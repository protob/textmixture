// src/scripts/verify-dialogue.ts

import { createDialogueService } from '@services/dialogue-service';
import { logger } from '@utils/logger';
import { createOpenAIService } from './helpers';
import type { DialogueLine } from '@models/dialogue';
import {DEFAULT_CONFIG} from "@models/app-config";

const createTestPrompts = () => ({
    systemPrompt: `You are simulating a conversation between Alice and Bob. Alice is a scientific researcher. Bob is a software engineer. Use natural dialogue to explore technical topics.`,
    userPrompt: `Generate a short dialogue about the current state of quantum computing technology. Focus on explaining recent advancements of quantum computing. Keep it engaging but accurate. ~4 lines of dialogue.`,
});

const displayDialogue = (lines: readonly DialogueLine[]) =>
    lines.forEach(line => console.log(`${line.speaker}: ${line.text}`));

export const verifyDialogue = async () => {
    logger.info('Starting dialogue verification');

    const openaiAdapter = createOpenAIService();
    const dialogueService = createDialogueService(openaiAdapter);
    const prompts = createTestPrompts();
    const model = DEFAULT_CONFIG.openai.textModel.name;
    const temperature = DEFAULT_CONFIG.openai.textModel.temperature;

    const result = await dialogueService.generateDialogue({
        ...prompts,
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