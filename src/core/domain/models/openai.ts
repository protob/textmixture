export type OpenAIModelConfig = {
    readonly name: string
    readonly temperature: number
    readonly maxTokens: number
    readonly stop?: readonly string[]
}


export type OpenAIMessage = {
    readonly role: 'system' | 'user' | 'assistant'
    readonly content: string
}

export type OpenAITextRequest = {
    readonly messages: OpenAIMessage[]
    readonly model: string
    readonly temperature?: number
    readonly maxTokens?: number
    readonly stop?: string[]
}

export type OpenAITextResponse = {
    readonly content: string
    readonly role: 'assistant'
}