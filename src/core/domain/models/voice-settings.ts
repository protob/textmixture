import type { OpenAIVoice } from './audio'

export type OpenAIVoiceSettings = {
    readonly provider: 'openai'
    readonly voice:  OpenAIVoice
    readonly model?: string
}

export type ElevenLabsVoiceSettings = {
    readonly provider: 'elevenlabs'
    readonly voiceId: string
    readonly modelId?: string
    readonly settings: {
        readonly stability: number
        readonly similarityBoost: number
        readonly style: number
        readonly useSpeakerBoost: boolean
    }
}

export type VoiceSettings = OpenAIVoiceSettings | ElevenLabsVoiceSettings