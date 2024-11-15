// src/pure/domain/models/config.ts
import type { Result, AsyncResult } from '@shared-types/result'
import { z } from 'zod'


import {

    currentConfigSchema,
    characterConfigSchema,
    styleConfigSchema,
    seriesConfigSchema,
    episodeConfigSchema,
    fullConfigSchema
} from './schemas/yaml-metadata-schema'

// Export only types inferred from schemas
export type CurrentConfig = z.infer<typeof currentConfigSchema>
export type CharacterConfig = z.infer<typeof characterConfigSchema>
export type StyleConfig = z.infer<typeof styleConfigSchema>
export type SeriesConfig = z.infer<typeof seriesConfigSchema>
export type EpisodeConfig = z.infer<typeof episodeConfigSchema>
export type FullConfig = z.infer<typeof fullConfigSchema>

// Result types
export type ConfigLoadResult = Result<FullConfig>
export type ConfigLoadAsyncResult = AsyncResult<FullConfig>