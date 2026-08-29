import { SuccessSiteAdapter } from './types'
import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'
import { confidenceScorer } from '../confidenceScorer'

export class AshbySuccessAdapter implements SuccessSiteAdapter {
  name = 'Ashby'

  canHandle(url: string): boolean {
    return url.includes('ashbyhq.com') || url.includes('jobs.ashbyhq.com')
  }

  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null {
    const confirmationEl = doc.querySelector('[class*="submittedConfirmation" i], [class*="applicationSuccess" i], [data-ashby-application-success]')
    const pageText = (doc.body?.textContent || '').toLowerCase()

    const hasAshbySuccess =
      !!confirmationEl ||
      pageText.includes('application submitted') ||
      pageText.includes('thank you for applying') ||
      pageText.includes("we've received your application") ||
      pageText.includes('application has been received')

    if (hasAshbySuccess) {
      return confidenceScorer.evaluate(url, doc, session, [
        { name: 'Ashby Confirmation', score: 55, detail: 'Ashby application confirmation state matched' },
      ])
    }

    return confidenceScorer.evaluate(url, doc, session)
  }

  extractSubmittedJobInfo(doc: Document): Partial<ExtractedJob> | null {
    const title = doc.querySelector('h1, [class*="jobTitle" i], [data-testid="job-title"]')?.textContent?.trim()
    return { title: title || undefined }
  }
}
