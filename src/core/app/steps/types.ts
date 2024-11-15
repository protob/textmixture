import type { Result } from '@shared-types/result'
import type { FullConfig } from '@models/yaml-metadata'

export type BaseContext = {
    readonly config: FullConfig
}

// ensures each step extends previous context
export type PipelineStep<TInput extends BaseContext, TOutput extends TInput> =
    (context: TInput) => Promise<Result<TOutput>>

// inject base context into a data type
export type WithContext<T> = BaseContext & T

// extend previous context with new data
export type ExtendContext<TPrev extends BaseContext, TNew> = TPrev & TNew

// Full pipeline type
export type Pipeline<TInput extends BaseContext, TOutput extends TInput> =
    (initialContext: TInput) => Promise<Result<TOutput>>