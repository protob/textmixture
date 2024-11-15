import * as R from 'remeda';
import { createElevenLabsAudioAdapter } from '@adapters/api/elevenlabs-audio';
import { createFsAdapter } from '@adapters/common/fs-adapter';
import { DEFAULT_CONFIG } from '@models/app-config';
import { logger } from '@utils/logger';
import type { CharacterConfig } from '@models/yaml-metadata';
import type { ElevenLabsRequest } from '@models/audio';
import type { Result } from '@shared-types/result';
import { initializeConfig } from './helpers';

const findActiveCharacter = (config: { characters: CharacterConfig[] }): Result<CharacterConfig> => {
    const activeCharacter = R.pipe(
        config.characters,
        R.find(char => char.voiceSettings?.elevenlabs !== undefined)
    );

    return activeCharacter
        ? { ok: true, data: activeCharacter }
        : { ok: false, error: 'No character found with ElevenLabs voice configuration' };
};

const createAudioRequest = (
    voiceConfig: NonNullable<CharacterConfig['voiceSettings']['elevenlabs']>,
    text: string
): ElevenLabsRequest => ({
    provider: 'elevenlabs',
    text,
    voiceId: voiceConfig.voiceId,
    model: voiceConfig.modelId,
    settings: voiceConfig.settings,
});

const saveAudioFile = async (fsAdapter: ReturnType<typeof createFsAdapter>, data: Buffer): Promise<Result<string>> => {
    const outputDir = 'output/audio_tests';
    const outputPath = `${outputDir}/elevenlabs_test.mp3`;

    const dirResult = await fsAdapter.ensureDir(outputDir);
    if (!dirResult.ok) return dirResult;

    const saveResult = await fsAdapter.writeFile(outputPath, data);
    if (!saveResult.ok) return saveResult;

    logger.success('Audio saved to', { path: outputPath });
    return { ok: true, data: outputPath };
};

const handleError = (error: unknown) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Script execution failed', { error: errorMsg });
    return { success: false as const, error: errorMsg };
};

export const verifyAudioElevenLabs = async () => {
    try {
        logger.info('🔊 Verifying ElevenLabs audio generation...');

        const config = await initializeConfig();
        const charResult = findActiveCharacter(config);
        if (!charResult.ok) return handleError(charResult.error);

        const voiceConfig = charResult.data.voiceSettings.elevenlabs;
        if (!voiceConfig) return handleError('Voice config missing');

        const audioService = createElevenLabsAudioAdapter(
            DEFAULT_CONFIG.elevenlabs.apiKey,
            DEFAULT_CONFIG.elevenlabs.baseUrl
        );

        const audioResult = await audioService.generateAudio(
            createAudioRequest(
                voiceConfig,
                'Hello, this is a test of the ElevenLabs audio generation.'
            )
        );

        if (!audioResult.ok) return handleError(audioResult.error);
        logger.success('ElevenLabs audio generation succeeded');

        const saveResult = await saveAudioFile(createFsAdapter(), audioResult.data.data);
        if (!saveResult.ok) return handleError(saveResult.error);

        return !import.meta.main ? { success: true as const } : undefined;
    } catch (error) {
        if (import.meta.main) process.exit(1);
        return handleError(error);
    }
};

if (import.meta.main) {
    verifyAudioElevenLabs().catch(error => {
        logger.error('Unhandled error in verification:', { error });
        process.exit(1);
    });
}