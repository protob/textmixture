import { createTranslationService } from '@services/translation-service';
import { logger } from '@utils/logger';

import type { DialogueContent } from '@models/dialogue';

import { createOpenAIService, formatDialogue } from './helpers';

const sampleDialogue: DialogueContent = {
    lines: [
        { speaker: 'Alice', text: 'What is a qubit?', index: 0, metadata: {} },
        {
            speaker: 'Bob',
            text: 'A qubit is the basic unit of quantum information.',
            index: 1,
            metadata: {},
        },
    ],
    metadata: {},
};

// Helper to extract error message
const extractErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

export const verifyTranslation = async () => {
    try {
        logger.info('🚀 Starting translation verification');

        const translationService = createTranslationService(createOpenAIService());

        logger.info('Original text:', { dialogue: formatDialogue(sampleDialogue.lines) });

        const translationResult = await translationService.translateDialogue({
            content: sampleDialogue,
            targetLanguage: 'de',
        });

        if (!translationResult.ok) {
            logger.error('Translation failed', { error: translationResult.error });
            if (!import.meta.main) return { success: false, error: translationResult.error };
            process.exit(1);
        }

        logger.success('Translation completed', {
            lines: translationResult.data.lines.length,
            metadata: translationResult.data.metadata,
        });

        logger.info('Translated text:', { dialogue: formatDialogue(translationResult.data.lines) });

        // Return success for test runner
        if (!import.meta.main) return { success: true };
    } catch (error) {
        const errorMessage = extractErrorMessage(error);
        logger.error('Script execution failed', { error: errorMessage });

        // Return failure for test runner
        if (!import.meta.main)
            return {
                success: false,
                error: errorMessage,
            };

        process.exit(1);
    }
};

// Handle unhandled promise rejections when running as main
if (import.meta.main) {
    verifyTranslation().catch((error) => {
        const errorMessage = extractErrorMessage(error);
        logger.error('Unhandled error in verifyTranslation', { error: errorMessage });
        process.exit(1);
    });
}
