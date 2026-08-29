import { AutofillSiteAdapter } from './types'

export class LeverAutofillAdapter implements AutofillSiteAdapter {
  name = 'Lever'

  canHandle(url: string): boolean {
    return url.includes('lever.co') || url.includes('jobs.lever.co')
  }

  isApplicationForm(url: string, doc: Document): boolean {
    return (
      /\/apply\/?$/i.test(url) ||
      !!doc.querySelector('.application-form, form#application-form, .application-page')
    )
  }

  findFormRoots(doc: Document): HTMLElement[] {
    const form = doc.querySelector('.application-form, form#application-form, form') as HTMLElement | null
    return form ? [form] : [doc.body]
  }
}
