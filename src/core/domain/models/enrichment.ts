import type { Result } from '@shared-types/result'

export type ContentAnalysis = {
    readonly categories: readonly string[]
    readonly tags: readonly string[]
    readonly keyTopics: readonly string[]
}

export type EnrichmentRequest = {
    readonly content: string
    readonly title: string
}

export type EnrichmentResult = Result<ContentAnalysis>