import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ContentPort } from '@data-access/content-port';
import type { ContentFile } from '@models/content';
import type { AsyncResult } from '@shared-types/result';
import { logger } from '@utils/logger';

const INPUT_ROOT = 'input';

export const createContentFsAdapter = (): ContentPort => ({
    loadFile: async (file: ContentFile): AsyncResult<string> => {
        const fullPath = join(process.cwd(), INPUT_ROOT, file.subDir || '', file.path);
        try {
            return { ok: true, data: (await readFile(fullPath, 'utf8')).trim() };
        } catch (error) {
            logger.error(`Failed to load file: ${error}`, { path: fullPath });
            return { ok: false, error: `Failed to load file: ${error}` };
        }
    }
});