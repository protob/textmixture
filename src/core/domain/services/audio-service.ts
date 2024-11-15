// src/pure/domain/services/audio-service.ts
import type { AudioPort } from '@data-access/audio-port'
import type { AudioRequest, AudioResult } from '@models/audio'

export const createAudioService = (audioPort: AudioPort) => {
    const generateAudio = async (request: AudioRequest): Promise<AudioResult> => {
        return audioPort.generateAudio(request)
    }
    return { generateAudio }
}