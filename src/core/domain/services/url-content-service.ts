import * as R from 'remeda';
import type { UrlPort } from '@data-access/url-port';
import type { UrlContentPort } from '@data-access/url-content-port';
import type { UrlLoadResult, UrlLoadOptions } from '@models/url-content';
import { logger } from '@utils/logger';

export const createUrlContentService = (urlPort: UrlPort): UrlContentPort => {
    const handleError = (error: unknown, url: string): UrlLoadResult => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error('Failed to process content', { error: errorMsg, url });
        return { ok: false, error: errorMsg };
    };

    const saveContent = async (content: string, url: string): Promise<UrlLoadResult> => {
        if (!urlPort.saveToDisk) return { ok: true, data: { content } };
        const saveResult = await urlPort.saveToDisk(content, url);
        return saveResult.ok
            ? { ok: true, data: { content, savedTo: saveResult.data } }
            : saveResult;
    };

    const processUrl = async (
        url: string,
        html: string,
        processContent: (html: string, url: string) => Promise<string>,
        shouldSave: boolean
    ): Promise<UrlLoadResult> => {
        try {
            const content = await processContent(html, url);
            return shouldSave ? saveContent(content, url) : { ok: true, data: { content } };
        } catch (error) {
            return handleError(error, url);
        }
    };

    const loadUrl = async (
        url: string,
        processContent: (html: string, url: string) => Promise<string>,
        options: UrlLoadOptions = {}
    ): Promise<UrlLoadResult> => {
        const result = await urlPort.fetchContent(url);
        return !result.ok
            ? result
            : processUrl(url, result.data, processContent, !!options.save);
    };

    const combineResults = (results: UrlLoadResult[]): UrlLoadResult =>
        R.pipe(
            results,
            R.find((r): r is { ok: false; error: string } => !r.ok),
            failure => failure ?? {
                ok: true,
                data: {
                    content: R.pipe(
                        results as Array<{ ok: true; data: { content: string } }>,
                        R.map(r => r.data.content),
                        R.join('\n\n')
                    )
                }
            }
        );

    const loadMultipleUrls = async (
        urls: string[],
        processContent: (html: string, url: string) => Promise<string>,
        options: UrlLoadOptions = {}
    ): Promise<UrlLoadResult> =>
        R.pipe(
            urls,
            urls => Promise.all(urls.map(url => loadUrl(url, processContent, options))),
            async results => combineResults(await results)
        );

    return { loadUrl, loadMultipleUrls };
};