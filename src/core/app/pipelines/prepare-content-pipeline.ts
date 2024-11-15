import * as R from 'remeda'
import { composePipelineSteps } from './compose-pipeline-steps'
import { createLoadContentStep } from '@steps/load-content'
import { createEnsureStructureStep } from '@steps/ensure-structure'
import { createGenerateDialogueStep } from '@steps/generate-dialogue'
import { createEnrichMetadataStep } from '@steps/enrich-metadata'
import { createTranslateDialogueStep } from '@steps/translate-dialogue'
import { createWriteOutputsStep } from '@steps/write-outputs'
import { createYamlMetadataAdapter } from '@adapters/loaders/yaml-metadata-loader'
import { createYamlMetadataService } from '@services/yaml-metadata-service'
import { createYamlMetadataStore } from '@store/yaml-metadata-store'
import { logger } from '@utils/logger'
import type { BaseContext } from '@steps/types'
import type { Result } from '@shared-types/result'
import type { OutputContext } from '@steps/write-outputs'
import type { FullConfig } from '@models/yaml-metadata'

const initializeConfig = async (): Promise<Result<FullConfig>> => {
    const store = R.pipe(
        createYamlMetadataAdapter(),
        createYamlMetadataService,
        createYamlMetadataStore
    )

    const initResult = await store.initialize()
    if (!initResult.ok) {
        return { ok: false, error: `Config initialization failed: ${initResult.error}` }
    }

    const configResult = store.getFullConfig()
    if (!configResult.ok) {
        return { ok: false, error: `Failed to get config: ${configResult.error}` }
    }

    return configResult
}

const createPipeline = () => composePipelineSteps<BaseContext, OutputContext>(
    createLoadContentStep(),
    createEnsureStructureStep(),
    createGenerateDialogueStep(),
    createEnrichMetadataStep(),
    createTranslateDialogueStep(),
    createWriteOutputsStep()
)

export const runPrepareContentPipeline = async (): Promise<Result<OutputContext>> => {
    try {
        logger.info('🚀 Starting Prepare Content Pipeline')

        const configResult = await initializeConfig()
        if (!configResult.ok) {
            return { ok: false as const, error: configResult.error }
        }

        const result = await createPipeline()({ config: configResult.data })
        if (!result.ok) {
            return { ok: false as const, error: `Pipeline execution failed: ${result.error}` }
        }

        logger.success('✅ Prepare Content Pipeline completed successfully', {
            outputs: result.data.outputPaths
        })

        return result

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        logger.error('Prepare Content Pipeline failed', { error: msg })
        return { ok: false as const, error: msg }
    }
}