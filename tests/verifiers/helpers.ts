import * as R from 'remeda';

import { createYamlMetadataAdapter } from '@adapters/loaders/yaml-metadata-loader';
import { createYamlMetadataService } from '@services/yaml-metadata-service';
import { createYamlMetadataStore } from '@store/yaml-metadata-store';


import type { FullConfig } from '@models/yaml-metadata';


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

    return configResult.data as FullConfig;
};

export const displayConfigSummary = ({ series, episode, style, characters }: FullConfig): void => {
    console.info('Configuration Summary:', {
        series: `${series.title} (${series.SeriesID})`,
        episode: episode.title,
        style: style.StyleID,
        characters: R.pipe(characters, R.map(c => c.name), R.join(', ')),
    });
};
