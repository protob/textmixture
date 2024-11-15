
import { logger } from '@utils/logger';

import { initializeConfig, displayConfigSummary } from './helpers';


// @ts-ignore
export const verifyLoaderYamlMetadata = async (): Promise<{ success: boolean; error: any }> => {
    try {
        logger.info('Starting YAML config verification...');
        const config = await initializeConfig();

        displayConfigSummary(config);
        logger.success('YAML config verification completed successfully');

        // Return success for external test runner
        if (!import.meta.main) return {error: undefined, success: true };

    } catch (error) {
        logger.error('Config verification failed:', {error: error instanceof Error ? error.message : String(error)});

        // Return failure for external test runner
        if (!import.meta.main)
            return { success: false, error: error instanceof Error ? error.message : String(error) };

        process.exit(1);
    }
};

if (import.meta.main) verifyLoaderYamlMetadata();

