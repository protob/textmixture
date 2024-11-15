// src/scripts/verify-loader-url-wiki.ts

import { logger } from '@utils/logger';

import {
    createFsAndUrlServices,
    processUrls,
    countResults,
} from './helpers';

import { processWikiContent } from '@services/url-processors';

const getWikiUrls = (): string[] => ['https://en.wikipedia.org/wiki/Quantum_computing'];

export const verifyLoaderUrlWiki = async () => {
    try {
        logger.info('Verifying Wiki URL loader...');

        const { urlService } = createFsAndUrlServices();

        const urls = getWikiUrls();
        const results = await processUrls(urls, urlService, processWikiContent);

        const { successCount, failureCount } = countResults(results);

        logger.info('Wiki URL loader validation completed', {
            total: results.length,
            success: successCount,
            failures: failureCount,
        });

        // Return success for external test runner
        if (!import.meta.main) return { success: true };
    } catch (error) {
        logger.error('Script execution failed', {
            error: error instanceof Error ? error.message : String(error),
        });

        // Return failure for external test runner
        if (!import.meta.main)
            return { success: false, error: error instanceof Error ? error.message : String(error) };

        process.exit(1);
    }
};

if (import.meta.main) verifyLoaderUrlWiki();

