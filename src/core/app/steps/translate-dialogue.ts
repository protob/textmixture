import { createOpenAIAdapter } from '@adapters/api/openai'
import { createTranslationService } from '@services/translation-service'
import { DEFAULT_CONFIG } from '@models/app-config'
import type { DialogueLine } from '@models/dialogue'
import type { PipelineStep } from './types'
import type { EnrichmentContext } from './enrich-metadata'
import { logger } from '@utils/logger'

export type TranslationData = {
    readonly translation: {
        readonly lines: readonly DialogueLine[]
        readonly metadata: Record<string, unknown>
    }
}

export type TranslationContext = EnrichmentContext & TranslationData

export const createTranslateDialogueStep = (): PipelineStep<EnrichmentContext, TranslationContext> => {
    const translationService = createTranslationService(
        createOpenAIAdapter(DEFAULT_CONFIG.openai.apiKey, DEFAULT_CONFIG.openai.baseUrl)
    )

    return async (context) => {
        logger.debug('Translating dialogue')

        const result = await translationService.translateDialogue({
            content: context.dialogue,
            targetLanguage: 'de',
        })

        return result.ok
            ? { ok: true, data: { ...context, translation: result.data } }
            : result
    }
}