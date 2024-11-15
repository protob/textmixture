import * as R from 'remeda';
import { createFsAdapter } from '@adapters/common/fs-adapter';
import type { PipelineStep } from './types';
import type { TranslationContext } from './translate-dialogue';
import type { OutputPathsContext } from './ensure-structure';
import { logger } from '@utils/logger';

export type OutputContext = TranslationContext & OutputPathsContext;

const formatDialogue = (lines: readonly { speaker: string, text: string }[]): string =>
    R.pipe(
        lines,
        R.map(line => `${line.speaker}: ${line.text}`),
        R.join('\n')
    );

export const createWriteOutputsStep = (): PipelineStep<OutputContext, OutputContext> => {
    const fsAdapter = createFsAdapter();

    return async (context) => {
        logger.debug('Writing outputs');

        const enResult = await fsAdapter.writeFile(
            context.outputPaths.languages.en.dialogue,
            formatDialogue(context.dialogue.lines)
        );

        if (!enResult.ok) return enResult;

        const deResult = await fsAdapter.writeFile(
            context.outputPaths.languages.de.dialogue,
            formatDialogue(context.translation.lines)
        );

        if (!deResult.ok) return deResult;

        const metadataResult = await fsAdapter.writeFile(
            context.outputPaths.metadata,
            JSON.stringify(
                {
                    ...context.dialogue.metadata,
                    ...context.enrichment,
                    enrichedAt: new Date().toISOString(),
                    translated: true,
                    languages: ['en', 'de'],
                },
                null,
                2
            )
        );

        return !metadataResult.ok ? metadataResult : { ok: true, data: context };
    };
};