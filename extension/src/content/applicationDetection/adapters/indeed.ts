import { SuccessSiteAdapter } from './types'
import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'
import { confidenceScorer } from '../confidenceScorer'

export class IndeedSuccessAdapter implements SuccessSiteAdapter {
  name = 'Indeed'

  canHandle(url: string): boolean {
    return url.includes('indeed.com')
  }

  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null {
    const confirmationEl = doc.querySelector('#ia-container, .ia-BasePage, .ia-PostApply')
    const containerText = (confirmationEl?.textContent || doc.body?.textContent || '').toLowerCase()

    const hasIndeedSuccess =
      containerText.includes('your application has been submitted') ||
      containerText.includes('application submitted') ||
      containerText.includes('application has been sent')

    if (hasIndeedSuccess) {
      return confidenceScorer.evaluate(url, doc, session, [
        { name: 'Indeed Apply Confirmation', score: 55, detail: 'Indeed post-apply confirmation matched' },
      ])
    }

    return confidenceScorer.evaluate(url, doc, session)
  }

  extractSubmittedJobInfo(doc: Document): Partial<ExtractedJob> | null {
    const title = doc.querySelector('.jobsearch-JobInfoHeader-title, h1[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim()
    const company = doc.querySelector('[data-company-name="true"], .jobsearch-InlineCompanyRating-companyHeader')?.textContent?.trim()
    return { title: title || undefined, company: company || undefined }
  }
}
