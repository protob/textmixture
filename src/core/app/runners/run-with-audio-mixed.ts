import { runPrepareContentPipeline } from '@pipelines/prepare-content-pipeline';
import { runPrepareAudioPipeline } from '@pipelines/prepare-audio-pipeline';
import { runDSPPipeline } from '@pipelines/dsp-pipeline';
import * as R from 'remeda';
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

const initializeContext = async () => {
    const configResult = await loadConfigAndPaths();
    return configResult.ok
        ? R.pipe(configResult.data, ({ config, outputPath }) => ({
            context: { config, outputPath, content: '' },
            targetLanguage: 'de' as const,
            provider: 'mixed_providers' as const,
            outputPath
        }))
        : Promise.reject(new Error(configResult.error));
};

const prepareContent = async (context: { config: any, outputPath: string, content: string }): Promise<Result<typeof context>> => {
    if (SKIP_GENERATION_STEPS) {
        logger.info('Using existing text content');
        return { ok: true, data: context };
    }

    const contentResult = await runPrepareContentPipeline();
    if (!contentResult.ok) return { ok: false, error: `Content pipeline failed: ${contentResult.error}` };

    logger.info('Content generation completed');
    return { ok: true, data: { ...context, ...contentResult.data } };
};

const prepareAudioContext = async (
    context: { config: any, outputPath: string, content: string },
    targetLanguage: 'de' | 'en',
    provider: 'mixed_providers'
): Promise<Result<DSPContext>> => {
    const hasSegments = await checkSegmentsExist(context.outputPath, targetLanguage, provider);

    if (!hasSegments) {
        logger.info('Starting audio generation');
        const audioResult = await runPrepareAudioPipeline(context, context.outputPath, targetLanguage, provider);
        return audioResult.ok
            ? { ok: true, data: audioResult.data }
            : { ok: false, error: `Audio pipeline failed: ${audioResult.error}` };
    }

    logger.info('Found existing audio segments, loading them for DSP');
    const existingAudio = await loadExistingSegments(context.outputPath, targetLanguage, provider);

    return existingAudio.ok
        ? {
            ok: true,
            data: {
                config: context.config,
                outputPath: context.outputPath,
                content: context.content,
                audio: existingAudio.data,
            }
        }
        : { ok: false, error: `Failed to load existing segments: ${existingAudio.error}` };
};

export const runWithMixed = async (): Promise<void> => {
    logger.info('Starting Mixed Providers runner', {
        mode: SKIP_GENERATION_STEPS ? 'External API generation skipped' : 'Full generation',
    });

    try {
        const { context, targetLanguage, provider, outputPath } = await initializeContext();

        const structureResult = await ensureOutputStructure(outputPath, targetLanguage, provider);
        if (!structureResult.ok) return Promise.reject(new Error(structureResult.error));

        const contentResult = await prepareContent(context);
        if (!contentResult.ok) return Promise.reject(new Error(contentResult.error));

        const audioResult = await prepareAudioContext(contentResult.data, targetLanguage, provider);
        if (!audioResult.ok) return Promise.reject(new Error(audioResult.error));

        logger.info('Starting DSP processing');
        const dspResult = await runDSPPipeline(audioResult.data, outputPath, targetLanguage, provider);

        if (!dspResult.ok) return Promise.reject(new Error(`DSP pipeline failed: ${dspResult.error}`));

        logger.success('Mixed providers runner completed successfully');
    } catch (error) {
        logger.error('Runner execution failed', {
            error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
    }
};

if (import.meta.main) {
    runWithMixed().catch(error => {
        logger.error('Unhandled error in mixed providers runner', {
            error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
    });
}