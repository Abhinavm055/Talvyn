import { SuccessSiteAdapter } from './types'
import { GenericSuccessAdapter } from './generic'
import { GreenhouseSuccessAdapter } from './greenhouse'
import { LeverSuccessAdapter } from './lever'
import { WorkdaySuccessAdapter } from './workday'
import { LinkedInSuccessAdapter } from './linkedin'
import { IndeedSuccessAdapter } from './indeed'
import { AshbySuccessAdapter } from './ashby'
import { SmartRecruitersSuccessAdapter } from './smartrecruiters'

export class SuccessAdapterRegistry {
  private adapters: SuccessSiteAdapter[] = []
  private genericAdapter: SuccessSiteAdapter

  constructor() {
    this.genericAdapter = new GenericSuccessAdapter()
    this.adapters = [
      new GreenhouseSuccessAdapter(),
      new LeverSuccessAdapter(),
      new WorkdaySuccessAdapter(),
      new LinkedInSuccessAdapter(),
      new IndeedSuccessAdapter(),
      new AshbySuccessAdapter(),
      new SmartRecruitersSuccessAdapter(),
    ]
  }

  getAdapter(url: string, doc: Document): SuccessSiteAdapter {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url, doc)) {
        return adapter
      }
    }
    return this.genericAdapter
  }
}

export const successAdapterRegistry = new SuccessAdapterRegistry()
