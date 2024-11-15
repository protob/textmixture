import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import * as R from 'remeda';
import type { FileSystemPort } from '@data-access/fs-port';
import type { AsyncResult } from '@shared-types/result';
import { logger } from '@utils/logger';

//  paths are relative to project root
export const createFsAdapter = (): FileSystemPort => {
    const ensureDir = async (path: string): AsyncResult<void> => {
        try {
            await mkdir(path, { recursive: true });
            return { ok: true, data: undefined };
        } catch (error) {
            const errorMsg = `Failed to create directory: ${error}`;
            logger.error(errorMsg, { path });
            return { ok: false, error: errorMsg };
        }
    };

    const writeFile = async (path: string, content: string | Buffer): AsyncResult<string> => {
        try {
            const dirPath = join(path, '..');
            await ensureDir(dirPath);
            await Bun.write(path, content);
            return { ok: true, data: path };
        } catch (error) {
            const errorMsg = `Failed to write file: ${error}`;
            logger.error(errorMsg, { path });
            return { ok: false, error: errorMsg };
        }
    };

    const listDir = async (path: string): AsyncResult<string[]> => {
        try {
            const files = await readdir(path);
            return { ok: true, data: files };
        } catch (error) {
            const errorMsg = `Failed to list directory: ${error}`;
            logger.error(errorMsg, { path });
            return { ok: false, error: errorMsg };
        }
    };

    const sanitizePath = (str: string): string =>
        R.pipe(
            str,
            s => s.replace(/[^a-z0-9]+/gi, '_'),
            s => s.toLowerCase(),
            s => s.slice(0, 100)
        );

    return {
        writeFile,
        ensureDir,
        sanitizePath,
        listDir
    };
};