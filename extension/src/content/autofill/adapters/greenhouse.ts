import { AutofillSiteAdapter } from './types'

export class GreenhouseAutofillAdapter implements AutofillSiteAdapter {
  name = 'Greenhouse'

  canHandle(url: string): boolean {
    return url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')
  }

  isApplicationForm(_url: string, doc: Document): boolean {
    return (
      !!doc.querySelector('form#application_form, #app_body, #application') ||
      !!doc.querySelector('#first_name, #last_name, #email, #phone')
    )
  }

  findFormRoots(doc: Document): HTMLElement[] {
    const form = doc.querySelector('form#application_form, #app_body, form') as HTMLElement | null
    return form ? [form] : [doc.body]
  }
}
