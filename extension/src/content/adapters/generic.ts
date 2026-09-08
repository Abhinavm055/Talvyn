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

    // Semantic section extraction: Responsibilities and Requirements
    const responsibilities: string[] = []
    const requirements: string[] = []
    let semanticDesc = ''

    const sectionHeadings = Array.from(doc.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, strong, b, [class*="heading" i], [class*="section_title" i], [class*="section-title" i], [class*="title" i], div, span, p'
    ))

    for (const el of sectionHeadings) {
      const text = el.textContent?.replace(/\s+/g, ' ').trim() || ''
      if (!text || text.length > 60 || text.includes('\n')) continue

      const isRespHeading = /^(key\s+|major\s+|primary\s+|role\s+)?responsibilities\b|^what\s+you('ll|\s+will)\s+do\b|^your\s+role\b|^duties\b|^day[ -]to[ -]day\b/i.test(text)
      const isReqHeading = /^(key\s+|basic\s+|minimum\s+|preferred\s+)?(requirements|qualifications)\b|^what\s+we('re|\s+are)\s+looking\s+for\b|^who\s+you\s+are\b|^what\s+you('ll|\s+will)\s+need\b|^skills\s+and\s+qualifications\b|^eligibility\s+criteria\b/i.test(text)
      const isAboutHeading = /^(about\s+the\s+(job|role|position)|job\s+description|role\s+overview|job\s+summary)\b/i.test(text)

      if (isRespHeading || isReqHeading || isAboutHeading) {
        let container: Element | null = el.nextElementSibling
        if (!container && el.parentElement && el.parentElement.children.length <= 2) {
          container = el.parentElement.nextElementSibling
        }
        if (container) {
          const lis = Array.from(container.querySelectorAll('li'))
          const listItems = lis.map((li) => li.textContent?.replace(/\s+/g, ' ').trim() || '').filter((t) => t.length > 5 && t.length < 300)
          const lines = listItems.length > 0 ? listItems : (container.textContent || '').split(/\n|<br\s*\/?>/).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length > 10 && l.length < 300)

          if (isRespHeading && responsibilities.length === 0) {
            responsibilities.push(...lines.slice(0, 8))
          } else if (isReqHeading && requirements.length === 0) {
            requirements.push(...lines.slice(0, 8))
          } else if (isAboutHeading && !semanticDesc) {
            semanticDesc = lines.join(' ')
          }
        }
      }
    }

    const jsonLdJobs = this.extractFromJsonLd(doc)
    if (jsonLdJobs.length === 1 && jsonLdJobs[0].title) {
      const j = jsonLdJobs[0]
      if (!j.description) {
        const descEl = doc.querySelector('[class*="job-description" i], [class*="jobDescription" i], [class*="description" i], [class*="posting-requirements" i], article, main')
        if (descEl) j.description = descEl.textContent?.replace(/\s+/g, ' ').trim().slice(0, 3000)
      }
      if (responsibilities.length > 0) j.responsibilities = responsibilities
      if (requirements.length > 0) j.requirements = requirements
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
    let description = descEl?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 3000)
    if (!description || description.length < 60) {
      description = semanticDesc || undefined
    }

    if ((responsibilities.length > 0 || requirements.length > 0) && (!description || description.length < 100)) {
      const parts: string[] = []
      if (description) parts.push(description)
      if (responsibilities.length > 0) parts.push(`Responsibilities:\n${responsibilities.map((r) => `• ${r}`).join('\n')}`)
      if (requirements.length > 0) parts.push(`Requirements:\n${requirements.map((r) => `• ${r}`).join('\n')}`)
      description = parts.join('\n\n')
    }

    return {
      title, company, location, salary, jobType, description,
      responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
      requirements: requirements.length > 0 ? requirements : undefined,
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
              const inner = elem.item || elem
              if (inner['@type'] === 'JobPosting') jobs.push(this.formatJsonLdJob(inner))
            }
          } else if (item['@type'] === 'JobPosting') {
            jobs.push(this.formatJsonLdJob(item))
          }
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
    const titleCandidates = Array.from(card.querySelectorAll(
      'h1, h2, h3, h4, h5, [class*="job-title" i], [class*="jobTitle" i], [class*="job_title" i], [class*="opp_title" i], [class*="opp-title" i], [class*="role" i], [class*="position" i], [class*="heading" i], a, strong, b'
    ))
    let title = ''
    let titleLink: HTMLAnchorElement | null = preferredAnchor || null

    for (const el of titleCandidates) {
      const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
      const cls = (el.className || '').toString().toLowerCase()
      if (cls.includes('sub') || cls.includes('company') || cls.includes('org') || cls.includes('brand')) continue
      if (txt.length >= 3 && txt.length <= 140 && UNIVERSAL_JOB_ROLE_REGEX.test(txt) && !/^(home|about|careers|jobs|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all)$/i.test(txt)) {
        title = txt
        if (!titleLink) titleLink = (el.tagName === 'A' ? el : el.closest('a')) as HTMLAnchorElement | null
        break
      }
    }

    if (!title) {
      for (const el of titleCandidates) {
        const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
        const cls = (el.className || '').toString().toLowerCase()
        if (cls.includes('sub') || cls.includes('company') || cls.includes('org') || cls.includes('brand')) continue
        if (txt.length >= 3 && txt.length <= 140 && !/^(home|about|careers|jobs|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all)$/i.test(txt)) {
          title = txt
          if (!titleLink) titleLink = (el.tagName === 'A' ? el : el.closest('a')) as HTMLAnchorElement | null
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
