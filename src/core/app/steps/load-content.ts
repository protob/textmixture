import * as R from 'remeda'
import { createContentFsAdapter } from '@adapters/loaders/content-fs-loader'
import { createContentService } from '@services/content-service'
import type { BaseContext, PipelineStep, WithContext } from './types'
import { logger } from '@utils/logger'

export type ContentData = { readonly content: string }
export type ContentContext = WithContext<ContentData>

export const createLoadContentStep = (): PipelineStep<BaseContext, ContentContext> => {
    const contentService = createContentService(createContentFsAdapter())

    return async (context) => {
        const sources = context.config.episode.localSources
        logger.debug('Loading content files from:', { sources })

        if (!sources?.length) return { ok: false, error: 'No content sources specified in episode config' }

        const files = R.pipe(
            sources,
            R.map((path: string) => ({ path: path.replace(/^input\//, ''), subDir: 'docs' }))
        )
        logger.debug('Processing files:', { files })

        const result = await contentService.loadContents(files)
        return result.ok
            ? { ok: true, data: { ...context, content: result.data.content } }
            : result
    }
}