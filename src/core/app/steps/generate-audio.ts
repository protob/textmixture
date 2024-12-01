import * as R from 'remeda'
import type { DialogueContext } from './generate-dialogue'
import type { PipelineStep } from './types'
import type { AudioPort } from '@data-access/audio-port'
import type { FileSystemPort } from '@data-access/fs-port'
import type { CharacterConfig } from '@models/yaml-metadata'
import type { FullAudioContext } from './types-audio-context'
import type { AudioRequest, ElevenLabsSettings, OpenAIVoice } from '@models/audio'
import type { DialogueLine } from '@models/dialogue'
import type { Result } from '@shared-types/result'
import { createTTSQueueService } from '@services/tts-queue-service';
import { logger } from '@utils/logger'

export const OUTPUT_SEGMENT_LIMIT = 2 //  number like 999999 for all items

const findCharacter = (characters: readonly CharacterConfig[], speakerName: string): CharacterConfig | undefined =>
    R.find(characters, char => char.name.toLowerCase() === speakerName.toLowerCase())

const getProviderForSegment = (index: number): 'openai' | 'elevenlabs' =>
    index % 2 === 0 ? 'openai' : 'elevenlabs'

const getEffectiveProvider = (provider: 'openai' | 'elevenlabs' | 'mixed_providers', index: number): 'openai' | 'elevenlabs' =>
    provider === 'mixed_providers' ? getProviderForSegment(index) : provider

type VoiceConfigResult = Result<{
    voiceConfig: {
        voiceId: string
        model?: string
        modelId?: string
        settings?: ElevenLabsSettings
    }  
}>

const getVoiceConfig = (character: CharacterConfig, effectiveProvider: 'openai' | 'elevenlabs', speakerName: string): VoiceConfigResult => {
    if (effectiveProvider === 'openai') {
        const voiceSettings = character.voiceSettings.openai
        if (!voiceSettings?.voiceId) {
            return { ok: false, error: `No OpenAI voice configuration found for ${speakerName}` }
        }
        return {
            ok: true,
            data: {
                voiceConfig: {
                    voiceId: voiceSettings.voiceId,
                    model: voiceSettings.model
                }
            }
        }
    } else {
        const voiceSettings = character.voiceSettings.elevenlabs
        if (!voiceSettings?.voiceId) {
            return { ok: false, error: `No ElevenLabs voice configuration found for ${speakerName}` }
        }
        return {
            ok: true,
            data: {
                voiceConfig: {
                    voiceId: voiceSettings.voiceId,
                    modelId: voiceSettings.modelId,
                    settings: voiceSettings.settings
                }
            }
        }
    }
}

const createAudioRequest = (
    line: DialogueLine,
    index: number,
    voiceConfig: { voiceId: string, model?: string, modelId?: string, settings?: ElevenLabsSettings },
    effectiveProvider: 'openai' | 'elevenlabs'
): AudioRequest => {
    const metadata = {
        characterId: line.speaker,
        segmentIndex: index
    }

    if (effectiveProvider === 'openai') {
        return {
            provider: 'openai',
            text: line.text,
            voice: voiceConfig.voiceId as OpenAIVoice,
            model: voiceConfig.model || 'tts-1',
            metadata
        }
    } else {
        return {
            provider: 'elevenlabs',
            text: line.text,
            voiceId: voiceConfig.voiceId,
            settings: voiceConfig.settings,
            metadata
        }
    }
}

export const createAudioGenerationStep = (
    audioPort: AudioPort,
    fsPort: FileSystemPort,
    outputPath: string,
    language: string,
    provider: 'openai' | 'elevenlabs' | 'mixed_providers'
): PipelineStep<DialogueContext, FullAudioContext> => async context => {
    try {
        logger.info('Starting audio generation')

        const ttsQueueService = createTTSQueueService(audioPort);

        const requests = R.pipe(
            context.dialogue.lines,
            R.take(OUTPUT_SEGMENT_LIMIT),
            R.map((line, index) => {
                const character = findCharacter(context.config.characters, line.speaker);
                if (!character || !character.voiceSettings) {
                    throw new Error(`Character not found or missing voice settings: ${line.speaker}`);
                }
                
                const effectiveProvider = getEffectiveProvider(provider, index);
                const voiceConfigResult = getVoiceConfig(character, effectiveProvider, line.speaker);
                if (!voiceConfigResult.ok) throw new Error(voiceConfigResult.error);

                return createAudioRequest(line, index, voiceConfigResult.data.voiceConfig, effectiveProvider);
            })
        );

        const queueResult = await ttsQueueService.processQueue(requests);

        if (!queueResult.ok) {
            return { ok: false, error: queueResult.error };
        }

        const segments = await Promise.all(
            queueResult.data.successes.map(async (success, index) => {
                const outputDir = `${outputPath}/${language}/${provider}/segments`;
                await fsPort.ensureDir(outputDir);

                const speaker = context.dialogue.lines[index].speaker.toLowerCase();
                const fileName = `segment_${index}_${speaker}.mp3`;
                const segmentPath = `${outputDir}/${fileName}`;

                const saveResult = await fsPort.writeFile(segmentPath, success.data.data);

                if (!saveResult.ok) {
                    throw new Error(`Failed to save audio: ${saveResult.error}`);
                }

                return {
                    path: segmentPath,
                    provider: success.request.provider,
                    characterId: speaker
                };
            })
        );

        logger.success('Audio generation completed', {
            totalSegments: segments.length,
            provider
        });

        return {
            ok: true,
            data: {
                ...context,
                outputPath,
                audio: {
                    segments,
                    metadata: {
                        totalSegments: segments.length,
                        timestamp: new Date().toISOString(),
                        provider
                    }
                }
            }
        };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('Audio generation failed', { error: msg });
        return { ok: false, error: msg };
    }
};