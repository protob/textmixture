import type { Result } from '@shared-types/result'
import type { FullConfig } from '@models/yaml-metadata'
import { createYamlMetadataService } from '@services/yaml-metadata-service' 

export const createYamlMetadataStore = (configService: ReturnType<typeof createYamlMetadataService>) => {
    let state = { configs: null as FullConfig | null, initialized: false }

    return {
        initialize: async (): Promise<Result<void>> => {
            if (state.initialized) return { ok: true, data: undefined }

            const result = await configService.loadFullConfig()
            if (!result.ok) return result

            state = { configs: result.data, initialized: true }
            return { ok: true, data: undefined }
        },

        getFullConfig: (): Result<FullConfig> =>
            !state.initialized ? { ok: false, error: 'Config store not initialized' } :
                !state.configs ? { ok: false, error: 'No configs loaded' } :
                    { ok: true, data: state.configs }
    }
}
