import * as R from 'remeda'
import type { OutputPort } from '@data-access/output-structure-port'
import type {
    OutputRequest,
    OutputStructureResult,
    SeriesInfo,
    OutputLanguage,
    AudioProvider,
    ProviderPaths,
    LanguagePaths,
    SeriesStructure
} from '@models/output-structure'

const createProviderPaths = (basePath: string, provider: AudioProvider): ProviderPaths => {
    const [SeriesID, EpisodeID] = [process.env.CURRENT_SERIES_ID, process.env.CURRENT_EPISODE_ID]
    const filePrefix = `de_ep${EpisodeID}_${SeriesID}`

    return {
        root: basePath,
        processing: `${basePath}/processing`,
        segments: `${basePath}/segments`,
        normalized: provider !== 'mixed_providers' ? `${basePath}/${filePrefix}_${provider}_normalized.mp3` : undefined,
        raw: provider !== 'mixed_providers' ? `${basePath}/${filePrefix}_${provider}_raw.mp3` : undefined,
    }
}

const createLanguagePaths = (basePath: string, providers: readonly AudioProvider[]): LanguagePaths => ({
    root: basePath,
    dialogue: `${basePath}/dialogue.txt`,
    providers: R.mapToObj(providers, provider => [provider, createProviderPaths(`${basePath}/${provider}`, provider)])
})

const createSeriesStructure = (
    baseDir: string,
    { seriesId, episodeNumber, date }: SeriesInfo,
    languages: readonly OutputLanguage[],
    providers: readonly AudioProvider[]
): SeriesStructure => {
    const episodeBase = `${baseDir}/${seriesId}/ep${episodeNumber}_${date}`
    return {
        base: episodeBase,
        metadata: `${episodeBase}/metadata.json`,
        languages: R.mapToObj(languages, lang => [lang, createLanguagePaths(`${episodeBase}/${lang}`, providers)])
    }
}

const getAllDirectoryPaths = (structure: SeriesStructure): readonly string[] =>
    R.flatMap(Object.values(structure.languages), lang => [
        lang.root,
        ...R.flatMap(Object.values(lang.providers), provider => [
            provider.root,
            provider.processing,
            provider.segments
        ])
    ])


const isFailure = (result: { ok: boolean; error?: string }): result is { ok: false; error: string } => !result.ok

export const createOutputService = (outputPort: OutputPort) => ({
    ensureStructure: async ({
                                baseDir = 'output',
                                info,
                                languages,
                                providers
                            }: OutputRequest): Promise<OutputStructureResult> => {
        const structure = createSeriesStructure(baseDir, info, languages, providers)
        const dirResults = await Promise.all(getAllDirectoryPaths(structure).map(outputPort.ensureDir))

        const failure = R.find(dirResults, isFailure)

        return failure ?? { ok: true, data: structure }
    }
})
