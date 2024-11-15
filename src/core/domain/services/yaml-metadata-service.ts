import type { MetadataPort } from '@data-access/metadata-port';
import type { Result, AsyncResult } from '@shared-types/result';
import {
    currentConfigSchema,
    characterConfigSchema,
    styleConfigSchema,
    seriesConfigSchema,
    episodeConfigSchema,
} from '@models/schemas/yaml-metadata-schema';
import type { FullConfig } from '@models/yaml-metadata';

const isSuccess = <T>(r: Result<T>): r is { ok: true; data: T } => r.ok;

const basePath = 'metadata/production/';
const buildPath = (...segments: string[]) => `${basePath}${segments.join('/')}`;

const loadConfigPaths = (config: MetadataPort, chars: string[], style: string, series: string, ep: string) => {
    const characterPaths = chars.map(c => buildPath('characters', `${c}.yaml`));

    return Promise.all([
        config.loadMany(characterPaths, characterConfigSchema),
        config.loadConfig(buildPath('dialogue', 'styles', `${style}.yaml`), styleConfigSchema),
        config.loadConfig(buildPath('series', series, 'series.yaml'), seriesConfigSchema),
        config.loadConfig(buildPath('series', series, 'episodes', `${ep}.yaml`), episodeConfigSchema)
    ]);
};

export const createYamlMetadataService = (MetadataPort: MetadataPort) => ({
    loadFullConfig: async (): AsyncResult<FullConfig> => {
        const currentResult = await MetadataPort.loadConfig(
            buildPath('current.yaml'),
            currentConfigSchema
        );

        if (!isSuccess(currentResult)) return currentResult;

        const { Characters, StyleID, SeriesID, EpisodeID } = currentResult.data;

        const [charactersResult, styleResult, seriesResult, episodeResult] =
            await loadConfigPaths(MetadataPort, Characters, StyleID, SeriesID, EpisodeID);

        if (!isSuccess(charactersResult)) return charactersResult;
        if (!isSuccess(styleResult)) return styleResult;
        if (!isSuccess(seriesResult)) return seriesResult;
        if (!isSuccess(episodeResult)) return episodeResult;

        return {
            ok: true,
            data: {
                current: currentResult.data,
                characters: charactersResult.data,
                style: styleResult.data,
                series: seriesResult.data,
                episode: episodeResult.data,
            }
        };
    }
});