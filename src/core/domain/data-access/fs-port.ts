import type { AsyncResult } from '@shared-types/result';

export interface FileSystemPort {
    writeFile: (path: string, content: string | Buffer) => AsyncResult<string>;
    ensureDir: (path: string) => AsyncResult<void>;
    sanitizePath: (str: string) => string;
    listDir: (path: string) => AsyncResult<string[]>;
}