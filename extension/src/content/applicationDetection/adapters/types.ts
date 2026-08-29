import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'

export interface SuccessSiteAdapter {
  name: string
  canHandle(url: string, doc: Document): boolean
  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null
  extractSubmittedJobInfo?(doc: Document, session?: ApplicationSession | null): Partial<ExtractedJob> | null
}
