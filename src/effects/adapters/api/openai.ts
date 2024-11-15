import OpenAI from 'openai';
import * as R from 'remeda';
import type { OpenAIPort } from '@data-access/openai-port';
import type { OpenAITextRequest } from '@models/openai';
import type { AsyncResult } from '@shared-types/result';
import { logger } from '@utils/logger';

const createCompletionRequest = (req: OpenAITextRequest) => ({
    model: req.model,
    messages: [...req.messages],
    temperature: req.temperature,
    max_tokens: req.maxTokens,
    stop: req.stop ? [...req.stop] : undefined,
});

const handleError = (error: unknown): AsyncResult<{ content: string, role: 'assistant' }> => {
    logger.error('OpenAI text generation failed:', { error });
    return Promise.resolve({ ok: false, error: String(error) });
};

export const createOpenAIAdapter = (apiKey: string, baseURL: string): OpenAIPort => ({
    generateText: async (request: OpenAITextRequest): AsyncResult<{ content: string, role: 'assistant' }> => {
        const client = new OpenAI({ apiKey, baseURL });

        return R.pipe(
            request,
            createCompletionRequest,
            req => client.chat.completions.create(req).then(response => {
                const content = response.choices[0]?.message?.content;
                return content
                    ? { ok: true as const, data: { content, role: 'assistant' as const } }
                    : { ok: false as const, error: 'No content in OpenAI response' };
            }).catch(error => handleError(error))
        );
    }
});