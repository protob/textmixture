import type { AudioRequest, AudioResult } from '@models/audio'

export interface AudioPort {
    generateAudio: (request: AudioRequest) => Promise<AudioResult>
}