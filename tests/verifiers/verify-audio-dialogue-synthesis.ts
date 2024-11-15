import * as R from 'remeda';
import { join } from 'path';

import { createFsAdapter } from '@adapters/common/fs-adapter';
import { logger } from '@utils/logger';
import type { FileSystemPort } from '@data-access/fs-port';
import type { FullConfig, CharacterConfig } from '@models/yaml-metadata';
import type { AudioProviders } from '@data-access/audio-port';
import type { Result } from '@shared-types/result';
import type { AudioRequest } from '@models/audio';
import type { OpenAIVoice } from '@models/audio';

import {
    initializeConfig,
    createAudioProviders,
    ensureDirectories,
} from './helpers';

type Provider = 'openai' | 'elevenlabs';
type DialogueSegment = { characterId: string; provider: Provider; text: string };

const OUTPUT_STRUCTURE = {
    base: 'output',
    tests: 'output/audio_tests',
    dialogue: 'output/audio_tests/dialogue',
    providers: {
        openai: 'output/audio_tests/dialogue/openai',
        elevenlabs: 'output/audio_tests/dialogue/elevenlabs',
    },
} as const;

const prepareDirectories = async (fs: FileSystemPort) => {
    const paths = [
        OUTPUT_STRUCTURE.base,
        OUTPUT_STRUCTURE.tests,
        OUTPUT_STRUCTURE.dialogue,
        ...Object.values(OUTPUT_STRUCTURE.providers),
    ];
    await ensureDirectories(fs, paths);
};

const createTestDialogue = (config: FullConfig): DialogueSegment[] => {
    const speakers = R.pipe(
        config.characters,
        R.map((char) => char.name.toLowerCase()),
        R.take(2),
    );

    const testPairs: Array<[string, Provider]> = [
        [speakers[0], 'openai'],
        [speakers[1], 'elevenlabs'],
    ];

    return testPairs.map(([characterId, provider]) => ({
        characterId,
        provider,
        text: `Testing ${config.episode.title} synthesis with ${provider}`,
    }));
};

const getOutputPath = (segment: DialogueSegment, index: number): string =>
    join(
        OUTPUT_STRUCTURE.providers[segment.provider],
        `segment_${index + 1}_${segment.characterId}.mp3`,
    );

const createAudioRequest = (
    segment: DialogueSegment,
    settings: CharacterConfig['voiceSettings'],
    provider: Provider,
): AudioRequest => {
    const baseRequest = {
        text: segment.text,
        metadata: { characterId: segment.characterId },
    };

    return provider === 'openai'
        ? {
            ...baseRequest,
            provider: 'openai',
            voice: settings.openai!.voiceId as OpenAIVoice,
            model: settings.openai!.model || 'tts-1',
        }
        : {
            ...baseRequest,
            provider: 'elevenlabs',
            voiceId: settings.elevenlabs!.voiceId,
            modelId: settings.elevenlabs!.modelId,
            settings: settings.elevenlabs!.settings,
        };
};

const findCharacter = (characters: readonly CharacterConfig[], id: string) =>
    R.find(characters, (char) => char.name.toLowerCase() === id);

const processSegment = async (
    segment: DialogueSegment,
    index: number,
    config: FullConfig,
    providers: AudioProviders,
    fs: FileSystemPort,
): Promise<Result<{ path: string; provider: Provider; character: string }>> => {
    const character = findCharacter(config.characters, segment.characterId);
    if (!character)
        return { ok: false, error: `Character not found: ${segment.characterId}` };

    const settings = character.voiceSettings;
    if (!settings)
        return { ok: false, error: `No voice settings for ${segment.characterId}` };

    const request = createAudioRequest(segment, settings, segment.provider);
    const audioResult = await providers[segment.provider].generateAudio(request);
    if (!audioResult.ok) return { ok: false, error: audioResult.error };

    const outputPath = getOutputPath(segment, index);
    const writeResult = await fs.writeFile(outputPath, audioResult.data.data);

    return !writeResult.ok
        ? { ok: false, error: `Failed to save audio: ${writeResult.error}` }
        : {
            ok: true,
            data: {
                path: outputPath,
                provider: segment.provider,
                character: segment.characterId,
            },
        };
};

const processTestDialogue = async (
    testDialogue: DialogueSegment[],
    config: FullConfig,
    providers: AudioProviders,
    fsAdapter: FileSystemPort,
): Promise<Result<{ successes: Record<Provider, any[]>; failures: string[] }>> => {
    const results = await Promise.all(
        testDialogue.map((segment, index) =>
            processSegment(segment, index, config, providers, fsAdapter),
        ),
    );

    const failures = R.pipe(
        results,
        R.filter((r): r is { ok: false; error: string } => !r.ok),
        R.map((r) => r.error),
    );

    return failures.length > 0
        ? { ok: false, error: failures.join('\n') }
        : {
            ok: true,
            data: {
                successes: R.groupBy(
                    R.map(results, (r) => (r as any).data),
                    (data) => data.provider,
                ),
                failures,
            },
        };
};

export const verifyDialogueAudioSynthesis = async () => {
    try {
        logger.info('🎙️ Starting dialogue audio synthesis verification');
        const fsAdapter = createFsAdapter();
        await prepareDirectories(fsAdapter);
        const config = await initializeConfig();
        const providers = createAudioProviders();
        const testDialogue = createTestDialogue(config);

        logger.info('Processing test dialogue', {
            segments: testDialogue.map((d) => `${d.characterId} (${d.provider})`).join(', '),
        });

        const processResult = await processTestDialogue(testDialogue, config, providers, fsAdapter);
        if (!processResult.ok) {
            logger.error('Synthesis failed', { errors: processResult.error });
            if (!import.meta.main) {
                return { success: false, error: processResult.error };
            }
            process.exit(1);
        }

        logger.success('Audio synthesis completed', {
            byProvider: R.mapValues(processResult.data.successes, (segments) => ({
                count: segments.length,
                files: segments.map((s) => s.path.split('/').slice(-1)[0]),
            })),
        });

        if (!import.meta.main) {
            return { success: true };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Script execution failed', { error: errorMessage });

        if (!import.meta.main) {
            return { success: false, error: errorMessage };
        }
        process.exit(1);
    }
};

// Ensure promise handling
if (import.meta.main) {
    verifyDialogueAudioSynthesis().catch((error) => {
        logger.error('Unhandled error in verification', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    });
}

