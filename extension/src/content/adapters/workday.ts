import { SiteAdapter } from './types'
import { ExtractedJob } from '../../types'

export class WorkdayAdapter implements SiteAdapter {
  name = 'Workday'

  canHandle(url: string): boolean {
    return url.includes('myworkdayjobs.com') || url.includes('workday.com')
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    if (!this.canHandle(url)) return false
    return (
      /\/job\/[^/?#]+/i.test(url) ||
      !!doc.querySelector('[data-automation-id="jobPostingHeader"], [data-automation-id="jobPostingDescription"]')
    )
  }

  isJobListingPage(url: string, doc: Document): boolean {
    if (!this.canHandle(url)) return false
    if (this.isJobDetailPage(url, doc)) return false
    const cards = doc.querySelectorAll(
      '[data-automation-id="compositeHeader"], [data-automation-id="jobCard"], li[class*="css-"], a[href*="/job/"]'
    )
    return cards.length >= 1
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const seen = new Set<string>()
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://company.myworkdayjobs.com'
    const company =
      (doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content ||
      doc.querySelector('[data-automation-id="companyName"]')?.textContent?.trim() ||
      'Workday Employer'

    const cardElements = Array.from(
      doc.querySelectorAll(
        '[data-automation-id="compositeHeader"], [data-automation-id="jobCard"], li[class*="css-"], div[data-automation-id="jobPostingHeader"]'
      )
    )

    for (const card of cardElements) {
      const linkEl = (card.tagName === 'A' ? card : card.querySelector('a')) as HTMLAnchorElement | null
      const titleEl = card.querySelector('[data-automation-id="jobPostingHeader"], h3, h4, a') || linkEl
      const locationEl = card.querySelector('[data-automation-id="locations"], [data-automation-id="jobLocation"]')
      const typeEl = card.querySelector('[data-automation-id="timeType"]')

      const title = titleEl?.textContent?.trim()
      const jobUrl = linkEl?.href || currentUrl

      if (title && title.length > 2 && !seen.has(jobUrl)) {
        seen.add(jobUrl)
        jobs.push({
          title,
          company,
          location: locationEl?.textContent?.trim(),
          jobType: typeEl?.textContent?.trim(),
          jobUrl,
          sourceWebsite: 'Workday',
          confidence: 'HIGH',
        })
      }
    }

    // Fallback: search <a> links pointing to /job/
    if (jobs.length === 0) {
      const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="/job/"]'))
      for (const link of links) {
        const title = link.textContent?.trim()
        const jobUrl = link.href || currentUrl
        if (title && title.length > 3 && !seen.has(jobUrl)) {
          seen.add(jobUrl)
          jobs.push({
            title,
            company,
            jobUrl,
            sourceWebsite: 'Workday',
            confidence: 'HIGH',
          })
        }
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const title = doc.querySelector(
      '[data-automation-id="jobPostingHeader"], h2[data-automation-id="jobPostingHeader"], h1'
    )?.textContent?.trim()
    if (!title) return null

    const company =
      (doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content ||
      doc.querySelector('[data-automation-id="companyName"]')?.textContent?.trim() ||
      'Workday Employer'

    const location = doc.querySelector(
      '[data-automation-id="locations"], [data-automation-id="jobLocation"]'
    )?.textContent?.trim()

    const jobType = doc.querySelector('[data-automation-id="timeType"]')?.textContent?.trim()
    const description = doc.querySelector('[data-automation-id="jobPostingDescription"]')?.textContent?.trim()

    return {
      title,
      company,
      location,
      jobType,
      description,
      jobUrl: typeof window !== 'undefined' ? window.location.href : '',
      sourceWebsite: 'Workday',
      confidence: 'HIGH',
    }
  }
}
