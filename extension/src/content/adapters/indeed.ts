import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'

export class IndeedAdapter implements SiteAdapter {
  name = 'Indeed'

  canHandle(url: string): boolean {
    return url.includes('indeed.com')
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    return (
      /\/viewjob/i.test(url) ||
      /\/rc\/clk/i.test(url) ||
      !!doc.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')
    )
  }

  isJobListingPage(url: string, doc: Document): boolean {
    return (
      /\/jobs/i.test(url) ||
      doc.querySelectorAll('.job_seen_beacon, .resultContent, div[class*="cardOutline"]').length >= 2
    )
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const seen = new Set<string>()

    const cardElements = Array.from(
      doc.querySelectorAll('.job_seen_beacon, .resultContent, div[class*="cardOutline"]')
    )

    for (const card of cardElements) {
      const titleEl = card.querySelector(
        '[data-testid="jobsearch-JobInfoHeader-title"], h2.jobTitle, a[data-jk], a[id^="job_"]'
      )
      const linkEl = (titleEl?.tagName === 'A' ? titleEl : card.querySelector('a[data-jk], a[id^="job_"]')) as HTMLAnchorElement | null
      const companyEl = card.querySelector(
        '[data-testid="company-name"], .companyName, span[data-testid="company-name"]'
      )
      const locationEl = card.querySelector(
        '[data-testid="text-location"], .companyLocation'
      )
      const salaryEl = card.querySelector(
        '[data-testid="attribute_snippet_testid"], .salary-snippet-container'
      )

      const title = titleEl?.textContent?.trim()
      const jobUrl = linkEl?.href || window.location.href

      if (title && title.length > 2 && !seen.has(jobUrl)) {
        seen.add(jobUrl)
        jobs.push({
          title,
          company: companyEl?.textContent?.trim() || 'Indeed Employer',
          location: locationEl?.textContent?.trim(),
          salary: salaryEl?.textContent?.trim(),
          jobUrl,
          sourceWebsite: 'Indeed',
          confidence: 'HIGH',
        })
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const title = doc.querySelector(
      '[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title'
    )?.textContent?.trim()

    if (!title) return null

    const company = doc.querySelector(
      '[data-testid="inlineHeader-companyName"], .icl-u-lg-mr--sm'
    )?.textContent?.trim() || 'Indeed Employer'

    const location = doc.querySelector(
      '[data-testid="job-location"]'
    )?.textContent?.trim()

    const salary = doc.querySelector(
      '[data-testid="attribute_snippet_testid"]'
    )?.textContent?.trim()

    const description = doc.querySelector(
      '#jobDescriptionText'
    )?.textContent?.trim()

    return {
      title,
      company,
      location,
      salary,
      description,
      jobUrl: window.location.href,
      sourceWebsite: 'Indeed',
      confidence: 'HIGH',
    }
  }
}
