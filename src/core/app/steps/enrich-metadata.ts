import * as R from 'remeda'
import { createOpenAIAdapter } from '@adapters/api/openai'
import { createEnrichmentService } from '@services/enrichment-service'
import { DEFAULT_CONFIG } from '@models/app-config'
import type { PipelineStep } from './types'
import type { DialogueContext } from './generate-dialogue'
import { logger } from '@utils/logger'

export type EnrichmentData = {
    readonly enrichment: {
        readonly categories: readonly string[]
        readonly tags: readonly string[]
        readonly keyTopics: readonly string[]
    }
}

export type EnrichmentContext = DialogueContext & EnrichmentData

const formatDialogue = (lines: readonly { speaker: string, text: string }[]): string =>
    R.pipe(
        lines,
        R.map(line => `${line.speaker}: ${line.text}`),
        R.join('\n')
    )

export const createEnrichMetadataStep = (): PipelineStep<DialogueContext, EnrichmentContext> => {
    const enrichmentService = R.pipe(
        DEFAULT_CONFIG.openai,
        ({ apiKey, baseUrl }) => createOpenAIAdapter(apiKey, baseUrl),
        createEnrichmentService
    )

    return async context => {
        logger.debug('Enriching metadata')

        const result = await enrichmentService.enrichContent({
            content: formatDialogue(context.dialogue.lines),
            title: context.config.episode.title
        })

        return result.ok
            ? { ok: true, data: { ...context, enrichment: result.data } }
            : result
    }
}