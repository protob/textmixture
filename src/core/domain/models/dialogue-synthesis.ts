import type { Result } from '@shared-types/result'
import type { AudioProvider } from '@models/audio'

export type DialogueLineInput = {
    readonly characterId: string
    readonly provider: AudioProvider
    readonly text: string
}

export type DialogueSynthesisResult = Result<{
    readonly paths: readonly string[]
    readonly metadata: {
        readonly timestamp: string
        readonly totalSegments: number
        readonly providers: readonly AudioProvider[]
    }
}>