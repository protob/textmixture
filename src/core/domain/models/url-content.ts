import type { Result } from '@shared-types/result';

export type UrlLoadOptions = {
    readonly save?: boolean;
};

export type UrlLoadResult = Result<{
    readonly content: string;
    readonly savedTo?: string;
}>;