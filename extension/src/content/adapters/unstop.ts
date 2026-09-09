import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'
import { UNIVERSAL_JOB_ROLE_REGEX, findJobCardCandidates, isValidJobCard } from '../jobEvidenceDetector'

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
      /\/(job|jobs)\/[a-z0-9_-]+-jobs/i.test(clean) ||
      /\/jobs?\/search/i.test(clean) ||
      /\/internships\/?(\?.*)?$/i.test(clean) ||
      /\/internships\/search/i.test(clean) ||
      clean.includes('selecteditem=') ||
      clean.includes('oppstatus=') ||
      clean.includes('opportunity=') ||
      clean.includes('usertype=') ||
      clean.includes('domain=') ||
      clean.includes('specialization=')

    if (isListUrl) {
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

    if (isDetailUrl) {
      return true
    }

    const mainOrArticle = doc?.querySelector('main, article, [class*="job-detail" i], [class*="opportunity-detail" i]') || doc
    const hasTitle = Boolean(mainOrArticle?.querySelector('h1, h1.title, [class*="job-title" i], [class*="opp_title" i], [class*="opp-title" i]'))
    const hasApplyBtn = Boolean(mainOrArticle?.querySelector('button[class*="apply" i], a[class*="apply" i], button[data-testid*="apply" i]'))

    return Boolean(hasTitle && hasApplyBtn)
  }

  isJobListingPage(url: string, doc?: Document): boolean {
    const clean = url.toLowerCase()
    const isListUrl =
      /\/(job|jobs)\/?(\?.*)?$/i.test(clean) ||
      /\/(job|jobs)\/[a-z0-9_-]+-jobs/i.test(clean) ||
      /\/jobs?\/search/i.test(clean) ||
      /\/internships\/?(\?.*)?$/i.test(clean) ||
      /\/internships\/search/i.test(clean) ||
      /\/competitions\/?(\?.*)?$/i.test(clean) ||
      /\/all-opportunities/i.test(clean) ||
      clean.includes('opportunity=') ||
      clean.includes('oppstatus=') ||
      clean.includes('selecteditem=') ||
      clean.includes('usertype=') ||
      clean.includes('domain=') ||
      clean.includes('specialization=')

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

    const rawCandidates: HTMLElement[] = [
      ...Array.from(
        doc.querySelectorAll(
          '[class*="opportunity_card" i], [class*="opp-card" i], [class*="opp_card" i], [class*="c-card" i], [class*="job-card" i], [class*="listing_card" i], .single_opportunity, app-competition-listing'
        )
      ) as HTMLElement[],
      ...findJobCardCandidates(doc),
    ]

    const uniqueCards = Array.from(new Set(rawCandidates))

    let idx = 0
    for (const card of uniqueCards) {
      idx++
      // Filter out non-card parent containers if matching [class*="opportunity" i] broadly
      if (card.children.length > 25 && card.querySelectorAll('[class*="opportunity" i]').length > 1) {
        continue
      }
      if (!isValidJobCard(card).isValid) {
        continue
      }

      const cardText = card.textContent?.replace(/\s+/g, ' ').trim() || ''

      // 1. High-precision title selection: prioritize elements matching universal job roles
      const titleCandidates = Array.from(card.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, [class*="job-title" i], [class*="jobTitle" i], [class*="opp_title" i], [class*="opp-title" i], [class*="role" i], [class*="position" i], [class*="heading" i], [class*="title" i], [class*="name" i], [data-automation-id*="title" i], [data-testid*="title" i], a, strong, b, [class*="bold" i], [class*="semibold" i], p, div, span'
      ))
      let title = ''
      let linkEl: HTMLAnchorElement | null = (card.tagName === 'A' ? card : null) as HTMLAnchorElement | null

      for (const el of titleCandidates) {
        if (el.children && el.children.length > 3) continue
        const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
        const cls = (el.className || '').toString().toLowerCase()
        if (cls.includes('sub') || cls.includes('company') || cls.includes('org') || cls.includes('brand') || cls.includes('employer')) continue
        if (txt.length >= 3 && txt.length <= 120 && UNIVERSAL_JOB_ROLE_REGEX.test(txt) && !/^(home|about|careers?|jobs?|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all|view details|register|register now)$/i.test(txt)) {
          title = txt
          if (!linkEl) linkEl = (el.tagName === 'A' ? el : el.closest?.('a')) as HTMLAnchorElement | null
          break
        }
      }

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
            if (!linkEl) linkEl = (el.tagName === 'A' ? el : el.closest?.('a')) as HTMLAnchorElement | null
            break
          }
        }
      }

      if (!title) {
        const lines = cardText.split(/\n|<br\s*\/?>/).map((l) => l.trim()).filter((l) => l.length >= 3 && l.length <= 120)
        for (const line of lines.slice(0, 4)) {
          if (UNIVERSAL_JOB_ROLE_REGEX.test(line) && !/^(home|about|careers?|jobs?|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all|view details|register|register now)$/i.test(line)) {
            title = line
            break
          }
        }
      }

      if (!title || title.length < 3 || title.length > 150) continue

      const companyEl = card.querySelector(
        '[class*="company" i], [class*="organisation" i], [class*="organization" i], [class*="c-name" i], [class*="sub-title" i], [class*="subtitle" i], [class*="brand" i], [class*="employer" i]'
      )
      let rawCompany = companyEl?.textContent?.trim() || ''
      if (!rawCompany) {
        const nonTitleLeaves = Array.from(card.querySelectorAll('span, div, p, a, h4, h5'))
        for (const el of nonTitleLeaves) {
          if (el.children && el.children.length > 0) continue
          const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
          if (txt && txt !== title && txt.length >= 2 && txt.length <= 60) {
            const isMeta = /\b(full[ -]?time|part[ -]?time|remote|hybrid|in[ -]?office|years?|yrs?|exp|lpa|ctc|stipend|salary|[$€£₹]|apply|view)\b/i.test(txt)
            if (!isMeta && !/^(home|about|careers?|jobs?|login|sign in|privacy|terms|menu|search|share|apply|save|view details)$/i.test(txt)) {
              rawCompany = txt
              break
            }
          }
        }
      }
      const company = rawCompany && rawCompany.length > 0 ? rawCompany : 'Unknown Company'

      const locationEl = card.querySelector(
        '[class*="location" i], [class*="city" i], [class*="place" i], [class*="meta_item" i], [aria-label*="location" i]'
      )
      const salaryEl = card.querySelector(
        '[class*="salary" i], [class*="stipend" i], [class*="ctc" i], [class*="pay" i], [class*="compensation" i]'
      )
      const typeEl = card.querySelector(
        '[class*="job-type" i], [class*="opp-type" i], [class*="timing" i], [class*="type" i]'
      )
      const expEl = card.querySelector(
        '[class*="experience" i], [class*="exp" i]'
      )

      const dataId = (card as HTMLElement).getAttribute?.('data-id') || (card as HTMLElement).getAttribute?.('data-item-id') || (card as HTMLElement).getAttribute?.('id')
      if (!linkEl) {
        linkEl = (card.querySelector('a[href]:not([href="#"]):not([href^="javascript:"])') || card.closest?.('a[href]')) as HTMLAnchorElement | null
      }
      let rawJobUrl = linkEl?.href || (dataId ? `https://unstop.com/jobs/${dataId}` : '')
      if (rawJobUrl && !rawJobUrl.startsWith('http') && typeof window !== 'undefined') {
        try {
          rawJobUrl = new URL(rawJobUrl, window.location.origin).toString()
        } catch {}
      }
      if (!rawJobUrl || (typeof window !== 'undefined' && rawJobUrl === window.location.href) || rawJobUrl === '#' || rawJobUrl.startsWith('javascript:')) {
        rawJobUrl = `https://unstop.com/jobs/${encodeURIComponent(title || '')}-${encodeURIComponent(company || '')}-${idx}`
      }
      const jobUrl = cleanUrl(rawJobUrl)

      let location = locationEl?.textContent?.trim()
      if (!location) {
        const locMatch = cardText.match(/\b(remote|hybrid|on[ -]?site|in[ -]?office|work from home|in[ -]?person|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|gurgaon|gurugram|noida|chennai|kolkata|ahmedabad|kochi|chandigarh|jaipur|indore|london|new york|san francisco|singapore|berlin|toronto|austin|seattle|dublin|chicago|boston)\b/i)
        if (locMatch) location = locMatch[0]
      }
      if (location && (location.includes('Bengaluru') || location.includes('Bangalore'))) {
        location = location.replace(/\s+/g, ' ').trim()
      }

      let salary = salaryEl?.textContent?.trim()
      if (!salary) {
        const salMatch = cardText.match(/(([$€£₹]?\s*\d+(\.\d+)?\s*(l|lac|lakh|cr|k)?\s*-\s*[$€£₹]?\s*\d+(\.\d+)?\s*(lpa|ctc|k|lac|lakh|cr|l)\b)|([$€£₹]\s*\d+(\.\d+)?\s*(l|lac|lakh|cr|k)?\s*-\s*[$€£₹]?\s*\d+(\.\d+)?\s*(lpa|ctc|k|lac|lakh|cr|l)?\b)|(\b\d+(\.\d+)?\s*(lpa|ctc|lac|lakh|k)\b)|([$€£₹]\s*[\d,]+(\.\d+)?\s*(l|lac|lakh|cr|k)?)|(\bper\s+(month|year|annum|hr|hour)\b)|(\b\d+k\s*-\s*\d+k\b)|(\b(salary|stipend|compensation|unpaid)\b))/i)
        if (salMatch) salary = salMatch[0]
      }

      let jobType = typeEl?.textContent?.trim()
      if (!jobType) {
        const typeMatch = cardText.match(/\b(full[ -]?time|part[ -]?time|contract|internship|intern|campus\s+ambassador|freelance|permanent|temporary|trainee|in[ -]?office|in[ -]?person)\b/i)
        if (typeMatch) jobType = typeMatch[0]
      }

      let experience = expEl?.textContent?.trim()
      if (!experience) {
        const expMatch = cardText.match(
          /\b(no\s+prior\s+experience\s+required|no\s+experience\s+required|0\s*-\s*\d+\s*(?:years?|yrs?)|fresher|freshers|entry[ -]?level|mid[ -]?level|senior|lead|\d+\+?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?exp(?:erience)?)?|\d+\s*-\s*\d+\s*(?:years?|yrs?)|\d+\s*to\s*\d+\s*(?:years?|yrs?)|min\s+\d+\s*(?:years?|yrs?))\b/i
        )
        if (expMatch) experience = expMatch[0]
      }

      const dedupKey = `${title.toLowerCase()}|${company.toLowerCase()}`
      // Reject non-job items (e.g. pure generic cards or empty titles)
      if (title && title.length > 2 && !seen.has(dedupKey) && !seen.has(jobUrl)) {
        seen.add(dedupKey)
        seen.add(jobUrl)
        jobs.push({
          title,
          company,
          location: location || undefined,
          salary: salary || undefined,
          jobType: jobType || undefined,
          experience: experience || undefined,
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

