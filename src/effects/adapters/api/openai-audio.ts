import OpenAI from 'openai';
import * as R from 'remeda';
import type { AudioPort } from '@data-access/audio-port';
import type { AudioRequest, AudioResult, OpenAIRequest } from '@models/audio';
import { logger } from '@utils/logger';

const createAudioRequest = (request: OpenAIRequest) => ({
    model: request.model || 'tts-1',
    voice: request.voice,
    input: request.text,
    response_format: request.format || 'mp3'
});

const createSuccessResult = (data: Buffer, request: OpenAIRequest): AudioResult => ({
    ok: true,
    data: {
        data,
        metadata: {
            provider: 'openai',
            voiceId: request.voice,
            timestamp: new Date().toISOString(),
            ...request.metadata
        }
    }
});

const handleError = (error: unknown): AudioResult => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('OpenAI audio generation failed:', { error: errorMsg });
    return { ok: false, error: errorMsg };
};

export const createOpenAIAudioAdapter = (apiKey: string, baseURL: string): AudioPort => ({
    generateAudio: async (request: AudioRequest): Promise<AudioResult> =>
        request.provider !== 'openai'
            ? { ok: false, error: 'Invalid provider for OpenAI adapter' }
            : R.pipe(
                request as OpenAIRequest,
                async req => {
                    try {
                        logger.debug('OpenAI TTS request:', {
                            textLength: req.text.length,
                            voice: req.voice
                        });

                        const response = await new OpenAI({ apiKey, baseURL })
                            .audio.speech.create(createAudioRequest(req));

                        return createSuccessResult(
                            Buffer.from(await response.arrayBuffer()),
                            req
                        );
                    } catch (error) {
                        return handleError(error);
                    }
                }
            )
});