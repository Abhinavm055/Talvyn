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

  // 2. Negative Signals Check
  // Video page (-50)
  if (
    doc.querySelector(
      'ytd-watch-flexy, ytd-search, ytd-app, #movie_player, video.html5-main-video, .vjs-tech'
    )
  ) {
    disqualifiers.push('Contains primary video player / stream elements')
    score -= 50
  }

  // Search engine result page (-50)
  if (doc.querySelector('#rso, #search, .g .rc, div[data-sokoban-container], form[action*="search"]')) {
    disqualifiers.push('Contains search engine SERP elements')
    score -= 50
  }

  // Shopping / product page (-50)
  if (
    doc.querySelector(
      '#add-to-cart-button, [name="submit.add-to-cart"], button[class*="add-to-cart" i], [class*="product-price" i]'
    )
  ) {
    disqualifiers.push('Contains e-commerce shopping cart elements')
    score -= 50
  }

  // Social media feed (-40)
  if (
    doc.querySelector(
      '[data-testid="tweet"], [data-testid="primaryColumn"], article[role="article"] button[aria-label*="Like" i]'
    )
  ) {
    disqualifiers.push('Contains social media feed elements')
    score -= 40
  }

  // News article (-40)
  if (
    doc.querySelector('.article-body, article.article, .byline, [rel="author"]') &&
    !doc.querySelector('button[class*="apply" i], a[class*="apply" i], [data-automation-id="applyButton"]')
  ) {
    disqualifiers.push('Identified as news or editorial article')
    score -= 40
  }

  // Generic homepage (-30)
  try {
    const parsed = new URL(url)
    const isRoot = parsed.pathname === '/' || parsed.pathname === ''
    if (
      isRoot &&
      !doc.querySelector('h1, [class*="job" i], [data-automation-id*="job" i], script[type="application/ld+json"]')
    ) {
      disqualifiers.push('Generic root homepage without job postings')
      score -= 30
    }
  } catch {}

  // 3. Positive Evidence: Schema.org JSON-LD JobPosting (+80)
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
          score += 80
          break
        }
      }
    } catch {
      /* ignore JSON parse errors */
    }
    if (hasValidJsonLdJob) break
  }

  // 4. Positive Evidence: Valid job title + company (+25)
  const titleEl = doc.querySelector(
    'h1, [class*="job-title" i], [class*="jobTitle" i], [class*="posting-header" i], [data-automation-id="jobPostingHeader"], [class*="app-title" i]'
  )
  const metaTitle = (doc.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content || ''
  const rawTitle = titleEl?.textContent?.trim() || metaTitle
  const companyEl = doc.querySelector(
    '[class*="company" i], [class*="employer" i], [class*="org" i], [data-automation-id="companyName"]'
  )
  const metaCompany = (doc.querySelector('meta[property="og:site_name"]') as HTMLMetaElement)?.content || ''
  const rawCompany = companyEl?.textContent?.trim() || metaCompany

  const hasTitleAndCompany =
    Boolean(rawTitle && rawTitle.length >= 3 && rawTitle.length <= 140 && !/^(home|careers|jobs|search|about|login|sign in)$/i.test(rawTitle)) &&
    Boolean(rawCompany && rawCompany.length >= 2)

  if (hasTitleAndCompany) {
    signals.push(`Valid job title ("${rawTitle}") and company ("${rawCompany}") detected`)
    score += 25
  }

  // 5. Positive Evidence: Apply Button (+20)
  const applyControls = doc.querySelectorAll
    ? Array.from(
        doc.querySelectorAll(
          'a, button, input[type="submit"], input[type="button"], [role="button"], [data-automation-id="applyButton"]'
        )
      )
    : []

  const applyPattern =
    /^(apply(\s+now|\s+online|\s+for\s+this\s+job|\s+here)?|submit\s+application|easy\s+apply|start\s+application|application\s+form|apply\s+with\s+talvyn)$/i

  let hasApplyControl = false
  for (const el of applyControls) {
    const text = el.textContent?.trim() || (el as HTMLInputElement).value?.trim() || ''
    if (applyPattern.test(text) || el.getAttribute('data-automation-id') === 'applyButton') {
      hasApplyControl = true
      signals.push(`Apply button found: "${text || 'Apply'}"`)
      score += 20
      break
    }
  }

  // 6. Positive Evidence: Requirements / Qualifications (+15)
  const headings = doc.querySelectorAll ? Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, [class*="heading" i], [class*="title" i], strong')) : []
  const reqPatterns = [
    /qualifications/i,
    /requirements/i,
    /eligibility/i,
    /what you('ll| will) need/i,
    /who you are/i,
    /required skills/i,
    /basic qualifications/i,
    /minimum qualifications/i,
  ]

  let hasRequirements = false
  for (const h of headings) {
    const text = h.textContent?.trim() || ''
    if (reqPatterns.some((p) => p.test(text))) {
      hasRequirements = true
      signals.push('Requirements/Qualifications section found')
      score += 15
      break
    }
  }

  // 7. Positive Evidence: Responsibilities (+15)
  const respPatterns = [
    /responsibilities/i,
    /what you('ll| will) do/i,
    /duties/i,
    /role overview/i,
    /key responsibilities/i,
    /about the (role|position|job)/i,
    /primary duties/i,
  ]

  let hasResponsibilities = false
  for (const h of headings) {
    const text = h.textContent?.trim() || ''
    if (respPatterns.some((p) => p.test(text))) {
      hasResponsibilities = true
      signals.push('Responsibilities section found')
      score += 15
      break
    }
  }

  // 8. Positive Evidence: Experience Requirement (+10)
  const bodyText = doc.body ? doc.body.textContent || '' : ''
  const hasExpReq = /\b(\d+\+?\s*years?(\s+of)?\s+experience|\d+\s*-\s*\d+\s*years?(\s+of)?\s+experience|fresher|entry[ -]level|bachelor'?s(\s+degree)?|master'?s|b\.?tech|b\.?e\.)\b/i.test(
    bodyText
  )
  if (hasExpReq) {
    signals.push('Experience requirement mentioned')
    score += 10
  }

  // 9. Positive Evidence: Employment Type (+10)
  const hasEmploymentType = /\b(full[ -]time|part[ -]time|internship|contract|temporary|permanent|remote|hybrid|on-site)\b/i.test(
    bodyText
  )
  if (hasEmploymentType) {
    signals.push('Employment type keywords detected')
    score += 10
  }

  // 10. Positive Evidence: Salary / Stipend (+10)
  const hasSalaryCues = /([$€£₹]\s*[\d,]+|\b\d+\s*-\s*\d+\s*(lpa|k|usd|eur|gbp|inr)\b|\bper\s+(year|annum|month|hour)\b|\b(salary|stipend|compensation)\b)/i.test(
    bodyText
  )
  if (hasSalaryCues) {
    signals.push('Salary/stipend cues detected')
    score += 10
  }

  // 11. Positive Evidence: Location (+10)
  const hasLocation =
    !!doc.querySelector('[class*="location" i], [data-automation-id*="location" i], [itemprop="addressLocality"]') ||
    /\b(remote|work from home|hybrid|office location|[A-Z][a-zA-Z]+,\s*[A-Z]{2})\b/i.test(bodyText)
  if (hasLocation) {
    signals.push('Location details detected')
    score += 10
  }

  // 12. Positive Evidence: Career/ATS URL pattern (+10)
  const matchesCareerUrl = VERIFIED_CAREER_URL_PATTERNS.some((p) => p.test(url))
  if (matchesCareerUrl) {
    signals.push('URL matches verified career/ATS pattern')
    score += 10
  }

  // Final Gate Check:
  // URL pattern alone MUST NEVER classify page as job (score would only be 10).
  // Without JSON-LD: requires score >= 50 AND disqualifiers.length === 0 AND at least 2 distinct positive job content signals.
  const positiveJobSignalsCount = [
    hasValidJsonLdJob,
    hasTitleAndCompany,
    hasApplyControl,
    hasRequirements,
    hasResponsibilities,
    hasExpReq,
    hasEmploymentType,
    hasSalaryCues,
    hasLocation,
  ].filter(Boolean).length

  const isConfidentJob =
    disqualifiers.length === 0 &&
    score >= 50 &&
    (hasValidJsonLdJob || positiveJobSignalsCount >= 2)

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

  // Competitions / hackathons / non-job events
  if (
    /\b(hackathons?|competitions?|quizzes?|coding\s+challenge|workshops?|webinars?|festivals?|conferences?)\b/i.test(cardText) &&
    !/\b(jobs?|internships?|hiring|recruitment|trainee|developer|engineer|analyst)\b/i.test(cardText)
  ) {
    return { isValid: false, signals: [], reason: 'Card represents a competition, hackathon, or event rather than employment' }
  }

  // Advertisements / Sponsored promotional content
  if (
    /\b(sponsored|advertisement|promoted)\b/i.test(cardText) ||
    card.querySelector('[class*="sponsored" i], [class*="ad-" i], [data-ad]')
  ) {
    return { isValid: false, signals: [], reason: 'Card contains advertisement or sponsored content markers' }
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

  if (
    /\b(hackathons?|competitions?|quizzes?|coding\s+challenge|workshops?|webinars?)\b/i.test(rawTitle) &&
    !/\b(jobs?|internships?|hiring|recruitment|trainee)\b/i.test(rawTitle)
  ) {
    return { isValid: false, signals: [], reason: 'Title indicates competition or event' }
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
  const hasExperience = /\b(\d+\+?\s*years?|fresher|entry[ -]level|mid[ -]senior|intern|0-2 years|2-4 years|3\+ years)\b/i.test(cardText)
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

  // Factor G: Education requirement
  const hasEducation = /\b(bachelor'?s|master'?s|b\.?tech|b\.?e|degree|phd|diploma)\b/i.test(cardText)
  if (hasEducation) signals.push('education')

  // Factor H: Apply action
  const hasApply = !!card.querySelector('button[class*="apply" i], a[class*="apply" i]') || /\b(apply|apply now|easy apply)\b/i.test(cardText)
  if (hasApply) signals.push('applyAction')

  // Requirement: Job title + (Company or at least 2 job signals) + at least 1 verified job signal
  const hasCompany = Boolean(rawCompany && rawCompany.length >= 2)
  const isSufficientlyEvident =
    (hasCompany && signals.length >= 1) ||
    (!hasCompany && signals.length >= 2 && (hasJobLink || hasJobType || hasSalary || hasExperience))

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

  // 2. Candidate Card Elements
  const potentialCards = doc.querySelectorAll
    ? Array.from(
        doc.querySelectorAll(
          '[class*="job-card" i], [class*="jobCard" i], [class*="job-listing" i], [class*="job-item" i], [data-job-id], article[class*="job" i], li[class*="job" i], .card[class*="job" i], [class*="opportunity_card" i], [class*="opp-card" i], [class*="opp_card" i], [class*="c-card" i], [class*="listing_card" i], .single_opportunity, [class*="opportunity" i], div[class*="opening" i], tr.job, [data-automation-id="compositeHeader"], [data-automation-id="jobCard"]'
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

  // 3. Verified Job Board Search URL with at least 1 validated job card
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
    /\/vacancies\/?(\?.*)?$/i.test(cleanUrl) ||
    /boards\.greenhouse\.io/i.test(cleanUrl) ||
    /jobs\.lever\.co/i.test(cleanUrl) ||
    /myworkdayjobs\.com/i.test(cleanUrl)

  if (isJobBoardSearch && validJobCardCount >= 1) {
    return true
  }

  return false
}
