// src/pure/domain/models/app-config.ts
import type { OpenAIModelConfig } from '@models/openai'

export type AppConfig = {
    readonly openai: {
        readonly textModel: OpenAIModelConfig
        readonly apiKey: string
        readonly baseUrl: string
    }
    readonly elevenlabs: {
        readonly apiKey: string
        readonly baseUrl: string
    }
}

// This could be loaded from env or file in the future
export const DEFAULT_CONFIG: AppConfig = {
    openai: {
        textModel: {
            name: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 1500,
        },
        apiKey: process.env.OPENAI_API_KEY!,
        baseUrl: 'https://api.openai.com/v1'
    },
    elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY!,
        baseUrl: 'https://api.elevenlabs.io/v1'
    }
} as const