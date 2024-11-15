import * as R from 'remeda'
import type { OpenAIPort } from '@data-access/openai-port'
import type {
    TranslationRequest,
    TranslationResult,
    TranslatedLine
} from '@models/translation'

import type { DialogueLine } from '@models/dialogue'
import { DEFAULT_CONFIG } from '@models/app-config'
import { logger } from '@utils/logger'

// Prompt creation
const createTranslationPrompt = (language: string): string =>
    `You are a professional translator specializing in technical and scientific content.
Translate the provided dialogue into ${language}.
Keep speaker names exactly as they appear.
Maintain technical accuracy and natural conversational flow.
Important: 
- Keep format exactly as: "Speaker: translated text"
- Do not add any markdown formatting
- Preserve original speaker names
`.trim()

// Parse a single translated line
const parseTranslatedLine = (
    line: string,
    index: number,
    sourceLanguage: string,
    targetLanguage: string
): TranslatedLine | null => {
    const [speaker, ...textParts] = line.split(':')
    const text = textParts.join(':').trim()
    const trimmedSpeaker = speaker.trim()
    return trimmedSpeaker && text
        ? {
            speaker: trimmedSpeaker,
            text,
            index,
            metadata: { originalIndex: index, sourceLanguage, targetLanguage }
        }
        : null
}

// Parse all translated text lines
const parseTranslatedText = (
    text: string,
    sourceLanguage: string,
    targetLanguage: string
): readonly TranslatedLine[] =>
    R.pipe(
        text.split('\n'),
        R.filter(line => line.includes(':')),
        R.map((line, index) => parseTranslatedLine(line, index, sourceLanguage, targetLanguage)),
        R.filter((line): line is TranslatedLine => line !== null)
    )

// Validate the translation against the original dialogue
const validateTranslation = (
    lines: readonly TranslatedLine[],
    originalLines: readonly DialogueLine[]
): string | null =>
    lines.length !== originalLines.length
        ? 'Translation line count mismatch'
        : R.pipe(
            lines,
            R.zip(originalLines),
            R.find(([trans, orig]) => trans.speaker.toLowerCase() !== orig.speaker.toLowerCase()),
            mismatch => (mismatch ? 'Speaker order mismatch in translation' : null)
        )

export const createTranslationService = (openaiPort: OpenAIPort) => ({
    translateDialogue: async ({
                                  content,
                                  targetLanguage,
                                  sourceLanguage = 'en'
                              }: TranslationRequest): Promise<TranslationResult> => {
        const dialogueText = R.pipe(
            content.lines,
            R.map(line => `${line.speaker}: ${line.text}`),
            R.join('\n')
        )

        const model = DEFAULT_CONFIG.openai.textModel

        const result = await openaiPort.generateText({
            messages: [
                { role: 'system', content: createTranslationPrompt(targetLanguage) },
                { role: 'user', content: dialogueText }
            ],
            model: model.name,
            temperature: model.temperature,
            maxTokens: model.maxTokens,
            stop: model.stop ? [...model.stop] : undefined
        })

        if (!result.ok) {
            logger.error('Translation failed', { error: result.error })
            return result
        }

        const translatedLines = parseTranslatedText(result.data.content, sourceLanguage, targetLanguage)
        const validationError = validateTranslation(translatedLines, content.lines)

        if (validationError) {
            logger.error('Translation validation failed', { error: validationError })
            return { ok: false, error: validationError }
        }

        return {
            ok: true,
            data: {
                lines: translatedLines,
                metadata: {
                    ...content.metadata,
                    translated: true,
                    sourceLanguage,
                    targetLanguage,
                    translatedAt: new Date().toISOString(),
                    model: model.name
                }
            }
        }
    }
})
