import { createDialogueService } from '@services/dialogue-service';
import { logger } from '@utils/logger';
import { createOpenAIService, createSampleDialogue } from './helpers';
import type { DialogueLine } from '@models/dialogue';
import { DEFAULT_CONFIG } from "@models/app-config";

const displayDialogue = (lines: readonly DialogueLine[]) =>
    lines.forEach(line => console.log(`${line.speaker}: ${line.text}`));

export const verifyDialogue = async () => {
    logger.info('Starting dialogue verification');

    const openaiAdapter = createOpenAIService();
    const dialogueService = createDialogueService(openaiAdapter);
    const model = DEFAULT_CONFIG.openai.textModel.name;
    const temperature = DEFAULT_CONFIG.openai.textModel.temperature;

    const result = await dialogueService.generateDialogue({
        ...createSampleDialogue(),
        options: { model, temperature },
    });

    if (!result.ok) {
        const errorMsg = `Dialogue generation failed: ${result.error}`;
        logger.error(errorMsg);

        // Return failure for external test runner
        if (!import.meta.main) return { success: false, error: errorMsg };

        process.exit(1);
    }

    const { metadata, lines } = result.data;
    logger.success('Dialogue generated successfully', { lines: lines.length, metadata });

    displayDialogue(lines);

    // Return success for external test runner
    if (!import.meta.main) return { success: true };
};

if (import.meta.main) verifyDialogue();