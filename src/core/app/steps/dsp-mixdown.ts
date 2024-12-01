import * as R from 'remeda';
import { join } from 'path';
import type { PipelineStep } from './types';
import type { DSPContext } from './types-audio-context';
import type { DSPPort } from '@data-access/dsp-port';
import type { AudioFormat } from '@models/dsp';
import { DEFAULT_DSP_SETTINGS } from '@models/dsp';
import { logger } from '@utils/logger';

export type MixdownResult = {
  readonly path: string;
  readonly metadata: {
    readonly timestamp: string;
    readonly provider: string;
    readonly format: AudioFormat;
  };
};

export type MixdownContext = DSPContext & {
  readonly mixdown: MixdownResult;
};

const findSegmentPaths = (segments: DSPContext['audio']['segments']): string[] =>
  R.pipe(
    segments,
    R.sortBy(s => parseInt(s.path.match(/segment_(\d+)/)?.[1] || '0', 10)),
    R.map(s => s.path)
  );

const createMixPath = (basePath: string, language: string, provider: string) => {
  const filePrefix = `${language}_${process.env.CURRENT_SERIES_ID}_${process.env.CURRENT_EPISODE_ID}`;
  return join(basePath, language, provider, `${filePrefix}_${provider}_raw.mp3`);
};

export const createDSPMixdownStep = (
  dspPort: DSPPort,
  outputPath: string,
  language: string,
  provider: string
): PipelineStep<DSPContext, MixdownContext> =>
  async context => {
    try {
      logger.info('Starting DSP mixdown', {
        segments: context.audio.segments.length,
        provider,
        silenceDuration: DEFAULT_DSP_SETTINGS.silence.durationMs
      });

      const mixResult = await dspPort.mergeAudio(
        findSegmentPaths(context.audio.segments),
        createMixPath(outputPath, language, provider),
        DEFAULT_DSP_SETTINGS.format,
        DEFAULT_DSP_SETTINGS.silence
      );

      if (!mixResult.ok) {
        return {
          ok: false,
          error: `Failed to mix segments: ${mixResult.error}`
        };
      }

      return {
        ok: true,
        data: {
          ...context,
          mixdown: {
            path: mixResult.data,
            metadata: {
              timestamp: new Date().toISOString(),
              provider,
              format: DEFAULT_DSP_SETTINGS.format
            }
          }
        }
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('DSP mixdown failed', { error: msg });
      return { ok: false, error: msg };
    }
  };