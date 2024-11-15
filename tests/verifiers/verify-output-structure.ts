import { createOutputAdapter } from '@adapters/common/output-structure-adapter';
import { createOutputService } from '@services/output-structure-service';
import type { AudioProvider } from '@models/output-structure';
import { logger } from '@utils/logger';

const PROVIDERS: AudioProvider[] = ['openai', 'elevenlabs', 'mixed_providers'];

export const verifyOutputStructure = async () => {
    try {
        logger.info('Starting output structure verification');

        const outputService = createOutputService(createOutputAdapter());
        const seriesId = process.env.CURRENT_SERIES_ID as string;
        const date = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

        const result = await outputService.ensureStructure({
            info: {
                seriesId,
                episodeNumber: 1,
                date,
            },
            languages: ['en', 'de'],
            providers: PROVIDERS,
        });

        if (!result.ok) {
            logger.error(`Structure creation failed: ${result.error}`);
            if (!import.meta.main) return { success: false, error: `Structure creation failed: ${result.error}` };
            process.exit(1);
        }

        logger.success('Output structure created', {
            series: result.data.base,
            languages: Object.keys(result.data.languages),
        });

        // Return success  for external test runner
        if (!import.meta.main) return { success: true };
    } catch (error) {
        logger.error('Script execution failed', { error });

        // Return failure for external test runner
        if (!import.meta.main)
            return { success: false, error: error instanceof Error ? error.message : String(error) };

        process.exit(1);
    }
};

if (import.meta.main) {
    verifyOutputStructure().catch((error) => {
        logger.error('Unhandled error in verifyOutputStructure', { error });
        process.exit(1);
    });
}
