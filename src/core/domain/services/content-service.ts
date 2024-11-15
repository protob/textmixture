import * as R from 'remeda';
import type { ContentPort } from '@data-access/content-port';
import type { ContentFile, ContentResult } from '@models/content';

export const createContentService = (contentPort: ContentPort) => ({
    loadContents: async (files: ContentFile[]): Promise<ContentResult> => {
        const results = await Promise.all(files.map(file => contentPort.loadFile(file)));
        const failure = R.find(results, (r): r is { ok: false; error: string } => !r.ok);
        return failure ? { ok: false, error: `Failed to load files: ${failure.error}` } : {
            ok: true,
            data: { content: R.pipe(results, R.map(r => (r as { ok: true; data: string }).data), R.join('\n\n')), source: 'combined files' }
        };
    }
});