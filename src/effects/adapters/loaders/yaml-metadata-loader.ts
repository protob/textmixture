import yaml from 'yaml';
import { readFile } from 'fs/promises';
import * as z from 'zod';
import * as R from 'remeda';
import type { MetadataPort } from '@data-access/metadata-port';
import type { Result, AsyncResult } from '@shared-types/result';
import { logger } from '@utils/logger';

const validate = <T>(data: unknown, schema: z.ZodSchema<T>): Result<T> => {
    const result = schema.safeParse(data);
    return result.success
        ? { ok: true, data: result.data }
        : {
            ok: false,
            error: R.pipe(
                result.error.errors,
                R.map(err => `${err.path.join('.')}: ${err.message}`),
                R.join('\n')
            )
        };
};

export const createYamlMetadataAdapter = (): MetadataPort => {
    const loadAndValidate = async <T>(path: string, schema: z.ZodSchema<T>): AsyncResult<T> => {
        try {
            const content = await readFile(path, 'utf8');
            const data = yaml.parse(content);
            return validate(data, schema);
        } catch (error) {
            const errorMessage = `Failed to load config: ${error}`;
            logger.error(errorMessage, { path, error });
            return {
                ok: false,
                error: errorMessage,
                failedFile: path
            };
        }
    };

    const loadManyAndValidate = async <T>(paths: string[], schema: z.ZodSchema<T>): AsyncResult<T[]> => {
        const results = await Promise.all(paths.map(path => loadAndValidate(path, schema)));
        const failure = R.find(results, (result): result is { ok: false; error: string } => !result.ok);
        return failure ?? { ok: true, data: R.map(results, r => (r as { ok: true; data: T }).data) };
    };

    return {
        loadConfig: loadAndValidate,
        loadMany: loadManyAndValidate
    };
};