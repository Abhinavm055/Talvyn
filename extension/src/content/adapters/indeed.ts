import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'

function extractCompanyFromJsonLd(doc: Document): string | undefined {
  try {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
    for (const script of Array.from(scripts)) {
      const text = script.textContent
      if (!text) continue
      const data = JSON.parse(text)
      const org =
        data?.hiringOrganization?.name ||
        data?.hiringOrganization?.legalName ||
        data?.author?.name ||
        (Array.isArray(data?.['@graph']) &&
          data['@graph'].find((item: any) => item?.['@type'] === 'JobPosting')?.hiringOrganization?.name)
      if (org && typeof org === 'string' && org.trim().length > 0) {
        return org.trim()
      }
    }
  } catch {
    /* fallback */
  }
  return undefined
}

export class IndeedAdapter implements SiteAdapter {
  name = 'Indeed'

  canHandle(url: string): boolean {
    return url.includes('indeed.com')
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    return (
      /\/viewjob/i.test(url) ||
      /\/rc\/clk/i.test(url) ||
      !!doc.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
      !!doc.querySelector('h1.jobsearch-JobInfoHeader-title')
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
        '[data-testid="jobsearch-JobInfoHeader-title"], h2.jobTitle, a[data-jk], a[id^="job_"], span[id^="jobTitle"]'
      )
      const linkEl = (titleEl?.tagName === 'A' ? titleEl : card.querySelector('a[data-jk], a[id^="job_"]')) as HTMLAnchorElement | null
      const companyEl = card.querySelector(
        '[data-testid="company-name"], [data-testid="inlineHeader-companyName"], span[data-testid="company-name"], a[data-testid="company-name"], .companyName, .company-name, [class*="companyName"], [class*="company_location"] span, .icl-u-lg-mr--sm'
      )
      const locationEl = card.querySelector(
        '[data-testid="text-location"], [data-testid="inlineHeader-companyLocation"], .companyLocation, [class*="companyLocation"]'
      )
      const salaryEl = card.querySelector(
        '[data-testid="attribute_snippet_testid"], .salary-snippet-container, [class*="salary-snippet"], #salaryInfoAndJobType'
      )

      const title = titleEl?.textContent?.trim()
      const jobUrl = linkEl?.href || window.location.href
      const rawCompany = companyEl?.textContent?.trim()
      const company = rawCompany && rawCompany.length > 0 ? rawCompany : 'Unknown Company'

      if (title && title.length > 2 && !seen.has(jobUrl)) {
        seen.add(jobUrl)
        jobs.push({
          title,
          company,
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
      '[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, h1[class*="jobsearch-JobInfoHeader-title"]'
    )?.textContent?.trim()

    if (!title) return null

    const companyEl = doc.querySelector(
      '[data-testid="inlineHeader-companyName"], [data-testid="inlineHeader-companyName"] a, [data-testid="inlineHeader-companyName"] span, [data-testid="company-name"], div[data-testid="jobsearch-CompanyInfoContainer"] a, div[data-testid="jobsearch-CompanyInfoContainer"] span, .companyName, .icl-u-lg-mr--sm, [class*="companyName"]'
    )

    const company =
      companyEl?.textContent?.trim() ||
      extractCompanyFromJsonLd(doc) ||
      'Unknown Company'

    const location = doc.querySelector(
      '[data-testid="job-location"], [data-testid="inlineHeader-companyLocation"], .companyLocation'
    )?.textContent?.trim()

    const salary = doc.querySelector(
      '[data-testid="attribute_snippet_testid"], #salaryInfoAndJobType, [class*="salary-snippet"]'
    )?.textContent?.trim()

    const description = doc.querySelector(
      '#jobDescriptionText, [data-testid="jobsearch-JobComponent-description"]'
    )?.textContent?.trim()

    return {
      title,
      company,
      location,
      salary,
      description,
      jobUrl: typeof window !== 'undefined' ? window.location.href : '',
      sourceWebsite: 'Indeed',
      confidence: 'HIGH',
    }
  }
}

