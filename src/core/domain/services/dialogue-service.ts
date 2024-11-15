import * as R from 'remeda';
import type { OpenAIPort } from '@data-access/openai-port';
import type { DialogueRequest, DialogueResult, DialogueLine } from '@models/dialogue';
import type { OpenAIMessage } from '@models/openai';
import { DEFAULT_CONFIG } from '@models/app-config';

const cleanMarkdown = (text: string): string => text.replace(/\*\*|\*|`|^[\s_-]+|[\s_-]+$/g, '').trim();

const parseDialogueLine = (line: string, index: number): DialogueLine | null =>
    R.pipe(
        line.indexOf(':'),
        colonIndex => colonIndex === -1 ? null : {
            speaker: cleanMarkdown(line.slice(0, colonIndex)),
            text: cleanMarkdown(line.slice(colonIndex + 1)),
            index,
            metadata: { raw: line }
        }
    );

const parseDialogueText = (text: string): DialogueLine[] =>
    R.pipe(
        text.split('\n'),
        lines => lines.filter(line => line.includes(':')),
        R.map(parseDialogueLine),
        R.filter((line): line is NonNullable<typeof line> => line !== null)
    );

const createOpenAIRequest = (request: DialogueRequest) => {
    const model = DEFAULT_CONFIG.openai.textModel;
    return {
        messages: [
            {
                role: 'system',
                content: `${request.systemPrompt}\nIMPORTANT: Do not use any markdown formatting in responses. No asterisks, underscores, or backticks.`
            },
            { role: 'user', content: request.userPrompt }
        ] as OpenAIMessage[],
        model: request.options?.model ?? model.name,
        temperature: request.options?.temperature ?? model.temperature,
        maxTokens: request.options?.maxTokens ?? model.maxTokens,
        stop: model.stop ? [...model.stop] : undefined
    };
};

const createDialogueSuccess = (lines: DialogueLine[]): DialogueResult => ({
    ok: true,
    data: {
        lines,
        metadata: {
            generatedAt: new Date().toISOString(),
            model: DEFAULT_CONFIG.openai.textModel.name,
            lineCount: lines.length
        }
    }
});

export const createDialogueService = (openaiPort: OpenAIPort) => ({
    generateDialogue: async (request: DialogueRequest): Promise<DialogueResult> =>
        R.pipe(
            request,
            createOpenAIRequest,
            async req => {
                const result = await openaiPort.generateText(req);
                return !result.ok
                    ? result
                    : createDialogueSuccess(parseDialogueText(result.data.content));
            }
        )
});