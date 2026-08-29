import { SuccessSiteAdapter } from './types'
import { SuccessDetectionResult, ApplicationSession, ExtractedJob } from '../types'
import { confidenceScorer } from '../confidenceScorer'

export class GreenhouseSuccessAdapter implements SuccessSiteAdapter {
  name = 'Greenhouse'

  canHandle(url: string): boolean {
    return url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')
  }

  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null {
    const confirmationEl = doc.querySelector('#application_confirmation, .application-confirmation, #app_body .thank_you')
    const pageText = (doc.body?.textContent || '').toLowerCase()

    const hasGreenhouseSuccess =
      !!confirmationEl ||
      pageText.includes('thank you for applying to') ||
      pageText.includes('your application has been submitted') ||
      pageText.includes('we received your application')

    if (hasGreenhouseSuccess) {
      return confidenceScorer.evaluate(url, doc, session, [
        { name: 'Greenhouse Confirmation', score: 50, detail: 'Greenhouse application confirmation matched' },
      ])
    }

    return confidenceScorer.evaluate(url, doc, session)
  }

  extractSubmittedJobInfo(doc: Document): Partial<ExtractedJob> | null {
    const heading = doc.querySelector('h1, h2')?.textContent?.trim()
    if (heading && heading.includes('at ')) {
      const parts = heading.split('at ')
      return { title: parts[0].trim(), company: parts[1].trim() }
    }
    return null
  }
}
