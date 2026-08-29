import { SiteAdapter } from './types'
import { ExtractedJob } from '../../types'

export class AshbyAdapter implements SiteAdapter {
  name = 'Ashby'

  canHandle(url: string): boolean {
    return url.includes('ashbyhq.com') || url.includes('jobs.ashbyhq.com')
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    const isAshby = this.canHandle(url)
    if (!isAshby) return false

    // Ashby job URLs: jobs.ashbyhq.com/company-name/uuid or similar
    const segments = new URL(url, 'https://jobs.ashbyhq.com').pathname.split('/').filter(Boolean)
    const hasDetailSlug = segments.length >= 2

    const hasApplySection = !!doc.querySelector('form, [data-ashby-job-posting], [class*="applicationForm" i]')
    const hasJobTitle = !!doc.querySelector('h1, [class*="jobTitle" i], [class*="heading" i]')

    return (hasDetailSlug && hasJobTitle) || hasApplySection
  }

  isJobListingPage(url: string, doc: Document): boolean {
    if (!this.canHandle(url)) return false
    const jobCards = doc.querySelectorAll('a[href*="/jobs.ashbyhq.com/"], [class*="jobPosting" i], [class*="ashby-job-posting" i]')
    return jobCards.length >= 2
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://jobs.ashbyhq.com/company'
    const company = this.extractCompanyFromUrl(currentUrl) || 'Company'

    const jobCards = Array.from(
      doc.querySelectorAll('a[href*="/jobs.ashbyhq.com/"], [class*="jobPosting" i], [class*="ashby-job-posting" i]')
    )

    for (const card of jobCards) {
      const linkEl = card.tagName === 'A' ? (card as HTMLAnchorElement) : card.querySelector('a')
      const titleEl = card.querySelector('h2, h3, h4, [class*="title" i], strong') || linkEl
      const locationEl = card.querySelector('[class*="location" i], [class*="metadata" i]')

      const title = titleEl?.textContent?.trim()
      const jobUrl = linkEl?.href || currentUrl
      const location = locationEl?.textContent?.trim()

      if (title && title.length > 2) {
        jobs.push({
          title,
          company,
          jobUrl,
          sourceWebsite: 'Ashby',
          location: location || undefined,
          confidence: 'HIGH',
        })
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://jobs.ashbyhq.com/company'
    const titleEl = doc.querySelector('h1, [class*="jobTitle" i], [data-testid="job-title"]')
    const title = titleEl?.textContent?.trim()
    if (!title) return null

    const company =
      this.extractCompanyFromUrl(currentUrl) ||
      doc.querySelector('[class*="company" i], header img')?.getAttribute('alt') ||
      'Company'

    const locationEl = doc.querySelector('[class*="location" i], [data-testid="job-location"]')
    const location = locationEl?.textContent?.trim() || undefined

    const salaryEl = doc.querySelector('[class*="compensation" i], [class*="salary" i]')
    const salary = salaryEl?.textContent?.trim() || undefined

    const descEl = doc.querySelector('[class*="description" i], [class*="jobBody" i], main')
    const description = descEl?.textContent?.trim() || undefined

    return {
      title,
      company,
      jobUrl: currentUrl,
      sourceWebsite: 'Ashby',
      location,
      salary,
      description,
      confidence: 'HIGH',
    }
  }

  private extractCompanyFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url)
      const segments = parsed.pathname.split('/').filter(Boolean)
      if (segments.length > 0) {
        return segments[0].replace(/[-_]/g, ' ')
      }
    } catch {}
    return null
  }
}
