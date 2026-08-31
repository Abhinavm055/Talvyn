import { ExtractedJob } from '../types'

/**
 * Job Page Detector
 *
 * Generic detection — works across any job board or company careers page.
 * Uses a multi-signal approach:
 *  1. URL pattern matching
 *  2. Page title / meta keywords
 *  3. Heading text analysis
 *  4. Structured data (JSON-LD schema.org/JobPosting)
 *  5. Common HTML structures
 *
 * Returns null if the page is not a job posting.
 */

// ─── URL patterns that suggest a job posting page ────────────────────────────
const JOB_URL_PATTERNS = [
  /\/jobs?\//i,
  /\/careers?\//i,
  /\/positions?\//i,
  /\/openings?\//i,
  /\/vacancies?\//i,
  /\/opportunities?\//i,
  /\/apply/i,
  /linkedin\.com\/jobs/i,
  /indeed\.com\/(viewjob|rc\/clk)/i,
  /glassdoor\.com\/job-listing/i,
  /lever\.co\//i,
  /greenhouse\.io\//i,
  /workable\.com\//i,
  /myworkdayjobs\.com\//i,
  /icims\.com\//i,
  /smartrecruiters\.com\//i,
  /jobvite\.com\//i,
  /taleo\.net\//i,
  /successfactors\.(com|eu)\//i,
  /boards\.greenhouse\.io\//i,
  /jobs\.lever\.co\//i,
]

// ─── Heading text patterns suggesting a job title ────────────────────────────
const JOB_HEADING_PATTERNS = [
  /apply (for|now)/i,
  /job (description|details|overview|summary)/i,
  /about (this|the) (role|position|job)/i,
  /role (overview|summary|description)/i,
  /position (overview|summary|details)/i,
  /what you('ll|'d| will) do/i,
  /responsibilities/i,
  /qualifications/i,
  /requirements/i,
]

// ─── Source site detection ────────────────────────────────────────────────────
function detectSourceWebsite(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    const KNOWN: Record<string, string> = {
      'linkedin.com': 'LinkedIn',
      'indeed.com': 'Indeed',
      'glassdoor.com': 'Glassdoor',
      'lever.co': 'Lever',
      'greenhouse.io': 'Greenhouse',
      'workable.com': 'Workable',
      'myworkdayjobs.com': 'Workday',
      'icims.com': 'iCIMS',
      'smartrecruiters.com': 'SmartRecruiters',
      'jobvite.com': 'Jobvite',
      'taleo.net': 'Taleo',
    }
    for (const [domain, name] of Object.entries(KNOWN)) {
      if (hostname.includes(domain)) return name
    }
    return hostname
  } catch {
    return window.location.hostname
  }
}

// ─── JSON-LD structured data extraction ──────────────────────────────────────
function extractFromJsonLd(): Partial<ExtractedJob> | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '{}')
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'JobPosting') {
          return {
            title: item.title || item.name,
            company:
              item.hiringOrganization?.name ||
              item.employerOverview,
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
            description: item.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000),
          }
        }
      }
    } catch {
      /* malformed JSON-LD */
    }
  }
  return null
}

function extractJsonLdCompany(doc: Document = document): string | undefined {
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


// ─── Meta tag extraction ──────────────────────────────────────────────────────
function extractFromMeta(): Partial<ExtractedJob> {
  const get = (name: string) =>
    (document.querySelector(`meta[property="${name}"], meta[name="${name}"]`) as HTMLMetaElement | null)?.content

  return {
    title: get('og:title') || get('title') || undefined,
    company: get('og:site_name') || undefined,
  }
}

// ─── DOM heuristic extraction ─────────────────────────────────────────────────
function extractFromDom(): Partial<ExtractedJob> {
  const result: Partial<ExtractedJob> = {}

  // LinkedIn-specific
  if (window.location.hostname.includes('linkedin.com')) {
    result.title =
      document.querySelector('.job-details-jobs-unified-top-card__job-title, .topcard__title')?.textContent?.trim()
    result.company =
      document.querySelector('.job-details-jobs-unified-top-card__company-name a, .topcard__org-name-link')?.textContent?.trim()
    result.location =
      document.querySelector('.job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet')?.textContent?.trim()
  }

  // Indeed-specific
  if (window.location.hostname.includes('indeed.com')) {
    result.title =
      document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, h1[class*="jobsearch-JobInfoHeader-title"]')?.textContent?.trim()
    result.company =
      document.querySelector('[data-testid="inlineHeader-companyName"], [data-testid="inlineHeader-companyName"] a, [data-testid="company-name"], div[data-testid="jobsearch-CompanyInfoContainer"] a, .icl-u-lg-mr--sm, [class*="companyName"]')?.textContent?.trim() ||
      extractJsonLdCompany(document) ||
      'Unknown Company'
    result.location =
      document.querySelector('[data-testid="job-location"], [data-testid="inlineHeader-companyLocation"], .companyLocation')?.textContent?.trim()
    result.salary =
      document.querySelector('[data-testid="attribute_snippet_testid"], #salaryInfoAndJobType, [class*="salary-snippet"]')?.textContent?.trim()
  }


  // Greenhouse
  if (window.location.hostname.includes('greenhouse.io') || window.location.hostname.includes('boards.greenhouse.io')) {
    result.title = document.querySelector('.app-title, h1.heading')?.textContent?.trim()
    result.company = document.querySelector('.company-name, .logo span')?.textContent?.trim()
    result.location = document.querySelector('.location')?.textContent?.trim()
  }

  // Lever
  if (window.location.hostname.includes('lever.co') || window.location.hostname.includes('jobs.lever.co')) {
    result.title = document.querySelector('.posting-headline h2')?.textContent?.trim()
    result.company =
      document.querySelector('.posting-headline .posting-categories .sort-by-team')?.textContent?.trim() ||
      document.querySelector('.main-header-logo img')?.getAttribute('alt') || undefined
    result.location = document.querySelector('.location, .posting-categories .sort-by-location')?.textContent?.trim()
  }

  // Generic fallback — look for the first prominent h1 or h2
  if (!result.title) {
    const h1 = document.querySelector('h1')
    if (h1) {
      const text = h1.textContent?.trim() || ''
      // Only use if it looks like a job title (not a site name, etc.)
      if (text.length > 3 && text.length < 120) {
        result.title = text
      }
    }
  }

  // Generic company fallback — look for structured selectors
  if (!result.company) {
    const companyEl = document.querySelector(
      '[class*="company"], [class*="employer"], [class*="org-name"], [itemprop="name"]'
    )
    if (companyEl) {
      result.company = companyEl.textContent?.trim()
    }
  }

  // Generic location fallback
  if (!result.location) {
    const locationEl = document.querySelector(
      '[class*="location"], [class*="city"], [itemprop="addressLocality"]'
    )
    if (locationEl) {
      result.location = locationEl.textContent?.trim()
    }
  }

  return result
}

// ─── Page title fallback ───────────────────────────────────────────────────────
function parsePageTitle(): Partial<ExtractedJob> {
  const title = document.title
  // Common pattern: "Job Title at Company | Board" or "Job Title - Company"
  const atMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|\-–]|$)/i)
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() }
  }
  const dashMatch = title.match(/^(.+?)\s*[-–]\s*(.+?)(?:\s*[|\-–]|$)/)
  if (dashMatch) {
    return { title: dashMatch[1].trim(), company: dashMatch[2].trim() }
  }
  return {}
}

// ─── Main detection function ──────────────────────────────────────────────────

export function detectJob(doc: Document = (typeof document !== 'undefined' ? document : ({} as Document))): ExtractedJob | null {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  if (!url || typeof doc.querySelectorAll !== 'function') return null

  // Step 1: URL pattern check — is this likely a job page?
  const urlMatch = JOB_URL_PATTERNS.some((p) => p.test(url))

  // Step 2: Heading check
  const allHeadings = Array.from(doc.querySelectorAll('h1, h2, h3'))
    .map((h) => h.textContent || '')
    .join(' ')
  const headingMatch = JOB_HEADING_PATTERNS.some((p) => p.test(allHeadings))

  // If neither URL nor heading matches, not a job page
  if (!urlMatch && !headingMatch) return null

  // Step 3: Extract data from multiple sources, merge with priority
  const jsonLd = extractFromJsonLd()
  const meta = extractFromMeta()
  const dom = extractFromDom()
  const pageTitleParsed = parsePageTitle()

  // Merge: JSON-LD > DOM > meta > page title
  const merged = {
    title: jsonLd?.title || dom?.title || meta?.title || pageTitleParsed?.title,
    company: jsonLd?.company || dom?.company || meta?.company || pageTitleParsed?.company,
    location: jsonLd?.location || dom?.location,
    salary: jsonLd?.salary || dom?.salary,
    description: jsonLd?.description,
  }

  // A job requires at minimum a title
  if (!merged.title) return null

  // Determine confidence
  let confidence: ExtractedJob['confidence'] = 'LOW'
  if (jsonLd?.title) confidence = 'HIGH'
  else if (urlMatch && merged.title && merged.company) confidence = 'MEDIUM'
  else if (merged.title) confidence = 'LOW'

  return {
    title: merged.title,
    company: merged.company || 'Unknown Company',
    location: merged.location,
    salary: merged.salary,
    description: merged.description,
    jobUrl: url,
    sourceWebsite: detectSourceWebsite(url),
    confidence,
  }
}
