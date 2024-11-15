import * as R from 'remeda';
import type { AudioPort } from '@data-access/audio-port';
import type { AudioRequest, AudioResult, ElevenLabsRequest } from '@models/audio';
import fetch from 'node-fetch';
import { logger } from '@utils/logger';

const createRequestBody = (request: ElevenLabsRequest) => ({
    text: request.text,
    model_id: request.model || 'eleven_multilingual_v2',
    voice_settings: request.settings ? {
        stability: request.settings.stability,
        similarity_boost: request.settings.similarityBoost,
        style: request.settings.style,
        use_speaker_boost: request.settings.useSpeakerBoost
    } : undefined
});

const createSuccessResult = (audioData: Buffer, request: ElevenLabsRequest): AudioResult => ({
    ok: true,
    data: {
        data: audioData,
        metadata: {
            provider: 'elevenlabs',
            voiceId: request.voiceId,
            timestamp: new Date().toISOString(),
            settings: request.settings,
            ...request.metadata
        }
    }
});

const handleError = (error: unknown): AudioResult => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('ElevenLabs audio generation failed:', { error: errorMessage });
    return { ok: false, error: errorMessage };
};

export const createElevenLabsAudioAdapter = (apiKey: string, baseUrl: string): AudioPort => ({
    generateAudio: async (request: AudioRequest): Promise<AudioResult> =>
        request.provider !== 'elevenlabs'
            ? { ok: false, error: 'Invalid provider for ElevenLabs adapter' }
            : R.pipe(
                request as ElevenLabsRequest,
                async req => {
                    try {
                        logger.debug('ElevenLabs TTS request:', {
                            textLength: req.text.length,
                            voiceId: req.voiceId
                        });

                        const response = await fetch(
                            `${baseUrl}/text-to-speech/${req.voiceId}`,
                            {
                                method: 'POST',
                                headers: {
                                    'Accept': 'audio/mpeg',
                                    'Content-Type': 'application/json',
                                    'xi-api-key': apiKey
                                },
                                body: JSON.stringify(createRequestBody(req))
                            }
                        );

                        if (!response.ok) {
                            const errorBody = await response.text();
                            return handleError(
                                `ElevenLabs API Error: ${response.status} ${response.statusText} - ${errorBody}`
                            );
                        }

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