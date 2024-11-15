import { z } from 'zod'

// Voice settings schemas
const openAIVoiceSettingsSchema = z.object({
    voiceId: z.string(),
    language: z.string(),
    model: z.string().optional(),
    format: z.string().optional(),
    settings: z.object({
        stability: z.number().optional(),
        model: z.string().optional(),
        similarityBoost: z.number().optional(),
        style: z.number().optional(),
        voice: z.string().optional(),
        useSpeakerBoost: z.boolean().optional()
    }).optional()
})

const elevenLabsVoiceSettingsSchema = z.object({
    voiceId: z.string(),
    language: z.string(),
    modelId: z.string().optional(),
    settings: z.object({
        stability: z.number(),
        similarityBoost: z.number(),
        style: z.number(),
        useSpeakerBoost: z.boolean()
    })
})

// Main config schemas
export const currentConfigSchema = z.object({
    Characters: z.array(z.string()),
    StyleID: z.string(),
    SeriesID: z.string(),
    EpisodeID: z.string(),
    audioOutput: z.object({
        de: z.boolean(),
        en: z.boolean()
    }),
    outputSettings: z.object({
        format: z.string(),
        bitrate: z.string(),
        normalization: z.boolean()
    })
})

export const characterConfigSchema = z.object({
    CharacterID: z.string(),
    name: z.string(),
    expertise: z.string(),
    speakingStyle: z.string(),
    voiceSettings: z.object({
        openai: openAIVoiceSettingsSchema.optional(),
        elevenlabs: elevenLabsVoiceSettingsSchema.optional()
    })
})

export const styleConfigSchema = z.object({
    StyleID: z.string(),
    tone: z.string(),
    avoid: z.array(z.string()),
    targetAudience: z.string(),
    conversationFlow: z.string(),
    guidelines: z.array(z.string())
})

export const seriesConfigSchema = z.object({
    SeriesID: z.string(),
    title: z.string(),
    defaultSpeakers: z.array(z.string()),
    StyleID: z.string()
})

export const episodeConfigSchema = z.object({
    EpisodeID: z.string(),
    epNumber: z.number(),
    SeriesID: z.string(),
    TopicID: z.string(),
    localSources: z.array(z.string()),
    urlSources: z.array(z.string()).optional(),
    title: z.string(),
    about: z.string(),
    topicsToCover: z.array(z.string()),
    FocusID: z.string(),
    defaultSpeakers: z.array(z.string())
})

// Full config schema
export const fullConfigSchema = z.object({
    current: currentConfigSchema,
    characters: z.array(characterConfigSchema),
    style: styleConfigSchema,
    series: seriesConfigSchema,
    episode: episodeConfigSchema
})