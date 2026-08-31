import { SiteAdapter } from './types'
import { GenericAdapter } from './generic'
import { LinkedInAdapter } from './linkedin'
import { IndeedAdapter } from './indeed'
import { GreenhouseAdapter } from './greenhouse'
import { LeverAdapter } from './lever'
import { AshbyAdapter } from './ashby'
import { SmartRecruitersAdapter } from './smartrecruiters'
import { UnstopAdapter } from './unstop'

export class AdapterRegistry {
  private adapters: SiteAdapter[] = []
  private genericAdapter: SiteAdapter

  constructor() {
    this.genericAdapter = new GenericAdapter()
    // Specific site adapters in priority order
    this.adapters = [
      new LinkedInAdapter(),
      new IndeedAdapter(),
      new UnstopAdapter(),
      new GreenhouseAdapter(),
      new LeverAdapter(),
      new AshbyAdapter(),
      new SmartRecruitersAdapter(),
    ]
  }

  /**
   * Finds the best matching adapter for the current page.
   * Returns specific adapter if applicable, otherwise falls back to GenericAdapter.
   */
  getAdapter(url: string, doc: Document): SiteAdapter {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url, doc)) {
        return adapter
      }
    }
    return this.genericAdapter
  }
}

export const adapterRegistry = new AdapterRegistry()
