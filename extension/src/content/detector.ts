import { ExtractedJob } from '../types'
import { isExplicitlyNonJobSite, isLikelyJobPage } from './jobEvidenceDetector'

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
function extractFromJsonLd(doc: Document = document): Partial<ExtractedJob> | null {
  const scripts = doc.querySelectorAll ? doc.querySelectorAll('script[type="application/ld+json"]') : []
  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent || '{}')
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'JobPosting') {
          return {
            title: item.title || item.name,
            company:
              item.hiringOrganization?.name ||
              item.employerOverview ||
              item.author?.name,
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
            description: item.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000),
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
    const scripts = doc.querySelectorAll ? doc.querySelectorAll('script[type="application/ld+json"]') : []
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
function extractFromMeta(doc: Document = document): Partial<ExtractedJob> {
  const get = (name: string) =>
    (doc.querySelector ? (doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`) as HTMLMetaElement | null)?.content : undefined)

  return {
    title: get('og:title') || get('twitter:title') || get('title') || undefined,
    company: get('og:site_name') || undefined,
    description: get('og:description') || get('description') || undefined,
  }
}

// ─── DOM heuristic extraction ─────────────────────────────────────────────────
function extractFromDom(doc: Document = document, url: string = ''): Partial<ExtractedJob> {
  const result: Partial<ExtractedJob> = {}
  if (!doc || typeof doc.querySelector !== 'function') return result

  const hostname = (() => {
    try {
      return new URL(url).hostname.toLowerCase()
    } catch {
      return typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
    }
  })()

  // LinkedIn-specific
  if (hostname.includes('linkedin.com')) {
    result.title =
      doc.querySelector('.job-details-jobs-unified-top-card__job-title, .topcard__title')?.textContent?.trim()
    result.company =
      doc.querySelector('.job-details-jobs-unified-top-card__company-name a, .topcard__org-name-link')?.textContent?.trim()
    result.location =
      doc.querySelector('.job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet')?.textContent?.trim()
    result.description =
      doc.querySelector('.jobs-description__content, #job-details, .description__text')?.textContent?.trim()
  }

  // Indeed-specific
  if (hostname.includes('indeed.com')) {
    result.title =
      doc.querySelector('[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, h1[class*="jobsearch-JobInfoHeader-title"]')?.textContent?.trim()
    result.company =
      doc.querySelector('[data-testid="inlineHeader-companyName"], [data-testid="inlineHeader-companyName"] a, [data-testid="company-name"], div[data-testid="jobsearch-CompanyInfoContainer"] a, .icl-u-lg-mr--sm, [class*="companyName"]')?.textContent?.trim() ||
      extractJsonLdCompany(doc) ||
      'Unknown Company'
    result.location =
      doc.querySelector('[data-testid="job-location"], [data-testid="inlineHeader-companyLocation"], .companyLocation')?.textContent?.trim()
    result.salary =
      doc.querySelector('[data-testid="attribute_snippet_testid"], #salaryInfoAndJobType, [class*="salary-snippet"]')?.textContent?.trim()
    result.description =
      doc.querySelector('#jobDescriptionText, [data-testid="jobDescriptionText"]')?.textContent?.trim()
  }

  // Greenhouse
  if (hostname.includes('greenhouse.io') || hostname.includes('boards.greenhouse.io')) {
    result.title = doc.querySelector('.app-title, h1.heading')?.textContent?.trim()
    result.company = doc.querySelector('.company-name, .logo span')?.textContent?.trim()
    result.location = doc.querySelector('.location')?.textContent?.trim()
    result.description = doc.querySelector('#content, .job-post-content')?.textContent?.trim()
  }

  // Lever
  if (hostname.includes('lever.co') || hostname.includes('jobs.lever.co')) {
    result.title = doc.querySelector('.posting-headline h2')?.textContent?.trim()
    result.company =
      doc.querySelector('.posting-headline .posting-categories .sort-by-team')?.textContent?.trim() ||
      doc.querySelector('.main-header-logo img')?.getAttribute('alt') || undefined
    result.location = doc.querySelector('.location, .posting-categories .sort-by-location')?.textContent?.trim()
    result.description = doc.querySelector('.section-wrapper, .posting-page')?.textContent?.trim()
  }

  // Generic fallback — look for prominent headings
  if (!result.title) {
    const headingSelectors = [
      'h1[class*="job" i]',
      'h1[class*="title" i]',
      'h1[class*="position" i]',
      'h1[class*="role" i]',
      '[class*="job-title" i]',
      '[class*="position-title" i]',
      'h1',
      'h2[class*="job" i]',
      'h2[class*="title" i]',
    ]
    for (const sel of headingSelectors) {
      const el = doc.querySelector(sel)
      if (el) {
        const text = el.textContent?.trim() || ''
        if (text.length > 3 && text.length < 140 && !/^(home|careers|jobs|search|openings|login)$/i.test(text)) {
          result.title = text
          break
        }
      }
    }
  }

  // Generic company fallback
  if (!result.company) {
    const companySelectors = [
      '[class*="company-name" i]',
      '[class*="companyName" i]',
      '[class*="employer" i]',
      '[class*="org-name" i]',
      '[class*="organization" i]',
      '[itemprop="hiringOrganization"]',
      '[itemprop="name"]',
      '[class*="sub-title" i]',
    ]
    for (const sel of companySelectors) {
      const el = doc.querySelector(sel)
      if (el) {
        const text = el.textContent?.trim()
        if (text && text.length > 1 && text.length < 100) {
          result.company = text
          break
        }
      }
    }
  }

  // Generic location fallback
  if (!result.location) {
    const locSelectors = [
      '[class*="location" i]',
      '[class*="city" i]',
      '[class*="workplace" i]',
      '[itemprop="addressLocality"]',
      '[class*="address" i]',
    ]
    for (const sel of locSelectors) {
      const el = doc.querySelector(sel)
      if (el) {
        const text = el.textContent?.trim()
        if (text && text.length > 1 && text.length < 100) {
          result.location = text
          break
        }
      }
    }
  }

  // Generic salary fallback
  if (!result.salary) {
    const salSelectors = [
      '[class*="salary" i]',
      '[class*="compensation" i]',
      '[class*="stipend" i]',
      '[class*="pay" i]',
      '[class*="remuneration" i]',
    ]
    for (const sel of salSelectors) {
      const el = doc.querySelector(sel)
      if (el) {
        const text = el.textContent?.trim()
        if (text && text.length > 1 && text.length < 80) {
          result.salary = text
          break
        }
      }
    }
  }

  // Generic job type fallback
  if (!result.jobType) {
    const typeSelectors = [
      '[class*="job-type" i]',
      '[class*="jobType" i]',
      '[class*="employment-type" i]',
      '[class*="work-type" i]',
    ]
    for (const sel of typeSelectors) {
      const el = doc.querySelector(sel)
      if (el) {
        const text = el.textContent?.trim()
        if (text && text.length > 2 && text.length < 40) {
          result.jobType = text
          break
        }
      }
    }
  }

  // Generic description fallback
  if (!result.description) {
    const descSelectors = [
      '[class*="job-description" i]',
      '[class*="jobDescription" i]',
      '[class*="description" i]',
      '[class*="posting-requirements" i]',
      '[class*="job-details" i]',
      'article',
      'main',
    ]
    for (const sel of descSelectors) {
      const el = doc.querySelector(sel)
      if (el) {
        const text = el.textContent?.replace(/\s+/g, ' ').trim()
        if (text && text.length > 50) {
          result.description = text.slice(0, 3000)
          break
        }
      }
    }
  }

  return result
}

// ─── Page title fallback ───────────────────────────────────────────────────────
function parsePageTitle(doc: Document = document): Partial<ExtractedJob> {
  const title = doc.title || (typeof document !== 'undefined' ? document.title : '')
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

export function detectJob(
  urlOrDoc?: string | Document,
  maybeDoc?: Document
): ExtractedJob | null {
  let doc: Document = typeof document !== 'undefined' ? document : ({} as Document)
  let url: string = typeof window !== 'undefined' ? window.location.href : ''

  if (typeof urlOrDoc === 'string') {
    url = urlOrDoc
    if (maybeDoc && typeof maybeDoc.querySelectorAll === 'function') {
      doc = maybeDoc
    }
  } else if (urlOrDoc && typeof (urlOrDoc as Document).querySelectorAll === 'function') {
    doc = urlOrDoc as Document
  }

  if (!url || typeof doc.querySelectorAll !== 'function') return null

  // Safety Gate: Explicit non-job sites (YouTube, Google search, social media)
  if (isExplicitlyNonJobSite(url)) return null

  // Step 1: URL pattern check — is this likely a job page?
  const urlMatch = JOB_URL_PATTERNS.some((p) => p.test(url))

  // Step 2: Heading check
  const allHeadings = Array.from(doc.querySelectorAll('h1, h2, h3'))
    .map((h) => h.textContent || '')
    .join(' ')
  const headingMatch = JOB_HEADING_PATTERNS.some((p) => p.test(allHeadings))

  // Step 3: Extract data from multiple sources, merge with priority
  const jsonLd = extractFromJsonLd(doc)
  const meta = extractFromMeta(doc)
  const dom = extractFromDom(doc, url)
  const pageTitleParsed = parsePageTitle(doc)

  // If JSON-LD JobPosting is found, it is definitely a job page
  const hasJsonLdJob = Boolean(jsonLd?.title)

  // If neither URL, heading, nor JSON-LD matches, not a confident job page
  if (!urlMatch && !headingMatch && !hasJsonLdJob) return null

  // On generic pages (non-ATS, non-verified portal), gate with multi-signal evidence
  const isKnownJobBoard =
    /linkedin\.com\/jobs/i.test(url) ||
    /indeed\.com\/(viewjob|rc\/clk)/i.test(url) ||
    /unstop\.com\/(jobs|internships|competitions)/i.test(url) ||
    /greenhouse\.io/i.test(url) ||
    /lever\.co/i.test(url) ||
    /workable\.com/i.test(url) ||
    /ashbyhq\.com/i.test(url) ||
    /smartrecruiters\.com/i.test(url)

  if (!hasJsonLdJob && !isKnownJobBoard) {
    if (!isLikelyJobPage(doc, url)) {
      return null
    }
  }

  // Merge: JSON-LD > DOM > meta > page title
  const merged = {
    title: jsonLd?.title || dom?.title || meta?.title || pageTitleParsed?.title,
    company: jsonLd?.company || dom?.company || meta?.company || pageTitleParsed?.company,
    location: jsonLd?.location || dom?.location,
    salary: jsonLd?.salary || dom?.salary,
    jobType: jsonLd?.jobType || dom?.jobType,
    description: jsonLd?.description || dom?.description || meta?.description,
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
    jobType: merged.jobType,
    description: merged.description,
    jobUrl: url,
    sourceWebsite: detectSourceWebsite(url),
    confidence,
  }
}
