/**
 * Universal Job Evidence Detector
 *
 * Evidence-first gate used before Talvyn analyzes the current page.
 * It must distinguish single jobs, job listings, and non-job pages without
 * relying on one site's CSS classes or URL alone.
 */

export interface ConfidenceReport {
  score: number
  isConfidentJob: boolean
  signals: string[]
  disqualifiers: string[]
  rejectionReason?: string
}

const NON_JOB_DOMAINS: { domain: string; allowedSubdomains?: string[] }[] = [
  { domain: 'youtube.com' }, { domain: 'youtu.be' },
  { domain: 'google.com', allowedSubdomains: ['careers.google.com'] },
  { domain: 'facebook.com', allowedSubdomains: ['metacareers.com'] },
  { domain: 'instagram.com' }, { domain: 'twitter.com' }, { domain: 'x.com' },
  { domain: 'reddit.com' }, { domain: 'wikipedia.org' },
  { domain: 'amazon.com', allowedSubdomains: ['amazon.jobs'] },
  { domain: 'netflix.com', allowedSubdomains: ['jobs.netflix.com'] },
  { domain: 'nytimes.com' }, { domain: 'cnn.com' }, { domain: 'bbc.com' },
  { domain: 'medium.com' }, { domain: 'substack.com' }, { domain: 'twitch.tv' },
  { domain: 'vimeo.com' }, { domain: 'tiktok.com' }, { domain: 'quora.com' },
]

export function isExplicitlyNonJobSite(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const pathname = parsed.pathname.toLowerCase()
    for (const rule of NON_JOB_DOMAINS) {
      if (hostname === rule.domain || hostname.endsWith(`.${rule.domain}`)) {
        if (rule.allowedSubdomains?.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`))) return false
        if (rule.domain === 'google.com' && pathname.startsWith('/about/careers')) return false
        return true
      }
    }
    return false
  } catch { return false }
}

export const UNIVERSAL_JOB_ROLE_REGEX = /\b(engineer|developer|designer|analyst|scientist|manager|executive|intern|internship|trainee|architect|consultant|specialist|coordinator|lead|director|recruiter|associate|accountant|marketing|sales|product|software|data|cloud|devops|full[ -]?stack|front[ -]?end|back[ -]?end|mobile|qa|tester|security|ai|ml|administrator|technician|officer|representative|expert|writer|editor|strategist|assistant|operator|fellow|advisor|counsel|counselor|supervisor|head|vp|president|founder|staff|principal|chief)\b/i

const VERIFIED_CAREER_URL_PATTERNS = [
  /\/jobs?\/\d+/i, /\/jobs?\/[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+/i,
  /\/careers?\/[a-zA-Z0-9_-]+/i, /\/positions?\/[a-zA-Z0-9_-]+/i,
  /\/openings?\/[a-zA-Z0-9_-]+/i, /\/vacancies?\/[a-zA-Z0-9_-]+/i,
  /\/opportunities?\/[a-zA-Z0-9_-]+/i,
  /\/viewjob/i, /linkedin\.com\/jobs/i,
  /indeed\.com\/(viewjob|rc\/clk|jobs)/i,
  /unstop\.com\/(job|jobs|internships)/i,
  /glassdoor\.com\/job-listing/i, /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /workable\.com/i,
]

function hasJobPostingJsonLd(doc: Document): { valid: boolean; title?: string } {
  const scripts = doc.querySelectorAll?.('script[type="application/ld+json"]') || []
  for (const script of Array.from(scripts)) {
    try {
      const parsed = JSON.parse(script.textContent || '{}')
      const roots = Array.isArray(parsed) ? parsed : [parsed]
      const candidates: any[] = []
      for (const root of roots) {
        if (root?.['@type'] === 'JobPosting') candidates.push(root)
        if (Array.isArray(root?.['@graph'])) candidates.push(...root['@graph'].filter((x: any) => x?.['@type'] === 'JobPosting'))
      }
      const job = candidates.find((x) => typeof x?.title === 'string' && x.title.trim().length >= 3)
      if (job) return { valid: true, title: job.title.trim() }
    } catch { /* malformed JSON-LD */ }
  }
  return { valid: false }
}

export function calculateJobConfidence(doc: Document, url: string): ConfidenceReport {
  const signals: string[] = []
  const disqualifiers: string[] = []
  let score = 0

  if (isExplicitlyNonJobSite(url)) {
    return { score: 0, isConfidentJob: false, signals, disqualifiers: ['Known non-job platform'], rejectionReason: 'Page is on a known non-job domain.' }
  }

  if (doc.querySelector?.('ytd-watch-flexy, ytd-search, #movie_player, video.html5-main-video, .vjs-tech')) {
    disqualifiers.push('Contains primary video player / stream elements'); score -= 50
  }
  if (doc.querySelector?.('#rso, #search, .g .rc, div[data-sokoban-container]')) {
    disqualifiers.push('Contains search engine SERP elements'); score -= 50
  }
  if (doc.querySelector?.('#add-to-cart-button, [name="submit.add-to-cart"], button[class*="add-to-cart" i], [class*="product-price" i]')) {
    disqualifiers.push('Contains e-commerce shopping cart elements'); score -= 50
  }
  if (doc.querySelector?.('[data-testid="tweet"], [data-testid="primaryColumn"], article[role="article"] button[aria-label*="Like" i]')) {
    disqualifiers.push('Contains social media feed elements'); score -= 40
  }
  if (doc.querySelector?.('.article-body, article.article, .byline, [rel="author"]') && !doc.querySelector?.('button[class*="apply" i], a[class*="apply" i], [data-automation-id="applyButton"]')) {
    disqualifiers.push('Identified as news or editorial article'); score -= 40
  }

  const parsed = (() => { try { return new URL(url) } catch { return null } })()
  if (parsed && (parsed.pathname === '/' || parsed.pathname === '') && !doc.querySelector?.('[class*="job" i], [data-automation-id*="job" i], script[type="application/ld+json"]')) {
    disqualifiers.push('Generic root homepage without job postings'); score -= 30
  }

  const jsonLd = hasJobPostingJsonLd(doc)
  if (jsonLd.valid) { score += 80; signals.push(`Schema.org JobPosting found with title: "${jsonLd.title}"`) }

  const titleEl = doc.querySelector?.('h1, [class*="job-title" i], [class*="jobTitle" i], [class*="posting-header" i], [data-automation-id="jobPostingHeader"], [class*="app-title" i]')
  const metaTitle = (doc.querySelector?.('meta[property="og:title"]') as HTMLMetaElement)?.content || ''
  const rawTitle = titleEl?.textContent?.trim() || metaTitle
  const companyEl = doc.querySelector?.('[class*="company" i], [class*="employer" i], [class*="org" i], [data-automation-id="companyName"]')
  const metaCompany = (doc.querySelector?.('meta[property="og:site_name"]') as HTMLMetaElement)?.content || ''
  const rawCompany = companyEl?.textContent?.trim() || metaCompany
  const hasTitleAndCompany = Boolean(rawTitle && rawTitle.length >= 3 && rawTitle.length <= 140 && !/^(home|careers|jobs|search|about|login|sign in)$/i.test(rawTitle)) && Boolean(rawCompany && rawCompany.length >= 2)
  if (hasTitleAndCompany) { score += 25; signals.push(`Valid job title and company detected: "${rawTitle}" / "${rawCompany}"`) }

  const bodyText = doc.body?.textContent || ''

  const controls = Array.from(doc.querySelectorAll?.('a, button, input[type="submit"], input[type="button"], [role="button"], [data-automation-id="applyButton"]') || [])
  const applyPattern = /^(apply(\s+now|\s+online|\s+for\s+this\s+job|\s+here)?|submit\s+application|easy\s+apply|start\s+application|application\s+form|apply\s+with\s+talvyn)$/i
  const hasApply = controls.some((el) => applyPattern.test(el.textContent?.trim() || (el as HTMLInputElement).value?.trim() || '') || el.getAttribute('data-automation-id') === 'applyButton') ||
    Boolean(doc.querySelector?.('button[class*="apply" i], a[class*="apply" i], button[class*="register" i], a[class*="register" i], form[id*="application" i], form[id*="apply" i], form[action*="apply" i], [data-automation-id="applyButton"], .apply-button, .apply-btn')) ||
    /\b(apply\s+now|apply\s+online|submit\s+application)\b/i.test(bodyText)
  if (hasApply) { score += 20; signals.push('Apply control found') }

  const headings = Array.from(doc.querySelectorAll?.('h1, h2, h3, h4, h5, [class*="heading" i], [class*="title" i], strong') || [])
  const hasRequirements = headings.some((h) => /qualifications|requirements|eligibility|what you('ll| will) need|who you are|required skills|minimum qualifications/i.test(h.textContent?.trim() || '')) ||
    /\b(qualifications|requirements|eligibility|what you('ll| will) need|who you are|required skills|minimum qualifications)\b/i.test(bodyText)
  if (hasRequirements) { score += 15; signals.push('Requirements/Qualifications section found') }
  const hasResponsibilities = headings.some((h) => /responsibilities|what you('ll| will) do|duties|role overview|key responsibilities|about the (role|position|job)|primary duties/i.test(h.textContent?.trim() || '')) ||
    /\b(responsibilities|what you('ll| will) do|key responsibilities|about the (role|position|job)|primary duties)\b/i.test(bodyText)
  if (hasResponsibilities) { score += 15; signals.push('Responsibilities section found') }

  const hasExp = /\b(\d+\+?\s*years?(\s+(of\s+)?experience|\s+exp)?|\d+\s*-\s*\d+\s*years?(\s+(of\s+)?experience|\s+exp)?|fresher|freshers|entry[ -]level|bachelor'?s|master'?s|b\.?tech|b\.?e\.)\b/i.test(bodyText)
  const hasEmployment = /\b(full[ -]time|part[ -]time|internship|contract|temporary|permanent|remote|hybrid|on-site)\b/i.test(bodyText)
  const hasSalary = /([$€£₹]\s*[\d,]+|\b\d+\s*-\s*\d+\s*(lpa|k|usd|eur|gbp|inr)\b|\bper\s+(year|annum|month|hour)\b|\b(salary|stipend|compensation)\b)/i.test(bodyText)
  const hasLocation = Boolean(doc.querySelector?.('[class*="location" i], [data-automation-id*="location" i], [itemprop="addressLocality"]')) || /\b(remote|work from home|hybrid|office location)\b/i.test(bodyText)
  if (hasExp) { score += 10; signals.push('Experience requirement mentioned') }
  if (hasEmployment) { score += 10; signals.push('Employment type detected') }
  if (hasSalary) { score += 10; signals.push('Salary/stipend detected') }
  if (hasLocation) { score += 10; signals.push('Location detected') }
  if (VERIFIED_CAREER_URL_PATTERNS.some((p) => p.test(url))) { score += 10; signals.push('Verified career/ATS URL pattern') }

  const positiveCount = [jsonLd.valid, hasTitleAndCompany, hasApply, hasRequirements, hasResponsibilities, hasExp, hasEmployment, hasSalary, hasLocation].filter(Boolean).length
  const isConfidentJob = disqualifiers.length === 0 && score >= 50 && (jsonLd.valid || positiveCount >= 2)
  return { score, isConfidentJob, signals, disqualifiers, rejectionReason: !isConfidentJob ? (disqualifiers.join('; ') || 'Insufficient verified job signals.') : undefined }
}

export function isLikelyJobPage(doc: Document, url: string): boolean {
  return !isExplicitlyNonJobSite(url) && calculateJobConfidence(doc, url).isConfidentJob
}

export interface CardValidationResult {
  isValid: boolean
  title?: string
  company?: string
  signals: string[]
  reason?: string
}

export function isValidJobCard(card: HTMLElement): CardValidationResult {
  const cardText = card.textContent?.replace(/\s+/g, ' ').trim() || ''
  if (cardText.length < 15) return { isValid: false, signals: [], reason: 'Card content too brief' }
  if (/\b\d+(\.\d+)?[KM]?\s+views\b|\b(subscribers?|playlist|episodes?|season\s+\d+)\b/i.test(cardText) || card.querySelector?.('ytd-thumbnail, ytd-video-renderer, #video-title')) return { isValid: false, signals: [], reason: 'Video/media indicators' }
  if (/\b(add to cart|buy now|in stock|free delivery)\b/i.test(cardText) || card.querySelector?.('[class*="add-to-cart" i]')) return { isValid: false, signals: [], reason: 'E-commerce indicators' }
  if (/\b(hackathons?|competitions?|quizzes?|coding\s+challenge|workshops?|webinars?|festivals?|conferences?)\b/i.test(cardText) && !/\b(jobs?|internships?|hiring|recruitment|trainee|developer|engineer|analyst|executive|consultant)\b/i.test(cardText)) return { isValid: false, signals: [], reason: 'Competition/event card' }
  if (/\b(sponsored|advertisement|promoted)\b/i.test(cardText) || card.querySelector?.('[class*="sponsored" i], [class*="ad-" i], [data-ad]')) return { isValid: false, signals: [], reason: 'Advertisement' }

  const titleCandidateElements = Array.from(card.querySelectorAll?.(
    'h1, h2, h3, h4, h5, [class*="job-title" i], [class*="jobTitle" i], [class*="job_title" i], [class*="opp_title" i], [class*="opp-title" i], [class*="role" i], [class*="position" i], [class*="heading" i], a, strong, b'
  ) || [])

  let rawTitle = ''
  let titleLink: HTMLAnchorElement | null = null

  // 1. First priority: Heading or link explicitly matching universal job roles
  for (const el of titleCandidateElements) {
    const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
    const cls = (el.className || '').toString().toLowerCase()
    if (cls.includes('sub') || cls.includes('company') || cls.includes('org') || cls.includes('brand')) continue
    if (txt.length >= 3 && txt.length <= 140 && UNIVERSAL_JOB_ROLE_REGEX.test(txt) && !/^(home|about|careers|jobs|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all)$/i.test(txt)) {
      rawTitle = txt
      titleLink = (el.tagName === 'A' ? el : el.closest('a')) as HTMLAnchorElement | null
      break
    }
  }

  // 2. Second priority: First plausible heading or anchor
  if (!rawTitle) {
    for (const el of titleCandidateElements) {
      const txt = el.textContent?.replace(/\s+/g, ' ').trim() || ''
      const cls = (el.className || '').toString().toLowerCase()
      if (cls.includes('sub') || cls.includes('company') || cls.includes('org') || cls.includes('brand')) continue
      if (txt.length >= 3 && txt.length <= 140 && !/^(home|about|careers|jobs|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all)$/i.test(txt)) {
        rawTitle = txt
        titleLink = (el.tagName === 'A' ? el : el.closest('a')) as HTMLAnchorElement | null
        break
      }
    }
  }

  if (!rawTitle || rawTitle.length < 3 || rawTitle.length > 140 || /^(home|about|careers|jobs|login|sign in|privacy|terms|menu|search|share|watch|video|playlist|trending|apply|apply now|save|bookmark|filters|details|view all)$/i.test(rawTitle)) {
    return { isValid: false, signals: [], reason: 'No valid job title' }
  }

  const companyEl = card.querySelector?.(
    '[class*="company" i], [class*="employer" i], [class*="organization" i], [class*="organisation" i], [class*="org" i], [class*="hiring" i], [class*="recruiter" i], [class*="sub-title" i], [class*="subtitle" i], [class*="c-name" i], [class*="brand" i], [data-automation-id*="company" i]'
  )
  const rawCompany = companyEl?.textContent?.replace(/\s+/g, ' ').trim() || ''
  const signals: string[] = []
  const hasLocation = Boolean(card.querySelector?.('[class*="location" i], [class*="city" i], [class*="place" i], [class*="region" i]')) || /\b(remote|hybrid|on[ -]?site|in[ -]?office|work from home|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|gurgaon|gurugram|noida|chennai|kolkata|london|new york|san francisco|singapore|berlin|toronto|austin|seattle|dublin|chicago|boston)\b/i.test(cardText)
  const hasExperience = /\b(\d+\+?\s*years?(\s+(of\s+)?exp(erience)?)?|\d+\s*-\s*\d+\s*years?|fresher|freshers|entry[ -]level|mid[ -]level|senior|lead|years?\s+exp)\b/i.test(cardText)
  const hasSalary = Boolean(card.querySelector?.('[class*="salary" i], [class*="stipend" i], [class*="pay" i], [class*="ctc" i], [class*="wage" i], [class*="compensation" i]')) || /([$€£₹]\s*[\d,]+|\b\d+(\.\d+)?\s*-\s*\d+(\.\d+)?\s*(lpa|k|lac|lakh|cr)\b|\b\d+(\.\d+)?\s*(lpa|lac|lakh|k)\b|\bper\s+(month|year|annum|hr|hour)\b|\b\d+k\s*-\s*\d+k\b)/i.test(cardText)
  const hasJobType = /\b(full[ -]?time|part[ -]?time|contract|internship|intern|campus\s+ambassador|freelance|permanent|temporary|trainee)\b/i.test(cardText)
  const href = titleLink?.href || (card.querySelector?.('a') as HTMLAnchorElement | null)?.href || ''
  const hasJobLink = /\/jobs?(\/|\?|#|$)/i.test(href) || /\/careers?(\/|\?|#|$)/i.test(href) || /\/positions?(\/|\?|#|$)/i.test(href) || /\/openings?(\/|\?|#|$)/i.test(href) || /\/opportunities?(\/|\?|#|$)/i.test(href) || /\/apply/i.test(href) || /viewjob/i.test(href) || /boards\.greenhouse\.io|jobs\.lever\.co|myworkdayjobs\.com|ashbyhq\.com/i.test(href) || card.hasAttribute?.('data-job-id') || card.hasAttribute?.('data-id') || card.hasAttribute?.('data-item-id') || /selectedItem=|oppstatus=|jobId=/i.test(href)
  const hasSnippet = Boolean(card.querySelector?.('[class*="snippet" i], [class*="summary" i], [class*="description" i]')) || /\b(responsibilities|qualifications|skills|requirements|eligibility|apply\s+by)\b/i.test(cardText)
  const hasEducation = /\b(bachelor'?s|master'?s|b\.?tech|b\.?e\.?|m\.?tech|degree|phd|diploma)\b/i.test(cardText)
  const hasApply = Boolean(card.querySelector?.('button[class*="apply" i], a[class*="apply" i], button[class*="register" i], a[class*="register" i]')) || /\b(apply|easy apply|apply now|register now|quick apply|view details)\b/i.test(cardText)

  if (hasLocation) signals.push('location')
  if (hasExperience) signals.push('experience')
  if (hasSalary) signals.push('salary')
  if (hasJobType) signals.push('jobType')
  if (hasJobLink) signals.push('jobLink')
  if (hasSnippet) signals.push('jobSnippet')
  if (hasEducation) signals.push('education')
  if (hasApply) signals.push('applyAction')

  const hasCompany = rawCompany.length >= 2
  const valid =
    (hasCompany && signals.length >= 1) ||
    (!hasCompany && signals.length >= 2 && (hasJobLink || hasJobType || hasSalary || hasExperience || hasLocation || hasApply)) ||
    (UNIVERSAL_JOB_ROLE_REGEX.test(rawTitle) && signals.length >= 1)

  return valid ? { isValid: true, title: rawTitle, company: rawCompany || 'Unknown Company', signals } : { isValid: false, title: rawTitle, company: rawCompany, signals, reason: `Insufficient job evidence (${signals.length} signals)` }
}

/**
 * Generic listing evidence gate. It deliberately looks beyond CSS classes:
 * job destination anchors and their nearest semantic containers are candidate
 * cards. This is what lets custom company portals and evolving job-board DOMs
 * work without adding a new adapter for every site.
 */
export function isLikelyJobListing(doc: Document, url: string): boolean {
  if (isExplicitlyNonJobSite(url)) return false

  const scripts = doc.querySelectorAll?.('script[type="application/ld+json"]') || []
  for (const script of Array.from(scripts)) {
    try {
      const parsed = JSON.parse(script.textContent || '{}')
      const roots = Array.isArray(parsed) ? parsed : [parsed]
      for (const root of roots) {
        if (root?.['@type'] === 'ItemList' && Array.isArray(root.itemListElement)) {
          const count = root.itemListElement.filter((x: any) => (x?.item || x)?.['@type'] === 'JobPosting').length
          if (count >= 1) return true
        }
      }
    } catch { /* ignore */ }
  }

  const candidates: HTMLElement[] = []
  const selectors = [
    '[class*="job-card" i]', '[class*="jobCard" i]', '[class*="job_card" i]', '[class*="job-listing" i]', '[class*="job-item" i]', '[class*="job_item" i]',
    '[data-job-id]', '[data-testid*="job" i]', '[data-automation-id*="job" i]', '[data-automation-id*="composite" i]', 'article[class*="job" i]',
    'li[class*="job" i]', '.card[class*="job" i]', '[class*="opportunity_card" i]', '[class*="opp-card" i]',
    '[class*="opp_card" i]', '[class*="c-card" i]', '[class*="listing_card" i]', '.single_opportunity',
    '[class*="opportunity" i]', '[class*="opening" i]', '[class*="vacancy" i]', '[class*="position" i]',
    '.job_seen_beacon', '.resultContent', 'div[class*="cardOutline"]',
  ]
  for (const sel of selectors) {
    for (const el of Array.from(doc.querySelectorAll?.(sel) || [])) {
      const hEl = el as HTMLElement
      // Filter out overly large wrappers that might match class "opportunity" broadly
      if (hEl.children && hEl.children.length > 25 && hEl.querySelectorAll?.('[class*="opportunity" i]').length > 1) continue
      candidates.push(hEl)
    }
  }

  // Universal anchor-driven discovery: do not require a job-card class.
  const anchors = Array.from(doc.querySelectorAll?.('a[href]') || []) as HTMLAnchorElement[]
  for (const anchor of anchors) {
    const href = anchor.href || ''
    const text = anchor.textContent?.replace(/\s+/g, ' ').trim() || ''
    const jobDestination = /\/jobs?(\/|\?|#|$)/i.test(href) || /\/careers?(\/|\?|#|$)/i.test(href) || /\/positions?(\/|\?|#|$)/i.test(href) || /\/openings?(\/|\?|#|$)/i.test(href) || /\/opportunities?(\/|\?|#|$)/i.test(href) || /\/apply(?:\/|\?|$)/i.test(href) || /viewjob|boards\.greenhouse\.io|jobs\.lever\.co|myworkdayjobs\.com|ashbyhq\.com|selectedItem=|oppstatus=/i.test(href)
    const titleLike = Boolean(text && text.length >= 3 && text.length <= 140 && UNIVERSAL_JOB_ROLE_REGEX.test(text))
    if (jobDestination || titleLike) {
      let node: HTMLElement | null = anchor.parentElement
      let depth = 0
      while (node && depth < 5) {
        const nodeText = node.textContent?.replace(/\s+/g, ' ').trim() || ''
        if (nodeText.length >= 25 && nodeText.length <= 1800) { candidates.push(node); break }
        node = node.parentElement; depth++
      }
    }
  }

  const unique = Array.from(new Set(candidates))
  let validCount = 0
  for (const card of unique) {
    if (isValidJobCard(card).isValid) {
      validCount++
      if (validCount >= 1) return true
    }
  }
  return false
}
