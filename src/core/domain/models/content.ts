import type { Result } from '@shared-types/result'

export type ContentFile = {
    readonly path: string
    readonly subDir?: string
}

export type ContentResult = Result<{
    readonly content: string
    readonly source: string
}>