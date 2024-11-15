import * as R from 'remeda'
import { composePipelineSteps } from './compose-pipeline-steps'
import { createDSPMixdownStep } from '@steps/dsp-mixdown'
import { createDSPNormalizeStep } from '@steps/dsp-normalize'
import { createFFmpegAdapter } from '@adapters/dsp/ffmpeg-adapter'
import type { DSPContext } from '@steps/types-audio-context'
import type { NormalizeContext } from '@steps/dsp-normalize'
import type { Result } from '@shared-types/result'
import { logger } from '@utils/logger'

const getFileName = (path: string): string =>
    R.pipe(
        path,
        path => path.split('/'),
        parts => parts[parts.length - 1] || ''
    )

const logDSPResult = ({ mixdown, normalize }: NormalizeContext): void =>
    logger.success('✨ DSP Pipeline completed', {
        raw: getFileName(mixdown.path),
        normalized: getFileName(normalize.path),
        lufs: normalize.metadata.lufs
    })

export const runDSPPipeline = async (
    context: DSPContext,
    outputPath: string,
    language: 'en' | 'de',
    provider: string
): Promise<Result<NormalizeContext>> => {
    try {
        logger.info('🎛️ Starting DSP Pipeline', {
            segments: context.audio.segments.length,
            provider
        })

        const result = await R.pipe(
            createFFmpegAdapter(),
            dspAdapter => composePipelineSteps<DSPContext, NormalizeContext>(
                createDSPMixdownStep(dspAdapter, outputPath, language, provider),
                createDSPNormalizeStep(dspAdapter, outputPath, language, provider)
            ),
            pipeline => pipeline(context)
        )

        if (!result.ok) {
            return { ok: false, error: `DSP pipeline failed: ${result.error}` }
        }

        logDSPResult(result.data)
        return result

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        logger.error('DSP Pipeline failed', { error: msg })
        return { ok: false, error: msg }
    }
}