import { AutofillSiteAdapter } from './types'

export class LinkedInAutofillAdapter implements AutofillSiteAdapter {
  name = 'LinkedIn'

  canHandle(url: string): boolean {
    return url.includes('linkedin.com')
  }

  isApplicationForm(_url: string, doc: Document): boolean {
    return !!doc.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, div[data-test-modal]')
  }

  findFormRoots(doc: Document): HTMLElement[] {
    const modal = doc.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, div[data-test-modal]') as HTMLElement | null
    return modal ? [modal] : [doc.body]
  }
}
