import { AutofillSiteAdapter } from './types'

export class SmartRecruitersAutofillAdapter implements AutofillSiteAdapter {
  name = 'SmartRecruiters'

  canHandle(url: string): boolean {
    return url.includes('smartrecruiters.com') || url.includes('careers.smartrecruiters.com')
  }

  isApplicationForm(url: string, doc: Document): boolean {
    if (!this.canHandle(url)) return false
    const hasForm = !!doc.querySelector('#st-apply, form.st-apply, [data-qa="apply-form"], form[action*="smartrecruiters"]')
    const hasInputs = doc.querySelectorAll('input:not([type="hidden"]), textarea').length >= 2
    return (hasForm && hasInputs) || url.includes('/apply')
  }

  findFormRoots(doc: Document): HTMLElement[] {
    const forms = Array.from(
      doc.querySelectorAll<HTMLElement>('#st-apply, form.st-apply, [data-qa="apply-form"], form[action*="smartrecruiters"]')
    )
    if (forms.length > 0) return forms
    const genericForms = Array.from(doc.querySelectorAll<HTMLElement>('form'))
    return genericForms.length > 0 ? genericForms : [doc.body]
  }
}
