import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'

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
    const isDetailUrl =
      /\/jobs\/[a-zA-Z0-9_-]+/i.test(clean) ||
      /\/internships\/[a-zA-Z0-9_-]+/i.test(clean) ||
      /\/competitions\/[a-zA-Z0-9_-]+/i.test(clean) ||
      /\/hackathons\/[a-zA-Z0-9_-]+/i.test(clean) ||
      /\/workshops\/[a-zA-Z0-9_-]+/i.test(clean) ||
      /\/conferences\/[a-zA-Z0-9_-]+/i.test(clean) ||
      /\/quizzes\/[a-zA-Z0-9_-]+/i.test(clean) ||
      /\/p\/[a-zA-Z0-9_-]+/i.test(clean)

    const hasTitle = Boolean(doc?.querySelector?.('h1, h1.title, [class*="job-title" i], [class*="opp_title" i], [class*="opp-title" i]'))
    const hasApplyOrRegBtn = Boolean(doc?.querySelector?.('button[class*="apply" i], a[class*="apply" i], button[class*="register" i], a[class*="register" i]'))

    return isDetailUrl || (hasTitle && hasApplyOrRegBtn)
  }

  isJobListingPage(url: string, doc?: Document): boolean {
    const clean = url.toLowerCase()
    const isListUrl =
      /\/jobs\/?(\?.*)?$/i.test(clean) ||
      /\/internships\/?(\?.*)?$/i.test(clean) ||
      /\/competitions\/?(\?.*)?$/i.test(clean) ||
      /\/all-opportunities/i.test(clean) ||
      clean.includes('opportunity=')

    const cardCount = doc?.querySelectorAll?.(
      '[class*="opportunity_card" i], [class*="opp-card" i], [class*="c-card" i], [class*="job-card" i], [class*="listing_card" i], .single_opportunity'
    )?.length || 0

    return isListUrl || cardCount >= 2
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const seen = new Set<string>()

    const cardElements = Array.from(
      doc.querySelectorAll(
        '[class*="opportunity_card" i], [class*="opp-card" i], [class*="c-card" i], [class*="job-card" i], [class*="listing_card" i], .single_opportunity'
      )
    )

    for (const card of cardElements) {
      const titleEl = card.querySelector(
        'h2, h3, h4, h1, [class*="title" i], [class*="opp_title" i], [class*="heading" i], a'
      )
      const linkEl = (titleEl?.tagName === 'A' ? titleEl : card.querySelector('a')) as HTMLAnchorElement | null
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

      const title = titleEl?.textContent?.trim()
      const rawJobUrl = linkEl?.href || (typeof window !== 'undefined' ? window.location.href : '')
      const jobUrl = cleanUrl(rawJobUrl)
      const rawCompany = companyEl?.textContent?.trim()
      const company = rawCompany && rawCompany.length > 0 ? rawCompany : 'Unknown Company'

      let location = locationEl?.textContent?.trim() || undefined
      if (location && (location.includes('Bengaluru') || location.includes('Bangalore'))) {
        location = location.replace(/\s+/g, ' ').trim()
      }

      if (title && title.length > 2 && !seen.has(jobUrl)) {
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

    const descriptionEl = doc.querySelector(
      '#description, [class*="description" i], [class*="details" i], [class*="about" i], [class*="eligibility" i], [class*="overview" i]'
    )
    const description = descriptionEl?.textContent?.trim()?.slice(0, 2000) || jsonLdData.description?.slice(0, 2000) || undefined

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
      jobUrl,
      sourceWebsite: 'Unstop',
      confidence: 'HIGH',
    }
  }
}

