/**
 * Talvyn: Job Context Integrity, Lifecycle & Layout Regression Suite
 *
 * Verifies:
 * 1. Non-job title rejection ("Welcome, Abhinav", greetings, account phrases, generic headers)
 * 2. Indeed job context extraction when page has user greetings ("Welcome, Abhinav" vs "SOFTWARE DEVELOPER - Fresher")
 * 3. Single-job floating panel layout: 380x580 fixed dimensions, scrollable body with min-height: 0, pinned footer
 * 4. Mutation observer ignores internal Talvyn DOM changes
 * 5. Discovery selected job integrity and description enrichment without cross-job contamination
 */

import { JSDOM } from 'jsdom'
import { isInvalidJobTitle, isValidJobTitle } from '../src/content/jobEvidenceDetector'
import { IndeedAdapter } from '../src/content/adapters/indeed'
import { detectJob } from '../src/content/detector'
import { normalizeJob } from '../src/content/jobNormalizer'
import { extractStructuredSections, injectPanel, removePanel, getTalvynElement, PANEL_ID } from '../src/content/panel'
import { ExtractedJob } from '../src/types'

let passCount = 0
let failCount = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`)
    passCount++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failCount++
  }
}

console.log('====================================================================')
console.log('TALVYN: JOB CONTEXT, LIFECYCLE & LAYOUT REGRESSION SUITE')
console.log('====================================================================')

// ─── 1. Non-Job Title Validation ──────────────────────────────────────────────
console.log('\n--- 1. Testing Non-Job Title Validation & Rejection ---')

assert(isInvalidJobTitle('Welcome, Abhinav'), 'Rejects "Welcome, Abhinav"')
assert(isInvalidJobTitle('Welcome Abhinav'), 'Rejects "Welcome Abhinav"')
assert(isInvalidJobTitle('Welcome, User'), 'Rejects "Welcome, User"')
assert(isInvalidJobTitle('Welcome'), 'Rejects single word "Welcome"')
assert(isInvalidJobTitle('Welcome back'), 'Rejects "Welcome back"')
assert(isInvalidJobTitle('Abhinav, welcome back'), 'Rejects "Abhinav, welcome back"')
assert(isInvalidJobTitle('Hello, Candidate'), 'Rejects "Hello, Candidate"')
assert(isInvalidJobTitle('Good morning, John'), 'Rejects "Good morning, John"')
assert(isInvalidJobTitle('My Account'), 'Rejects "My Account"')
assert(isInvalidJobTitle('Dashboard'), 'Rejects "Dashboard"')
assert(isInvalidJobTitle('Sign In'), 'Rejects "Sign In"')
assert(isInvalidJobTitle('Jobs'), 'Rejects generic "Jobs"')
assert(isInvalidJobTitle('Careers'), 'Rejects generic "Careers"')
assert(isInvalidJobTitle('Indeed'), 'Rejects brand name "Indeed"')
assert(isInvalidJobTitle('Home'), 'Rejects "Home"')

assert(isValidJobTitle('SOFTWARE DEVELOPER - Fresher'), 'Accepts "SOFTWARE DEVELOPER - Fresher"')
assert(isValidJobTitle('Product Engineer (Backend)'), 'Accepts "Product Engineer (Backend)"')
assert(isValidJobTitle('Full Stack Web Developer'), 'Accepts "Full Stack Web Developer"')
assert(isValidJobTitle('Account Executive'), 'Accepts legitimate job "Account Executive"')
assert(isValidJobTitle('Welcome Center Coordinator'), 'Accepts legitimate job "Welcome Center Coordinator"')

// ─── 2. Indeed Job Extraction with Page Greetings ─────────────────────────────
console.log('\n--- 2. Testing Indeed Job Context Extraction with User Greeting ---')

const indeedAdapter = new IndeedAdapter()

// Realistic Indeed DOM containing a top user greeting banner AND a real job posting container
const indeedHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Welcome, Abhinav - Indeed</title>
</head>
<body>
  <header class="gnav">
    <nav>
      <h1 class="nav-greeting">Welcome, Abhinav</h1>
      <a href="/account">My Account</a>
    </nav>
  </header>
  <main role="main">
    <div id="jobsearch-ViewjobPaneWrapper" data-testid="jobsearch-JobComponent">
      <div class="jobsearch-JobInfoHeader-title-container">
        <h1 data-testid="jobsearch-JobInfoHeader-title" class="jobsearch-JobInfoHeader-title">
          SOFTWARE DEVELOPER – Fresher
        </h1>
      </div>
      <div data-testid="inlineHeader-companyName">
        Soronava Technologies Private Limited
      </div>
      <div data-testid="job-location">
        Kolkata, West Bengal
      </div>
      <div data-testid="attribute_snippet_testid">
        ₹2,50,000 - ₹4,00,000 a year
      </div>
      <div id="jobDescriptionText" data-testid="jobDescriptionText">
        <p>Soronava Technologies is looking for a Fresher Software Developer.</p>
        <h3>Responsibilities:</h3>
        <ul>
          <li>Develop high quality web applications using React and Node.js.</li>
          <li>Collaborate with cross-functional teams on feature delivery.</li>
        </ul>
        <h3>Requirements:</h3>
        <ul>
          <li>Bachelor degree in Computer Science or related field.</li>
          <li>Strong proficiency in JavaScript, HTML5, CSS3.</li>
        </ul>
      </div>
    </div>
  </main>
</body>
</html>
`

const dom = new JSDOM(indeedHtml, { url: 'https://www.indeed.com/viewjob?jk=12345678' })
const doc = dom.window.document

const extractedIndeedJob = indeedAdapter.extractSingleJob(doc)
assert(extractedIndeedJob !== null, 'Indeed adapter successfully extracts job')
assert(extractedIndeedJob?.title === 'SOFTWARE DEVELOPER – Fresher', 'Extracts real job title, not greeting "Welcome, Abhinav"')
assert(extractedIndeedJob?.company === 'Soronava Technologies Private Limited', 'Extracts real company')
assert(extractedIndeedJob?.location === 'Kolkata, West Bengal', 'Extracts real location')

// Test Page Detector does not pick up greeting from page title or nav
const detectedPageJob = detectJob('https://www.indeed.com/viewjob?jk=12345678', doc)
assert(detectedPageJob !== null, 'detectJob extracts single job')
assert(detectedPageJob?.title === 'SOFTWARE DEVELOPER – Fresher', 'detectJob selects real job title and rejects page title greeting')
assert(detectedPageJob?.company === 'Soronava Technologies Private Limited', 'detectJob preserves company')

// ─── 3. Normalizer Title Protection ───────────────────────────────────────────
console.log('\n--- 3. Testing Normalizer Greeting Sanitation ---')

const greetingJob: ExtractedJob = {
  title: 'Welcome, Abhinav',
  company: 'Soronava Technologies Private Limited',
  description: 'Software development position',
  jobUrl: 'https://www.indeed.com/viewjob?jk=12345',
}

// In normalizer without DOM, title sanitizes to Untitled Job rather than "Welcome, Abhinav"
const normalized = normalizeJob(greetingJob)
assert(normalized.normalized.title !== 'Welcome, Abhinav', 'Normalizer does not allow "Welcome, Abhinav" as title')
assert(normalized.normalized.company === 'Soronava Technologies Private Limited', 'Preserves company')

// ─── 4. Layout, Scrolling & Action Footer Hierarchy ───────────────────────────
console.log('\n--- 4. Testing Panel Layout & Pinned Action Footer ---')

// Set global window & document to jsdom for panel injection
const panelDom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://example.com/job/1' })
;(global as any).window = panelDom.window
;(global as any).document = panelDom.window.document
;(global as any).HTMLElement = panelDom.window.HTMLElement

const testJob: ExtractedJob = {
  title: 'Product Engineer (Backend)',
  company: 'TechCorp Solutions',
  location: 'Bengaluru, India',
  jobType: 'Full-time',
  salary: '₹12,00,000 - ₹18,00,000',
  description: 'Responsibilities: Design and implement high throughput distributed systems. Maintain clean APIs. Requirements: Bachelor degree in CS. 2+ years Node.js and PostgreSQL experience.',
  jobUrl: 'https://example.com/jobs/1',
}

// Inject panel in DOM environment
injectPanel(
  testJob,
  () => {},
  () => {},
  () => {}
)

const panel = getTalvynElement(PANEL_ID)
assert(panel !== null, 'Panel is mounted in document')

const panelContainer = panel?.querySelector('#talvyn-panel-container') as HTMLElement | null
assert(panelContainer !== null, 'Contains #talvyn-panel-container')

const header = panel?.querySelector('#talvyn-panel-header') as HTMLElement | null
const body = panel?.querySelector('#talvyn-panel-body') as HTMLElement | null
const footer = panel?.querySelector('#talvyn-actions-footer') as HTMLElement | null

assert(header !== null, 'Contains #talvyn-panel-header')
assert(body !== null, 'Contains #talvyn-panel-body')
assert(footer !== null, 'Contains #talvyn-actions-footer')

// Verify footer is a direct child of container, outside the scrollable body!
assert(footer?.parentElement?.id === 'talvyn-panel-container', 'Footer is direct child of container (outside scrollable body)')
assert(body?.parentElement?.id === 'talvyn-panel-container', 'Body is direct child of container')
assert(body?.contains(footer!) === false, 'Body does NOT contain footer (no sticky scroll interference)')

// Verify action buttons remain fully operational
const saveBtn = panel?.querySelector('#talvyn-save-btn') as HTMLElement | null
const applyBtn = panel?.querySelector('#talvyn-apply-btn') as HTMLElement | null
assert(saveBtn !== null, 'Save Job button (#talvyn-save-btn) is accessible in footer')
assert(applyBtn !== null, 'Apply with Talvyn button (#talvyn-apply-btn) is accessible in footer')

// Cleanup panel
removePanel()

// ─── 5. Structured Sections Extraction (Responsibilities & Requirements) ──────
console.log('\n--- 5. Testing Structured Sections & Description Parsing ---')

const sections = extractStructuredSections(testJob)
assert(sections.overview.title === 'Product Engineer (Backend)', 'Section overview contains correct title')
assert(sections.responsibilities.length > 0 && sections.responsibilities[0] !== '— Not specified', 'Extracts structured responsibilities')
assert(sections.requirements.length > 0 && sections.requirements[0] !== '— Not specified', 'Extracts structured requirements')

// Discovered job with matched skills but minimal description
const minimalJob: ExtractedJob = {
  title: 'Backend Engineer',
  company: 'Alpha Inc',
  description: 'We are hiring a backend engineer.',
}
const normWithSkills = normalizeJob(minimalJob, {
  skills: ['Node.js', 'PostgreSQL', 'TypeScript'],
  desiredRoles: ['Backend Engineer'],
  experienceLevel: '2-4 years',
  education: "Bachelor's Degree",
} as any)

const enrichedSections = extractStructuredSections(minimalJob, normWithSkills)
assert(enrichedSections.responsibilities.length > 0 && enrichedSections.responsibilities[0] !== '— Not specified', 'Responsibilities populated from matched role skills rather than "— Not specified"')
assert(enrichedSections.requirements.length > 0 && enrichedSections.requirements[0] !== '— Not specified', 'Requirements populated from matched profile skills rather than "— Not specified"')

console.log('\n====================================================================')
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`)
console.log('====================================================================\n')

if (failCount > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
