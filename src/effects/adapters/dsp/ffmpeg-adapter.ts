import { exec } from 'child_process';
import { promisify } from 'util';
import * as R from 'remeda';
import { logger } from '@utils/logger';
import type { DSPPort } from '@data-access/dsp-port';
import type { SilenceConfig } from '@models/dsp';

const execAsync = promisify(exec);

const buildCommand = (parts: (string | undefined)[]) =>
  R.pipe(
    parts,
    R.filter((x): x is string => !!x),
    R.join(' ')
  );

const createSilenceFilter = (durationMs: number): string =>
  `aevalsrc=0:d=${durationMs/1000}`;

const buildFilterGraph = (inputCount: number, silenceConfig?: SilenceConfig): string => {
  // Without silence, concat all inputs
  if (!silenceConfig) {
    return R.pipe(
      R.range(0, inputCount),
      R.map(i => `[${i}:a]`),
      labels => `${labels.join('')}concat=n=${inputCount}:v=0:a=1[aout]`
    );
  }

  const silenceStartIndex = inputCount;
  const parts: string[] = [];
  
  // add silence after each audio segment except the last one
  R.range(0, inputCount - 1).forEach(i => {
    const silenceIndex = silenceStartIndex + i;
    parts.push(`[${i}:a][${silenceIndex}:a]concat=n=2:v=0:a=1[tmp${i}]`);
  });

  // final config
  const tmpInputs = R.pipe(
    R.range(0, inputCount - 1),
    R.map(i => `[tmp${i}]`),
    R.join('')
  );
  
  const finalConcat = `${tmpInputs}[${inputCount - 1}:a]concat=n=${inputCount}:v=0:a=1[aout]`;
  return [...parts, finalConcat].join(';');
};

export const createFFmpegAdapter = (): DSPPort => {
  const mergeAudio: DSPPort['mergeAudio'] = async (
    segments,
    outputPath,
    format,
    silenceConfig
  ) => {
    try {
      // for audio segments
      const inputFlags = R.pipe(
        segments,
        R.map(path => `-i "${path}"`),
        R.join(' ')
      );

      // for silence segments
      const silenceFlags = silenceConfig
        ? R.pipe(
            R.range(0, segments.length - 1),
            R.map(() => `-f lavfi -i "${createSilenceFilter(silenceConfig.durationMs)}"`),
            R.join(' ')
          )
        : '';

      const filterGraph = buildFilterGraph(segments.length, silenceConfig);

      const command = buildCommand([
        'ffmpeg -y',
        inputFlags,
        silenceFlags,
        '-filter_complex',
        `"${filterGraph}"`,
        '-map "[aout]"',
        `-ar ${format.sampleRate}`,
        `-ac ${format.channels}`,
        `-c:a ${format.codec}`,
        `-b:a ${format.bitrate}`,
        `"${outputPath}"`
      ]);

      logger.debug('Executing FFmpeg merge', { command });
      const { stdout, stderr } = await execAsync(command);
      logger.debug('FFmpeg stdout', { stdout });
      logger.debug('FFmpeg stderr', { stderr });

      return { ok: true, data: outputPath };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Audio merge failed', { error: errorMsg });
      return { ok: false, error: errorMsg };
    }
  };

  const normalizeAudio: DSPPort['normalizeAudio'] = async (
    inputPath,
    outputPath,
    settings
  ) => {
    try {
      const filters = `loudnorm=I=${settings.targetLUFS}:TP=${settings.maxTruePeak}:print_format=json`;
      const command = buildCommand([
        'ffmpeg -y',
        `-i "${inputPath}"`,
        `-af "${filters}"`,
        `"${outputPath}"`
      ]);

      logger.debug('Executing FFmpeg normalization', { command });
      const { stdout, stderr } = await execAsync(command);
      logger.debug('FFmpeg stdout', { stdout });
      logger.debug('FFmpeg stderr', { stderr });

      return { ok: true, data: outputPath };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Audio normalization failed', { error: errorMsg });
      return { ok: false, error: errorMsg };
    }
  };

  const analyzeAudio: DSPPort['analyzeAudio'] = async path => {
    try {
      const command = buildCommand([
        'ffmpeg',
        `-i "${path}"`,
        '-af loudnorm=print_format=json',
        '-f null -'
      ]);

      const { stdout, stderr } = await execAsync(command);
      logger.debug('FFmpeg stdout', { stdout });
      logger.debug('FFmpeg stderr', { stderr });

      const loudnormMatch = stderr.match(/\{.*?}/s);
      if (!loudnormMatch) {
        const errorMsg = 'Failed to extract audio metrics';
        logger.error(errorMsg, { path });
        return { ok: false, error: errorMsg };
      }

      const metrics = JSON.parse(loudnormMatch[0]);
      return {
        ok: true,
        data: {
          duration: parseFloat(metrics.input_i || '0'),
          peakLevel: parseFloat(metrics.input_tp || '0'),
          rmsLevel: parseFloat(metrics.input_lra || '0'),
          lufs: parseFloat(metrics.input_lufs || '0')
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Audio analysis failed', { error: errorMsg });
      return { ok: false, error: errorMsg };
    }
  };

  return {
    mergeAudio,
    normalizeAudio,
    analyzeAudio
  };
};