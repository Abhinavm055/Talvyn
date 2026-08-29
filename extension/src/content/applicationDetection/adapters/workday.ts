import { SuccessSiteAdapter } from './types'
import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'
import { confidenceScorer } from '../confidenceScorer'

export class WorkdaySuccessAdapter implements SuccessSiteAdapter {
  name = 'Workday'

  canHandle(url: string): boolean {
    return url.includes('myworkdayjobs.com') || url.includes('workday.com')
  }

  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null {
    const successMsg = doc.querySelector('[data-automation-id="applicationSubmittedMessage"], [data-automation-id="congratulations"]')
    const pageText = (doc.body?.textContent || '').toLowerCase()

    const hasWorkdaySuccess =
      !!successMsg ||
      pageText.includes('application submitted') ||
      pageText.includes('congratulations') ||
      pageText.includes('thank you for applying')

    if (hasWorkdaySuccess) {
      return confidenceScorer.evaluate(url, doc, session, [
        { name: 'Workday Confirmation', score: 50, detail: 'Workday application completion state matched' },
      ])
    }

    return confidenceScorer.evaluate(url, doc, session)
  }

  extractSubmittedJobInfo(doc: Document): Partial<ExtractedJob> | null {
    const title = doc.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim()
    return { title: title || undefined }
  }
}
