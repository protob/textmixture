import * as R from 'remeda'
import type { DialogueContext } from './generate-dialogue'
import type { PipelineStep } from './types'
import type { AudioPort } from '@data-access/audio-port'
import type { FileSystemPort } from '@data-access/fs-port'
import type { CharacterConfig } from '@models/yaml-metadata'
import type { AudioSegment, FullAudioContext } from './types-audio-context'
import type { AudioRequest, ElevenLabsSettings, OpenAIVoice } from '@models/audio'
import type { DialogueLine } from '@models/dialogue'
import type { Result } from '@shared-types/result'
import { logger } from '@utils/logger'

export const OUTPUT_SEGMENT_LIMIT = 2

const findCharacter = (characters: readonly CharacterConfig[], speakerName: string): CharacterConfig | undefined =>
    R.find(characters, char => char.name.toLowerCase() === speakerName.toLowerCase())

const getProviderForSegment = (index: number): 'openai' | 'elevenlabs' =>
    index % 2 === 0 ? 'openai' : 'elevenlabs'

const getEffectiveProvider = (
    provider: 'openai' | 'elevenlabs' | 'mixed_providers',
    index: number
): 'openai' | 'elevenlabs' =>
    provider === 'mixed_providers' ? getProviderForSegment(index) : provider

type VoiceConfigResult = Result<{
    voiceConfig: {
        voiceId: string
        model?: string
        modelId?: string
        settings?: ElevenLabsSettings
    }
}>

const getVoiceConfig = (
    character: CharacterConfig,
    effectiveProvider: 'openai' | 'elevenlabs',
    speakerName: string
): VoiceConfigResult => {
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
    voiceConfig: {
        voiceId: string
        model?: string
        modelId?: string
        settings?: ElevenLabsSettings
    },
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

type GenerateAudioConfig = {
    ports: {
        audio: AudioPort
        fs: FileSystemPort
    }
    request: AudioRequest
    outputDir: string
    index: number
    speaker: string
}

const generateAndSaveAudioSegment =
    async ({ports, request, outputDir, index, speaker }: GenerateAudioConfig): Promise<Result<AudioSegment>> => {
        const result = await ports.audio.generateAudio(request)
        if (!result.ok) return result

        await ports.fs.ensureDir(outputDir)
        const segmentPath = `${outputDir}/segment_${index}_${speaker.toLowerCase()}.mp3`
        const saveResult = await ports.fs.writeFile(segmentPath, result.data.data)

        if (!saveResult.ok) {
            return { ok: false, error: `Failed to save audio: ${saveResult.error}` }
        }

        return {
            ok: true,
            data: {
                path: segmentPath,
                provider: request.provider,
                characterId: speaker
            }
        }
}

type ProcessLineConfig = {
    line: DialogueLine
    index: number
    context: DialogueContext
    provider: 'openai' | 'elevenlabs' | 'mixed_providers'
    ports: {
        audio: AudioPort
        fs: FileSystemPort
    }
    outputPath: string
    language: string
}

const processLine =
    async ({line, index, context, provider, ports, outputPath, language }: ProcessLineConfig): Promise<Result<AudioSegment>> => {
        const character = findCharacter(context.config.characters, line.speaker)
        if (!character || !character.voiceSettings) {
            return { ok: false, error: `Character not found or missing voice settings: ${line.speaker}` }
        }

        const effectiveProvider = getEffectiveProvider(provider, index)
        const voiceConfigResult = getVoiceConfig(character, effectiveProvider, line.speaker)
        if (!voiceConfigResult.ok) return voiceConfigResult

        const request = createAudioRequest(line, index, voiceConfigResult.data.voiceConfig, effectiveProvider)
        const outputDir = `${outputPath}/${language}/${provider}/segments`

        return generateAndSaveAudioSegment({ports, request, outputDir, index, speaker: line.speaker})
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

        const ports = { audio: audioPort, fs: fsPort }
        const results = await R.pipe(
            context.dialogue.lines,
            R.take(OUTPUT_SEGMENT_LIMIT),
            lines => Promise.all(lines.map(line =>
                processLine({ line, index: line.index, context, provider, ports, outputPath, language })
            ))
        )

        const failure = R.find(results, (r): r is { ok: false; error: string } => !r.ok)
        if (failure) return failure

        const segments = R.pipe(
            results,
            R.filter((r): r is { ok: true; data: AudioSegment } => r.ok),
            R.map(r => r.data)
        )

        logger.success('Audio generation completed', {
            totalSegments: segments.length,
            provider
        })

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
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        logger.error('Audio generation failed', { error: msg })
        return { ok: false, error: msg }
    }
}