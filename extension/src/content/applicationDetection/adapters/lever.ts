import { SuccessSiteAdapter } from './types'
import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'
import { confidenceScorer } from '../confidenceScorer'

export class LeverSuccessAdapter implements SuccessSiteAdapter {
  name = 'Lever'

  canHandle(url: string): boolean {
    return url.includes('lever.co') || url.includes('jobs.lever.co')
  }

  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null {
    const confirmationEl = doc.querySelector('.application-confirmation, .application-submitted, .thank-you')
    const pageText = (doc.body?.textContent || '').toLowerCase()

    const hasLeverSuccess =
      !!confirmationEl ||
      pageText.includes('application submitted') ||
      pageText.includes('thank you for applying') ||
      pageText.includes('thanks for applying')

    if (hasLeverSuccess) {
      return confidenceScorer.evaluate(url, doc, session, [
        { name: 'Lever Confirmation', score: 50, detail: 'Lever application confirmation matched' },
      ])
    }

    return confidenceScorer.evaluate(url, doc, session)
  }

  extractSubmittedJobInfo(doc: Document): Partial<ExtractedJob> | null {
    const title = doc.querySelector('.posting-headline h2, h2.posting-title, h1')?.textContent?.trim()
    const company = doc.querySelector('.main-header-logo img')?.getAttribute('alt') || undefined
    return { title: title || undefined, company }
  }
}
