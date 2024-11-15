import type { DialogueContent } from '@models/dialogue'
import type { Result } from '@shared-types/result'

export type TranslationRequest = {
    readonly content: DialogueContent
    readonly targetLanguage: string
    readonly sourceLanguage?: string
}

export type TranslatedLine = {
    readonly speaker: string
    readonly text: string
    readonly index: number
    readonly metadata: {
        readonly originalIndex: number
        readonly sourceLanguage: string
        readonly targetLanguage: string
    }
}

export type TranslatedContent = {
    readonly lines: readonly TranslatedLine[]
    readonly metadata: {
        readonly translated: true
        readonly sourceLanguage: string
        readonly targetLanguage: string
        readonly translatedAt: string
        readonly model: string
    }
}

export type TranslationResult = Result<TranslatedContent>