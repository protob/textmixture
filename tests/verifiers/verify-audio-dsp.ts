import * as R from 'remeda';
import { join } from 'path';
import { createFsAdapter } from '@adapters/common/fs-adapter';
import { createFFmpegAdapter } from '@adapters/dsp/ffmpeg-adapter';
import { DEFAULT_DSP_SETTINGS } from '@models/dsp';
import { logger } from '@utils/logger';

import type { FileSystemPort } from '@data-access/fs-port';
import type { FullConfig } from '@models/yaml-metadata';
import type { AudioProviders } from '@data-access/audio-port';
import type { Result } from '@shared-types/result';
import type { AudioRequest, OpenAIVoice } from '@models/audio';
import type { DSPPort } from '@data-access/dsp-port';

import {
    initializeConfig,
    createAudioProviders,
    ensureDirectories,
} from './helpers';

type GenerateResult = Result<{ paths: string[] }>;

const PATHS = {
    test: {
        base: 'output/audio_tests/dsp_test',
        openai: 'output/audio_tests/dsp_test/openai',
        elevenlabs: 'output/audio_tests/dsp_test/elevenlabs',
    },
    output: {
        base: 'output/audio_tests',
        raw: 'mix_raw.mp3',
        normalized: 'mix_normalized.mp3',
    },
} as const;

const TEST_DIALOGUE = [
    {
        characterId: 'alice',
        provider: 'openai' as const,
        text: 'Testing DSP pipeline, segment one.',
    },
    {
        characterId: 'bob',
        provider: 'elevenlabs' as const,
        text: 'Testing DSP pipeline, segment two.',
    },
    {
        characterId: 'alice',
        provider: 'openai' as const,
        text: 'Testing DSP pipeline, final segment.',
    },
] as const;

const prepareDirectories = async (fsAdapter: FileSystemPort) =>
    ensureDirectories(fsAdapter, [
        PATHS.test.base,
        PATHS.test.openai,
        PATHS.test.elevenlabs,
        PATHS.output.base,
    ]);

const buildAudioRequest = (line: typeof TEST_DIALOGUE[number], character: any): AudioRequest => {
    const settings = character.voiceSettings[line.provider];
    return line.provider === 'openai'
        ? {
            provider: 'openai',
            text: line.text,
            voice: settings.voiceId as OpenAIVoice,
            model: settings.model || 'tts-1',
            metadata: { characterId: line.characterId },
        }
        : {
            provider: 'elevenlabs',
            text: line.text,
            voiceId: settings.voiceId,
            modelId: settings.modelId,
            settings: settings.settings,
            metadata: { characterId: line.characterId },
        };
};

const generateTestSegments = async (
    config: FullConfig,
    fsAdapter: FileSystemPort,
    providers: AudioProviders,
): Promise<GenerateResult> => {
    const results = await Promise.all(
        TEST_DIALOGUE.map(async (line, index) => {
            const character = R.find(config.characters, (char) => char.name.toLowerCase() === line.characterId);
            if (!character) return { ok: false as const, error: `Character not found: ${line.characterId}` };

            const settings = character.voiceSettings[line.provider];
            if (!settings) return { ok: false as const, error: `No ${line.provider} settings for ${line.characterId}` };

            const request = buildAudioRequest(line, character);

            const audioResult = await providers[line.provider].generateAudio(request);
            if (!audioResult.ok) return { ok: false as const, error: audioResult.error };

            const outputPath = join(PATHS.test[line.provider], `segment_${index + 1}_${line.characterId}.mp3`);

            const writeResult = await fsAdapter.writeFile(outputPath, audioResult.data.data);
            if (!writeResult.ok) return { ok: false as const, error: `Failed to save segment: ${writeResult.error}` };

            return { ok: true as const, path: outputPath };
        }),
    );

    const failures = R.pipe(
        results,
        R.filter((r): r is { ok: false; error: string } => !r.ok),
        R.map((r) => r.error),
    );

    if (failures.length > 0) return { ok: false, error: failures.join('\n') };

    const paths = R.pipe(
        results,
        R.filter((r): r is { ok: true; path: string } => r.ok),
        R.map((r) => r.path),
    );

    return { ok: true, data: { paths } };
};

const processDSP = async (
    dspAdapter: DSPPort,
    segments: string[],
): Promise<void> => {
    // Create raw mix
    const rawMixPath = join(PATHS.output.base, PATHS.output.raw);
    const mergeResult = await dspAdapter.mergeAudio(segments, rawMixPath, DEFAULT_DSP_SETTINGS.format);
    if (!mergeResult.ok) throw new Error(`Failed to merge segments: ${mergeResult.error}`);

    const rawAnalysis = await dspAdapter.analyzeAudio(rawMixPath);
    if (!rawAnalysis.ok) throw new Error(`Failed to analyze raw mix: ${rawAnalysis.error}`);

    logger.info('Created raw mix', { file: PATHS.output.raw, metrics: rawAnalysis.data });

    // Create normalized version
    const normalizedPath = join(PATHS.output.base, PATHS.output.normalized);
    const normalizeResult = await dspAdapter.normalizeAudio(rawMixPath, normalizedPath, DEFAULT_DSP_SETTINGS.normalization);
    if (!normalizeResult.ok) throw new Error(`Failed to normalize mix: ${normalizeResult.error}`);

    const normalizedAnalysis = await dspAdapter.analyzeAudio(normalizedPath);
    if (!normalizedAnalysis.ok) throw new Error(`Failed to analyze normalized mix: ${normalizedAnalysis.error}`);

    logger.success('DSP processing completed', {
        raw: { file: PATHS.output.raw, metrics: rawAnalysis.data },
        normalized: {
            file: PATHS.output.normalized,
            metrics: normalizedAnalysis.data,
            targetLUFS: DEFAULT_DSP_SETTINGS.normalization.targetLUFS,
        },
    });
};

export const verifyDSP = async () => {
    try {
        logger.info('🎛️ Starting DSP verification');

        const fsAdapter = createFsAdapter();
        const dspAdapter = createFFmpegAdapter();

        await prepareDirectories(fsAdapter);

        const config = await initializeConfig();

        const providers = createAudioProviders();

        const segmentsResult = await generateTestSegments(config, fsAdapter, providers);
        if (!segmentsResult.ok) {
            logger.error('Failed to generate segments', { error: segmentsResult.error });
            return { success: false, error: segmentsResult.error }; // Return directly instead of throwing
        }

        logger.info('Generated segments', {
            count: segmentsResult.data.paths.length,
            files: segmentsResult.data.paths.map((p) => p.split('/').pop()),
        });

        await processDSP(dspAdapter, segmentsResult.data.paths);

        // Return success for external test runner
        if (!import.meta.main) return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('DSP verification failed', { error: errorMessage });

        // Return failure for external test runner
        if (!import.meta.main)
            return { success: false, error: errorMessage };
        process.exit(1);
    }
};

if (import.meta.main) {
    verifyDSP().catch(error => {
        logger.error('Unhandled error in DSP verification', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    });
}
