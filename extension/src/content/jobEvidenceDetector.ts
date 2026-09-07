/**
 * Job Evidence Detector
 *
 * High-confidence job detection gate.
 * Evaluates whether a page or card is genuinely a job posting or listing
 * based on verified structural, semantic, and contextual evidence.
 * Explicitly rejects non-job pages (YouTube, Google search, social media, articles).
 */

export interface ConfidenceReport {
  score: number
  isConfidentJob: boolean
  signals: string[]
  disqualifiers: string[]
  rejectionReason?: string
}

// ─── Non-Job Domain & Page Safety Layer ───────────────────────────────────────

const NON_JOB_DOMAINS: { domain: string; allowedSubdomains?: string[] }[] = [
  { domain: 'youtube.com' },
  { domain: 'youtu.be' },
  { domain: 'google.com', allowedSubdomains: ['careers.google.com'] },
  { domain: 'facebook.com', allowedSubdomains: ['metacareers.com'] },
  { domain: 'instagram.com' },
  { domain: 'twitter.com' },
  { domain: 'x.com' },
  { domain: 'reddit.com' },
  { domain: 'wikipedia.org' },
  { domain: 'amazon.com', allowedSubdomains: ['amazon.jobs'] },
  { domain: 'netflix.com', allowedSubdomains: ['jobs.netflix.com'] },
  { domain: 'nytimes.com' },
  { domain: 'cnn.com' },
  { domain: 'bbc.com' },
  { domain: 'medium.com' },
  { domain: 'substack.com' },
  { domain: 'twitch.tv' },
  { domain: 'vimeo.com' },
  { domain: 'tiktok.com' },
  { domain: 'quora.com' },
]

export function isExplicitlyNonJobSite(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const pathname = parsed.pathname.toLowerCase()

    for (const rule of NON_JOB_DOMAINS) {
      if (hostname === rule.domain || hostname.endsWith(`.${rule.domain}`)) {
        if (rule.allowedSubdomains) {
          const isAllowed = rule.allowedSubdomains.some(
            (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
          )
          if (isAllowed) return false
        }
        // Specific path exceptions (e.g. google.com/about/careers)
        if (rule.domain === 'google.com' && pathname.startsWith('/about/careers')) {
          return false
        }
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

// ─── Verified Career URL Patterns ─────────────────────────────────────────────

const VERIFIED_CAREER_URL_PATTERNS = [
  /\/jobs?\/\d+/i,
  /\/jobs?\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+/i,
  /\/careers?\/[a-zA-Z0-9_-]+/i,
  /\/positions?\/[a-zA-Z0-9_-]+/i,
  /\/openings?\/[a-zA-Z0-9_-]+/i,
  /\/vacancies?\/[a-zA-Z0-9_-]+/i,
  /\/viewjob/i,
  /linkedin\.com\/jobs\/view/i,
  /indeed\.com\/(viewjob|rc\/clk)/i,
  /unstop\.com\/(jobs|internships|competitions)\/[a-zA-Z0-9_-]+/i,
  /glassdoor\.com\/job-listing/i,
  /boards\.greenhouse\.io\/[^/]+\/jobs/i,
  /jobs\.lever\.co\/[^/]+\/[a-f0-9-]+/i,
  /jobs\.ashbyhq\.com\/[^/]+\/[a-f0-9-]+/i,
  /myworkdayjobs\.com\/[^/]+\/job\//i,
  /smartrecruiters\.com\/[^/]+\/[a-f0-9-]+/i,
]

// ─── Single Job Page Evidence Scoring ────────────────────────────────────────

export function calculateJobConfidence(doc: Document, url: string): ConfidenceReport {
  const signals: string[] = []
  const disqualifiers: string[] = []
  let score = 0

  // 1. Check Non-Job Domain Safety Gate
  if (isExplicitlyNonJobSite(url)) {
    disqualifiers.push('Domain is identified as non-job platform (video, social, news, or search engine)')
    return {
      score: 0,
      isConfidentJob: false,
      signals,
      disqualifiers,
      rejectionReason: 'Page is on a known non-job domain.',
    }
  }

  // 2. Disqualifiers in DOM (video player, e-commerce, search engine results)
  if (
    doc.querySelector(
      'ytd-watch-flexy, ytd-search, ytd-app, #movie_player, video.html5-main-video, .vjs-tech'
    )
  ) {
    disqualifiers.push('Contains primary video player elements (YouTube / Video stream)')
    score -= 60
  }

  if (doc.querySelector('#rso, #search, .g .rc, div[data-sokoban-container]')) {
    disqualifiers.push('Contains Google SERP search result elements')
    score -= 60
  }

  if (doc.querySelector('#add-to-cart-button, [name="submit.add-to-cart"], button[class*="add-to-cart" i]')) {
    disqualifiers.push('Contains e-commerce shopping cart elements')
    score -= 60
  }

  // 3. Positive Evidence: Schema.org JSON-LD JobPosting
  const scripts = doc.querySelectorAll ? doc.querySelectorAll('script[type="application/ld+json"]') : []
  let hasValidJsonLdJob = false

  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent || '{}')
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (
          item['@type'] === 'JobPosting' &&
          typeof item.title === 'string' &&
          item.title.trim().length >= 3
        ) {
          hasValidJsonLdJob = true
          signals.push(`Schema.org JobPosting found with title: "${item.title.trim()}"`)
          score += 50
          if (item.hiringOrganization?.name || item.employerOverview) {
            signals.push(`Hiring organization: ${item.hiringOrganization?.name || item.employerOverview}`)
            score += 15
          }
          if (item.description) {
            signals.push('Job description present in JSON-LD')
            score += 15
          }
          break
        }
      }
    } catch {
      /* ignore JSON parse errors */
    }
    if (hasValidJsonLdJob) break
  }

  // 4. Positive Evidence: Verified Career / Job Detail URL
  const matchesCareerUrl = VERIFIED_CAREER_URL_PATTERNS.some((p) => p.test(url))
  if (matchesCareerUrl) {
    signals.push('URL matches verified job or career detail path')
    score += 25
  }

  // 5. Positive Evidence: Interactive Application Control
  const applyControls = doc.querySelectorAll
    ? Array.from(
        doc.querySelectorAll(
          'a, button, input[type="submit"], input[type="button"], [role="button"]'
        )
      )
    : []

  const applyPattern =
    /^(apply(\s+now|\s+online|\s+for\s+this\s+job|\s+here)?|submit\s+application|easy\s+apply|apply\s+with\s+talvyn)$/i

  let hasApplyControl = false
  for (const el of applyControls) {
    const text = el.textContent?.trim() || (el as HTMLInputElement).value?.trim() || ''
    if (applyPattern.test(text)) {
      hasApplyControl = true
      signals.push(`Explicit application control: "${text}"`)
      score += 25
      break
    }
  }

  // 6. Positive Evidence: Dedicated Job Specification Headings
  const headings = doc.querySelectorAll ? Array.from(doc.querySelectorAll('h1, h2, h3, h4')) : []
  const specPatterns = [
    /responsibilities/i,
    /qualifications/i,
    /requirements/i,
    /what you('ll| will) do/i,
    /about the (role|position|job)/i,
    /role overview/i,
    /experience required/i,
    /who you are/i,
    /key responsibilities/i,
  ]

  let matchingHeadingCount = 0
  for (const h of headings) {
    const text = h.textContent?.trim() || ''
    if (specPatterns.some((p) => p.test(text))) {
      matchingHeadingCount++
    }
  }

  if (matchingHeadingCount >= 2) {
    signals.push(`${matchingHeadingCount} job requirement/responsibility sections found`)
    score += 25
  } else if (matchingHeadingCount === 1) {
    signals.push('Job requirement section heading found')
    score += 15
  }

  // 7. Positive Evidence: Employment Type / Compensation Badges
  const bodyText = doc.body ? doc.body.textContent || '' : ''
  const hasEmploymentType = /\b(full[ -]time|part[ -]time|contract|internship|remote|hybrid|on-site)\b/i.test(
    bodyText
  )
  if (hasEmploymentType) {
    signals.push('Employment type keywords detected in page content')
    score += 10
  }

  const hasSalaryCues = /([$€£₹]\s*[\d,]+|\b\d+\s*-\s*\d+\s*(lpa|k|usd|eur|gbp|inr)\b|\bper\s+(year|annum|month|hour)\b)/i.test(
    bodyText
  )
  if (hasSalaryCues) {
    signals.push('Salary or compensation indicators detected')
    score += 10
  }

  // 8. Positive Evidence: Experience & Education Requirements
  const hasExpReq = /\b(\d+\+?\s*years?(\s+of)?\s+experience|fresher|entry[ -]level|bachelor'?s(\s+degree)?|master'?s|b\.?tech|b\.?e\.)\b/i.test(
    bodyText
  )
  if (hasExpReq) {
    signals.push('Experience or education requirements mentioned')
    score += 10
  }

  // Final Evaluation
  // Threshold:
  // - If JSON-LD JobPosting is present: score >= 50
  // - On generic company websites: requires score >= 55 with at least an apply control, heading, or verified URL
  const isConfidentJob =
    score >= 50 &&
    disqualifiers.length === 0 &&
    (hasValidJsonLdJob || matchesCareerUrl || hasApplyControl || matchingHeadingCount >= 1)

  return {
    score,
    isConfidentJob,
    signals,
    disqualifiers,
    rejectionReason: !isConfidentJob
      ? disqualifiers.length > 0
        ? disqualifiers.join('; ')
        : 'Insufficient verified job signals (minimum confidence score not met).'
      : undefined,
  }
}

/**
 * Gate check for single job detail pages
 */
export function isLikelyJobPage(doc: Document, url: string): boolean {
  if (isExplicitlyNonJobSite(url)) return false
  const report = calculateJobConfidence(doc, url)
  return report.isConfidentJob
}

// ─── Listing Page Job Card Validation ─────────────────────────────────────────

export interface CardValidationResult {
  isValid: boolean
  title?: string
  company?: string
  signals: string[]
  reason?: string
}

/**
 * Validates whether an individual DOM card element is genuinely a job posting card.
 * Requires:
 * 1. Valid job title (not video title, article headline, or nav link)
 * 2. Company / employer
 * 3. At least ONE verified job signal:
 *    - Location
 *    - Experience
 *    - Salary / compensation
 *    - Job type (Full Time, Internship, etc.)
 *    - Application link
 *    - Job description / snippet
 * 4. MUST NOT contain video metrics, shopping carts, or article author bylines
 */
export function isValidJobCard(card: HTMLElement): CardValidationResult {
  const cardText = card.textContent?.trim() || ''
  if (cardText.length < 15) {
    return { isValid: false, signals: [], reason: 'Card content too brief' }
  }

  // 1. Negative Disqualifiers inside card
  // Video metrics: e.g. "12:34", "1.2M views", "3 days ago", "Subscribed"
  if (
    /\b\d+(\.\d+)?[KM]?\s+views\b/i.test(cardText) ||
    /\b(subscribers?|playlist|episodes?|season\s+\d+)\b/i.test(cardText) ||
    card.querySelector('ytd-thumbnail, .ytd-thumbnail, ytd-video-renderer, #video-title')
  ) {
    return { isValid: false, signals: [], reason: 'Card contains video player / view count indicators' }
  }

  // E-commerce items: "Add to cart", "In Stock", star ratings without job context
  if (
    /\b(add to cart|buy now|in stock|free delivery|eligible for free)\b/i.test(cardText) ||
    card.querySelector('[class*="add-to-cart" i]')
  ) {
    return { isValid: false, signals: [], reason: 'Card contains e-commerce purchase indicators' }
  }

  // 2. Extract Candidate Title
  const titleEl = card.querySelector(
    'h1, h2, h3, h4, [class*="job-title" i], [class*="title" i], a[class*="job" i]'
  )
  const titleLink = (titleEl?.tagName === 'A' ? titleEl : card.querySelector('a')) as HTMLAnchorElement | null
  const rawTitle = titleEl?.textContent?.trim() || titleLink?.textContent?.trim() || ''

  if (!rawTitle || rawTitle.length < 3 || rawTitle.length > 140) {
    return { isValid: false, signals: [], reason: 'No valid title element found in card' }
  }

  // Reject generic navigation or media titles
  const invalidTitles = /^(home|about|careers|jobs|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending)$/i
  if (invalidTitles.test(rawTitle)) {
    return { isValid: false, signals: [], reason: 'Title matches generic navigation/media keyword' }
  }

  // 3. Extract Candidate Company
  const companyEl = card.querySelector(
    '[class*="company" i], [class*="employer" i], [class*="org" i], [class*="hiring" i]'
  )
  let rawCompany = companyEl?.textContent?.trim() || ''

  // Fallback: check schema.org hiringOrganization or meta if present
  if (!rawCompany) {
    const parentContainer = card.closest('[class*="job" i], [id*="job" i]')
    const parentCompanyEl = parentContainer?.querySelector('[class*="company" i], [class*="employer" i]')
    rawCompany = parentCompanyEl?.textContent?.trim() || ''
  }

  // 4. Check for Verified Job Signals
  const signals: string[] = []

  // Factor A: Location
  const hasLocation =
    !!card.querySelector('[class*="location" i], [class*="city" i], [class*="place" i]') ||
    /\b(remote|hybrid|on-site|in-office|[A-Z][a-zA-Z]+,\s*[A-Z]{2})\b/i.test(cardText)
  if (hasLocation) signals.push('location')

  // Factor B: Experience
  const hasExperience = /\b(\d+\+?\s*years?|fresher|entry[ -]level|mid[ -]senior|intern)\b/i.test(cardText)
  if (hasExperience) signals.push('experience')

  // Factor C: Salary / Stipend
  const hasSalary =
    !!card.querySelector('[class*="salary" i], [class*="stipend" i], [class*="pay" i]') ||
    /([$€£₹]\s*[\d,]+|\b\d+\s*-\s*\d+\s*(lpa|k)\b|\bper\s+(month|year|hr)\b)/i.test(cardText)
  if (hasSalary) signals.push('salary')

  // Factor D: Job Type
  const hasJobType = /\b(full[ -]time|part[ -]time|contract|internship|intern|campus\s+ambassador|freelance)\b/i.test(cardText)
  if (hasJobType) signals.push('jobType')

  // Factor E: Application link / Career URL
  const anyLink = (titleLink?.href ? titleLink : card.querySelector('a')) as HTMLAnchorElement | null
  const href = anyLink?.href || ''
  const hasJobLink =
    /\/jobs?\//i.test(href) ||
    /\/careers?\//i.test(href) ||
    /\/position\//i.test(href) ||
    /\/apply/i.test(href) ||
    /viewjob/i.test(href) ||
    /unstop\.com\/(jobs|internships|opportunity|p)\//i.test(href) ||
    /\/(opportunity|p)\//i.test(href)
  if (hasJobLink) signals.push('jobLink')

  // Factor F: Job description / requirements snippet
  const hasJobSnippet =
    !!card.querySelector('[class*="snippet" i], [class*="summary" i], [class*="description" i]') ||
    /\b(responsibilities|qualifications|skills|requirements|eligibility|apply\s+by)\b/i.test(cardText)
  if (hasJobSnippet) signals.push('jobSnippet')

  // Requirement: Job title + (Company or at least 2 job signals) + at least 1 verified job signal
  const hasCompany = Boolean(rawCompany && rawCompany.length >= 2)
  const isSufficientlyEvident =
    (hasCompany && signals.length >= 1) ||
    (!hasCompany && signals.length >= 2 && (hasJobLink || hasJobType || hasSalary))

  if (!isSufficientlyEvident) {
    return {
      isValid: false,
      title: rawTitle,
      company: rawCompany,
      signals,
      reason: `Card lacks sufficient verified job signals (found ${signals.length}: ${signals.join(', ')})`,
    }
  }

  return {
    isValid: true,
    title: rawTitle,
    company: rawCompany || 'Unknown Company',
    signals,
  }
}

/**
 * Gate check for job listing pages
 */
export function isLikelyJobListing(doc: Document, url: string): boolean {
  if (isExplicitlyNonJobSite(url)) return false

  const cleanUrl = url.toLowerCase()

  // 1. JSON-LD ItemList with JobPostings
  const scripts = doc.querySelectorAll ? doc.querySelectorAll('script[type="application/ld+json"]') : []
  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent || '{}')
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
          const jobCount = item.itemListElement.filter(
            (elem: any) => (elem.item || elem)['@type'] === 'JobPosting'
          ).length
          if (jobCount >= 2) return true
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Verified Job Board Listing URL
  const isJobBoardSearch =
    /linkedin\.com\/jobs/i.test(cleanUrl) ||
    /indeed\.com\/jobs/i.test(cleanUrl) ||
    /unstop\.com\/(jobs|internships|all-opportunities|competitions)/i.test(cleanUrl) ||
    cleanUrl.includes('opportunity=') ||
    /glassdoor\.com\/job-listing/i.test(cleanUrl) ||
    /careers\.[a-z0-9-]+\.[a-z]+/i.test(cleanUrl) ||
    /\/careers?\/?(\?.*)?$/i.test(cleanUrl) ||
    /\/jobs?\/?(\?.*)?$/i.test(cleanUrl) ||
    /\/openings\/?(\?.*)?$/i.test(cleanUrl) ||
    /\/vacancies\/?(\?.*)?$/i.test(cleanUrl)

  // 3. Candidate Card Elements
  const potentialCards = doc.querySelectorAll
    ? Array.from(
        doc.querySelectorAll(
          '[class*="job-card" i], [class*="jobCard" i], [class*="job-listing" i], [class*="job-item" i], [data-job-id], article[class*="job" i], li[class*="job" i], .card[class*="job" i], [class*="opportunity_card" i], [class*="opp-card" i], [class*="opp_card" i], [class*="c-card" i], [class*="listing_card" i], .single_opportunity, [class*="opportunity" i]'
        )
      )
    : []

  let validJobCardCount = 0
  for (const card of potentialCards) {
    const check = isValidJobCard(card as HTMLElement)
    if (check.isValid) {
      validJobCardCount++
      if (validJobCardCount >= 2) return true
    }
  }

  // If on a verified job search URL and at least 1 valid job card or 2 potential cards exist
  if (isJobBoardSearch && (validJobCardCount >= 1 || potentialCards.length >= 2)) {
    return true
  }

  return false
}
