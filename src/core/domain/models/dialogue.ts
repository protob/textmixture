import type { Result } from '@shared-types/result'

export type DialogueLine = {
    readonly speaker: string
    readonly text: string
    readonly index: number
    readonly metadata: Record<string, unknown>
}

export type DialogueContent = {
    readonly lines: readonly DialogueLine[]
    readonly metadata: Record<string, unknown>
}

export type DialogueRequest = {
    readonly systemPrompt: string
    readonly userPrompt: string
    readonly options?: {
        readonly model?: string
        readonly temperature?: number
        readonly maxTokens?: number
    }
}

export type DialogueResult = Result<DialogueContent>