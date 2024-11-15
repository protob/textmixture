import { mkdir } from 'fs/promises'
import { join } from 'path'
import type { OutputPort } from '@data-access/output-structure-port'
import type { AsyncResult } from '@shared-types/result'
import { logger } from '@utils/logger'

export const createOutputAdapter = (rootDir: string = process.cwd()): OutputPort => {
    const ensureDir = async (path: string): AsyncResult<void> => {
        try {
            await mkdir(join(rootDir, path), { recursive: true })
            return { ok: true, data: undefined }
        } catch (error) {
            const errorMsg = `Failed to create directory: ${error}`
            logger.error(errorMsg, { path })
            return { ok: false, error: errorMsg }
        }
    }

    const writeFile = async (path: string, content: string): AsyncResult<void> => {
        try {
            const fullPath = join(rootDir, path)
            await ensureDir(join(fullPath, '..'))
            await Bun.write(fullPath, content)
            return { ok: true, data: undefined }
        } catch (error) {
            const errorMsg = `Failed to write file: ${error}`
            logger.error(errorMsg, { path })
            return { ok: false, error: errorMsg }
        }
    }

    return {
        ensureDir,
        writeFile
    }
}