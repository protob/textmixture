export type Result<T, E = string> =
    | { ok: true; data: T }
    | { ok: false; error: E; failedFile?: string }

export type AsyncResult<T, E = string> = Promise<Result<T, E>>