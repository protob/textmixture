import type { Result } from '@shared-types/result';
import type { BaseContext, PipelineStep, Pipeline } from '@steps/types';

export const composePipelineSteps = <TInput extends BaseContext, TOutput extends TInput>(
    ...steps: PipelineStep<any, any>[]
): Pipeline<TInput, TOutput> => {
    return async (initialContext: TInput): Promise<Result<TOutput>> => {
        let context = initialContext;

        for (const step of steps) {
            const result = await step(context);
            if (!result.ok) return result;
            context = result.data;
        }

        return { ok: true, data: context as TOutput };
    };
};