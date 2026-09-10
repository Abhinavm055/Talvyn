import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'
import { isInvalidJobTitle } from '../jobEvidenceDetector'

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
    if (this.isJobDetailPage(url, doc)) {
      return false
    }
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
      const linkEl = (titleEl?.tagName === 'A' ? titleEl : card.querySelector('a[data-jk], a[id^="job_"], a[href*="viewjob" i], a[href*="/rc/clk" i], a')) as HTMLAnchorElement | null
      const companyEl = card.querySelector(
        '[data-testid="company-name"], [data-testid="inlineHeader-companyName"], span[data-testid="company-name"], a[data-testid="company-name"], .companyName, .company-name, [class*="companyName"], [class*="company_location"] span, .icl-u-lg-mr--sm'
      )
      const locationEl = card.querySelector(
        '[data-testid="text-location"], [data-testid="inlineHeader-companyLocation"], .companyLocation, [class*="companyLocation"]'
      )
      const salaryEl = card.querySelector(
        '[data-testid="attribute_snippet_testid"], .salary-snippet-container, [class*="salary-snippet"], #salaryInfoAndJobType'
      )
      const snippetEl = card.querySelector(
        '.job-snippet, [data-testid="job-snippet"], [class*="job-snippet"], [class*="jobCardShelfContainer"], .underShelfFooter, ul, p'
      )

      const title = titleEl?.textContent?.trim()
      const rawCompany = companyEl?.textContent?.trim()
      const company = rawCompany && rawCompany.length > 0 ? rawCompany : 'Unknown Company'
      const rawJobUrl = linkEl?.href || (typeof window !== 'undefined' ? window.location.href : '')
      const jobUrl = rawJobUrl || `https://www.indeed.com/viewjob?key=${encodeURIComponent(title || '')}-${encodeURIComponent(company)}`
      const description = snippetEl?.textContent?.replace(/\s+/g, ' ').trim() || undefined

      const snippetLis = Array.from(snippetEl?.querySelectorAll('li') || [])
      const snippetBullets = snippetLis.map((li) => li.textContent?.replace(/\s+/g, ' ').trim() || '').filter((t) => t.length > 8)

      if (title && !isInvalidJobTitle(title) && !seen.has(jobUrl)) {
        seen.add(jobUrl)
        jobs.push({
          title,
          company,
          location: locationEl?.textContent?.trim(),
          salary: salaryEl?.textContent?.trim(),
          description,
          responsibilities: snippetBullets.length > 0 ? snippetBullets.slice(0, 4) : undefined,
          jobUrl,
          sourceWebsite: 'Indeed',
          confidence: 'HIGH',
        })
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    // 1. Identify authoritative job detail container
    const container =
      doc.querySelector(
        '[data-testid="jobsearch-JobComponent"], [data-testid="jobsearch-ViewJobLayout-mainContent"], #jobsearch-ViewjobPaneWrapper, .jobsearch-JobComponent, #viewJobSSRRoot, article[class*="job" i], [role="main"]'
      ) || doc.body || doc

    // 2. Extract job title strictly from authoritative container or specific selectors (never naked h1 from root)
    const isExcluded = (el: Element | null): boolean => {
      if (!el || typeof el.closest !== 'function') return false
      const excluded = el.closest('header, nav, [role="banner"], [role="navigation"], [class*="nav" i], [class*="account" i], [class*="user" i]')
      if (!excluded) return false
      const className = (excluded.className || '').toString().toLowerCase()
      if (className.includes('jobinfo') || className.includes('jobsearch')) return false
      return true
    }

    const titleSelectors = [
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1.jobsearch-JobInfoHeader-title',
      'h1[class*="jobsearch-JobInfoHeader-title"]',
      'h2.jobsearch-JobInfoHeader-title',
      '[class*="jobsearch-JobInfoHeader-title"]',
      'h1[class*="jobTitle" i]',
      'h2[class*="jobTitle" i]',
      '.jobsearch-JobInfoHeader-title-container h1',
      '[data-testid="simpler-job-title"]',
      'span[id^="jobTitle"]',
      'a[id^="job_"]',
    ]

    let title: string | null = null

    // First search within authoritative container
    for (const sel of titleSelectors) {
      if (typeof container.querySelectorAll === 'function') {
        const candidates = Array.from(container.querySelectorAll(sel))
        for (const el of candidates) {
          if (isExcluded(el)) continue
          const candidateText = el.textContent?.trim()
          if (candidateText && !isInvalidJobTitle(candidateText)) {
            title = candidateText
            break
          }
        }
      }
      if (!title && typeof container.querySelector === 'function') {
        const single = container.querySelector(sel)
        if (single && !isExcluded(single)) {
          const candidateText = single.textContent?.trim()
          if (candidateText && !isInvalidJobTitle(candidateText)) {
            title = candidateText
          }
        }
      }
      if (title) break
    }

    // Fallback within container if still not found
    if (!title && container !== doc && container !== doc.body) {
      const headings = typeof container.querySelectorAll === 'function' ? Array.from(container.querySelectorAll('h1, h2')) : []
      for (const el of headings) {
        if (isExcluded(el)) continue
        const candidateText = el.textContent?.trim()
        if (candidateText && !isInvalidJobTitle(candidateText)) {
          title = candidateText
          break
        }
      }
      if (!title && typeof container.querySelector === 'function') {
        const singleH = container.querySelector('h1, h2')
        if (singleH && !isExcluded(singleH)) {
          const candidateText = singleH.textContent?.trim()
          if (candidateText && !isInvalidJobTitle(candidateText)) {
            title = candidateText
          }
        }
      }
    }

    // Fallback to document level specific selectors
    if (!title) {
      for (const sel of titleSelectors) {
        if (typeof doc.querySelectorAll === 'function') {
          const candidates = Array.from(doc.querySelectorAll(sel))
          for (const el of candidates) {
            if (isExcluded(el)) continue
            const candidateText = el.textContent?.trim()
            if (candidateText && !isInvalidJobTitle(candidateText)) {
              title = candidateText
              break
            }
          }
        }
        if (!title && typeof doc.querySelector === 'function') {
          const single = doc.querySelector(sel)
          if (single && !isExcluded(single)) {
            const candidateText = single.textContent?.trim()
            if (candidateText && !isInvalidJobTitle(candidateText)) {
              title = candidateText
            }
          }
        }
        if (title) break
      }
    }

    if (!title || isInvalidJobTitle(title)) return null

    // 3. Extract company from the same container
    const companyEl = container.querySelector(
      '[data-testid="inlineHeader-companyName"], [data-testid="inlineHeader-companyName"] a, [data-testid="inlineHeader-companyName"] span, [data-testid="company-name"], div[data-testid="jobsearch-CompanyInfoContainer"] a, div[data-testid="jobsearch-CompanyInfoContainer"] span, .jobsearch-CompanyInfoContainer, [class*="CompanyInfo" i], .companyName, .icl-u-lg-mr--sm, [class*="companyName"]'
    ) || doc.querySelector(
      '[data-testid="inlineHeader-companyName"], [data-testid="inlineHeader-companyName"] a, [data-testid="company-name"], div[data-testid="jobsearch-CompanyInfoContainer"] a'
    )

    const company =
      companyEl?.textContent?.trim() ||
      extractCompanyFromJsonLd(doc) ||
      'Unknown Company'

    // 4. Extract location from the same container
    const location = (
      container.querySelector('[data-testid="job-location"], [data-testid="inlineHeader-companyLocation"], .companyLocation') ||
      doc.querySelector('[data-testid="job-location"], [data-testid="inlineHeader-companyLocation"]')
    )?.textContent?.trim()

    // 5. Extract salary and job type from the same container
    const salary = (
      container.querySelector('[data-testid="attribute_snippet_testid"], #salaryInfoAndJobType, [class*="salary-snippet"]') ||
      doc.querySelector('[data-testid="attribute_snippet_testid"], #salaryInfoAndJobType')
    )?.textContent?.trim()

    // 6. Extract description from the same container
    const descEl = container.querySelector(
      '#jobDescriptionText, [data-testid="jobsearch-JobComponent-description"], [class*="jobsearch-JobComponent-description"]'
    ) || doc.querySelector('#jobDescriptionText, [data-testid="jobsearch-JobComponent-description"]')

    const description = descEl?.textContent?.replace(/\s+/g, ' ').trim()

    // 7. Extract semantic responsibilities and requirements if available
    const responsibilities: string[] = []
    const requirements: string[] = []
    if (descEl) {
      const lis = Array.from(descEl.querySelectorAll('li'))
      for (const li of lis) {
        const text = li.textContent?.replace(/\s+/g, ' ').trim() || ''
        if (text.length > 8 && text.length < 250) {
          const parentHeading = li.closest('ul')?.previousElementSibling?.textContent?.toLowerCase() || ''
          if (/responsibilit|duties|what you('ll|\s+will)\s+do/i.test(parentHeading)) {
            responsibilities.push(text)
          } else if (/requirement|qualification|what we('re|\s+are)\s+looking\s+for|skills/i.test(parentHeading)) {
            requirements.push(text)
          }
        }
      }
    }

    return {
      title,
      company,
      location,
      salary,
      description,
      responsibilities: responsibilities.length > 0 ? responsibilities.slice(0, 8) : undefined,
      requirements: requirements.length > 0 ? requirements.slice(0, 8) : undefined,
      jobUrl: typeof window !== 'undefined' ? window.location.href : '',
      sourceWebsite: 'Indeed',
      confidence: 'HIGH',
    }
  }
}

