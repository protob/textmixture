import * as R from 'remeda';
import { createYamlMetadataAdapter } from '@adapters/loaders/yaml-metadata-loader';
import { createYamlMetadataService } from '@services/yaml-metadata-service';
import { createYamlMetadataStore } from '@store/yaml-metadata-store';
import { createFsAdapter } from '@adapters/common/fs-adapter';
import { createUrlFsAdapter } from '@adapters/loaders/url-loader';
import { createUrlContentService } from '@services/url-content-service';
import { createOpenAIAdapter } from '@adapters/api/openai';
import { createOpenAIAudioAdapter } from '@adapters/api/openai-audio';
import { createElevenLabsAudioAdapter } from '@adapters/api/elevenlabs-audio';

import type { FullConfig } from '@models/yaml-metadata';
import type { UrlContentPort } from '@data-access/url-content-port';
import { DEFAULT_CONFIG } from '@models/app-config';

import type { AudioProviders } from '@data-access/audio-port';
import type { FileSystemPort } from '@data-access/fs-port';

export const initializeConfig = async (): Promise<FullConfig> => {
    const configStore = R.pipe(
        createYamlMetadataAdapter(),
        createYamlMetadataService,
        createYamlMetadataStore
    );

    const initResult = await configStore.initialize();
    if (!initResult.ok) throw new Error(`Config initialization failed: ${initResult.error}`);

    const configResult = await configStore.getFullConfig();
    if (!configResult.ok) throw new Error(`Failed to get config: ${configResult.error}`);

    return configResult.data;
};

export const displayConfigSummary = ({ series, episode, style, characters }: FullConfig): void => {
    console.info('Configuration Summary:', {
        series: `${series.title} (${series.SeriesID})`,
        episode: episode.title,
        style: style.StyleID,
        characters: R.pipe(
            characters,
            R.map(c => c.name),
            R.join(', ')
        ),
    });
};

export const processUrls = async (
    urls: string[],
    urlService: UrlContentPort,
    processor: (html: string, url: string) => Promise<string>
) => Promise.all(urls.map(url => urlService.loadUrl(url, processor, { save: true })));

export const countResults = (results: any[]): { successCount: number; failureCount: number } => {
    const [successCount, failureCount] = R.pipe(
        results,
        R.reduce(
            ([s, f], r) => (r.ok ? [s + 1, f] : [s, f + 1]),
            [0, 0] as [number, number]
        )
    );
    return { successCount, failureCount };
};

export const createFsAndUrlServices = () => {
    const fsAdapter = createFsAdapter();
    const urlAdapter = createUrlFsAdapter(fsAdapter);
    const urlService = createUrlContentService(urlAdapter);
    return { fsAdapter, urlService };
};

export const createOpenAIService = () => {
    return createOpenAIAdapter(
        DEFAULT_CONFIG.openai.apiKey,
        DEFAULT_CONFIG.openai.baseUrl,
    );
};

//
export const createSampleDialogue = () => ({
    systemPrompt: `You are simulating a conversation between Alice and Bob. Alice is a scientific researcher. Bob is a software engineer. Use natural dialogue to explore technical topics.`,
    userPrompt: `Generate a short dialogue about the current state of quantum computing technology. Focus on explaining recent advancements of quantum computing. Keep it engaging but accurate. ~4 lines of dialogue.`,
});

//
export const createAudioProviders = (): AudioProviders => ({
    openai: createOpenAIAudioAdapter(
        DEFAULT_CONFIG.openai.apiKey,
        DEFAULT_CONFIG.openai.baseUrl,
    ),
    elevenlabs: createElevenLabsAudioAdapter(
        DEFAULT_CONFIG.elevenlabs.apiKey,
        DEFAULT_CONFIG.elevenlabs.baseUrl,
    ),
});

//
export const ensureDirectories = async (fs: FileSystemPort, paths: string[]): Promise<void> => {
    const results = await Promise.all(paths.map(fs.ensureDir));
    const failure = R.find(results, (r) => !r.ok);

    if (failure && !failure.ok) {
        throw new Error(`Failed to create directories: ${failure.error}`);
    }
};