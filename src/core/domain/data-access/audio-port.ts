import type { AudioRequest, AudioResult } from '@models/audio'

export interface AudioPort {
    generateAudio: (request: AudioRequest) => Promise<AudioResult>
}

export type AudioProviders = {
    openai: AudioPort;
    elevenlabs: AudioPort;
};