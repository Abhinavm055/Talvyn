import { SuccessSiteAdapter } from './types'
import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'
import { confidenceScorer } from '../confidenceScorer'

export class LinkedInSuccessAdapter implements SuccessSiteAdapter {
  name = 'LinkedIn'

  canHandle(url: string): boolean {
    return url.includes('linkedin.com')
  }

  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null {
    // In LinkedIn Easy Apply, after submission a completion modal appears saying "Your application was sent to [Company]"
    const modal = doc.querySelector('.jobs-easy-apply-modal, .artdeco-modal, div[data-test-modal]')
    const modalText = (modal?.textContent || '').toLowerCase()

    const hasLinkedInSuccess =
      modalText.includes('your application was sent to') ||
      modalText.includes('application submitted') ||
      modalText.includes('application was sent')

    if (hasLinkedInSuccess) {
      return confidenceScorer.evaluate(url, doc, session, [
        { name: 'LinkedIn Easy Apply Confirmation', score: 55, detail: 'LinkedIn submission completion modal matched' },
      ])
    }

    return confidenceScorer.evaluate(url, doc, session)
  }

  extractSubmittedJobInfo(doc: Document): Partial<ExtractedJob> | null {
    const title = doc.querySelector('.job-details-jobs-unified-top-card__job-title, h1.topcard__title')?.textContent?.trim()
    const company = doc.querySelector('.job-details-jobs-unified-top-card__company-name, .topcard__org-name-link')?.textContent?.trim()
    return { title: title || undefined, company: company || undefined }
  }
}
