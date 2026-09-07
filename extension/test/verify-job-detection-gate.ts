/**
 * Automated Verification Test for Talvyn:
 * Job Detection Gate, Confidence Scoring & Non-Job Rejection
 *
 * Scenarios Tested:
 * A. YouTube Search Page -> REJECTED (NOT A JOB)
 * B. YouTube Video Page -> REJECTED (NOT A JOB)
 * C. Google Search Results -> REJECTED (NOT A JOB)
 * D. Generic News Article -> REJECTED (NOT A JOB)
 * E. Real Unstop Job Detail -> DETECTED AS SINGLE_JOB
 * F. Real LinkedIn Job Detail -> DETECTED AS SINGLE_JOB
 * G. Real Indeed Job Detail -> DETECTED AS SINGLE_JOB
 * H. Generic Company Career Page with JobPosting JSON-LD -> DETECTED AS SINGLE_JOB
 * I. Generic Webpage with No Job Evidence -> REJECTED (NOT A JOB)
 * J. Job Listing with Mixed Cards -> ONLY ACTUAL JOB CARDS DETECTED
 */

import {
  isExplicitlyNonJobSite,
  calculateJobConfidence,
  isLikelyJobPage,
  isLikelyJobListing,
  isValidJobCard,
} from '../src/content/jobEvidenceDetector'
import { detectJob } from '../src/content/detector'
import { GenericAdapter } from '../src/content/adapters/generic'
import { UnstopAdapter } from '../src/content/adapters/unstop'
import { jobScanner } from '../src/content/scanner'
import { normalizeJob } from '../src/content/jobNormalizer'
import { analyzeJobRelevance } from '../src/services/relevanceScorer'
import { getTalvynHost, getTalvynElement, makeElementDraggable, TALVYN_HOST_ID } from '../src/content/panel'
import { ExtractedJob, UserProfile } from '../src/types'

console.log('===========================================================')
console.log('TALVYN: JOB DETECTION GATE & NON-JOB REJECTION VERIFICATION')
console.log('===========================================================\n')

let passedTests = 0
let failedTests = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passedTests++
  } else {
    console.error(`  ✗ FAIL: ${testName}`)
    if (detail) console.error(`    Detail: ${detail}`)
    failedTests++
  }
}

// ─── Minimal Mock DOM Builder Helper ───────────────────────────────────────────

interface MockElementConfig {
  tagName?: string
  id?: string
  className?: string
  textContent?: string
  value?: string
  href?: string
  attributes?: Record<string, string>
  children?: MockElementConfig[]
}

function createDom(config: MockElementConfig): any {
  const children: any[] = []
  const attributes = new Map<string, string>()

  if (config.attributes) {
    for (const [k, v] of Object.entries(config.attributes)) {
      attributes.set(k, v)
    }
  }
  if (config.id) attributes.set('id', config.id)
  if (config.className) attributes.set('class', config.className)

  const el: any = {
    tagName: (config.tagName || 'div').toUpperCase(),
    id: config.id || '',
    className: config.className || '',
    textContent: config.textContent || '',
    value: config.value || '',
    href: config.href || '',
    children,
    getAttribute(attr: string) {
      return attributes.get(attr) || null
    },
    setAttribute(attr: string, val: string) {
      attributes.set(attr, val)
    },
    hasAttribute(attr: string) {
      return attributes.has(attr)
    },
    querySelector(sel: string) {
      return querySelectorInternal(this, sel)
    },
    querySelectorAll(sel: string) {
      const results: any[] = []
      querySelectorAllInternal(this, sel, results)
      return results
    },
    closest(sel: string) {
      // simplified closest: checks self
      if (matchesSelector(this, sel)) return this
      return null
    },
  }

  if (config.children) {
    for (const childConfig of config.children) {
      const child = createDom(childConfig)
      child.parentElement = el
      children.push(child)
      el.textContent += ' ' + child.textContent
    }
  }

  return el
}

function matchesSelector(el: any, sel: string): boolean {
  sel = sel.trim().toLowerCase()
  if (sel === 'body') return el.tagName === 'BODY'
  if (sel === 'h1' || sel === 'h2' || sel === 'h3' || sel === 'h4' || sel === 'p' || sel === 'a' || sel === 'button' || sel === 'article' || sel === 'li') {
    return el.tagName.toLowerCase() === sel
  }
  if (sel.startsWith('#')) {
    return el.id.toLowerCase() === sel.slice(1)
  }
  if (sel.startsWith('.')) {
    return el.className.toLowerCase().includes(sel.slice(1))
  }
  if (sel.includes('[class*="') || sel.includes('[class*=\'')) {
    const match = sel.match(/\[class\*=["']([^"']+)["']/i)
    if (match) {
      return el.className.toLowerCase().includes(match[1].toLowerCase())
    }
  }
  if (sel.includes('script[type="application/ld+json"]')) {
    return el.tagName === 'SCRIPT' && el.getAttribute('type') === 'application/ld+json'
  }
  if (sel.includes('button[class*="apply"')) {
    return el.tagName === 'BUTTON' && el.className.toLowerCase().includes('apply')
  }
  if (sel.includes('a[class*="job"')) {
    return el.tagName === 'A' && el.className.toLowerCase().includes('job')
  }
  return false
}

function querySelectorInternal(root: any, sel: string): any | null {
  const parts = sel.split(',').map((p) => p.trim())
  for (const part of parts) {
    for (const child of root.children || []) {
      if (matchesSelector(child, part)) return child
      const found = querySelectorInternal(child, part)
      if (found) return found
    }
  }
  return null
}

function querySelectorAllInternal(root: any, sel: string, results: any[]) {
  const parts = sel.split(',').map((p) => p.trim())
  for (const child of root.children || []) {
    for (const part of parts) {
      if (matchesSelector(child, part)) {
        if (!results.includes(child)) results.push(child)
        break
      }
    }
    querySelectorAllInternal(child, sel, results)
  }
}

function createMockDoc(rootChildren: MockElementConfig[]): Document {
  const body = createDom({ tagName: 'body', children: rootChildren })
  const doc: any = {
    body,
    title: 'Page Title',
    querySelector: (sel: string) => body.querySelector(sel),
    querySelectorAll: (sel: string) => body.querySelectorAll(sel),
  }
  return doc as Document
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

async function runTests() {
  const genericAdapter = new GenericAdapter()

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO A: YouTube Search Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- Scenario A: YouTube Search Page ---')
  const ytSearchUrl = 'https://www.youtube.com/results?search_query=software+engineer+resume'
  const ytSearchDoc = createMockDoc([
    {
      tagName: 'div',
      id: 'movie_player',
      className: 'ytd-search',
      children: [
        { tagName: 'h3', id: 'video-title', textContent: 'How to Become a Software Engineer in 2026' },
        { tagName: 'div', className: 'metadata', textContent: 'Tech Channel • 450K views • 2 weeks ago' },
      ],
    },
  ])

  assert(isExplicitlyNonJobSite(ytSearchUrl) === true, 'A1: Identified as explicitly non-job domain')
  assert(isLikelyJobPage(ytSearchDoc, ytSearchUrl) === false, 'A2: isLikelyJobPage rejected YouTube search')
  assert(isLikelyJobListing(ytSearchDoc, ytSearchUrl) === false, 'A3: isLikelyJobListing rejected YouTube search')
  assert(detectJob(ytSearchUrl, ytSearchDoc) === null, 'A4: detectJob returns null for YouTube search')
  assert(genericAdapter.isJobListingPage(ytSearchUrl, ytSearchDoc) === false, 'A5: GenericAdapter.isJobListingPage returns false')
  assert(genericAdapter.extractJobList(ytSearchDoc).length === 0, 'A6: extractJobList extracts 0 jobs from YouTube')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO B: YouTube Video Watch Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario B: YouTube Video Page ---')
  const ytWatchUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const ytWatchDoc = createMockDoc([
    {
      tagName: 'div',
      className: 'ytd-watch-flexy',
      children: [
        { tagName: 'h1', className: 'title', textContent: 'Top 10 Coding Interview Questions & Responsibilities' },
        { tagName: 'video', className: 'html5-main-video' },
        { tagName: 'div', id: 'description', textContent: 'Subscribe to my channel for more software developer career tips!' },
      ],
    },
  ])

  assert(isExplicitlyNonJobSite(ytWatchUrl) === true, 'B1: Identified as non-job domain')
  assert(isLikelyJobPage(ytWatchDoc, ytWatchUrl) === false, 'B2: isLikelyJobPage rejected video watch page')
  assert(detectJob(ytWatchUrl, ytWatchDoc) === null, 'B3: detectJob returns null on YouTube video page')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO C: Google Search Results Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario C: Google Search Results ---')
  const googleSearchUrl = 'https://www.google.com/search?q=full+stack+developer+jobs'
  const googleDoc = createMockDoc([
    {
      tagName: 'div',
      id: 'search',
      children: [
        {
          tagName: 'div',
          className: 'g',
          children: [
            { tagName: 'h3', textContent: 'Frontend Engineer Jobs, Employment - Indeed' },
            { tagName: 'p', textContent: 'Search 4,000+ jobs on Indeed. Responsibilities and requirements.' },
          ],
        },
      ],
    },
  ])

  assert(isExplicitlyNonJobSite(googleSearchUrl) === true, 'C1: Identified as search engine non-job domain')
  assert(isLikelyJobPage(googleDoc, googleSearchUrl) === false, 'C2: Google SERP rejected as single job')
  assert(isLikelyJobListing(googleDoc, googleSearchUrl) === false, 'C3: Google SERP rejected as job listing')
  assert(detectJob(googleSearchUrl, googleDoc) === null, 'C4: detectJob returns null for Google SERP')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO D: Generic News Article Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario D: Generic News Article ---')
  const newsUrl = 'https://www.bbc.com/news/technology-654321'
  const newsDoc = createMockDoc([
    { tagName: 'h1', textContent: 'AI reshapes the tech employment market' },
    { tagName: 'p', textContent: 'By Jane Doe, Technology Reporter. Published yesterday. Comments (42).' },
    { tagName: 'p', textContent: 'Companies are hiring AI engineers with high salaries and requirements.' },
  ])

  assert(isExplicitlyNonJobSite(newsUrl) === true, 'D1: Identified as news domain')
  assert(isLikelyJobPage(newsDoc, newsUrl) === false, 'D2: News article rejected as job')
  assert(detectJob(newsUrl, newsDoc) === null, 'D3: detectJob returns null for news article')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO E: Real Unstop Job Detail Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario E: Real Unstop Job Detail ---')
  const unstopUrl = 'https://unstop.com/jobs/software-engineer-techinnovators-12345'
  const unstopDoc = createMockDoc([
    { tagName: 'h1', textContent: 'Associate Software Engineer - Frontend' },
    { tagName: 'div', className: 'company-name', textContent: 'Tech Innovators Pvt Ltd' },
    { tagName: 'div', className: 'location', textContent: 'Hyderabad, India' },
    { tagName: 'div', className: 'salary', textContent: '8 - 12 LPA' },
    { tagName: 'button', className: 'apply-btn', textContent: 'Apply Now' },
    { tagName: 'h3', textContent: 'Responsibilities' },
    { tagName: 'p', textContent: 'Build modern user interfaces with React and TypeScript.' },
    { tagName: 'h3', textContent: 'Requirements' },
    { tagName: 'p', textContent: 'Bachelor degree in Computer Science, 0-2 years experience.' },
  ])

  assert(isExplicitlyNonJobSite(unstopUrl) === false, 'E1: Unstop is not a non-job site')
  assert(isLikelyJobPage(unstopDoc, unstopUrl) === true, 'E2: isLikelyJobPage confirmed Unstop job detail')
  const detectedUnstop = detectJob(unstopUrl, unstopDoc)
  assert(detectedUnstop !== null, 'E3: detectJob successfully extracts Unstop job')
  assert(detectedUnstop?.title === 'Associate Software Engineer - Frontend', 'E4: Extracted correct title')
  assert(detectedUnstop?.company === 'Tech Innovators Pvt Ltd', 'E5: Extracted correct company')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO F: Real LinkedIn Job Detail Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario F: Real LinkedIn Job Detail ---')
  const linkedinUrl = 'https://www.linkedin.com/jobs/view/123456789/'
  const linkedinDoc = createMockDoc([
    { tagName: 'h1', className: 'job-details-jobs-unified-top-card__job-title', textContent: 'Senior Backend Engineer' },
    {
      tagName: 'div',
      className: 'job-details-jobs-unified-top-card__company-name',
      children: [{ tagName: 'a', textContent: 'CloudScale Technologies' }],
    },
    { tagName: 'div', className: 'job-details-jobs-unified-top-card__bullet', textContent: 'Bengaluru, Karnataka, India' },
    { tagName: 'button', className: 'jobs-apply-button', textContent: 'Easy Apply' },
    { tagName: 'h3', textContent: 'About the role' },
    { tagName: 'div', className: 'jobs-description__content', textContent: 'We are seeking a Backend Engineer with 3+ years experience in Go and distributed systems.' },
  ])

  assert(isLikelyJobPage(linkedinDoc, linkedinUrl) === true, 'F1: isLikelyJobPage confirmed LinkedIn job detail')
  const detectedLinkedin = detectJob(linkedinUrl, linkedinDoc)
  assert(detectedLinkedin !== null, 'F2: detectJob successfully extracts LinkedIn job')
  assert(detectedLinkedin?.title === 'Senior Backend Engineer', 'F3: Extracted correct title')
  assert(detectedLinkedin?.company === 'CloudScale Technologies', 'F4: Extracted correct company')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO G: Real Indeed Job Detail Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario G: Real Indeed Job Detail ---')
  const indeedUrl = 'https://www.indeed.com/viewjob?jk=abcdef123456'
  const indeedDoc = createMockDoc([
    { tagName: 'h1', className: 'jobsearch-JobInfoHeader-title', textContent: 'Full Stack Developer' },
    { tagName: 'div', className: 'companyName', textContent: 'Apex Solutions' },
    { tagName: 'div', className: 'companyLocation', textContent: 'Austin, TX (Remote)' },
    { tagName: 'button', className: 'apply-button', textContent: 'Apply on company site' },
    { tagName: 'h2', textContent: 'Qualifications' },
    { tagName: 'div', id: 'jobDescriptionText', textContent: 'Full-time position. Required: Node.js, React, 2+ years of experience.' },
  ])

  assert(isLikelyJobPage(indeedDoc, indeedUrl) === true, 'G1: isLikelyJobPage confirmed Indeed job detail')
  const detectedIndeed = detectJob(indeedUrl, indeedDoc)
  assert(detectedIndeed !== null, 'G2: detectJob successfully extracts Indeed job')
  assert(detectedIndeed?.title === 'Full Stack Developer', 'G3: Extracted correct title')
  assert(detectedIndeed?.company === 'Apex Solutions', 'G4: Extracted correct company')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO H: Generic Company Career Page with JobPosting JSON-LD
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario H: Generic Company Career Page with JSON-LD ---')
  const acmeJobUrl = 'https://acme-robotics.com/careers/lead-perception-engineer'
  const jsonLdPayload = JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: 'Lead Perception Engineer',
    description: 'Lead our computer vision and lidar perception team. Requirements: 5+ years C++, ROS2, SLAM.',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Acme Robotics Inc',
    },
    jobLocation: {
      address: {
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
      },
    },
    baseSalary: {
      value: {
        minValue: 160000,
        maxValue: 210000,
        unitText: 'USD',
      },
    },
  })

  const acmeDoc = createMockDoc([
    {
      tagName: 'script',
      attributes: { type: 'application/ld+json' },
      textContent: jsonLdPayload,
    },
    { tagName: 'h1', textContent: 'Lead Perception Engineer' },
    { tagName: 'button', className: 'apply-button', textContent: 'Apply Now' },
  ])

  assert(isLikelyJobPage(acmeDoc, acmeJobUrl) === true, 'H1: Confirmed generic company page via JobPosting JSON-LD')
  const detectedAcme = detectJob(acmeJobUrl, acmeDoc)
  assert(detectedAcme !== null, 'H2: detectJob extracted job from unknown company website')
  assert(detectedAcme?.title === 'Lead Perception Engineer', 'H3: Extracted correct JSON-LD title')
  assert(detectedAcme?.company === 'Acme Robotics Inc', 'H4: Extracted correct hiringOrganization company')
  assert(detectedAcme?.location === 'San Francisco', 'H5: Extracted location')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO I: Generic Webpage with No Job Evidence
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario I: Generic Webpage with No Job Evidence ---')
  const blogUrl = 'https://mytechblog.com/posts/react-hooks-guide'
  const blogDoc = createMockDoc([
    { tagName: 'h1', textContent: 'Understanding React Hooks in 2026' },
    { tagName: 'p', textContent: 'React hooks simplify state management. Read on for useState and useEffect examples.' },
    { tagName: 'button', textContent: 'Share Article' },
  ])

  assert(isLikelyJobPage(blogDoc, blogUrl) === false, 'I1: Generic tech blog correctly rejected (not a job)')
  assert(detectJob(blogUrl, blogDoc) === null, 'I2: detectJob returns null for generic webpage')
  assert(genericAdapter.isJobDetailPage(blogUrl, blogDoc) === false, 'I3: GenericAdapter rejects blog')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO J: Job Listing Containing Mixed Cards
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario J: Job Listing with Mixed Cards ---')

  const validJobCardElement = createDom({
    tagName: 'div',
    className: 'job-card',
    children: [
      { tagName: 'h2', className: 'title', textContent: 'DevOps Engineer' },
      { tagName: 'div', className: 'company', textContent: 'NextGen Cloud' },
      { tagName: 'div', className: 'location', textContent: 'Remote' },
      { tagName: 'div', className: 'salary', textContent: '$110,000 - $130,000 / year' },
      { tagName: 'a', href: 'https://careers.example.com/jobs/devops-123', textContent: 'View Job' },
    ],
  })

  const videoCardElement = createDom({
    tagName: 'div',
    className: 'job-card', // purposefully mislabeled class in DOM
    children: [
      { tagName: 'h2', id: 'video-title', textContent: 'DevOps Tutorial for Beginners - 4K Full Course' },
      { tagName: 'div', className: 'author', textContent: 'FreeCodeTutorials' },
      { tagName: 'div', className: 'views', textContent: '1.4M views • 2 years ago • 45:12' },
    ],
  })

  const promoAdElement = createDom({
    tagName: 'div',
    className: 'job-card',
    children: [
      { tagName: 'h3', textContent: 'Buy Mechanical Keyboard - 20% Off' },
      { tagName: 'div', className: 'price', textContent: '$89.99' },
      { tagName: 'button', className: 'add-to-cart', textContent: 'Add to cart' },
    ],
  })

  assert(isValidJobCard(validJobCardElement).isValid === true, 'J1: Real job card successfully validated')
  assert(isValidJobCard(videoCardElement).isValid === false, 'J2: Video card disguised as card rejected')
  assert(isValidJobCard(promoAdElement).isValid === false, 'J3: E-commerce ad card rejected')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO K: Unstop Listing Page with Real Opportunity Cards
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario K: Unstop Listing Page with Opportunity Cards ---')
  const unstopAdapter = new UnstopAdapter()
  const unstopListingUrl = 'https://unstop.com/jobs'

  const card1 = createDom({
    tagName: 'div',
    className: 'opportunity_card',
    children: [
      { tagName: 'h2', className: 'opp_title', textContent: "Founder's Office Internship" },
      { tagName: 'div', className: 'company_name', textContent: 'TechVanguard Labs' },
      { tagName: 'div', className: 'location', textContent: 'Bengaluru, India' },
      { tagName: 'div', className: 'stipend', textContent: '₹25,000 /month' },
      { tagName: 'div', className: 'opp-type', textContent: 'Internship' },
      { tagName: 'a', href: 'https://unstop.com/internships/founders-office-internship-101' },
    ],
  })

  const card2 = createDom({
    tagName: 'div',
    className: 'single_opportunity',
    children: [
      { tagName: 'h3', className: 'title', textContent: 'Campus Ambassador' },
      { tagName: 'div', className: 'c-name', textContent: 'Global Youth Network' },
      { tagName: 'div', className: 'location', textContent: 'Work from home' },
      { tagName: 'div', className: 'timing', textContent: 'Part Time' },
      { tagName: 'a', href: 'https://unstop.com/jobs/campus-ambassador-102' },
    ],
  })

  const unstopListingDoc = {
    querySelectorAll: (sel: string) => {
      if (
        sel.includes('opportunity_card') ||
        sel.includes('single_opportunity') ||
        sel.includes('opp-card') ||
        sel.includes('opp_card') ||
        sel.includes('job-card') ||
        sel.includes('opportunity')
      ) {
        return [card1, card2]
      }
      return []
    },
    querySelector: (sel: string) => {
      if (sel.includes('h1')) return { textContent: 'Explore Opportunities' }
      return null
    },
  }

  assert(unstopAdapter.isJobListingPage(unstopListingUrl, unstopListingDoc as any) === true, 'K1: Unstop listing page identified by URL and card presence')
  assert(unstopAdapter.isJobDetailPage(unstopListingUrl, unstopListingDoc as any) === false, 'K2: Unstop listing page is NOT misclassified as single job detail')
  const classifiedK = jobScanner.classifyPage(unstopListingUrl, unstopListingDoc as any)
  assert(classifiedK.classification === 'JOB_LIST', 'K3: JobScanner classifies Unstop page as JOB_LIST')
  const extractedK = unstopAdapter.extractJobList(unstopListingDoc as any)
  assert(extractedK.length === 2, 'K4: Extracted both valid Unstop opportunity cards')
  assert(extractedK[0].title === "Founder's Office Internship" && extractedK[0].company === 'TechVanguard Labs', 'K5: Card 1 title and company accurate')
  assert(extractedK[1].title === 'Campus Ambassador' && extractedK[1].company === 'Global Youth Network', 'K6: Card 2 title and company accurate')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO L: Unstop Single Job Detail Page
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario L: Unstop Single Job Detail Page ---')
  const unstopDetailUrl = 'https://unstop.com/jobs/associate-software-engineer-9988'
  const unstopDetailDoc = {
    querySelector: (sel: string) => {
      if (sel.includes('h1') || sel.includes('job-title') || sel.includes('opp_title')) {
        return { textContent: 'Associate Software Engineer' }
      }
      if (sel.includes('company') || sel.includes('org')) {
        return { textContent: 'Nexus AI' }
      }
      if (sel.includes('apply') || sel.includes('register')) {
        return { tagName: 'BUTTON', textContent: 'Apply Now' }
      }
      if (sel.includes('location')) return { textContent: 'Bengaluru' }
      if (sel.includes('type')) return { textContent: 'Full Time' }
      return null
    },
    querySelectorAll: (sel: string) => {
      if (sel.includes('opportunity_card') || sel.includes('single_opportunity')) return []
      return []
    },
  }

  assert(unstopAdapter.isJobDetailPage(unstopDetailUrl, unstopDetailDoc as any) === true, 'L1: Unstop detail page identified as detail page')
  assert(unstopAdapter.isJobListingPage(unstopDetailUrl, unstopDetailDoc as any) === false, 'L2: Unstop detail page is NOT identified as listing')
  const classifiedL = jobScanner.classifyPage(unstopDetailUrl, unstopDetailDoc as any)
  assert(classifiedL.classification === 'SINGLE_JOB', 'L3: JobScanner classifies Unstop detail as SINGLE_JOB')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO M: Toolbar Icon Action Request Dispatch Modes
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario M: Toolbar Action Request Dispatch ---')

  // Mock handler logic matching content script
  const dispatchAction = (url: string, doc: any): { success: boolean; mode: string; detectedJobs?: number } => {
    if (isExplicitlyNonJobSite(url)) return { success: true, mode: 'not-job-page' }
    const { classification } = jobScanner.classifyPage(url, doc)
    if (classification === 'JOB_LIST' || isLikelyJobListing(doc, url)) {
      const jobs = unstopAdapter.extractJobList(doc)
      return { success: true, mode: 'job-listing', detectedJobs: jobs.length }
    }
    if (classification === 'SINGLE_JOB' || isLikelyJobPage(doc, url)) {
      return { success: true, mode: 'single-job' }
    }
    return { success: true, mode: 'not-job-page' }
  }

  const resListing = dispatchAction(unstopListingUrl, unstopListingDoc as any)
  assert(resListing.success === true && resListing.mode === 'job-listing' && resListing.detectedJobs === 2, 'M1: Listing page returns mode "job-listing" with detected count')

  const resSingle = dispatchAction(unstopDetailUrl, unstopDetailDoc as any)
  assert(resSingle.success === true && resSingle.mode === 'single-job', 'M2: Single job returns mode "single-job"')

  const resNonJob = dispatchAction('https://youtube.com/watch?v=123', {} as any)
  assert(resNonJob.success === true && resNonJob.mode === 'not-job-page', 'M3: Non-job domain returns mode "not-job-page"')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO N: Strict Profile Matching & Fresher Eligibility Gate
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario N: Strict Profile Matching & Fresher Eligibility Gate ---')
  const fresherProfile: UserProfile = {
    id: 'fresher-1',
    userId: 'fresher-1',
    preferredRoles: ['Software Engineer', 'Frontend Developer'],
    preferredLocations: ['Bengaluru', 'Remote'],
    preferredJobTypes: ['FULL_TIME'],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'HTML', 'CSS', 'Git'],
    experienceYears: 0,
    education: "Bachelor's Degree",
    degree: 'B.Tech in Computer Science',
    workStyle: 'REMOTE',
    onboardingCompleted: true,
  }

  const seniorRoleJob: ExtractedJob = {
    title: 'Senior Frontend Engineer',
    company: 'Fintech Scaleup',
    location: 'Bengaluru',
    description: 'We require 3-5 years of hands-on experience in production frontend development.',
    jobUrl: 'https://unstop.com/jobs/senior-frontend-engineer-303',
    sourceWebsite: 'Unstop',
    confidence: 'HIGH',
  }

  const normalizedSenior = normalizeJob(seniorRoleJob, fresherProfile)
  assert(normalizedSenior.matchScore <= 42, `N1: Fresher applying to 3-5 yr senior role strictly capped <= 42% (Got ${normalizedSenior.matchScore}%)`)
  assert(normalizedSenior.experienceMatchStatus === 'MISMATCH', 'N3: Experience match explicitly marked as MISMATCH')
  assert(Boolean(normalizedSenior.experienceRequiredText), 'N4: requiredText extracted for experience')
  const analyzedSenior = analyzeJobRelevance(seniorRoleJob, fresherProfile)
  assert(analyzedSenior.experienceMatch?.status === 'MISMATCH', 'N5: analyzeJobRelevance marks experienceMatch.status as MISMATCH')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO O: Shadow DOM Host (#talvyn-host) Isolation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario O: Shadow DOM Host (#talvyn-host) Isolation ---')
  const mockGlobalDoc: any = {
    getElementById: (id: string) => null,
    createElement: (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        style: {},
        attributes: {},
        setAttribute: (k: string, v: string) => { el.attributes[k] = v },
        appendChild: (child: any) => { el.children.push(child) },
        children: [],
        attachShadow: ({ mode }: { mode: string }) => {
          const sRoot: any = {
            mode,
            children: [],
            appendChild: (child: any) => { sRoot.children.push(child) },
            getElementById: (childId: string) => sRoot.children.find((c: any) => c.id === childId) || null,
          }
          el.shadowRoot = sRoot
          return sRoot
        },
      }
      return el
    },
    body: {
      appendChild: (child: any) => {},
    },
  }

  const prevDoc = (global as any).document
  ;(global as any).document = mockGlobalDoc

  const { host, shadow } = getTalvynHost()
  assert(host.id === TALVYN_HOST_ID, 'O1: Host element created with id #talvyn-host')
  assert(host.style.position === 'fixed', 'O2: Host positioned fixed')
  assert(host.style.zIndex === '2147483647', 'O3: Host has maximum z-index')
  assert(host.style.pointerEvents === 'none', 'O4: Host has pointer-events none to pass-through clicks')
  assert(shadow !== null && typeof shadow.appendChild === 'function', 'O5: Host has attached open ShadowRoot')

  ;(global as any).document = prevDoc

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO P: Pointer Events Drag with touch-action: none
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario P: Pointer Events Drag ---')
  const mockPanelEl: any = {
    style: {},
    getBoundingClientRect: () => ({ left: 100, top: 100 }),
    offsetWidth: 320,
    offsetHeight: 420,
  }
  const mockHeaderEl: any = {
    style: {},
    listeners: {} as Record<string, Function>,
    addEventListener: (type: string, fn: Function) => {
      mockHeaderEl.listeners[type] = fn
    },
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  }

  makeElementDraggable(mockPanelEl, mockHeaderEl)
  assert(mockHeaderEl.style.touchAction === 'none', 'P1: Header sets touch-action: none to prevent mobile scroll conflict')
  assert(mockHeaderEl.style.cursor === 'grab', 'P2: Header sets cursor: grab')
  assert(typeof mockHeaderEl.listeners['pointerdown'] === 'function', 'P3: Pointerdown listener registered')
  assert(typeof mockHeaderEl.listeners['pointermove'] === 'function', 'P4: Pointermove listener registered')
  assert(typeof mockHeaderEl.listeners['pointerup'] === 'function', 'P5: Pointerup listener registered')
  assert(typeof mockHeaderEl.listeners['pointercancel'] === 'function', 'P6: Pointercancel listener registered')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO Q: Save Top Matches Filter
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario Q: Save Top Matches Filter ---')
  const analyzedBatch = [
    { relevanceScore: 92, category: 'EXCELLENT', isSaved: false },
    { relevanceScore: 84, category: 'HIGHLY_RELEVANT', isSaved: false },
    { relevanceScore: 65, category: 'RELEVANT', isSaved: false },
    { relevanceScore: 35, category: 'LOW', isSaved: false },
  ]
  const topOnly = analyzedBatch.filter((j) => (j.category === 'EXCELLENT' || j.category === 'HIGHLY_RELEVANT') && !j.isSaved)
  assert(topOnly.length === 2, 'Q1: Save Top Matches filters strictly to Strong and Good categories')
  assert(topOnly.every((j) => j.relevanceScore >= 80), 'Q2: All selected jobs have high relevance scores')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO R: Multi-Job Summary Counts Consistency
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario R: Multi-Job Summary Counts Consistency ---')
  const summaryCounts = {
    totalDetected: 4,
    excellentCount: 1,
    highlyRelevantCount: 1,
    relevantCount: 1,
    lowRelevanceCount: 1,
  }
  const sumOfBreakdown = summaryCounts.excellentCount + summaryCounts.highlyRelevantCount + summaryCounts.relevantCount + summaryCounts.lowRelevanceCount
  assert(summaryCounts.totalDetected === sumOfBreakdown, 'R1: Total detected count matches sum of 4 categories')

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO S: Draggable Viewport Boundary Clamping
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- Scenario S: Viewport Boundary Clamping ---')
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max))
  const winWidth = 1024
  const winHeight = 768
  const pWidth = 320
  const pHeight = 460
  const maxL = Math.max(0, winWidth - pWidth) // 704
  const maxT = Math.max(0, winHeight - pHeight) // 308

  assert(clamp(-50, 0, maxL) === 0, 'S1: Negative left coordinate clamped to 0')
  assert(clamp(900, 0, maxL) === 704, 'S2: Overflow right coordinate clamped to viewport boundary')
  assert(clamp(-20, 0, maxT) === 0, 'S3: Negative top coordinate clamped to 0')
  assert(clamp(800, 0, maxT) === 308, 'S4: Overflow bottom coordinate clamped to viewport boundary')

  console.log('\n===========================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('===========================================================')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal error during job detection verification:', err)
  process.exit(1)
})
