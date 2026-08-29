import { AutofillSiteAdapter } from './types'

export class AshbyAutofillAdapter implements AutofillSiteAdapter {
  name = 'Ashby'

  canHandle(url: string): boolean {
    return url.includes('ashbyhq.com') || url.includes('jobs.ashbyhq.com')
  }

  isApplicationForm(url: string, doc: Document): boolean {
    if (!this.canHandle(url)) return false
    const hasForm = !!doc.querySelector('form, [class*="applicationForm" i], [class*="application-form" i]')
    const hasInputs = doc.querySelectorAll('input:not([type="hidden"]), textarea').length >= 2
    return hasForm && hasInputs
  }

  findFormRoots(doc: Document): HTMLElement[] {
    const forms = Array.from(
      doc.querySelectorAll<HTMLElement>('form, [class*="applicationForm" i], [class*="application-form" i]')
    )
    if (forms.length > 0) return forms
    const main = doc.querySelector<HTMLElement>('main')
    return main ? [main] : [doc.body]
  }
}
