import { JobScanner } from '../src/content/scanner'
import {
  isLikelyJobListing,
  isLikelyJobPage,
  isValidJobCard,
  isExplicitlyNonJobSite,
} from '../src/content/jobEvidenceDetector'
import { UnstopAdapter } from '../src/content/adapters/unstop'
import { UserProfile } from '../src/types'

console.log('===================================================================')
console.log('TALVYN: UNSTOP & UNIVERSAL SPLIT-PANE LISTING DETECTION TESTS')
console.log('===================================================================\n')

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${name}`)
    if (detail !== undefined) console.error(`    Detail:`, detail)
    failed++
  }
}

// Lightweight mock helper
function createMockCard(props: {
  title: string
  company: string
  location?: string
  salary?: string
  jobType?: string
  experience?: string
  dataId?: string
  href?: string
}) {
  const children: any[] = []

  const titleNode = {
    tagName: 'H3',
    className: 'opp_title',
    textContent: props.title,
    children: [],
    querySelector: () => null,
    querySelectorAll: () => [],
    getAttribute: () => null,
  }
  children.push(titleNode)

  const compNode = {
    tagName: 'DIV',
    className: 'company_name',
    textContent: props.company,
    children: [],
    querySelector: () => null,
    querySelectorAll: () => [],
    getAttribute: () => null,
  }
  children.push(compNode)

  if (props.location) {
    children.push({
      tagName: 'DIV',
      className: 'location',
      textContent: props.location,
      children: [],
      querySelector: () => null,
      querySelectorAll: () => [],
      getAttribute: () => null,
    })
  }

  if (props.salary) {
    children.push({
      tagName: 'DIV',
      className: 'salary',
      textContent: props.salary,
      children: [],
      querySelector: () => null,
      querySelectorAll: () => [],
      getAttribute: () => null,
    })
  }

  if (props.jobType) {
    children.push({
      tagName: 'DIV',
      className: 'opp-type',
      textContent: props.jobType,
      children: [],
      querySelector: () => null,
      querySelectorAll: () => [],
      getAttribute: () => null,
    })
  }

  if (props.experience) {
    children.push({
      tagName: 'DIV',
      className: 'exp',
      textContent: props.experience,
      children: [],
      querySelector: () => null,
      querySelectorAll: () => [],
      getAttribute: () => null,
    })
  }

  if (props.href) {
    children.push({
      tagName: 'A',
      href: props.href,
      textContent: 'View Details',
      children: [],
      querySelector: () => null,
      querySelectorAll: () => [],
      getAttribute: (a: string) => (a === 'href' ? props.href : null),
    })
  }

  const cardNode: any = {
    tagName: 'DIV',
    className: 'opportunity_card single_opportunity',
    children,
    getAttribute(name: string) {
      if (name === 'data-id') return props.dataId || null
      if (name === 'data-item-id') return props.dataId || null
      return null
    },
    hasAttribute(name: string) {
      if (name === 'data-id' && props.dataId) return true
      if (name === 'data-item-id' && props.dataId) return true
      return false
    },
    querySelector(sel: string) {
      if (
        sel.includes('video-title') ||
        sel.includes('ytd-') ||
        sel.includes('add-to-cart') ||
        sel.includes('sponsored') ||
        sel.includes('ad-') ||
        sel.includes('data-ad')
      ) {
        return null
      }
      for (const child of children) {
        if (sel.includes('title') && (child.className?.includes('title') || child.tagName === 'H3')) return child
        if (sel.includes('company') && child.className?.includes('company')) return child
        if (sel.includes('location') && child.className?.includes('location')) return child
        if (sel.includes('salary') && child.className?.includes('salary')) return child
        if (sel.includes('opp-type') || sel.includes('job-type')) {
          if (child.className?.includes('opp-type')) return child
        }
        if (sel.includes('a') && child.tagName === 'A') return child
      }
      return null
    },
    querySelectorAll(sel: string) {
      const res: any[] = []
      for (const child of children) {
        if (sel.includes('h3') && child.tagName === 'H3') res.push(child)
        else if (sel.includes('title') && (child.className?.includes('title') || child.tagName === 'H3')) res.push(child)
        else if (sel.includes('a') && child.tagName === 'A') res.push(child)
        else if (sel.includes('div') && child.tagName === 'DIV') res.push(child)
        else if (sel.includes('span') && child.tagName === 'SPAN') res.push(child)
      }
      return res
    },
    get textContent() {
      return children.map((c) => c.textContent).filter(Boolean).join('\n')
    },
  }

  return cardNode
}

const testProfile: UserProfile = {
  id: 'usr-unstop-test',
  email: 'candidate@example.com',
  name: 'Candidate Profile',
  targetRoles: ['Sales Executive', 'Consultant', 'Software Engineer'],
  skills: ['Workday', 'Technical Sales', 'Cloud', 'Compensation'],
  experienceLevel: 'MID_LEVEL',
  yearsOfExperience: 3,
  educationLevel: 'BACHELORS',
  preferredLocations: ['Bengaluru', 'Remote'],
  workAuthorization: 'CITIZEN',
}

// ─── Scenario 1: Exact User Scenario ─────────────────────────────────────────
console.log('--- 1. Testing https://unstop.com/job?oppstatus=open&selectedItem=i_2747_1 ---')
{
  const url = 'https://unstop.com/job?oppstatus=open&selectedItem=i_2747_1'

  const card1 = createMockCard({
    title: 'Technical Sales Executive',
    company: 'Vanguard Enterprise Solutions',
    location: 'Bengaluru, India',
    salary: '₹ 8 - 14 LPA',
    jobType: 'Full Time',
    experience: '2-4 years experience',
    dataId: 'i_2747_1',
    href: 'https://unstop.com/jobs/technical-sales-executive-27471',
  })

  const card2 = createMockCard({
    title: 'Workday Advanced Compensation Consultant',
    company: 'Global Cloud Advisory',
    location: 'Remote, India',
    salary: '₹ 18 - 25 LPA',
    jobType: 'Full Time',
    experience: '3-6 years experience',
    dataId: 'i_2748_2',
    href: 'https://unstop.com/jobs/workday-advanced-compensation-consultant-27482',
  })

  const card3 = createMockCard({
    title: 'Senior Solutions Architect',
    company: 'Hyperscale Networks',
    location: 'Hyderabad, India',
    salary: '₹ 28 - 35 LPA',
    jobType: 'Full Time',
    experience: '5+ years experience',
    dataId: 'i_2749_3',
    href: 'https://unstop.com/jobs/senior-solutions-architect-27493',
  })

  const allCards = [card1, card2, card3]

  const mockDoc: any = {
    body: {
      get textContent() {
        return allCards.map((c) => c.textContent).join(' ') + ' Apply Now for selected opportunity'
      },
    },
    querySelector(sel: string) {
      if (sel.includes('h1')) return { textContent: 'Explore Job Opportunities' }
      if (sel.includes('apply')) return { tagName: 'BUTTON', textContent: 'Apply Now' }
      return null
    },
    querySelectorAll(sel: string) {
      if (
        sel.includes('opportunity_card') ||
        sel.includes('single_opportunity') ||
        sel.includes('opp-card') ||
        sel.includes('opp_card') ||
        sel.includes('c-card') ||
        sel.includes('job-card') ||
        sel.includes('opportunity')
      ) {
        return allCards
      }
      if (sel.includes('a[href]')) {
        return allCards.map((c) => c.querySelector('a')).filter(Boolean)
      }
      return []
    },
  }

  // 1a. Validate individual cards pass universal validation
  assert(isValidJobCard(card1).isValid === true, '1a. Technical Sales Executive passes isValidJobCard', isValidJobCard(card1))
  assert(isValidJobCard(card2).isValid === true, '1b. Workday Advanced Compensation Consultant passes isValidJobCard', isValidJobCard(card2))
  assert(isValidJobCard(card3).isValid === true, '1c. Senior Solutions Architect passes isValidJobCard', isValidJobCard(card3))

  // 1b. Validate listing evidence detector confirms listing
  assert(isLikelyJobListing(mockDoc, url) === true, '1d. isLikelyJobListing confirms multi-card listing')

  // 1c. Validate UnstopAdapter flags it as listing
  const unstopAdapter = new UnstopAdapter()
  assert(unstopAdapter.isJobListingPage(url, mockDoc) === true, '1e. UnstopAdapter flags page as job listing')
  assert(unstopAdapter.isJobDetailPage(url, mockDoc) === false, '1f. UnstopAdapter does not misclassify as single job detail')

  // 1d. Validate JobScanner classifies page as JOB_LIST
  const scanner = new JobScanner()
  const classification = scanner.classifyPage(url, mockDoc)
  assert(classification.classification === 'JOB_LIST', '1g. JobScanner classifies Unstop split-pane page as JOB_LIST')

  // 1e. Validate job extraction returns all 3 distinct jobs
  const listingSummary = scanner.scanJobListing(url, mockDoc, testProfile)
  assert(listingSummary.totalDetected === 3, `1h. Extracted exactly 3 jobs (Got: ${listingSummary.totalDetected})`)

  const titles = listingSummary.analyzedJobs.map((j) => j.job.title)
  assert(titles.includes('Technical Sales Executive'), '1i. Extracted "Technical Sales Executive"')
  assert(titles.includes('Workday Advanced Compensation Consultant'), '1j. Extracted "Workday Advanced Compensation Consultant"')
  assert(titles.includes('Senior Solutions Architect'), '1k. Extracted "Senior Solutions Architect"')

  // 1f. Verify relevance scores are properly computed
  assert(listingSummary.analyzedJobs[0].relevanceScore > 0, '1l. Analyzed jobs have valid match scores')
}

// ─── Scenario 2: Generic Unknown ATS Listing with Obfuscated Layout ─────────
console.log('\n--- 2. Testing Unknown Company Career Portal with Obfuscated Layout ---')
{
  const url = 'https://careers.innovatetech.io/openings?team=engineering'

  // Cards with non-standard classes
  const cardA = createMockCard({
    title: 'Lead Frontend Consultant',
    company: 'InnovateTech',
    location: 'Remote',
    salary: '$130,000 - $160,000 / year',
    jobType: 'Full Time',
    experience: '4+ years exp',
    href: 'https://careers.innovatetech.io/openings/101',
  })
  cardA.className = 'custom-listing-row rounded-md'

  const cardB = createMockCard({
    title: 'Cloud Infrastructure Specialist',
    company: 'InnovateTech',
    location: 'Austin, TX',
    salary: '$140,000 - $170,000 / year',
    jobType: 'Full Time',
    experience: '5+ years exp',
    href: 'https://careers.innovatetech.io/openings/102',
  })
  cardB.className = 'custom-listing-row rounded-md'

  const allCards = [cardA, cardB]

  const mockDoc: any = {
    body: {
      get textContent() {
        return allCards.map((c) => c.textContent).join(' ')
      },
    },
    querySelector(sel: string) {
      if (sel.includes('h1')) return { textContent: 'Current Career Openings' }
      return null
    },
    querySelectorAll(sel: string) {
      if (sel.includes('opening') || sel.includes('position')) return allCards
      if (sel.includes('a[href]')) return allCards.map((c) => c.querySelector('a')).filter(Boolean)
      return []
    },
  }

  const scanner = new JobScanner()
  const classification = scanner.classifyPage(url, mockDoc)
  assert(classification.classification === 'JOB_LIST', '2a. Unknown company career portal classified as JOB_LIST')

  const summary = scanner.scanJobListing(url, mockDoc, testProfile)
  assert(summary.totalDetected === 2, `2b. Extracted both jobs from unknown portal (Got: ${summary.totalDetected})`)
  assert(summary.analyzedJobs[0].job.title.length > 0, '2c. Successfully analyzed extracted jobs')
}

// ─── Scenario 3: Non-Job Pages Rejection Check ──────────────────────────────
console.log('\n--- 3. Testing Non-Job Safety Gates ---')
{
  assert(isExplicitlyNonJobSite('https://www.youtube.com/results?search_query=unstop+jobs') === true, '3a. YouTube search rejected')
  assert(isExplicitlyNonJobSite('https://www.google.com/search?q=unstop+job+openings') === true, '3b. Google SERP rejected')
  assert(isExplicitlyNonJobSite('https://www.instagram.com/p/C12345') === true, '3c. Instagram rejected')
}

console.log('\n===================================================================')
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
console.log('===================================================================')

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
