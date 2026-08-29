import { AutofillSiteAdapter } from './types'

export class IndeedAutofillAdapter implements AutofillSiteAdapter {
  name = 'Indeed'

  canHandle(url: string): boolean {
    return url.includes('indeed.com')
  }

  isApplicationForm(_url: string, doc: Document): boolean {
    return !!doc.querySelector('#ia-container, .ia-BasePage, form[action*="apply" i]')
  }

  findFormRoots(doc: Document): HTMLElement[] {
    const root = doc.querySelector('#ia-container, .ia-BasePage, form') as HTMLElement | null
    return root ? [root] : [doc.body]
  }
}
