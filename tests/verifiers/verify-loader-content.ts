import * as R from 'remeda';
import { createContentFsAdapter } from '@adapters/loaders/content-fs-loader';
import { createContentService } from '@services/content-service';
import { logger } from '@utils/logger';
import type { ContentFile } from '@models/content';

const prepareSampleFiles = (): ContentFile[] => [
    { path: 'quantum_computing_sample.md', subDir: 'docs' }
];

export const verifyLoaderContent = async (): Promise<{ success: boolean; error?: string } | void> => {
    try {
        logger.info('Verifying content loader...');
        const result = await R.pipe(
            createContentFsAdapter(),
            createContentService,
            contentService => contentService.loadContents(prepareSampleFiles())
        );

        if (!result.ok) {
            logger.error('Script execution failed', { error: result.error });
            if (!import.meta.main) return {
                success: false,
                error: `Content loader validation failed: ${result.error}`
            };
            process.exit(1);
        }

        logger.success('Content loader validation successful');
        logger.info('Loaded content', { content: result.data });

        if (!import.meta.main) return { success: true };
    } catch (error) {
        logger.error('Script execution failed', { error });
        if (!import.meta.main) return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
        process.exit(1);
    }
};

if (import.meta.main) verifyLoaderContent();