import { runPrepareContentPipeline } from '@pipelines/prepare-content-pipeline'
import { runPrepareAudioPipeline } from '@pipelines/prepare-audio-pipeline'
import { runDSPPipeline } from '@pipelines/dsp-pipeline'
import {
    loadConfigAndPaths,
    ensureOutputStructure,
    checkSegmentsExist,
    loadExistingSegments,
} from './runner-helpers'
import type { DSPContext } from '@steps/types-audio-context'
import type { PipelineInputContext } from '@steps/types-audio-context'
import type { Result } from '@shared-types/result'
import { logger } from '@utils/logger'

export const SKIP_GENERATION_STEPS = false

const initializeContext = async (): Promise<Result<{
    context: PipelineInputContext
    outputPath: string
}>> => {
    const configResult = await loadConfigAndPaths()
    if (!configResult.ok) return { ok: false, error: configResult.error }

    return {
        ok: true,
        data: {
            context: {
                config: configResult.data.config,
                outputPath: configResult.data.outputPath,
                content: ''
            },
            outputPath: configResult.data.outputPath
        }
    }
}

const prepareContent = async (
    baseContext: PipelineInputContext
): Promise<Result<PipelineInputContext>> => {
    if (SKIP_GENERATION_STEPS) {
        logger.info('Using existing text content')
        return { ok: true, data: baseContext }
    }

    const contentResult = await runPrepareContentPipeline()
    if (!contentResult.ok) return { ok: false, error: contentResult.error }

    logger.info('Content generation completed')
    return {
        ok: true,
        data: { ...baseContext, ...contentResult.data }
    }
}

const prepareAudioContext = async (
    context: PipelineInputContext,
    outputPath: string,
    language: 'en' | 'de',
    provider: 'openai' | 'elevenlabs' | 'mixed_providers'
): Promise<Result<DSPContext>> => {
    const hasSegments = await checkSegmentsExist(outputPath, language, provider)

    if (!hasSegments) {
        logger.info('Starting audio generation')
        const audioResult = await runPrepareAudioPipeline(context, outputPath, language, provider)
        if (!audioResult.ok) return { ok: false, error: audioResult.error }
        return { ok: true, data: audioResult.data }
    }

    logger.info('Found existing audio segments, loading them for DSP')
    const existingAudio = await loadExistingSegments(outputPath, language, provider)
    if (!existingAudio.ok) return { ok: false, error: existingAudio.error }

    return {
        ok: true,
        data: {
            config: context.config,
            outputPath,
            content: context.content,
            audio: existingAudio.data
        }
    }
}

const handleError = (error: unknown): never => {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('Runner execution failed', { error: msg })
    process.exit(1)
}

export const runWithOpenAI = async (): Promise<void> => {
    try {
        logger.info('Starting OpenAI runner', {
            mode: SKIP_GENERATION_STEPS ? 'External API generation skipped' : 'Full generation'
        })

        const targetLanguage = 'de' as const
        const provider = 'openai' as const

        const initResult = await initializeContext()
        if (!initResult.ok) return handleError(initResult.error)
        const { context, outputPath } = initResult.data

        const structureResult = await ensureOutputStructure(outputPath, targetLanguage, provider)
        if (!structureResult.ok) return handleError(structureResult.error)

        const contentResult = await prepareContent(context)
        if (!contentResult.ok) return handleError(contentResult.error)

        const audioResult = await prepareAudioContext(
            contentResult.data,
            outputPath,
            targetLanguage,
            provider
        )
        if (!audioResult.ok) return handleError(audioResult.error)

        logger.info('Starting DSP processing')
        const dspResult = await runDSPPipeline(audioResult.data, outputPath, targetLanguage, provider)
        if (!dspResult.ok) return handleError(`DSP pipeline failed: ${dspResult.error}`)

        logger.success('OpenAI runner completed successfully')
    } catch (error) {
        handleError(error)
    }
}

if (import.meta.main) {
    runWithOpenAI().catch(handleError)
}