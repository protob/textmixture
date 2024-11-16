import { runPrepareContentPipeline } from '@pipelines/prepare-content-pipeline';
import { runPrepareAudioPipeline } from '@pipelines/prepare-audio-pipeline';
import { runDSPPipeline } from '@pipelines/dsp-pipeline';
import {
    loadConfigAndPaths,
    ensureOutputStructure,
    checkSegmentsExist,
    loadExistingSegments,
} from './runner-helpers';
import type { DSPContext } from '@steps/types-audio-context';
import type { Result } from '@shared-types/result';
import { logger } from '@utils/logger';

export const SKIP_GENERATION_STEPS = false;

const handleError = (error: unknown): never => {
    logger.error('Runner execution failed', {
        error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
};

const prepareContent = async (context: { config: any, outputPath: string, content: string }): Promise<Result<typeof context>> => {
    if (SKIP_GENERATION_STEPS) {
        logger.info('Using existing text content');
        return { ok: true, data: context };
    }

    const contentResult = await runPrepareContentPipeline();
    if (!contentResult.ok) return contentResult;

    logger.info('Content generation completed');
    return { ok: true, data: { ...context, ...contentResult.data } };
};

const prepareAudioContext = async (
    context: { config: any, outputPath: string, content: string },
    targetLanguage: 'de' | 'en',
    provider: 'elevenlabs' | 'openai'
): Promise<Result<DSPContext>> => {
    const hasSegments = await checkSegmentsExist(context.outputPath, targetLanguage, provider);

    if (!hasSegments) {
        logger.info('Starting audio generation');
        return await runPrepareAudioPipeline(context, context.outputPath, targetLanguage, provider);
    }

    logger.info('Found existing audio segments, loading them for DSP');
    const existing = await loadExistingSegments(context.outputPath, targetLanguage, provider);
    if (!existing.ok) return existing;

    return { ok: true, data: { ...context, audio: existing.data } };
};

export const runWithElevenLabs = async () => {
    try {
        logger.info('Starting ElevenLabs runner', {
            mode: SKIP_GENERATION_STEPS ? 'External API generation skipped' : 'Full generation'
        });

        const targetLanguage = 'de' as const;
        const provider = 'elevenlabs' as const;

        const configResult = await loadConfigAndPaths();
        if (!configResult.ok) return handleError(configResult.error);

        const { config, outputPath } = configResult.data;
        const structureResult = await ensureOutputStructure(outputPath, targetLanguage, provider);
        if (!structureResult.ok) return handleError(structureResult.error);

        const baseContext = { config, outputPath, content: '' };
        const contentResult = await prepareContent(baseContext);
        if (!contentResult.ok) return handleError(contentResult.error);

        const audioResult = await prepareAudioContext(contentResult.data, targetLanguage, provider);
        if (!audioResult.ok) return handleError(audioResult.error);

        logger.info('Starting DSP processing');
        const dspResult = await runDSPPipeline(audioResult.data, outputPath, targetLanguage, provider);
        if (!dspResult.ok) return handleError(dspResult.error);

        logger.success('ElevenLabs runner completed successfully');
    } catch (error) {
        handleError(error);
    }
};

if (import.meta.main) {
    runWithElevenLabs().catch(handleError);
}