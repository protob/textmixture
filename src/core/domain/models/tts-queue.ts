import type { AudioRequest, AudioResult } from '@models/audio';
import type { Result } from '@shared-types/result';

export const TTS_QUEUE_CONFIG = {
  maxConcurrent: 2, // elevenlabs has limit of 5
  retryDelayMs: 1000,
  maxRetries: 3,
  queueConcurrency: 2, 
  chunkSize: 2,
} as const;

export type TTSQueueItem = {
  readonly request: AudioRequest;
  readonly retryCount: number;
};


export type TTSRequestResult = AudioResult & {
  readonly request: AudioRequest;
};

export type TTSQueueError = {
  readonly request: AudioRequest;
  readonly error: string;
};

export type TTSQueueSuccess = Extract<TTSRequestResult, { ok: true }>;
export type TTSQueueFailure = Extract<TTSRequestResult, { ok: false }>;

export type TTSQueueResult = Result<{
  readonly successes: readonly TTSQueueSuccess[];
  readonly failures: readonly TTSQueueError[];
}>;