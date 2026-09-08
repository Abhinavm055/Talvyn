import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'
import { UNIVERSAL_JOB_ROLE_REGEX } from '../jobEvidenceDetector'

function cleanUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    // Strip common tracking and referral parameters while preserving canonical path
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'ref_id', 'source', 'shared_by', 'fbclid', 'gclid', 'trk'
    ]
    for (const p of trackingParams) {
      parsed.searchParams.delete(p)
    }
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

function extractFromJsonLd(doc: Document): {
  company?: string
  location?: string
  salary?: string
  description?: string
  title?: string
} {
  try {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
    for (const script of Array.from(scripts)) {
      const text = script.textContent
      if (!text) continue
      const data = JSON.parse(text)
      const jobPosting =
        data?.['@type'] === 'JobPosting'
          ? data
          : Array.isArray(data?.['@graph'])
          ? data['@graph'].find((item: any) => item?.['@type'] === 'JobPosting')
          : data

      if (jobPosting) {
        const company =
          jobPosting?.hiringOrganization?.name ||
          jobPosting?.hiringOrganization?.legalName ||
          jobPosting?.author?.name

        const locObj = jobPosting?.jobLocation?.address || jobPosting?.jobLocation
        let location = ''
        if (typeof locObj === 'string') {
          location = locObj
        } else if (locObj) {
          const parts = [
            locObj.addressLocality,
            locObj.addressRegion,
            locObj.addressCountry,
          ].filter(Boolean)
          location = parts.join(', ')
        }

        let salary = ''
        const baseSal = jobPosting?.baseSalary?.value || jobPosting?.baseSalary
        if (baseSal) {
          if (typeof baseSal === 'string' || typeof baseSal === 'number') {
            salary = String(baseSal)
          } else if (baseSal.minValue && baseSal.maxValue) {
            salary = `${baseSal.minValue} - ${baseSal.maxValue} ${baseSal.unitText || ''}`.trim()
          } else if (baseSal.value) {
            salary = String(baseSal.value)
          }
        }

        return {
          company: company?.trim(),
          location: location?.trim() || undefined,
          salary: salary?.trim() || undefined,
          description: jobPosting?.description || undefined,
          title: jobPosting?.title || undefined,
        }
      }
    }
  } catch {
    /* JSON-LD fallback */
  }
  return {}
}

export class UnstopAdapter implements SiteAdapter {
  name = 'Unstop'

  canHandle(url: string): boolean {
    return url.includes('unstop.com')
  }

  isJobDetailPage(url: string, doc?: Document): boolean {
    const clean = url.toLowerCase()

    const cardCount = doc?.querySelectorAll?.(
      '[class*="opportunity_card" i], [class*="opp-card" i], [class*="opp_card" i], [class*="c-card" i], [class*="job-card" i], [class*="listing_card" i], [class*="opportunity" i], .single_opportunity'
    )?.length || 0

    if (cardCount >= 2) {
      return false
    }

    const isListUrl =
      /\/(job|jobs)\/?(\?.*)?$/i.test(clean) ||
      /\/jobs?\/search/i.test(clean) ||
      /\/internships\/?(\?.*)?$/i.test(clean) ||
      clean.includes('selecteditem=') ||
      clean.includes('oppstatus=') ||
      clean.includes('opportunity=')

    if (isListUrl && cardCount >= 1) {
      return false
    }

    const isDetailUrl =
      /\/jobs\/[a-zA-Z0-9_-]+-\d+/i.test(clean) ||
      /\/internships\/[a-zA-Z0-9_-]+-\d+/i.test(clean) ||
      /\/competitions\/[a-zA-Z0-9_-]+-\d+/i.test(clean) ||
      /\/hackathons\/[a-zA-Z0-9_-]+-\d+/i.test(clean) ||
      /\/workshops\/[a-zA-Z0-9_-]+-\d+/i.test(clean) ||
      /\/conferences\/[a-zA-Z0-9_-]+-\d+/i.test(clean) ||
      /\/quizzes\/[a-zA-Z0-9_-]+-\d+/i.test(clean) ||
      /\/p\/[a-zA-Z0-9_-]+/i.test(clean) ||
      (/\/(jobs|internships|competitions)\/[a-zA-Z0-9_-]{4,}/i.test(clean) && !/\/(jobs|internships|competitions)\/(search|all|\?|$)/i.test(clean))

    const hasTitle = Boolean(doc?.querySelector?.('h1, h1.title, [class*="job-title" i], [class*="opp_title" i], [class*="opp-title" i]'))
    const hasApplyOrRegBtn = Boolean(doc?.querySelector?.('button[class*="apply" i], a[class*="apply" i], button[class*="register" i], a[class*="register" i]'))

    if (isDetailUrl && !isListUrl) {
      return true
    }

    return Boolean(hasTitle && hasApplyOrRegBtn && !isListUrl)
  }

  isJobListingPage(url: string, doc?: Document): boolean {
    const clean = url.toLowerCase()
    const isListUrl =
      /\/(job|jobs)\/?(\?.*)?$/i.test(clean) ||
      /\/jobs?\/search/i.test(clean) ||
      /\/internships\/?(\?.*)?$/i.test(clean) ||
      /\/internships\/search/i.test(clean) ||
      /\/competitions\/?(\?.*)?$/i.test(clean) ||
      /\/all-opportunities/i.test(clean) ||
      clean.includes('opportunity=') ||
      clean.includes('oppstatus=') ||
      clean.includes('selecteditem=')

    const cardCount = doc?.querySelectorAll?.(
      '[class*="opportunity_card" i], [class*="opp-card" i], [class*="opp_card" i], [class*="c-card" i], [class*="job-card" i], [class*="listing_card" i], [class*="opportunity" i], .single_opportunity'
    )?.length || 0

    if (isListUrl || cardCount >= 2) {
      return true
    }

    if (this.isJobDetailPage(url, doc)) {
      return false
    }

    return false
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const seen = new Set<string>()

    const cardElements = Array.from(
      doc.querySelectorAll(
        '[class*="opportunity_card" i], [class*="opp-card" i], [class*="opp_card" i], [class*="c-card" i], [class*="job-card" i], [class*="listing_card" i], .single_opportunity, [class*="opportunity" i]'
      )
    )

    let idx = 0
    for (const card of cardElements) {
      idx++
      // Filter out non-card parent containers if matching [class*="opportunity" i] broadly
      if (card.children.length > 25 && card.querySelectorAll('[class*="opportunity" i]').length > 1) {
        continue
      }

      // 1. High-precision title selection: prioritize elements matching universal job roles
      const titleCandidates = Array.from(card.querySelectorAll(
        'h1, h2, h3, h4, h5, [class*="job-title" i], [class*="jobTitle" i], [class*="opp_title" i], [class*="opp-title" i], [class*="role" i], [class*="position" i], [class*="heading" i], a, strong, b'
      ))
      let title = ''
      let linkEl: HTMLAnchorElement | null = null

      for (const el of titleCandidates) {
        const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
        const cls = (el.className || '').toString().toLowerCase()
        if (cls.includes('sub') || cls.includes('company') || cls.includes('org') || cls.includes('brand')) continue
        if (txt.length >= 3 && txt.length <= 140 && UNIVERSAL_JOB_ROLE_REGEX.test(txt) && !/^(home|about|careers|jobs|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all)$/i.test(txt)) {
          title = txt
          linkEl = (el.tagName === 'A' ? el : el.closest('a')) as HTMLAnchorElement | null
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
            linkEl = (el.tagName === 'A' ? el : el.closest('a')) as HTMLAnchorElement | null
            break
          }
        }
      }

      const companyEl = card.querySelector(
        '[class*="company" i], [class*="organisation" i], [class*="organization" i], [class*="c-name" i], [class*="sub-title" i], [class*="subtitle" i], [class*="brand" i]'
      )
      const locationEl = card.querySelector(
        '[class*="location" i], [class*="city" i], [class*="place" i], [class*="meta_item" i], [aria-label*="location" i]'
      )
      const salaryEl = card.querySelector(
        '[class*="salary" i], [class*="stipend" i], [class*="ctc" i], [class*="pay" i], [class*="compensation" i]'
      )
      const typeEl = card.querySelector(
        '[class*="job-type" i], [class*="opp-type" i], [class*="timing" i], [class*="type" i]'
      )

      const rawCompany = companyEl?.textContent?.trim()
      const company = rawCompany && rawCompany.length > 0 ? rawCompany : 'Unknown Company'

      const dataId = (card as HTMLElement).getAttribute?.('data-id') || (card as HTMLElement).getAttribute?.('data-item-id') || (card as HTMLElement).getAttribute?.('id')
      let rawJobUrl = linkEl?.href || (dataId ? `https://unstop.com/jobs/${dataId}` : '')
      if (!rawJobUrl || (typeof window !== 'undefined' && rawJobUrl === window.location.href) || rawJobUrl === '#' || rawJobUrl.startsWith('javascript:')) {
        rawJobUrl = `https://unstop.com/jobs/${encodeURIComponent(title || '')}-${encodeURIComponent(company || '')}-${idx}`
      }
      const jobUrl = cleanUrl(rawJobUrl)

      let location = locationEl?.textContent?.trim() || undefined
      if (location && (location.includes('Bengaluru') || location.includes('Bangalore'))) {
        location = location.replace(/\s+/g, ' ').trim()
      }

      const dedupKey = `${title.toLowerCase()}|${company.toLowerCase()}`
      // Reject non-job items (e.g. pure generic cards or empty titles)
      if (title && title.length > 2 && !seen.has(dedupKey) && !seen.has(jobUrl)) {
        seen.add(dedupKey)
        seen.add(jobUrl)
        jobs.push({
          title,
          company,
          location,
          salary: salaryEl?.textContent?.trim() || undefined,
          jobType: typeEl?.textContent?.trim() || undefined,
          jobUrl,
          sourceWebsite: 'Unstop',
          confidence: 'HIGH',
        })
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const jsonLdData = extractFromJsonLd(doc)

    const titleEl = doc.querySelector(
      'h1, h1.title, [class*="job-title" i], [class*="opp_title" i], [class*="opp-title" i], [class*="header" i] h1, [class*="main_title" i]'
    )
    const title = titleEl?.textContent?.trim() || jsonLdData.title

    if (!title || title.length < 2) return null

    const companyEl = doc.querySelector(
      '[class*="company_name" i], [class*="organisation" i], [class*="organization" i], [class*="c-name" i], [class*="sub_title" i], [class*="sub-title" i], [class*="org" i], [class*="employer" i], [class*="brand" i], h2'
    )
    const company =
      companyEl?.textContent?.trim() ||
      jsonLdData.company ||
      'Unknown Company'

    // Priority for location: 1. Authoritative chip/DOM -> 2. JSON-LD -> 3. Fallback scan
    const locationEl = doc.querySelector(
      '[class*="location" i], [class*="place" i], [class*="city" i], [class*="job_location" i], [aria-label*="location" i], .job_details_item_location, .other_details .location'
    )
    let location = locationEl?.textContent?.trim() || jsonLdData.location

    // Check textual chips if not found
    if (!location) {
      const chips = Array.from(doc.querySelectorAll('[class*="chip" i], [class*="badge" i], [class*="meta" i], [class*="detail" i]'))
      for (const chip of chips) {
        const text = chip.textContent?.trim() || ''
        if (
          /\b(Bangalore|Bengaluru|Hyderabad|Pune|Mumbai|Delhi|Gurgaon|Gurugram|Noida|Chennai|Kolkata|Remote|Work from home|Hybrid)\b/i.test(text) &&
          text.length < 50
        ) {
          location = text
          break
        }
      }
    }

    if (location) {
      location = location.replace(/\s+/g, ' ').trim()
    }

    const salaryEl = doc.querySelector(
      '[class*="salary" i], [class*="stipend" i], [class*="ctc" i], [class*="compensation" i], [class*="pay" i]'
    )
    const salary = salaryEl?.textContent?.trim() || jsonLdData.salary || undefined

    const jobTypeEl = doc.querySelector(
      '[class*="job-type" i], [class*="job_type" i], [class*="opp_type" i], [class*="opp-type" i], [class*="timing" i], [class*="work_type" i]'
    )
    const jobType = jobTypeEl?.textContent?.trim() || undefined

    // Semantic section extraction: Responsibilities, Requirements, and genuine Description
    const responsibilities: string[] = []
    const requirements: string[] = []
    let descriptionText = ''

    // Search for semantic section headings
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
          } else if (isAboutHeading && !descriptionText) {
            descriptionText = lines.join(' ')
          }
        }
      }
    }

    // Content container query: strictly avoid tiny metadata chips like "Eligibility Fresher Locations Delhi"
    if (!descriptionText) {
      const descEl = doc.querySelector(
        '#description, [class*="job-description" i], [class*="job_description" i], [class*="jobDescription" i], [class*="about_job" i], [class*="about-job" i], [class*="role_description" i], [itemprop="description"]'
      )
      if (descEl) {
        const text = descEl.textContent?.replace(/\s+/g, ' ').trim() || ''
        if (text.length > 60 && !/^eligibility\s+fresher\s+locations/i.test(text)) {
          descriptionText = text
        }
      }
    }

    // Secondary fallback: JSON-LD description
    if (!descriptionText && jsonLdData.description) {
      descriptionText = jsonLdData.description
    }

    // If responsibilities or requirements were extracted, synthesize full description if needed
    if ((responsibilities.length > 0 || requirements.length > 0) && (!descriptionText || descriptionText.length < 100)) {
      const parts: string[] = []
      if (descriptionText) parts.push(descriptionText)
      if (responsibilities.length > 0) {
        parts.push(`Responsibilities:\n${responsibilities.map((r) => `• ${r}`).join('\n')}`)
      }
      if (requirements.length > 0) {
        parts.push(`Requirements:\n${requirements.map((r) => `• ${r}`).join('\n')}`)
      }
      descriptionText = parts.join('\n\n')
    }

    const description = descriptionText ? descriptionText.slice(0, 3000) : undefined

    const rawUrl = typeof window !== 'undefined' ? window.location.href : ''
    const jobUrl = cleanUrl(rawUrl)

    console.log(`[Talvyn] UNSSTOP_JOB_EXTRACTED: ${title} at ${company} (URL: ${jobUrl}, Location: ${location || 'N/A'})`)

    return {
      title,
      company,
      location,
      salary,
      jobType,
      description,
      responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
      requirements: requirements.length > 0 ? requirements : undefined,
      jobUrl,
      sourceWebsite: 'Unstop',
      confidence: 'HIGH',
    }
  }
}

