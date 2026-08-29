import { AutofillSiteAdapter } from './types'

export class GenericAutofillAdapter implements AutofillSiteAdapter {
  name = 'Generic'

  canHandle(): boolean {
    return true
  }

  isApplicationForm(url: string, doc: Document): boolean {
    const cleanUrl = url.toLowerCase()

    // URL signals
    const isApplyUrl =
      /\/apply/i.test(cleanUrl) ||
      /\/application/i.test(cleanUrl) ||
      /\/submit/i.test(cleanUrl) ||
      cleanUrl.includes('job') ||
      cleanUrl.includes('career')

    // DOM signals: Check for presence of key application fields (e.g. email + name + resume or phone)
    const inputs = Array.from(doc.querySelectorAll('input, textarea, select'))
    if (inputs.length < 2) return false

    const pageText = (doc.body?.textContent || '').toLowerCase()
    const hasJobWords =
      pageText.includes('apply') ||
      pageText.includes('submit application') ||
      pageText.includes('resume') ||
      pageText.includes('candidate') ||
      pageText.includes('first name') ||
      pageText.includes('email')

    // Check if form contains input elements typical of an application
    const hasEmail = !!doc.querySelector('input[type="email"], input[name*="email" i], input[id*="email" i]')
    const hasName = !!doc.querySelector('input[name*="name" i], input[id*="name" i], input[name*="first" i]')

    return (isApplyUrl && (hasEmail || hasName)) || (hasJobWords && hasEmail && hasName)
  }

  findFormRoots(doc: Document): HTMLElement[] {
    const forms = Array.from(doc.querySelectorAll('form'))
    if (forms.length > 0) return forms
    return [doc.body]
  }
}
