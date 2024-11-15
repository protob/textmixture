import * as R from 'remeda';
import type { OpenAIPort } from '@data-access/openai-port';
import type { EnrichmentRequest, EnrichmentResult, ContentAnalysis } from '@models/enrichment';
import type {  OpenAITextRequest } from '@models/openai';
import { DEFAULT_CONFIG } from '@models/app-config';
import { logger } from '@utils/logger';

const createEnrichmentPrompt = (): string =>
    `You are an expert content analyzer. Analyze the provided dialogue and return a JSON object with:
   - categories: Array of broad content categories (e.g., "Science", "Technology")
   - tags: Array of specific keywords and topics
   - keyTopics: Array of main subjects discussed

   Respond ONLY with the JSON object.`.trim();

const extractJson = (text: string): string | null =>
    R.pipe(
        [text.indexOf('{'), text.lastIndexOf('}')],
        ([start, end]) => start === -1 || end === -1 ? null : text.slice(start, end + 1)
    );

const parseAnalysis = (text: string): ContentAnalysis | null => {
    try {
        const jsonStr = extractJson(text);
        if (!jsonStr) return null;

        const { categories = [], tags = [], keyTopics = [] } = JSON.parse(jsonStr);
        return { categories, tags, keyTopics };
    } catch (error) {
        logger.error('Failed to parse analysis', { error });
        return null;
    }
};

const createOpenAIRequest = (content: string): OpenAITextRequest => ({
    messages: [
        { role: 'system' as const, content: createEnrichmentPrompt() },
        { role: 'user' as const, content }
    ],
    model: DEFAULT_CONFIG.openai.textModel.name,
    temperature: 0.3,
    maxTokens: DEFAULT_CONFIG.openai.textModel.maxTokens
});

export const createEnrichmentService = (openaiPort: OpenAIPort) => ({
    enrichContent: async (request: EnrichmentRequest): Promise<EnrichmentResult> =>
        R.pipe(
            request.content,
            createOpenAIRequest,
            async req => {
                const result = await openaiPort.generateText(req);
                if (!result.ok) return result;

                const analysis = parseAnalysis(result.data.content);
                return analysis
                    ? { ok: true, data: analysis }
                    : { ok: false, error: 'Failed to parse enrichment analysis' };
            }
        )
});