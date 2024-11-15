import { createOutputAdapter } from '@adapters/common/output-structure-adapter'
import { createOutputService } from '@services/output-service'
import type { BaseContext, PipelineStep, WithContext } from './types'
import { logger } from '@utils/logger'

export type OutputPaths = {
    readonly outputPaths: {
        readonly base: string
        readonly metadata: string
        readonly languages: {
            readonly [lang in 'en' | 'de']: {
                readonly dialogue: string
            }
        }
    }
}

export type OutputPathsContext = WithContext<OutputPaths>

const createStructureConfig = (context: BaseContext) => ({
    info: {
        seriesId: context.config.series.SeriesID,
        episodeNumber: context.config.episode.epNumber,
        date: new Date().toISOString().split('T')[0]
    },
    languages: ['en', 'de'] as const,
    providers: ['openai', 'elevenlabs', 'mixed_providers'] as const
})

export const createEnsureStructureStep = (): PipelineStep<BaseContext, OutputPathsContext> => {
    const outputPort = createOutputAdapter()
    const outputService = createOutputService(outputPort)

    return async context => {
        logger.debug('Ensuring output structure')

        const result = await outputService.ensureStructure(createStructureConfig(context))
        return result.ok
            ? { ok: true, data: { ...context, outputPaths: result.data } }
            : result
    }
}
