import * as R from 'remeda';
import path from 'path';
import type { OutputPort } from '@data-access/output-structure-port';
import type {
    OutputRequest,
    OutputStructureResult,
    SeriesInfo,
    OutputLanguage,
    AudioProvider,
    ProviderPaths,
    LanguagePaths,
    SeriesStructure
} from '@models/output-structure';
import type { SeriesConfig, EpisodeConfig } from '@models/yaml-metadata';



export const createOutputService = (outputPort: OutputPort) => ({
    getEpisodePath: (series: SeriesConfig, episode: EpisodeConfig): string => {
        const timestamp = new Date().toISOString().split('T')[0];
        return path.join('output', series.SeriesID, `ep${episode.epNumber}_${timestamp}`);
    },

    getProviderPath: (basePath: string, language: string, provider: string): string => {
        return path.join(basePath, language, provider);
    },

    ensureStructure: async ({ baseDir = 'output', info, languages, providers }: OutputRequest): Promise<OutputStructureResult> => {
        const structure = createSeriesStructure(baseDir, info, languages, providers);
        const dirResults = await Promise.all(getAllDirectoryPaths(structure).map(outputPort.ensureDir));
        const failure = R.find(dirResults, isFailure);
        return failure ?? { ok: true, data: structure };
    },
});

// Helper Functions
const createProviderPaths = (basePath: string, provider: AudioProvider): ProviderPaths => {
    const [SeriesID, EpisodeID] = [process.env.CURRENT_SERIES_ID, process.env.CURRENT_EPISODE_ID];
    const filePrefix = `ep${EpisodeID}_${SeriesID}`;

    return {
        root: basePath,
        processing: `${basePath}/processing`,
        segments: `${basePath}/segments`,
        normalized: provider !== 'mixed_providers' ? `${basePath}/${filePrefix}_${provider}_normalized.mp3` : undefined,
        raw: provider !== 'mixed_providers' ? `${basePath}/${filePrefix}_${provider}_raw.mp3` : undefined,
    };
};

const createLanguagePaths = (basePath: string, providers: readonly AudioProvider[]): LanguagePaths => ({
    root: basePath,
    dialogue: `${basePath}/dialogue.txt`,
    providers: R.mapToObj(providers, provider => [provider, createProviderPaths(`${basePath}/${provider}`, provider)]),
});

const createSeriesStructure = (
    baseDir: string,
    { seriesId, episodeNumber, date }: SeriesInfo,
    languages: readonly OutputLanguage[],
    providers: readonly AudioProvider[]
): SeriesStructure => {
    const episodeBase = `${baseDir}/${seriesId}/ep${episodeNumber}_${date}`;
    return {
        base: episodeBase,
        metadata: `${episodeBase}/metadata.json`,
        languages: R.mapToObj(languages, lang => [lang, createLanguagePaths(`${episodeBase}/${lang}`, providers)]),
    };
};

export const getAllDirectoryPaths = (structure: SeriesStructure): readonly string[] =>
    R.flatMap(Object.values(structure.languages), lang => [
        lang.root,
        ...R.flatMap(Object.values(lang.providers), provider => [
            provider.root,
            provider.processing,
            provider.segments
        ])
    ]);

const isFailure = (result: { ok: boolean; error?: string }): result is { ok: false; error: string } => !result.ok;
