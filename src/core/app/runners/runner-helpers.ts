import * as R from 'remeda';
import { createYamlMetadataAdapter } from '@adapters/loaders/yaml-metadata-loader';
import { createYamlMetadataService } from '@services/yaml-metadata-service';
import { createYamlMetadataStore } from '@store/yaml-metadata-store';
import { createOutputService } from '@services/output-service';

import { createFsAdapter } from '@adapters/common/fs-adapter';
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { Result } from '@shared-types/result';
import type { PipelineInputContext } from '@steps/types-audio-context';
import type { AudioData } from '@steps/types-audio-context';
import { logger } from '@utils/logger';
import { createOutputAdapter } from '@adapters/common/output-structure-adapter';

export const loadConfigAndPaths = async (): Promise<Result<PipelineInputContext>> => {
    try {
        const store = R.pipe(
            createYamlMetadataAdapter(),
            createYamlMetadataService,
            createYamlMetadataStore
        );

        const initResult = await store.initialize();
        if (!initResult.ok) return { ok: false, error: `Failed to initialize config: ${initResult.error}` };

        const configResult = store.getFullConfig();
        if (!configResult.ok) return { ok: false, error: `Failed to get config: ${configResult.error}` };

        const outputPort = createOutputAdapter();
        const outputService = createOutputService(outputPort);
        const outputPath = outputService.getEpisodePath(
            configResult.data.series,
            configResult.data.episode
        );

        return {
            ok: true,
            data: { config: configResult.data, outputPath, content: '' }
        };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export const ensureOutputStructure = async (
    _outputPath: string,
    language: 'en' | 'de',
    provider: 'openai' | 'elevenlabs' | 'mixed_providers'
): Promise<Result<void>> => {
    try {
        const outputPort = createOutputAdapter();
        const outputService = createOutputService(outputPort);
        const result = await outputService.ensureStructure({
            info: {
                seriesId: process.env.CURRENT_SERIES_ID as string,
                episodeNumber: 1,
                date: new Date().toISOString().split('T')[0]
            },
            languages: [language],
            providers: [provider]
        });

        return result.ok ? { ok: true, data: undefined } : result;
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export const checkSegmentsExist = async (
    basePath: string,
    language: string,
    provider: 'openai' | 'elevenlabs' | 'mixed_providers'
): Promise<boolean> => {
    const result = await createFsAdapter().listDir(join(basePath, language, provider, 'segments'))
        .catch(() => ({ ok: false, data: [] }));
    return result.ok && result.data.length > 0;
}

const parseSegmentFile = (
    file: string,
    segmentsPath: string,
    provider: 'openai' | 'elevenlabs' | 'mixed_providers'
) => {
    const match = file.match(/segment_(\d+)_([a-z]+)\.mp3/i);
    if (!match) return null;

    const segmentProvider = provider === 'mixed_providers'
        ? (parseInt(match[1], 10) % 2 === 0 ? 'openai' : 'elevenlabs')
        : provider as 'openai' | 'elevenlabs';

    return {
        path: join(segmentsPath, file),
        provider: segmentProvider,
        characterId: match[2].toLowerCase()
    };
}

export const loadExistingSegments = async (
    basePath: string,
    language: string,
    provider: 'openai' | 'elevenlabs' | 'mixed_providers'
): Promise<Result<AudioData>> => {
    try {
        const segmentsPath = join(basePath, language, provider, 'segments');
        const segments = R.pipe(
            await readdir(segmentsPath),
            R.filter((f): f is string => f.endsWith('.mp3')),
            R.map(file => parseSegmentFile(file, segmentsPath, provider)),
            R.filter((x): x is NonNullable<typeof x> => x !== null),
            R.sortBy(s => parseInt(s.path.match(/segment_(\d+)/)?.[1] || '0', 10))
        );

        if (!segments.length) return { ok: false, error: 'No audio segments found' };

        return {
            ok: true,
            data: {
                segments,
                metadata: {
                    totalSegments: segments.length,
                    timestamp: new Date().toISOString(),
                    provider
                }
            }
        };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to load segments: ${msg}`);
        return { ok: false, error: `Failed to load segments: ${msg}` };
    }
}
