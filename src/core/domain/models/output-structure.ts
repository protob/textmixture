import type { Result } from '@shared-types/result'

export type OutputLanguage = 'en' | 'de'
export type AudioProvider = 'openai' | 'elevenlabs' | 'mixed_providers'

export type ProviderPaths = {
    readonly root: string
    readonly processing: string
    readonly segments: string
    readonly normalized?: string
    readonly raw?: string
}

export type LanguagePaths = {
    readonly root: string
    readonly dialogue: string
    readonly providers: Record<AudioProvider, ProviderPaths>
}

export type SeriesStructure = {
    readonly base: string
    readonly metadata: string
    readonly languages: Record<OutputLanguage, LanguagePaths>
}

export type SeriesInfo = {
    readonly seriesId: string
    readonly episodeNumber: number
    readonly date: string
}

export type OutputRequest = {
    readonly info: SeriesInfo
    readonly languages: readonly OutputLanguage[]
    readonly providers: readonly AudioProvider[]
    readonly baseDir?: string
}

export type OutputStructureResult = Result<SeriesStructure>