import { SuccessSiteAdapter } from './types'
import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'
import { confidenceScorer } from '../confidenceScorer'

export class SmartRecruitersSuccessAdapter implements SuccessSiteAdapter {
  name = 'SmartRecruiters'

  canHandle(url: string): boolean {
    return url.includes('smartrecruiters.com') || url.includes('careers.smartrecruiters.com')
  }

  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null {
    const confirmationEl = doc.querySelector('.st-apply-success, [data-qa="success-message"], .application-success')
    const pageText = (doc.body?.textContent || '').toLowerCase()

    const hasSRSuccess =
      !!confirmationEl ||
      pageText.includes('application submitted') ||
      pageText.includes('thank you for applying') ||
      pageText.includes('your application has been received')

    if (hasSRSuccess) {
      return confidenceScorer.evaluate(url, doc, session, [
        { name: 'SmartRecruiters Confirmation', score: 55, detail: 'SmartRecruiters application confirmation matched' },
      ])
    }

    return confidenceScorer.evaluate(url, doc, session)
  }

  extractSubmittedJobInfo(doc: Document): Partial<ExtractedJob> | null {
    const title = doc.querySelector('h1.job-title, [data-qa="job-title"], .job-header h1, h1')?.textContent?.trim()
    const company = doc.querySelector('.company-name, [data-qa="company-name"]')?.textContent?.trim()
    return { title: title || undefined, company: company || undefined }
  }
}
