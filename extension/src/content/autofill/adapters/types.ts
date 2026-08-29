import { DetectedFormField } from '../../../types'

export interface AutofillSiteAdapter {
  name: string
  canHandle(url: string, doc: Document): boolean
  isApplicationForm(url: string, doc: Document): boolean
  findFormRoots(doc: Document): HTMLElement[]
  extractCustomFields?(doc: Document): DetectedFormField[]
}
