import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'
import { isLikelyJobPage, isLikelyJobListing, isValidJobCard, isExplicitlyNonJobSite, UNIVERSAL_JOB_ROLE_REGEX, findJobCardCandidates } from '../jobEvidenceDetector'

export class GenericAdapter implements SiteAdapter {
  name = 'Generic'

  canHandle(): boolean { return true }

  isJobDetailPage(url: string, doc: Document): boolean {
    if (isExplicitlyNonJobSite(url)) return false
    // If there are 2 or more primary (non-sidebar/non-recommendation) job cards, it is a listing page, not a single job detail
    const primaryCards = findJobCardCandidates(doc).filter((c) => {
      if (!isValidJobCard(c).isValid) return false
      const isSidebar = Boolean(
        c.closest?.('aside') ||
        c.closest?.('[class*="recommend" i]') ||
        c.closest?.('[class*="similar" i]') ||
        c.closest?.('[class*="related" i]') ||
        c.closest?.('[class*="other-jobs" i]')
      )
      return !isSidebar
    })
    if (primaryCards.length >= 2) return false

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
      if (normCompany !== 'unknowncompany') {
        seenJobKeys.add(`${normTitle}|unknowncompany`)
      }
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

    // 2. Discover all candidate cards universally (semantic selectors, anchors, repeated-card structures)
    const candidateCards = findJobCardCandidates(doc)
    for (const card of candidateCards) {
      if (!isValidJobCard(card).isValid) continue
      add(this.extractCardData(card))
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

    const isExcluded = (el: Element | null): boolean => {
      if (!el) return true
      if (typeof el.closest !== 'function') return false
      return Boolean(el.closest('header, nav, [role="banner"], [role="navigation"], [class*="nav" i], [class*="navbar" i], [class*="header" i], [class*="account" i], [class*="user-menu" i]'))
    }

    const nonJobHeadingPattern = /^(welcome\b|hello\b|hi\b|good\s+(morning|afternoon|evening)|my\s+account\b|sign\s+in\b|sign\s+up\b|log\s+in\b|log\s+out\b|dashboard\b|notifications\b|messages\b|settings\b|feedback\b|search\s+jobs\b|browse\s+jobs\b|find\s+jobs\b)/i

    // 1. Authoritative job detail container
    const container = doc.querySelector(
      'main, article[class*="job" i], [role="main"], [class*="job-details" i], [class*="job-view" i], [class*="job-posting" i], [class*="jobDescription" i], [id*="job-detail" i], [class*="posting" i], article'
    ) || doc.body || doc

    // 2. Job title extraction
    let title = ''
    const titleCandidates = Array.from(
      container.querySelectorAll('[class*="job-title" i], [class*="jobTitle" i], [class*="position-title" i], [class*="role-title" i], [class*="app-title" i], h1, h2, [class*="title" i]')
    )

    for (const el of titleCandidates) {
      if (isExcluded(el) && container === doc.body) continue
      const txt = el.textContent?.trim() || ''
      if (txt.length >= 3 && txt.length <= 150 && !nonJobHeadingPattern.test(txt)) {
        if (UNIVERSAL_JOB_ROLE_REGEX.test(txt) || el.className.toString().toLowerCase().includes('title') || ['H1', 'H2'].includes(el.tagName)) {
          title = txt
          break
        }
      }
    }

    if (!title) {
      const docHeadings = Array.from(doc.querySelectorAll('h1, [class*="job-title" i], [class*="app-title" i]'))
      for (const el of docHeadings) {
        if (isExcluded(el)) continue
        const txt = el.textContent?.trim() || ''
        if (txt.length >= 3 && txt.length <= 150 && !nonJobHeadingPattern.test(txt)) {
          title = txt
          break
        }
      }
    }

    if (!title || title.length < 3 || title.length > 150) {
      const metaTitle = (doc.querySelector('meta[property="og:title"], meta[name="title"]') as HTMLMetaElement)?.content || ''
      if (metaTitle && !nonJobHeadingPattern.test(metaTitle)) {
        title = metaTitle
      }
    }
    if (!title || title.length < 3 || title.length > 150) return null

    // 3. Company from container
    const companyEl = container.querySelector(
      '[class*="company-name" i], [class*="companyName" i], [class*="employer-name" i], [class*="employer" i], [class*="org-name" i], [class*="company" i], [class*="org" i]'
    ) || doc.querySelector(
      '[class*="company-name" i], [class*="companyName" i], [class*="employer-name" i], [class*="employer" i], [class*="org-name" i]'
    )
    const company = companyEl?.textContent?.trim() || (doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content?.trim() || 'Unknown Company'

    // 4. Location, Salary, JobType from container
    const location = (
      container.querySelector('[class*="location" i], [class*="city" i], [class*="workplace" i], [itemprop="addressLocality"]') ||
      doc.querySelector('[class*="location" i], [class*="city" i], [class*="workplace" i], [itemprop="addressLocality"]')
    )?.textContent?.trim()

    const salary = (
      container.querySelector('[class*="salary" i], [class*="compensation" i], [class*="stipend" i], [class*="pay" i]') ||
      doc.querySelector('[class*="salary" i], [class*="compensation" i], [class*="stipend" i], [class*="pay" i]')
    )?.textContent?.trim()

    const jobType = (
      container.querySelector('[class*="job-type" i], [class*="employment-type" i], [class*="work-type" i]') ||
      doc.querySelector('[class*="job-type" i], [class*="employment-type" i], [class*="work-type" i]')
    )?.textContent?.trim()

    // 5. Description from container
    const descEl = container.querySelector(
      '[class*="job-description" i], [class*="jobDescription" i], [class*="description" i], [class*="posting-requirements" i], article, main'
    ) || doc.querySelector(
      '[class*="job-description" i], [class*="jobDescription" i], [class*="description" i], [class*="posting-requirements" i]'
    )
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
    const cardText = card.textContent?.replace(/\s+/g, ' ').trim() || ''
    const titleCandidates = Array.from(card.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, [class*="title" i], [class*="role" i], [class*="position" i], [class*="heading" i], [class*="name" i], [data-automation-id*="title" i], [data-testid*="title" i], a, strong, b, [class*="bold" i], [class*="semibold" i], p, div, span'
    ))
    let title = ''
    let titleLink: HTMLAnchorElement | null = preferredAnchor || null

    // 1. First priority: Heading or element matching universal job roles
    for (const el of titleCandidates) {
      if (el.children && el.children.length > 3) continue
      const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
      const cls = (el.className || '').toString().toLowerCase()
      if (cls.includes('sub') || cls.includes('company') || cls.includes('org') || cls.includes('brand') || cls.includes('employer')) continue
      if (txt.length >= 3 && txt.length <= 120 && UNIVERSAL_JOB_ROLE_REGEX.test(txt) && !/^(home|about|careers?|jobs?|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all|view details|register|register now)$/i.test(txt)) {
        title = txt
        if (!titleLink) titleLink = (el.tagName === 'A' ? el : el.closest?.('a')) as HTMLAnchorElement | null
        break
      }
    }

    // 2. Second priority: Heading, link, or bold element
    if (!title) {
      for (const el of titleCandidates) {
        if (el.children && el.children.length > 2) continue
        const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
        const cls = (el.className || '').toString().toLowerCase()
        if (cls.includes('sub') || cls.includes('company') || cls.includes('org') || cls.includes('brand') || cls.includes('employer')) continue
        const tag = el.tagName.toUpperCase()
        const isHeadingLike = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'A'].includes(tag) || cls.includes('title') || cls.includes('role') || cls.includes('heading')
        if (isHeadingLike && txt.length >= 3 && txt.length <= 120 && !/^(home|about|careers?|jobs?|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all|view details|register|register now)$/i.test(txt)) {
          title = txt
          if (!titleLink) titleLink = (el.tagName === 'A' ? el : el.closest?.('a')) as HTMLAnchorElement | null
          break
        }
      }
    }

    // 3. Third priority: Text line matching job role
    if (!title) {
      const lines = cardText.split(/\n|<br\s*\/?>/).map((l) => l.trim()).filter((l) => l.length >= 3 && l.length <= 120)
      for (const line of lines.slice(0, 4)) {
        if (UNIVERSAL_JOB_ROLE_REGEX.test(line) && !/^(home|about|careers?|jobs?|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all|view details|register|register now)$/i.test(line)) {
          title = line
          break
        }
      }
    }

    if (!title || title.length < 3 || title.length > 150) return null

    // Company extraction
    const companyEl = card.querySelector('[class*="company" i], [class*="employer" i], [class*="organisation" i], [class*="organization" i], [class*="org" i], [class*="sub-title" i], [class*="subtitle" i], [class*="c-name" i], [class*="brand" i], [class*="recruiter" i]')
    let company = companyEl?.textContent?.replace(/\s+/g, ' ').trim() || ''

    if (!company) {
      const nonTitleLeaves = Array.from(card.querySelectorAll('span, div, p, a, h4, h5'))
      for (const el of nonTitleLeaves) {
        if (el.children && el.children.length > 0) continue
        const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
        if (txt && txt !== title && txt.length >= 2 && txt.length <= 60) {
          const isMeta = /\b(full[ -]?time|part[ -]?time|remote|hybrid|in[ -]?office|years?|yrs?|exp|lpa|ctc|stipend|salary|[$€£₹]|apply|view)\b/i.test(txt)
          if (!isMeta && !/^(home|about|careers?|jobs?|login|sign in|privacy|terms|menu|search|share|apply|save|view details)$/i.test(txt)) {
            company = txt
            break
          }
        }
      }
    }
    if (!company) company = 'Unknown Company'

    let location = card.querySelector('[class*="location" i], [class*="city" i], [class*="place" i], [class*="region" i]')?.textContent?.replace(/\s+/g, ' ').trim()
    if (!location) {
      const locMatch = cardText.match(/\b(remote|hybrid|on[ -]?site|in[ -]?office|work from home|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|gurgaon|gurugram|noida|chennai|kolkata|ahmedabad|kochi|chandigarh|jaipur|indore|london|new york|san francisco|singapore|berlin|toronto|austin|seattle|dublin|chicago|boston)\b/i)
      if (locMatch) location = locMatch[0]
    }

    let salary = card.querySelector('[class*="salary" i], [class*="stipend" i], [class*="compensation" i], [class*="pay" i], [class*="wage" i], [class*="ctc" i]')?.textContent?.replace(/\s+/g, ' ').trim()
    if (!salary) {
      const salMatch = cardText.match(/(([$€£₹]?\s*\d+(\.\d+)?\s*(l|lac|lakh|cr|k)?\s*-\s*[$€£₹]?\s*\d+(\.\d+)?\s*(lpa|ctc|k|lac|lakh|cr|l)\b)|([$€£₹]\s*\d+(\.\d+)?\s*(l|lac|lakh|cr|k)?\s*-\s*[$€£₹]?\s*\d+(\.\d+)?\s*(lpa|ctc|k|lac|lakh|cr|l)?\b)|(\b\d+(\.\d+)?\s*(lpa|ctc|lac|lakh|k)\b)|([$€£₹]\s*[\d,]+(\.\d+)?)|(\bper\s+(month|year|annum|hr|hour)\b)|(\b\d+k\s*-\s*\d+k\b)|(\b(salary|stipend|compensation|unpaid)\b))/i)
      if (salMatch) salary = salMatch[0]
    }

    let jobType = card.querySelector('[class*="job-type" i], [class*="employment" i], [class*="work-type" i], [class*="timing" i]')?.textContent?.replace(/\s+/g, ' ').trim()
    if (!jobType) {
      const typeMatch = cardText.match(/\b(full[ -]?time|part[ -]?time|contract|internship|intern|campus\s+ambassador|freelance|permanent|temporary|trainee|in[ -]?office|in[ -]?person)\b/i)
      if (typeMatch) jobType = typeMatch[0]
    }

    let experience = card.querySelector('[class*="experience" i], [class*="exp" i]')?.textContent?.replace(/\s+/g, ' ').trim()
    if (!experience) {
      const expMatch = cardText.match(/\b(no\s+(prior\s+)?exp(erience)?(\s+required)?|exp(erience)?\s+not\s+required|fresher|freshers|entry[ -]?level|mid[ -]?level|senior|lead|\d+\+?\s*(years?|yrs?)(\s+(of\s+)?exp(erience)?)?|\d+\s*-\s*\d+\s*(years?|yrs?)|\d+\s*to\s*\d+\s*(years?|yrs?)|0\s*-\s*\d+\s*(years?|yrs?)|0\s*to\s*\d+\s*(years?|yrs?)|0\+?\s*(years?|yrs?)|years?\s+exp|min\s+\d+\s*(years?|yrs?))\b/i)
      if (expMatch) experience = expMatch[0]
    }

    const snippetEl = card.querySelector('[class*="snippet" i], [class*="description" i], [class*="summary" i], [class*="details" i], ul, p')
    const description = snippetEl?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 1000)

    const snippetLis = Array.from(snippetEl?.querySelectorAll('li') || card.querySelectorAll('li'))
    const snippetBullets = snippetLis.map((li) => li.textContent?.replace(/\s+/g, ' ').trim() || '').filter((t) => t.length > 8 && t.length < 250)

    let jobUrl = titleLink?.href || (card.tagName === 'A' ? (card as HTMLAnchorElement).href : '') || ''
    if (!jobUrl || (typeof window !== 'undefined' && jobUrl === window.location.href) || jobUrl === '#' || jobUrl.startsWith('javascript:')) {
      const preferredLink = card.querySelector('a[href*="/job"], a[href*="/career"], a[href*="/position"], a[href*="/opening"], a[href*="/opp"], a[href*="/apply"], a[itemprop="url"]') as HTMLAnchorElement | null
      const anyLink = preferredLink || (card.querySelector('a[href]') as HTMLAnchorElement | null)
      if (anyLink && anyLink.href && anyLink.href !== '#' && !anyLink.href.startsWith('javascript:')) {
        jobUrl = anyLink.href
      }
    }
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
      experience,
      description,
      responsibilities: snippetBullets.length > 0 ? snippetBullets.slice(0, 4) : undefined,
      jobUrl,
      sourceWebsite: typeof window !== 'undefined' ? window.location.hostname.replace(/^www\./, '') : '',
      confidence: 'MEDIUM',
    }
  }
}
