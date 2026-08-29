import { AutofillSiteAdapter } from './types'
import { GenericAutofillAdapter } from './generic'
import { GreenhouseAutofillAdapter } from './greenhouse'
import { LeverAutofillAdapter } from './lever'
import { WorkdayAutofillAdapter } from './workday'
import { LinkedInAutofillAdapter } from './linkedin'
import { IndeedAutofillAdapter } from './indeed'
import { AshbyAutofillAdapter } from './ashby'
import { SmartRecruitersAutofillAdapter } from './smartrecruiters'

export class AutofillAdapterRegistry {
  private adapters: AutofillSiteAdapter[] = []
  private genericAdapter: AutofillSiteAdapter

  constructor() {
    this.genericAdapter = new GenericAutofillAdapter()
    this.adapters = [
      new GreenhouseAutofillAdapter(),
      new LeverAutofillAdapter(),
      new WorkdayAutofillAdapter(),
      new LinkedInAutofillAdapter(),
      new IndeedAutofillAdapter(),
      new AshbyAutofillAdapter(),
      new SmartRecruitersAutofillAdapter(),
    ]
  }

  getAdapter(url: string, doc: Document): AutofillSiteAdapter {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url, doc)) {
        return adapter
      }
    }
    return this.genericAdapter
  }
}

export const autofillAdapterRegistry = new AutofillAdapterRegistry()
