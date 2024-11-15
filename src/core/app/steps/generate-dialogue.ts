import * as R from 'remeda'
import { createOpenAIAdapter } from '@adapters/api/openai'
import { createDialogueService } from '@services/dialogue-service'
import { DEFAULT_CONFIG } from '@models/app-config'
import type { DialogueLine } from '@models/dialogue'
import type { PipelineStep } from './types'
import type { ContentContext } from './load-content'
import { logger } from '@utils/logger'

export type DialogueData = {
    readonly dialogue: {
        readonly lines: readonly DialogueLine[]
        readonly metadata: Record<string, unknown>
    }
}

export type DialogueContext = ContentContext & DialogueData

const createSystemPrompt = (context: ContentContext): string =>
    R.pipe(
        [
            `You are simulating a conversation between these speakers:`,
            R.pipe(
                context.config.characters,
                R.map(c => `${c.name} (${c.expertise}):
- Speaking Style: ${c.speakingStyle}`),
                R.join('\n\n')
            ),
            `Style: ${context.config.style.tone}`,
            `Avoid: ${context.config.style.avoid.join(', ')}`
        ],
        R.join('\n\n')
    )

const createUserPrompt = (context: ContentContext): string =>
    R.pipe(
        [
            `Generate a dialogue about: ${context.config.episode.title}`,
            'Topics to cover:',
            R.pipe(
                context.config.episode.topicsToCover,
                R.map((topic: string) => `- ${topic}`),
                R.join('\n')
            ),
            'Content reference:',
            context.content,
            'Generate ~5 lines of engaging dialogue that explores these topics naturally.'
        ],
        R.join('\n\n')
    )

export const createGenerateDialogueStep = (): PipelineStep<ContentContext, DialogueContext> => {
    const openaiAdapter = createOpenAIAdapter(DEFAULT_CONFIG.openai.apiKey, DEFAULT_CONFIG.openai.baseUrl)
    const dialogueService = createDialogueService(openaiAdapter)

    return async (context: ContentContext) => {
        logger.debug('Generating dialogue')

        const result = await dialogueService.generateDialogue({
            systemPrompt: createSystemPrompt(context),
            userPrompt: createUserPrompt(context),
            options: { temperature: 0.7 }
        })

        if (!result.ok) return result

        return {
            ok: true,
            data: {
                ...context,
                dialogue: {
                    ...result.data,
                    metadata: result.data.metadata ?? {}
                }
            }
        }
    }
}