import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'

/**
 * Generic Site Adapter
 *
 * Universal fallback adapter for scanning job listings on any website.
 * Supports:
 * 1. JSON-LD structured data (ItemList / Array of JobPostings)
 * 2. Common job card containers (.job-card, [class*="job"], article, li)
 * 3. Link clusters with title headings
 * 4. DOM heuristics
 */
export class GenericAdapter implements SiteAdapter {
  name = 'Generic'

  canHandle(): boolean {
    return true // Universal fallback
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    const cleanUrl = url.toLowerCase()

    // URL detail signals
    const hasDetailUrl =
      /\/jobs?\/\d+/i.test(cleanUrl) ||
      /\/viewjob/i.test(cleanUrl) ||
      /\/current-openings\//i.test(cleanUrl) ||
      /\/job\/[a-zA-Z0-9_-]+/i.test(cleanUrl) ||
      /\/position\/[a-zA-Z0-9_-]+/i.test(cleanUrl) ||
      /\/careers\/[a-zA-Z0-9_-]+/i.test(cleanUrl) ||
      /\/apply\/?$/i.test(cleanUrl)

    // Heading detail signals
    const h1 = doc.querySelector('h1')
    const hasApplyBtn = !!doc.querySelector(
      'button[class*="apply" i], a[class*="apply" i], input[value*="apply" i]'
    )

    // If there's an obvious single job posting with an Apply button and not a multi-card list
    const cardCount = doc.querySelectorAll(
      '[class*="job-card" i], [class*="jobCard" i], [class*="job-listing" i], [class*="job-item" i], [data-job-id]'
    ).length

    if (cardCount >= 3) return false // It's a listing page

    return hasDetailUrl || (!!h1 && hasApplyBtn)
  }

  isJobListingPage(url: string, doc: Document): boolean {
    const cleanUrl = url.toLowerCase()

    // Listing URL signals
    const isSearchOrListUrl =
      /\/jobs?\/?(\?.*)?$/i.test(cleanUrl) ||
      /\/careers?\/?(\?.*)?$/i.test(cleanUrl) ||
      /\/positions?\/?(\?.*)?$/i.test(cleanUrl) ||
      /\/openings?\/?(\?.*)?$/i.test(cleanUrl) ||
      /\/vacancies?\/?(\?.*)?$/i.test(cleanUrl) ||
      /\/search\/?/i.test(cleanUrl) ||
      cleanUrl.includes('q=') ||
      cleanUrl.includes('search') ||
      cleanUrl.includes('keyword')

    // DOM listing signals: multiple job cards
    const cardSelectors = [
      '[class*="job-card" i]',
      '[class*="jobCard" i]',
      '[class*="job-listing" i]',
      '[class*="job-item" i]',
      '[class*="job_item" i]',
      '[class*="job-result" i]',
      '[class*="search-result" i]',
      '[data-job-id]',
      '[data-testid*="job" i]',
      'article[class*="job" i]',
      'li[class*="job" i]',
      'div[class*="opening" i]',
      'div[class*="posting" i]',
    ]

    for (const selector of cardSelectors) {
      const elements = doc.querySelectorAll(selector)
      if (elements.length >= 2) return true
    }

    // JSON-LD ItemList check
    const jsonLdCards = this.extractFromJsonLd(doc)
    if (jsonLdCards.length >= 2) return true

    return isSearchOrListUrl
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const seenUrls = new Set<string>()

    // 1. Try structured JSON-LD data first
    const jsonLdJobs = this.extractFromJsonLd(doc)
    for (const j of jsonLdJobs) {
      if (j.jobUrl && !seenUrls.has(j.jobUrl)) {
        seenUrls.add(j.jobUrl)
        jobs.push(j)
      }
    }

    if (jobs.length >= 3) return jobs

    // 2. DOM Job Card Extraction
    const cardSelectors = [
      '[class*="job-card" i]',
      '[class*="jobCard" i]',
      '[class*="job-listing" i]',
      '[class*="job-item" i]',
      '[class*="job_item" i]',
      '[class*="job-result" i]',
      '[class*="search-result" i]',
      '[data-job-id]',
      '[data-testid*="job" i]',
      'article[class*="job" i]',
      'li[class*="job" i]',
      'div[class*="opening" i]',
      'div[class*="posting" i]',
      '.card[class*="job" i]',
      'tr[class*="job" i]',
      '.resultContent',
    ]

    for (const sel of cardSelectors) {
      const cards = Array.from(doc.querySelectorAll(sel))
      if (cards.length >= 2) {
        for (const card of cards) {
          const extracted = this.extractCardData(card as HTMLElement)
          if (extracted && extracted.title && !seenUrls.has(extracted.jobUrl)) {
            seenUrls.add(extracted.jobUrl)
            jobs.push(extracted)
          }
        }
        if (jobs.length >= 2) break
      }
    }

    // 3. Fallback: Repeated link list with job titles
    if (jobs.length === 0) {
      const links = Array.from(doc.querySelectorAll('a[href*="/job" i], a[href*="/career" i], a[href*="/position" i], a[href*="/opening" i]'))
      for (const link of links) {
        const title = link.textContent?.trim()
        const href = (link as HTMLAnchorElement).href
        if (title && title.length >= 4 && title.length <= 120 && href && !seenUrls.has(href)) {
          seenUrls.add(href)
          jobs.push({
            title,
            company: this.guessCompanyFromContext(link as HTMLElement) || 'Unknown Company',
            jobUrl: href,
            sourceWebsite: window.location.hostname.replace(/^www\./, ''),
            confidence: 'LOW',
          })
        }
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const h1 = doc.querySelector('h1')
    if (!h1) return null

    const title = h1.textContent?.trim() || ''
    if (title.length < 3 || title.length > 150) return null

    const company =
      doc.querySelector('[class*="company" i], [class*="employer" i], [class*="org" i]')?.textContent?.trim() ||
      'Unknown Company'

    const location =
      doc.querySelector('[class*="location" i], [class*="city" i], [itemprop="addressLocality"]')
        ?.textContent?.trim()

    const salary =
      doc.querySelector('[class*="salary" i], [class*="compensation" i], [class*="pay" i]')
        ?.textContent?.trim()

    const jobType =
      doc.querySelector('[class*="job-type" i], [class*="employment-type" i]')?.textContent?.trim()

    return {
      title,
      company,
      location,
      salary,
      jobType,
      jobUrl: window.location.href,
      sourceWebsite: window.location.hostname.replace(/^www\./, ''),
      confidence: 'MEDIUM',
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private extractFromJsonLd(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')

    for (const script of Array.from(scripts)) {
      try {
        const data = JSON.parse(script.textContent || '{}')
        const items = Array.isArray(data) ? data : [data]

        for (const item of items) {
          if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
            for (const elem of item.itemListElement) {
              const jobItem = elem.item || elem
              if (jobItem['@type'] === 'JobPosting' || jobItem.title) {
                jobs.push(this.formatJsonLdJob(jobItem))
              }
            }
          } else if (item['@type'] === 'JobPosting') {
            jobs.push(this.formatJsonLdJob(item))
          }
        }
      } catch {
        /* malformed json-ld */
      }
    }

    return jobs
  }

  private formatJsonLdJob(item: Record<string, any>): ExtractedJob {
    return {
      title: item.title || item.name || 'Untitled Position',
      company:
        item.hiringOrganization?.name ||
        item.employerOverview ||
        'Unknown Company',
      location:
        typeof item.jobLocation === 'string'
          ? item.jobLocation
          : item.jobLocation?.address?.addressLocality ||
            item.jobLocation?.address?.addressRegion,
      salary:
        item.baseSalary?.value?.value ||
        (item.baseSalary?.value?.minValue && item.baseSalary?.value?.maxValue
          ? `${item.baseSalary.value.minValue}–${item.baseSalary.value.maxValue} ${item.baseSalary.value.unitText || ''}`
          : undefined),
      jobType: item.employmentType,
      jobUrl: item.url || window.location.href,
      sourceWebsite: window.location.hostname.replace(/^www\./, ''),
      confidence: 'HIGH',
    }
  }

  private extractCardData(card: HTMLElement): ExtractedJob | null {
    // 1. Find Title & URL
    const titleEl =
      card.querySelector('h1, h2, h3, h4, [class*="title" i], [class*="role" i], a[class*="job" i]')
    const titleLink =
      (titleEl?.tagName === 'A' ? titleEl : card.querySelector('a')) as HTMLAnchorElement | null

    const title = titleEl?.textContent?.trim() || titleLink?.textContent?.trim()
    if (!title || title.length < 3 || title.length > 150) return null

    const jobUrl = titleLink?.href || window.location.href

    // 2. Find Company
    const companyEl = card.querySelector(
      '[class*="company" i], [class*="employer" i], [class*="org" i], [class*="sub-title" i], [class*="subtitle" i]'
    )
    const company = companyEl?.textContent?.trim() || 'Unknown Company'

    // 3. Find Location
    const locationEl = card.querySelector(
      '[class*="location" i], [class*="city" i], [class*="place" i], [class*="region" i]'
    )
    const location = locationEl?.textContent?.trim()

    // 4. Find Salary
    const salaryEl = card.querySelector(
      '[class*="salary" i], [class*="compensation" i], [class*="pay" i], [class*="wage" i]'
    )
    const salary = salaryEl?.textContent?.trim()

    // 5. Find Job Type
    const typeEl = card.querySelector(
      '[class*="job-type" i], [class*="employment" i], [class*="work-type" i]'
    )
    const jobType = typeEl?.textContent?.trim()

    // 6. Find Snippet/Description
    const descEl = card.querySelector(
      '[class*="snippet" i], [class*="description" i], [class*="summary" i], p'
    )
    const description = descEl?.textContent?.trim().slice(0, 1000)

    return {
      title,
      company,
      location,
      salary,
      jobType,
      description,
      jobUrl,
      sourceWebsite: window.location.hostname.replace(/^www\./, ''),
      confidence: 'MEDIUM',
    }
  }

  private guessCompanyFromContext(el: HTMLElement): string | null {
    const parent = el.closest('div, li, tr')
    if (!parent) return null
    const companyEl = parent.querySelector('[class*="company" i], [class*="employer" i]')
    return companyEl?.textContent?.trim() || null
  }
}
