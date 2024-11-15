import type { AsyncResult } from '@shared-types/result'

export interface OutputPort {
    ensureDir: (path: string) => AsyncResult<void>
    writeFile: (path: string, content: string) => AsyncResult<void>
}