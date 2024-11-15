// src/pure/domain/data-access/openai-port.ts
import type { AsyncResult } from '@shared-types/result'
import type { OpenAITextRequest } from '@models/openai'

export interface OpenAIPort {
    generateText: (request: OpenAITextRequest) => AsyncResult<{
        content: string
        role: 'assistant'
    }>
}