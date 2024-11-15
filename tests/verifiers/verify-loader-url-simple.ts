// src/scripts/verify-loader-url-simple.ts

import { logger } from '@utils/logger';

import {
    createFsAndUrlServices,
    processUrls,
    countResults,
} from './helpers';

import { processSimpleContent } from '@services/url-processors';

const getSampleUrls = (): string[] => [
    'https://blogs.nvidia.com/blog/what-is-quantum-computing/',
];

export const verifyLoaderUrlSimple = async () => {
    try {
        logger.info('Verifying Simple URL loader...');

        const { urlService } = createFsAndUrlServices();

        const urls = getSampleUrls();
        const results = await processUrls(urls, urlService, processSimpleContent);

        const { successCount, failureCount } = countResults(results);

        logger.info('Simple URL loader validation completed', {
            total: results.length,
            success: successCount,
            failures: failureCount,
        });

        // Return success for test runner
        if (!import.meta.main) return { success: true };
    } catch (error) {
        logger.error('Script execution failed', { error });

        // Return failure for test runner
        if (!import.meta.main)
            return { success: false, error: error instanceof Error ? error.message : String(error) };

        process.exit(1);
    }
};

if (import.meta.main) verifyLoaderUrlSimple();

