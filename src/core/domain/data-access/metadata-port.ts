import type { AsyncResult } from '@shared-types/result';
import type { z } from 'zod';

export interface MetadataPort {
    loadConfig: <T>(path: string, schema: z.ZodSchema<T>) => AsyncResult<T>;
    loadMany: <T>(paths: string[], schema: z.ZodSchema<T>) => AsyncResult<T[]>;
}