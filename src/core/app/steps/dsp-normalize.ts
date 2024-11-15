import { join } from 'path'
import type { PipelineStep } from './types'
import type { MixdownContext } from './dsp-mixdown'
import type { DSPPort } from '@data-access/dsp-port'
import type { NormalizationSettings } from '@models/dsp'
import type { Result } from '@shared-types/result'
import { logger } from '@utils/logger'

const DEFAULT_NORMALIZATION: NormalizationSettings = {
    targetLUFS: -16.0,
    maxTruePeak: -1.0,
    ceiling: -0.1
}

export type NormalizeResult = {
    readonly path: string
    readonly metadata: {
        readonly timestamp: string
        readonly provider: string
        readonly lufs: number
        readonly settings: NormalizationSettings
    }
}

export type NormalizeContext = MixdownContext & {
    readonly normalize: NormalizeResult
}

const createNormalizedPath = (basePath: string, language: string, provider: string) => {
    const filePrefix = `${language}_${process.env.CURRENT_SERIES_ID}_${process.env.CURRENT_EPISODE_ID}`
    return join(basePath, language, provider, `${filePrefix}_${provider}_normalized.mp3`)
}

const createNormalizeResult = async (
    dspPort: DSPPort,
    inputPath: string,
    outputPath: string,
    provider: string
): Promise<Result<NormalizeResult>> => {
    const normalizeResult = await dspPort.normalizeAudio(inputPath, outputPath, DEFAULT_NORMALIZATION)
    if (!normalizeResult.ok) return { ok: false, error: `Failed to normalize audio: ${normalizeResult.error}` }

    const analysisResult = await dspPort.analyzeAudio(outputPath)
    if (!analysisResult.ok) return { ok: false, error: `Failed to analyze normalized audio: ${analysisResult.error}` }

    return {
        ok: true,
        data: {
            path: outputPath,
            metadata: {
                timestamp: new Date().toISOString(),
                provider,
                lufs: analysisResult.data.lufs,
                settings: DEFAULT_NORMALIZATION
            }
        }
    }
}

export const createDSPNormalizeStep = (
    dspPort: DSPPort,
    outputPath: string,
    language: string,
    provider: string
): PipelineStep<MixdownContext, NormalizeContext> => async context => {
    try {
        logger.info('Starting DSP normalization', { provider })

        const normalizeResult = await createNormalizeResult(
            dspPort,
            context.mixdown.path,
            createNormalizedPath(outputPath, language, provider),
            provider
        )

        if (!normalizeResult.ok) return normalizeResult

        return {
            ok: true,
            data: {
                ...context,
                normalize: normalizeResult.data
            }
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        logger.error('DSP normalization failed', { error: msg })
        return { ok: false, error: msg }
    }
}