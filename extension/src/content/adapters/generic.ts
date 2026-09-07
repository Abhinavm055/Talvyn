import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'
import {
  isLikelyJobPage,
  isLikelyJobListing,
  isValidJobCard,
  isExplicitlyNonJobSite,
} from '../jobEvidenceDetector'

/**
 * Generic Site Adapter
 *
 * Universal fallback adapter for scanning job listings and detail pages on any website.
 * Gated by JobEvidenceDetector to prevent false positives on non-job websites (YouTube, etc.).
 */
export class GenericAdapter implements SiteAdapter {
  name = 'Generic'

  canHandle(): boolean {
    return true // Universal fallback
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    if (isExplicitlyNonJobSite(url)) return false
    return isLikelyJobPage(doc, url)
  }

  isJobListingPage(url: string, doc: Document): boolean {
    if (isExplicitlyNonJobSite(url)) return false
    return isLikelyJobListing(doc, url)
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    if (isExplicitlyNonJobSite(currentUrl)) return []

    const jobs: ExtractedJob[] = []
    const seenUrls = new Set<string>()
    const seenJobKeys = new Set<string>()

    const isDuplicate = (j: ExtractedJob): boolean => {
      const normTitle = j.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
      const normCompany = j.company.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
      const key = `${normTitle}|${normCompany}`
      if (seenJobKeys.has(key)) return true
      seenJobKeys.add(key)
      if (j.jobUrl && j.jobUrl !== currentUrl) {
        if (seenUrls.has(j.jobUrl)) return true
        seenUrls.add(j.jobUrl)
      }
      return false
    }

    // 1. Try structured JSON-LD data first
    const jsonLdJobs = this.extractFromJsonLd(doc)
    for (const j of jsonLdJobs) {
      if (!isDuplicate(j)) {
        jobs.push(j)
      }
    }

    if (jobs.length >= 2) return jobs

    // 2. DOM Job Card Extraction with validation
    const cardSelectors = [
      '[class*="job-card" i]',
      '[class*="jobCard" i]',
      '[class*="job-listing" i]',
      '[class*="job-item" i]',
      '[class*="job_item" i]',
      '[class*="job-result" i]',
      '[data-job-id]',
      '[data-testid*="job" i]',
      '[data-automation-id*="job" i]',
      '[data-automation-id*="composite" i]',
      'article[class*="job" i]',
      'li[class*="job" i]',
      'div[class*="opening" i]',
      'div[class*="posting" i]',
      'div[class*="vacancy" i]',
      'div[class*="position" i]',
      'div[class*="career" i]',
      'div[class*="role" i]',
      '.card[class*="job" i]',
      'tr[class*="job" i]',
      'tr.job',
      '.resultContent',
      '.job-search-card',
      '.base-card',
      '.opportunity-card',
      '.opp-card',
      'li[class*="opening" i]',
    ]

    for (const sel of cardSelectors) {
      const cards = Array.from(doc.querySelectorAll(sel))
      if (cards.length >= 1) {
        for (const card of cards) {
          const cardEl = card as HTMLElement
          const validation = isValidJobCard(cardEl)
          if (!validation.isValid) continue

          const extracted = this.extractCardData(cardEl)
          if (extracted && extracted.title && !isDuplicate(extracted)) {
            jobs.push(extracted)
          }
        }
        if (jobs.length >= 2) break
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    if (isExplicitlyNonJobSite(currentUrl)) return null
    if (!isLikelyJobPage(doc, currentUrl)) return null

    // 1. Check JSON-LD first
    const jsonLdJobs = this.extractFromJsonLd(doc)
    if (jsonLdJobs.length === 1 && jsonLdJobs[0].title) {
      const j = jsonLdJobs[0]
      if (!j.description) {
        const descEl = doc.querySelector(
          '[class*="job-description" i], [class*="jobDescription" i], [class*="description" i], [class*="posting-requirements" i], article, main'
        )
        if (descEl) j.description = descEl.textContent?.replace(/\s+/g, ' ').trim().slice(0, 3000)
      }
      return j
    }

    // 2. Headings & Meta tags
    const h1 = doc.querySelector('h1')
    let title = h1?.textContent?.trim() || ''

    if (!title || title.length < 3 || title.length > 150) {
      const metaTitle = (doc.querySelector('meta[property="og:title"], meta[name="title"]') as HTMLMetaElement)?.content
      if (metaTitle && metaTitle.length >= 3 && metaTitle.length <= 150) {
        title = metaTitle
      }
    }

    if (!title || title.length < 3 || title.length > 150) return null

    const company =
      doc.querySelector('[class*="company-name" i], [class*="companyName" i], [class*="employer" i], [class*="org-name" i], [class*="company" i], [class*="org" i]')?.textContent?.trim() ||
      (doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content?.trim() ||
      'Unknown Company'

    const location =
      doc.querySelector('[class*="location" i], [class*="city" i], [class*="workplace" i], [itemprop="addressLocality"]')
        ?.textContent?.trim()

    const salary =
      doc.querySelector('[class*="salary" i], [class*="compensation" i], [class*="stipend" i], [class*="pay" i]')
        ?.textContent?.trim()

    const jobType =
      doc.querySelector('[class*="job-type" i], [class*="employment-type" i], [class*="work-type" i]')?.textContent?.trim()

    const descEl = doc.querySelector(
      '[class*="job-description" i], [class*="jobDescription" i], [class*="description" i], [class*="posting-requirements" i], article, main'
    )
    const description = descEl?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 3000)

    return {
      title,
      company,
      location,
      salary,
      jobType,
      description,
      jobUrl: currentUrl,
      sourceWebsite: typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : '',
      confidence: 'MEDIUM',
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private extractFromJsonLd(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const scripts = doc.querySelectorAll ? doc.querySelectorAll('script[type="application/ld+json"]') : []

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
      jobUrl: item.url || (typeof window !== 'undefined' ? window.location.href : ''),
      sourceWebsite: typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : '',
      confidence: 'HIGH',
    }
  }

  private extractCardData(card: HTMLElement): ExtractedJob | null {
    // 1. Find Title & URL
    const titleEl =
      card.querySelector('h1, h2, h3, h4, [class*="job-title" i], [class*="title" i], [class*="role" i], a[class*="job" i]')
    const titleLink =
      (titleEl?.tagName === 'A' ? titleEl : card.querySelector('a')) as HTMLAnchorElement | null

    const title = titleEl?.textContent?.trim() || titleLink?.textContent?.trim()
    if (!title || title.length < 3 || title.length > 150) return null

    const jobUrl = titleLink?.href || (typeof window !== 'undefined' ? window.location.href : '')

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
      sourceWebsite: typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : '',
      confidence: 'MEDIUM',
    }
  }
}
