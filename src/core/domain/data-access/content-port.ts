import type { ContentFile } from '@models/content'
import type { AsyncResult } from '@shared-types/result'

export interface ContentPort {
    loadFile: (file: ContentFile) => AsyncResult<string>
}