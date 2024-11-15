import { join } from 'path'
import type { UrlPort } from '@data-access/url-port'
import type { FileSystemPort } from '@data-access/fs-port'
import type { AsyncResult } from '@shared-types/result'
import { logger } from '@utils/logger'

const WEB_DIR = 'input/web'

export const createUrlFsAdapter = (fsAdapter: FileSystemPort): UrlPort => {
    const fetchContent = async (url: string): AsyncResult<string> => {
        try {
            const response = await fetch(url, { redirect: 'follow' });
            return response.ok
                ? { ok: true, data: await response.text() }
                : { ok: false, error: `HTTP error: ${response.status}` };
        } catch (error) {
            const errorMsg = `Failed to fetch URL: ${error}`;
            logger.error(errorMsg, { url });
            return { ok: false, error: errorMsg };
        }
    };

    const saveToDisk = async (
        content: string,
        url: string
    ): AsyncResult<string> => {
        try {
            await fsAdapter.ensureDir(WEB_DIR)
            const filename = `${url.replace(/[^a-z0-9]+/gi, '_').toLowerCase().slice(0, 100)}.md`;
            const filepath = join(WEB_DIR, filename)
            return await fsAdapter.writeFile(filepath, content)
        } catch (error) {
            const errorMsg = `Failed to save content: ${error}`
            logger.error(errorMsg, { url })
            return { ok: false, error: errorMsg }
        }
    }

    return {
        fetchContent,
        saveToDisk
    }
}