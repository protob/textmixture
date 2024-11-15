import type { Result } from '@shared-types/result'

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
export type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac'
export type AudioProvider = 'openai' | 'elevenlabs'

export type ElevenLabsSettings = {
    readonly stability: number
    readonly similarityBoost: number
    readonly style?: number
    readonly useSpeakerBoost?: boolean
}

type BaseRequest = {
    readonly text: string
    readonly format?: AudioFormat
    readonly model?: string
    readonly metadata?: Record<string, unknown>
}

export type OpenAIRequest = BaseRequest & {
    readonly provider: 'openai'
    readonly voice: OpenAIVoice
}

export type ElevenLabsRequest = BaseRequest & {
    readonly provider: 'elevenlabs';
    readonly voiceId: string;
    readonly modelId?: string; // Change 'model' to 'modelId'
    readonly settings?: ElevenLabsSettings;
};

export type AudioRequest = OpenAIRequest | ElevenLabsRequest

export type AudioData = {
    readonly data: Buffer
    readonly metadata: {
        readonly provider: AudioProvider
        readonly voiceId: string
        readonly timestamp: string
        readonly settings?: ElevenLabsSettings
        readonly [key: string]: unknown
    }
}

export type AudioResult = Result<AudioData>