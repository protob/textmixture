import type { UrlLoadResult, UrlLoadOptions } from '@models/url-content';

export interface UrlContentPort {
    loadUrl: (
        url: string,
        processContent: (html: string, url: string) => Promise<string>,
        options?: UrlLoadOptions
    ) => Promise<UrlLoadResult>;

    loadMultipleUrls: (
        urls: string[],
        processContent: (html: string, url: string) => Promise<string>,
        options?: UrlLoadOptions
    ) => Promise<UrlLoadResult>;
}