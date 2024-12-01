import type { Result } from '@shared-types/result';
import type { 
  AudioMetrics, 
  NormalizationSettings, 
  AudioFormat,
  SilenceConfig 
} from '@models/dsp';

export interface DSPPort {
  mergeAudio(
    inputPaths: string[],
    outputPath: string,
    format: AudioFormat,
    silenceConfig?: SilenceConfig
  ): Promise<Result<string>>;

  normalizeAudio(
    inputPath: string,
    outputPath: string,
    settings: NormalizationSettings
  ): Promise<Result<string>>;

  analyzeAudio(
    path: string
  ): Promise<Result<AudioMetrics>>;
}