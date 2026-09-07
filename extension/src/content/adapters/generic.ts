import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'
import { isLikelyJobPage, isLikelyJobListing, isValidJobCard, isExplicitlyNonJobSite, UNIVERSAL_JOB_ROLE_REGEX } from '../jobEvidenceDetector'

export class GenericAdapter implements SiteAdapter {
  name = 'Generic'

  canHandle(): boolean { return true }

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

    const add = (job: ExtractedJob | null) => {
      if (job && job.title && !isDuplicate(job)) jobs.push(job)
    }

    // 1. Structured JSON-LD first.
    for (const job of this.extractFromJsonLd(doc)) add(job)

    // 2. Standard semantic card extraction.
    const cardSelectors = [
      '[class*="job-card" i]', '[class*="jobCard" i]', '[class*="job_card" i]', '[class*="job-listing" i]', '[class*="job-item" i]',
      '[class*="job_item" i]', '[class*="job-result" i]', '[data-job-id]', '[data-testid*="job" i]',
      '[data-automation-id*="job" i]', '[data-automation-id*="composite" i]', 'article[class*="job" i]',
      'li[class*="job" i]', 'div[class*="opening" i]', 'div[class*="posting" i]', 'div[class*="vacancy" i]',
      'div[class*="position" i]', 'div[class*="career" i]', 'div[class*="role" i]', '.card[class*="job" i]',
      'tr[class*="job" i]', 'tr.job', '.resultContent', '.job-search-card', '.base-card',
      '[class*="opportunity_card" i]', '[class*="opp-card" i]', '[class*="opp_card" i]', '[class*="c-card" i]',
      '[class*="listing_card" i]', '.single_opportunity', '[class*="opportunity" i]',
    ]
    for (const sel of cardSelectors) {
      for (const card of Array.from(doc.querySelectorAll(sel))) {
        const cardEl = card as HTMLElement
        if (cardEl.children && cardEl.children.length > 25 && cardEl.querySelectorAll?.('[class*="opportunity" i]').length > 1) continue
        if (!isValidJobCard(cardEl).isValid) continue
        add(this.extractCardData(cardEl))
      }
    }

    // 3. Universal semantic-link fallback for custom ATS/company DOMs.
    const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[]
    for (const anchor of anchors) {
      const href = anchor.href || ''
      const text = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
      if (text.length < 3 || text.length > 140) continue

      const jobDestination = /\/jobs?(\/|\?|#|$)/i.test(href) || /\/careers?(\/|\?|#|$)/i.test(href) || /\/positions?(\/|\?|#|$)/i.test(href) || /\/openings?(\/|\?|#|$)/i.test(href) || /\/opportunities?(\/|\?|#|$)/i.test(href) || /\/apply(?:\/|\?|$)/i.test(href) || /viewjob|greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|selectedItem=|oppstatus=/i.test(href)
      const titleLike = UNIVERSAL_JOB_ROLE_REGEX.test(text)
      if (!jobDestination && !titleLike) continue

      let container: HTMLElement | null = anchor.parentElement
      for (let depth = 0; container && depth < 5; depth++, container = container.parentElement) {
        const containerText = container.textContent?.replace(/\s+/g, ' ').trim() || ''
        if (containerText.length >= 20 && containerText.length <= 1800) {
          const validation = isValidJobCard(container)
          if (validation.isValid) {
            add(this.extractCardData(container, anchor))
            break
          }
        }
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
    if (currentUrl && isExplicitlyNonJobSite(currentUrl)) return null

    const jsonLdJobs = this.extractFromJsonLd(doc)
    if (jsonLdJobs.length === 1 && jsonLdJobs[0].title) {
      const j = jsonLdJobs[0]
      if (!j.description) {
        const descEl = doc.querySelector('[class*="job-description" i], [class*="jobDescription" i], [class*="description" i], [class*="posting-requirements" i], article, main')
        if (descEl) j.description = descEl.textContent?.replace(/\s+/g, ' ').trim().slice(0, 3000)
      }
      return j
    }

    const h1 = doc.querySelector('h1, [class*="job-title" i], [class*="app-title" i]')
    let title = h1?.textContent?.trim() || ''
    if (!title || title.length < 3 || title.length > 150) {
      title = (doc.querySelector('meta[property="og:title"], meta[name="title"]') as HTMLMetaElement)?.content || ''
    }
    if (!title || title.length < 3 || title.length > 150) return null

    const company = doc.querySelector('[class*="company-name" i], [class*="companyName" i], [class*="employer-name" i], [class*="employer" i], [class*="org-name" i], [class*="company" i], [class*="org" i]')?.textContent?.trim() || (doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content?.trim() || 'Unknown Company'
    const location = doc.querySelector('[class*="location" i], [class*="city" i], [class*="workplace" i], [itemprop="addressLocality"]')?.textContent?.trim()
    const salary = doc.querySelector('[class*="salary" i], [class*="compensation" i], [class*="stipend" i], [class*="pay" i]')?.textContent?.trim()
    const jobType = doc.querySelector('[class*="job-type" i], [class*="employment-type" i], [class*="work-type" i]')?.textContent?.trim()
    const descEl = doc.querySelector('[class*="job-description" i], [class*="jobDescription" i], [class*="description" i], [class*="posting-requirements" i], article, main')
    const description = descEl?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 3000)

    return {
      title, company, location, salary, jobType, description,
      jobUrl: currentUrl,
      sourceWebsite: typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : '',
      confidence: 'MEDIUM',
    }
  }

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
              if (jobItem['@type'] === 'JobPosting' || jobItem.title) jobs.push(this.formatJsonLdJob(jobItem))
            }
          } else if (item['@type'] === 'JobPosting') jobs.push(this.formatJsonLdJob(item))
        }
      } catch { /* malformed json-ld */ }
    }
    return jobs
  }

  private formatJsonLdJob(item: Record<string, any>): ExtractedJob {
    return {
      title: item.title || item.name || 'Untitled Position',
      company: item.hiringOrganization?.name || item.employerOverview || 'Unknown Company',
      location: typeof item.jobLocation === 'string' ? item.jobLocation : item.jobLocation?.address?.addressLocality || item.jobLocation?.address?.addressRegion,
      salary: item.baseSalary?.value?.value || (item.baseSalary?.value?.minValue && item.baseSalary?.value?.maxValue ? `${item.baseSalary.value.minValue}–${item.baseSalary.value.maxValue} ${item.baseSalary.value.unitText || ''}` : undefined),
      jobType: item.employmentType,
      jobUrl: item.url || (typeof window !== 'undefined' ? window.location.href : ''),
      sourceWebsite: typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : '',
      confidence: 'HIGH',
    }
  }

  private extractCardData(card: HTMLElement, preferredAnchor?: HTMLAnchorElement): ExtractedJob | null {
    const titleEl = card.querySelector('h1, h2, h3, h4, h5, [class*="job-title" i], [class*="jobTitle" i], [class*="title" i], [class*="opp_title" i], [class*="opp-title" i], [class*="role" i], [class*="position" i], [class*="heading" i], a[class*="job" i]') || preferredAnchor
    const titleLink = (titleEl?.tagName === 'A' ? titleEl : preferredAnchor || card.querySelector('a')) as HTMLAnchorElement | null
    let title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || titleLink?.textContent?.replace(/\s+/g, ' ').trim() || ''

    if (!title || /^(home|about|careers|jobs|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all)$/i.test(title)) {
      const anchors = Array.from(card.querySelectorAll?.('a') || []) as HTMLAnchorElement[]
      for (const a of anchors) {
        const aText = a.textContent?.replace(/\s+/g, ' ').trim() || ''
        if (aText.length >= 3 && aText.length <= 140 && UNIVERSAL_JOB_ROLE_REGEX.test(aText)) {
          title = aText
          break
        }
      }
    }

    if (!title || title.length < 3 || title.length > 150) return null

    const cardText = card.textContent?.replace(/\s+/g, ' ').trim() || ''
    const company = card.querySelector('[class*="company" i], [class*="employer" i], [class*="organisation" i], [class*="organization" i], [class*="org" i], [class*="sub-title" i], [class*="subtitle" i], [class*="c-name" i], [class*="brand" i], [class*="recruiter" i]')?.textContent?.replace(/\s+/g, ' ').trim() || 'Unknown Company'

    let location = card.querySelector('[class*="location" i], [class*="city" i], [class*="place" i], [class*="region" i]')?.textContent?.replace(/\s+/g, ' ').trim()
    if (!location) {
      const locMatch = cardText.match(/\b(remote|hybrid|on[ -]?site|in[ -]?office|work from home|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|gurgaon|gurugram|noida|chennai|kolkata|london|new york|san francisco|singapore|berlin|toronto|austin|seattle|dublin|chicago|boston)\b/i)
      if (locMatch) location = locMatch[0]
    }

    let salary = card.querySelector('[class*="salary" i], [class*="stipend" i], [class*="compensation" i], [class*="pay" i], [class*="wage" i], [class*="ctc" i]')?.textContent?.replace(/\s+/g, ' ').trim()
    if (!salary) {
      const salMatch = cardText.match(/([$€£₹]\s*[\d,]+|\b\d+(\.\d+)?\s*-\s*\d+(\.\d+)?\s*(lpa|k|lac|lakh|cr)\b|\b\d+(\.\d+)?\s*(lpa|lac|lakh|k)\b|\bper\s+(month|year|annum|hr|hour)\b|\b\d+k\s*-\s*\d+k\b)/i)
      if (salMatch) salary = salMatch[0]
    }

    let jobType = card.querySelector('[class*="job-type" i], [class*="employment" i], [class*="work-type" i], [class*="timing" i]')?.textContent?.replace(/\s+/g, ' ').trim()
    if (!jobType) {
      const typeMatch = cardText.match(/\b(full[ -]?time|part[ -]?time|contract|internship|intern|campus\s+ambassador|freelance|permanent|temporary|trainee)\b/i)
      if (typeMatch) jobType = typeMatch[0]
    }

    const description = card.querySelector('[class*="snippet" i], [class*="description" i], [class*="summary" i], p')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 1000)

    let jobUrl = titleLink?.href || ''
    if (!jobUrl || (typeof window !== 'undefined' && jobUrl === window.location.href) || jobUrl === '#' || jobUrl.startsWith('javascript:')) {
      const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://careers.company.com'
      jobUrl = `${origin}/jobs/${encodeURIComponent(title)}-${encodeURIComponent(company)}`
    }

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
