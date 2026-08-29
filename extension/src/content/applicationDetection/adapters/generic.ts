import { SuccessSiteAdapter } from './types'
import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'
import { confidenceScorer } from '../confidenceScorer'

export class GenericSuccessAdapter implements SuccessSiteAdapter {
  name = 'Generic'

  canHandle(): boolean {
    return true
  }

  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null {
    return confidenceScorer.evaluate(url, doc, session)
  }

  extractSubmittedJobInfo(): Partial<ExtractedJob> | null {
    return null
  }
}
