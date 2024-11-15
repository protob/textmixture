import type { AudioProvider } from './audio'
import type { DialogueLine } from './dialogue'

export type TimelineSegment = {
    readonly index: number
    readonly characterId: string
    readonly provider: AudioProvider
    readonly text: string
    readonly timestamp?: string
}

export type AudioTimeline = {
    readonly segments: readonly TimelineSegment[]
    readonly metadata: {
        readonly timestamp: string
        readonly totalSegments: number
        readonly speakers: readonly string[]
        readonly providers: readonly AudioProvider[]
    }
}

export type SegmentPath = {
    readonly path: string
    readonly provider: AudioProvider
    readonly index: number
    readonly characterId: string
}

export type AudioSynthesisResult = {
    readonly segments: readonly SegmentPath[]
    readonly metadata: {
        readonly timestamp: string
        readonly totalSegments: number
        readonly speakers: readonly string[]
        readonly providers: readonly AudioProvider[]
    }
}

// Maps dialogue to timeline segments with proper provider assignment
export const createAudioTimeline = (
    dialogue: readonly DialogueLine[],
    speakerProviders: Record<string, AudioProvider>
): AudioTimeline => {
    const segments = dialogue.map((line, index) => ({
        index,
        characterId: line.speaker.toLowerCase(),
        provider: speakerProviders[line.speaker.toLowerCase()],
        text: line.text,
        timestamp: new Date().toISOString()
    }));

    const speakers = Array.from(new Set(segments.map(s => s.characterId)));
    const providers = Array.from(new Set(segments.map(s => s.provider)));

    return {
        segments,
        metadata: {
            timestamp: new Date().toISOString(),
            totalSegments: segments.length,
            speakers,
            providers
        }
    };
};