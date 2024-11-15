import type { AsyncResult } from '@shared-types/result'

export interface UrlPort {
    fetchContent: (url: string) => AsyncResult<string>
    saveToDisk?: (content: string, url: string) => AsyncResult<string>
}