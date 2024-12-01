import *as R from 'remeda';
import type { AudioPort } from '@data-access/audio-port';
import type { AudioRequest } from '@models/audio';
import { TTS_QUEUE_CONFIG, TTSQueueItem, TTSQueueResult, TTSRequestResult, TTSQueueSuccess, TTSQueueError } from '@models/tts-queue';


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRateLimitError = (error: string): boolean =>
    error.includes('too_many_concurrent_requests') || error.includes('429');

const processWithRetry = async (audioPort: AudioPort, item: TTSQueueItem): Promise<TTSRequestResult> => {
    const result = await audioPort.generateAudio(item.request);
    const resultWithRequest = { ...result, request: item.request };

    if (!result.ok && isRateLimitError(result.error) && item.retryCount < TTS_QUEUE_CONFIG.maxRetries) {
        await delay(TTS_QUEUE_CONFIG.retryDelayMs * (item.retryCount + 1));
        return processWithRetry(audioPort, { ...item, retryCount: item.retryCount + 1 });
    }
    return resultWithRequest;
};

const processChunk = async (audioPort: AudioPort, requests: readonly AudioRequest[]): Promise<readonly TTSRequestResult[]> =>
    Promise.all(R.map(requests, request => processWithRetry(audioPort, { request, retryCount: 0 })));

const processChunks = async (audioPort: AudioPort, chunks: readonly (readonly AudioRequest[])[]): Promise<readonly TTSRequestResult[]> => {
    let results: TTSRequestResult[] = [];

    for (const chunk of chunks) {
        const chunkResults = await Promise.all(
            R.take(chunk, TTS_QUEUE_CONFIG.queueConcurrency).map(request =>
                processWithRetry(audioPort, { request, retryCount: 0 })
            )
        );
        results = R.concat(results, chunkResults);
    }

    return results;
};

const partitionResults = (results: readonly TTSRequestResult[]): [readonly TTSQueueSuccess[], readonly TTSQueueError[]] => {
    const [successes, failures] = R.partition(results, (r): r is TTSQueueSuccess => r.ok);
    return [
        successes,
        R.map(failures, f => ({ request: f.request, error: f.error }))
    ];
};

export const createTTSQueueService = (audioPort: AudioPort) => {
    const processQueue = async (requests: readonly AudioRequest[]): Promise<TTSQueueResult> => {
        try {
            const chunks = R.chunk(requests, TTS_QUEUE_CONFIG.chunkSize);
            const results = await processChunks(audioPort, chunks);
            const [successes, failures] = partitionResults(results);

            return {
                ok: true,
                data: { successes, failures }
            };
        } catch (error) {
            return {
                ok: false,
                error: `Queue processing failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    };

    return { processQueue };
};