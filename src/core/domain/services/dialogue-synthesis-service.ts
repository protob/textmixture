import * as R from 'remeda';
import type { FileSystemPort } from '@data-access/fs-port';
import type { AudioPort } from '@data-access/audio-port';
import type { DialogueLineInput, DialogueSynthesisResult } from '@models/dialogue-synthesis';
import type { VoiceSettings } from '@models/voice-settings';
import type { AudioRequest, OpenAIVoice } from '@models/audio';
import type { Result } from '@shared-types/result';
import { createTTSQueueService } from './tts-queue-service';
import { logger } from '@utils/logger';

type SegmentWithSettings = DialogueLineInput & {
  readonly voiceSettings: VoiceSettings;
};

type GenerationResult = Result<{ path: string }>;

const createAudioRequest = (line: SegmentWithSettings, index: number): AudioRequest => {
  const metadata = {
    characterId: line.characterId,
    index,
    provider: line.provider
  };

  return line.voiceSettings.provider === 'openai'
    ? {
        provider: 'openai',
        text: line.text,
        voice: line.voiceSettings.voice as OpenAIVoice,
        metadata
      }
    : {
        provider: 'elevenlabs',
        text: line.text,
        voiceId: line.voiceSettings.voiceId,
        settings: line.voiceSettings.settings,
        metadata
      };
};

const generateSegment = async (
  line: SegmentWithSettings,
  index: number,
  audioPort: AudioPort,
  fsPort: FileSystemPort,
  outputDir: string
): Promise<GenerationResult> => {
  try {
    const audioResult = await audioPort.generateAudio(createAudioRequest(line, index));
    if (!audioResult.ok) return audioResult;

    const fileName = `segment_${index}_${line.provider}_${line.characterId}.mp3`;
    const saveResult = await fsPort.writeFile(`${outputDir}/${fileName}`, audioResult.data.data);

    return !saveResult.ok
      ? { ok: false, error: `Failed to save audio: ${saveResult.error}` }
      : { ok: true, data: { path: saveResult.data } };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to synthesize segment', {
      error: errorMsg,
      character: line.characterId,
      provider: line.provider
    });
    return { ok: false, error: errorMsg };
  }
};

export const createDialogueSynthesisService = (audioPort: AudioPort, fsPort: FileSystemPort) => {
  const ttsQueueService = createTTSQueueService(audioPort);

  const synthesizeDialogue = async (
    lines: readonly SegmentWithSettings[],
    outputDir: string
  ): Promise<DialogueSynthesisResult> => {
    const dirResult = await fsPort.ensureDir(outputDir);
    if (!dirResult.ok) return {
      ok: false,
      error: `Failed to create output directory: ${dirResult.error}`
    };

    // Process TTS queue to safely handle API rate limiting
    const requests = R.map(lines, (line, index) => createAudioRequest(line, index));
    const queueResult = await ttsQueueService.processQueue(requests);
    if (!queueResult.ok) return queueResult;

    if (queueResult.data.failures.length > 0) {
      const failureMessage = R.pipe(
        queueResult.data.failures,
        R.map(f => `${f.request.metadata?.characterId}: ${f.error}`),
        errors => errors.join(', ')
      );
      return { ok: false, error: `TTS generation failed: ${failureMessage}` };
    }

    // handle file saving
    const results = await Promise.all(
      R.map(queueResult.data.successes, async (success, index) => {
        const line = lines[index];
        const fileName = `segment_${index}_${line.provider}_${line.characterId}.mp3`;
        const saveResult = await fsPort.writeFile(
          `${outputDir}/${fileName}`, 
          success.data.data
        );

        return !saveResult.ok
          ? { ok: false as const, error: `Failed to save audio: ${saveResult.error}` }
          : { ok: true as const, data: { path: saveResult.data } };
      })
    );

    const failure = R.find(results, (r): r is { ok: false; error: string } => !r.ok);
    if (failure) return failure;

    const successResults = results as Array<{ ok: true; data: { path: string } }>;
    return {
      ok: true,
      data: {
        paths: R.map(successResults, r => r.data.path),
        metadata: {
          timestamp: new Date().toISOString(),
          totalSegments: successResults.length,
          providers: [...new Set(lines.map(l => l.provider))]
        }
      }
    };
  };

  return { synthesizeDialogue };
};