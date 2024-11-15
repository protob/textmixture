import { createDialogueService } from '@services/dialogue-service';
import { createEnrichmentService } from '@services/enrichment-service';
import { logger } from '@utils/logger';
import * as R from 'remeda';
import { DEFAULT_CONFIG } from '@models/app-config';
import { createOpenAIService, createSampleDialogue } from './helpers';
import type { DialogueLine } from '@models/dialogue';

const dialogueToText = (lines: readonly DialogueLine[]): string =>
    R.pipe(
        lines,
        R.map(line => `${line.speaker}: ${line.text}`),
        R.join('\n')
    );

export const verifyEnricher = async () => {
    logger.info('🚀 Starting enrichment verification');

    const openaiAdapter = createOpenAIService();
    const dialogueService = createDialogueService(openaiAdapter);
    const enrichmentService = createEnrichmentService(openaiAdapter);

    const dialogueResult = await dialogueService.generateDialogue({
        ...createSampleDialogue(),
        options: {
            model: DEFAULT_CONFIG.openai.textModel.name,
            temperature: DEFAULT_CONFIG.openai.textModel.temperature
        }
    });

    if (!dialogueResult.ok) {
        const errorMsg = `Dialogue generation failed: ${dialogueResult.error}`;
        logger.error(errorMsg);
        if (!import.meta.main) return { success: false, error: errorMsg };
        process.exit(1);
    }

    const enrichmentResult = await enrichmentService.enrichContent({
        content: dialogueToText(dialogueResult.data.lines),
        title: 'Quantum Computing Fundamentals',
    });

    if (!enrichmentResult.ok) {
        const errorMsg = `Enrichment failed: ${enrichmentResult.error}`;
        logger.error(errorMsg);
        if (!import.meta.main) return { success: false, error: errorMsg };
        process.exit(1);
    }

    logger.success('Content enriched successfully', enrichmentResult.data);

    if (!import.meta.main) return { success: true };
};

if (import.meta.main) verifyEnricher();