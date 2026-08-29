import { SiteAdapter } from './types'
import { ExtractedJob } from '../../types'

export class SmartRecruitersAdapter implements SiteAdapter {
  name = 'SmartRecruiters'

  canHandle(url: string): boolean {
    return url.includes('smartrecruiters.com') || url.includes('careers.smartrecruiters.com')
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    if (!this.canHandle(url)) return false
    const hasJobTitle = !!doc.querySelector('h1.job-title, [data-qa="job-title"], .job-header h1, h1')
    const hasApplyBtn = !!doc.querySelector('a[href*="/apply"], button[data-qa="apply-button"], .st-apply')
    const isDetailUrl = /\/jobs\/[a-zA-Z0-9_-]+/i.test(url)
    return (hasJobTitle && hasApplyBtn) || isDetailUrl
  }

  isJobListingPage(url: string, doc: Document): boolean {
    if (!this.canHandle(url)) return false
    const jobItems = doc.querySelectorAll('.opening-job, .job-item, li.opening, a[href*="smartrecruiters.com/"][href*="/"]')
    return jobItems.length >= 2
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://jobs.smartrecruiters.com/company'
    const company = doc.querySelector('.company-name, [data-qa="company-name"]')?.textContent?.trim() || 'Company'

    const jobCards = Array.from(
      doc.querySelectorAll('.opening-job, .job-item, li.opening, [class*="job-item" i]')
    )

    for (const card of jobCards) {
      const linkEl = card.querySelector('a') as HTMLAnchorElement | null
      const titleEl = card.querySelector('h3, h4, .job-title, [data-qa="job-title"]') || linkEl
      const locationEl = card.querySelector('.job-location, .location, [data-qa="job-location"]')

      const title = titleEl?.textContent?.trim()
      const jobUrl = linkEl?.href || currentUrl
      const location = locationEl?.textContent?.trim()

      if (title && title.length > 2) {
        jobs.push({
          title,
          company,
          jobUrl,
          sourceWebsite: 'SmartRecruiters',
          location: location || undefined,
          confidence: 'HIGH',
        })
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://jobs.smartrecruiters.com/company'
    const titleEl = doc.querySelector('h1.job-title, [data-qa="job-title"], .job-header h1, h1')
    const title = titleEl?.textContent?.trim()
    if (!title) return null

    const companyEl = doc.querySelector('.company-name, [data-qa="company-name"], .job-header .company')
    const company = companyEl?.textContent?.trim() || this.extractCompanyFromUrl(currentUrl) || 'Company'

    const locationEl = doc.querySelector('.job-location, [data-qa="job-location"], .spl-location')
    const location = locationEl?.textContent?.trim() || undefined

    const descEl = doc.querySelector('.job-sections, #job-details, .job-detail')
    const description = descEl?.textContent?.trim() || undefined

    return {
      title,
      company,
      jobUrl: currentUrl,
      sourceWebsite: 'SmartRecruiters',
      location,
      description,
      confidence: 'HIGH',
    }
  }

  private extractCompanyFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url)
      const segments = parsed.pathname.split('/').filter(Boolean)
      if (segments.length > 0 && segments[0] !== 'jobs') {
        return segments[0].replace(/[-_]/g, ' ')
      }
    } catch {}
    return null
  }
}
