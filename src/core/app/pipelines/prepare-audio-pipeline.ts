import * as R from 'remeda'
import { readFile } from 'fs/promises'
import { composePipelineSteps } from './compose-pipeline-steps'
import { createAudioGenerationStep } from '@steps/generate-audio'
import { createOpenAIAudioAdapter } from '@adapters/api/openai-audio'
import { createElevenLabsAudioAdapter } from '@adapters/api/elevenlabs-audio'
import { createFsAdapter } from '@adapters/common/fs-adapter'
import { DEFAULT_CONFIG } from '@models/app-config'
import { logger } from '@utils/logger'
import type { Result } from '@shared-types/result'
import type { DialogueLine, DialogueContent } from '@models/dialogue'
import type { BaseContext } from '@steps/types'
import type { FullAudioContext, PipelineInputContext } from '@steps/types-audio-context'
import type { AudioRequest } from '@models/audio'

export type AudioPipelineResult = Result<FullAudioContext>

const parseDialogue = (content: string): DialogueLine[] => R.pipe(
    content.split('\n'),
    R.filter(line => line.includes(':')),
    R.map((line, index) => {
        const [speaker, ...parts] = line.split(':')
        return {
            speaker: speaker.trim(),
            text: parts.join(':').trim(),
            index,
            metadata: { original: line, timestamp: new Date().toISOString() }
        }
    })
)

const loadDialogueContent = async (
    outputPath: string,
    language: 'en' | 'de' = 'de'
): Promise<DialogueContent> => {
    const content = await readFile(`${outputPath}/${language}/dialogue.txt`, 'utf8')
        .catch(error => { throw new Error(`Failed to load dialogue content: ${error}`) })

    return {
        lines: parseDialogue(content),
        metadata: {
            language,
            loadedFrom: `${outputPath}/${language}/dialogue.txt`,
            loadedAt: new Date().toISOString()
        }
    }
}

const createAudioPort = (config = DEFAULT_CONFIG) => {
    const adapters = {
        openai: createOpenAIAudioAdapter(config.openai.apiKey, config.openai.baseUrl),
        elevenlabs: createElevenLabsAudioAdapter(config.elevenlabs.apiKey, config.elevenlabs.baseUrl)
    }
    return { generateAudio: (req: AudioRequest) => adapters[req.provider].generateAudio(req) }
}

export const createAudioPipeline = (
    outputPath: string,
    language: 'en' | 'de',
    provider: 'openai' | 'elevenlabs' | 'mixed_providers'
) => composePipelineSteps<BaseContext, FullAudioContext>(
    createAudioGenerationStep(createAudioPort(), createFsAdapter(), outputPath, language, provider)
)

export const runPrepareAudioPipeline = async (
    initialContext: PipelineInputContext,
    outputPath: string,
    language: 'en' | 'de' = 'de',
    provider: 'openai' | 'elevenlabs' | 'mixed_providers' = 'openai'
): Promise<AudioPipelineResult> => {
    try {
        logger.info('🎙️ Starting Audio Pipeline', { language, provider })

        const result = await R.pipe(
            await loadDialogueContent(outputPath, language),
            dialogueContent => ({
                ...initialContext,
                dialogue: dialogueContent,
                content: initialContext.content || ''
            }),
            contextWithDialogue => createAudioPipeline(outputPath, language, provider)(contextWithDialogue)
        )


        if (!result.ok) return { ok: false, error: `Pipeline execution failed: ${result.error}` }

        logger.success('✅ Audio Pipeline completed successfully', {
            segments: result.data.audio.metadata.totalSegments,
            language,
            provider
        })

        return result
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        logger.error('Audio Pipeline failed', { error: msg })
        return { ok: false, error: msg }
    }
}
