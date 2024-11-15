import { join } from 'path';
import * as R from 'remeda';
import { createOpenAIAudioAdapter } from '@adapters/api/openai-audio';
import { createAudioService } from '@services/audio-service';
import { DEFAULT_CONFIG } from '@models/app-config';
import { createFsAdapter } from '@adapters/common/fs-adapter';
import { logger } from '@utils/logger';
import type { OpenAIRequest, OpenAIVoice } from '@models/audio';

const OUTPUT_DIR = 'output/audio_tests';

const createAudioRequest = (): OpenAIRequest => ({
    provider: 'openai' as const,
    text: 'Hello, this is a test of the OpenAI text-to-speech API.',
    voice: 'nova' as OpenAIVoice,
    metadata: { purpose: 'testing' }
});

const createServices = () => {
    const fsAdapter = createFsAdapter();
    const audioService = R.pipe(
        DEFAULT_CONFIG.openai,
        ({ apiKey, baseUrl }) => createOpenAIAudioAdapter(apiKey, baseUrl),
        createAudioService
    );
    return { fsAdapter, audioService };
};

const saveGeneratedAudio = async (fsAdapter: ReturnType<typeof createFsAdapter>, audioData: Buffer) => {
    await fsAdapter.ensureDir(OUTPUT_DIR);
    const writeResult = await fsAdapter.writeFile(join(OUTPUT_DIR, 'openai_test.mp3'), audioData);

    if (!writeResult.ok) {
        logger.error('Failed to save audio file', { error: writeResult.error });
        return { ok: false as const, error: writeResult.error };
    }

    logger.success('Audio generation and saving succeeded', { outputPath: writeResult.data });
    return { ok: true as const };
};

const handleError = (error: unknown): { success: false; error: string } => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Script execution failed', { error: errorMsg });
    return { success: false, error: errorMsg };
};

export const verifyAudioOpenAI = async () => {
    try {
        logger.info('🔊 Starting OpenAI audio verification');
        const { audioService, fsAdapter } = createServices();

        const result = await audioService.generateAudio(createAudioRequest());
        if (!result.ok) {
            logger.error('Audio generation failed', { error: result.error });
            return !import.meta.main ? { success: false, error: result.error } : process.exit(1);
        }

        const saveResult = await saveGeneratedAudio(fsAdapter, result.data.data);
        if (!saveResult.ok) {
            return !import.meta.main
                ? { success: false, error: saveResult.error }
                : process.exit(1);
        }

        return !import.meta.main ? { success: true } : undefined;
    } catch (error) {
        if (import.meta.main) process.exit(1);
        return handleError(error);
    }
};

if (import.meta.main) verifyAudioOpenAI();