import type { Result } from '@shared-types/result'

export type AudioMetrics = {
    readonly duration: number
    readonly peakLevel: number
    readonly rmsLevel: number
    readonly lufs: number
}

export type AudioFormat = {
    readonly codec: string
    readonly sampleRate: number
    readonly channels: number
    readonly bitrate: string
}

export type NormalizationSettings = {
    readonly targetLUFS: number
    readonly maxTruePeak: number
    readonly ceiling: number
}

export type DSPSettings = {
    readonly format: AudioFormat
    readonly normalization: NormalizationSettings
}

export type DSPResult = Result<{    readonly outputPath: string
    readonly normalizedPath?: string
    readonly metrics: AudioMetrics
}>

export const DEFAULT_DSP_SETTINGS: DSPSettings = {
    format: {
        codec: 'libmp3lame',
        sampleRate: 44100,
        channels: 2,
        bitrate: '192k'
    },
    normalization: {
        targetLUFS: -16.0,
        maxTruePeak: -1.0,
        ceiling: -0.1
    }
}