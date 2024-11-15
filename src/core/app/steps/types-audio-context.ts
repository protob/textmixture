import type { BaseContext } from './types';
import type { DialogueContent } from '@models/dialogue';

export type ContentData = { readonly content: string };

export type AudioSegment = {
    readonly path: string;
    readonly provider: 'openai' | 'elevenlabs'; // Adjusted type
    readonly characterId: string;
};

export type AudioMetadata = {
    readonly totalSegments: number;
    readonly timestamp: string;
    readonly provider: 'openai' | 'elevenlabs' | 'mixed_providers';
};

export type AudioData = {
    readonly segments: readonly AudioSegment[];
    readonly metadata: AudioMetadata;
};

export type WithPath = { readonly outputPath: string };

export type AudioBaseContext = BaseContext &
    WithPath & {
    readonly audio: AudioData;
};

export type WithOptionalContent = { readonly content?: string };

export type WithContent = { readonly content: string };

export type WithDialogue = { readonly dialogue: DialogueContent };

export type FullAudioContext = AudioBaseContext & WithContent & WithDialogue;

export type DSPContext = AudioBaseContext & Partial<WithContent & WithDialogue>;

export type PipelineInputContext = BaseContext & WithPath & WithOptionalContent;
