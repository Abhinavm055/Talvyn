import { AutofillSiteAdapter } from './types'

export class WorkdayAutofillAdapter implements AutofillSiteAdapter {
  name = 'Workday'

  canHandle(url: string): boolean {
    return url.includes('myworkdayjobs.com') || url.includes('workday.com')
  }

  isApplicationForm(url: string, doc: Document): boolean {
    return (
      /\/apply/i.test(url) ||
      !!doc.querySelector('div[data-automation-id="formField"], form[data-automation-id="applyForm"]')
    )
  }

  findFormRoots(doc: Document): HTMLElement[] {
    const form = doc.querySelector('form, main, [data-automation-id="pageContent"]') as HTMLElement | null
    return form ? [form] : [doc.body]
  }
}
