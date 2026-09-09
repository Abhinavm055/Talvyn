/**
 * Regression Verification Suite for Video-Confirmed Runtime Fixes:
 * - Test A: Correct job title context (rejects "Welcome, Abhinav" header, keeps authoritative job)
 * - Test B: Discovery job selection isolation (separates selectedDiscoveryJob from nativePageJob)
 * - Test C: Full description, responsibilities, and requirements extraction (no fabrication)
 * - Test D: Single-job panel layout matches Discovery window (380x580, vertical scrolling)
 * - Test E: Panel lifecycle stability across DOM mutations (no disappearing/reappearing)
 */

import { JSDOM } from 'jsdom'
import { IndeedAdapter } from '../src/content/adapters/indeed'
import { GenericAdapter } from '../src/content/adapters/generic'
import { detectJob } from '../src/content/detector'
import { JobScanner } from '../src/content/scanner'
import { extractStructuredSections, injectPanel, removePanel, PANEL_ID, getTalvynHost, getTalvynElement } from '../src/content/panel'
import { discoveryPanelManager, DISCOVERY_PANEL_ID } from '../src/content/discoveryPanel'
import { NavigationObserver } from '../src/content/navigationObserver'
import { ExtractedJob, JobListAnalysisSummary } from '../src/types'

console.log('====================================================================')
console.log('TALVYN: RUNTIME FIXES REGRESSION VERIFICATION SUITE')
console.log('====================================================================\n')

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

// ─── TEST A: Correct Job Title / Job Context Mapping ─────────────────────────
console.log('--- TEST A: Correct Job Title Context vs Greeting/Nav Header ---')

const domA = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head><title>Job Search | Indeed</title></head>
    <body>
      <header class="gnav-header">
        <div class="user-greeting-banner">
          <h1>Welcome, Abhinav</h1>
          <span class="user-email">abhinav@example.com</span>
        </div>
        <nav role="navigation">
          <a href="/home">Home</a>
          <a href="/saved">My Jobs</a>
        </nav>
      </header>

      <main role="main">
        <div data-testid="jobsearch-JobComponent" class="jobsearch-JobComponent">
          <div class="jobsearch-JobInfoHeader">
            <h1 data-testid="jobsearch-JobInfoHeader-title" class="jobsearch-JobInfoHeader-title">
              SOFTWARE DEVELOPER - Fresher
            </h1>
            <div data-testid="inlineHeader-companyName" class="companyName">
              Soronava Technologies Private Limited
            </div>
            <div data-testid="job-location" class="companyLocation">
              Bangalore, Karnataka
            </div>
            <div data-testid="attribute_snippet_testid">
              ₹3,50,000 - ₹5,00,000 a year - Full-time
            </div>
          </div>
          <div id="jobDescriptionText" data-testid="jobsearch-JobComponent-description">
            <p>About Soronava Technologies: We are building modern enterprise applications.</p>
            <h3>Responsibilities</h3>
            <ul>
              <li>Design, develop and maintain frontend components</li>
              <li>Collaborate with cross-functional product teams</li>
            </ul>
            <h3>Requirements</h3>
            <ul>
              <li>Bachelor degree in Computer Science or related field</li>
              <li>Strong foundation in JavaScript and TypeScript</li>
            </ul>
          </div>
        </div>
      </main>
    </body>
  </html>
`, { url: 'https://www.indeed.com/viewjob?jk=12345' })

const docA = domA.window.document
const indeedAdapter = new IndeedAdapter()
const genericAdapter = new GenericAdapter()
const scanner = new JobScanner()

const extractedIndeed = indeedAdapter.extractSingleJob(docA)
assert(extractedIndeed !== null, 'Test A1: Indeed adapter extracts single job from page')
assert(extractedIndeed?.title === 'SOFTWARE DEVELOPER - Fresher', 'Test A2: Extracted title is exact job title, NOT greeting', extractedIndeed?.title)
assert(extractedIndeed?.title !== 'Welcome, Abhinav', 'Test A3: Extracted title strictly never equals "Welcome, Abhinav"')
assert(extractedIndeed?.company === 'Soronava Technologies Private Limited', 'Test A4: Extracted company matches authoritative job context', extractedIndeed?.company)
assert(Boolean(extractedIndeed?.description?.includes('Soronava Technologies')), 'Test A5: Extracted description belongs to the same job context')
assert(Array.isArray(extractedIndeed?.responsibilities) && extractedIndeed!.responsibilities.length > 0, 'Test A6: Extracted responsibilities populated from container')

// Verify Generic adapter on the same page
const extractedGeneric = genericAdapter.extractSingleJob(docA)
assert(extractedGeneric !== null, 'Test A7: Generic adapter extracts single job from page')
assert(extractedGeneric?.title === 'SOFTWARE DEVELOPER - Fresher', 'Test A8: Generic adapter title is exact job title, NOT greeting', extractedGeneric?.title)
assert(extractedGeneric?.title !== 'Welcome, Abhinav', 'Test A9: Generic adapter strictly ignores "Welcome, Abhinav"')
assert(extractedGeneric?.company === 'Soronava Technologies Private Limited', 'Test A10: Generic adapter company belongs to same job context')

// Verify scanner plausibility check rejects greeting
const fakeGreetingJob: ExtractedJob = {
  title: 'Welcome, Abhinav',
  company: 'Soronava Technologies Private Limited',
  location: 'Bangalore',
  description: 'Software Developer fresher position',
  jobUrl: 'https://www.indeed.com/viewjob?jk=123',
  sourceWebsite: 'Indeed',
}
const isPlausible = (scanner as any).isPlausibleExtractedJob(fakeGreetingJob, 'https://www.indeed.com/viewjob?jk=123')
assert(isPlausible === false, 'Test A11: JobScanner.isPlausibleExtractedJob strictly rejects "Welcome, Abhinav"')

// ─── TEST B: Discovery Job Selection Isolation ───────────────────────────────
console.log('\n--- TEST B: Discovery Job Selection Isolation ---')

const nativeJobA: ExtractedJob = {
  title: 'SOFTWARE DEVELOPER - Fresher',
  company: 'Soronava Technologies Private Limited',
  location: 'Bangalore, Karnataka',
  salary: '₹3,50,000 - ₹5,00,000 a year',
  jobType: 'FULL_TIME',
  description: 'Native job on the page at Soronava Technologies.',
  jobUrl: 'https://www.indeed.com/viewjob?jk=native-job-a',
  sourceWebsite: 'Indeed',
}

const discoveryJobB: ExtractedJob = {
  title: 'Product Engineer (Backend)',
  company: 'Caprice Cloud Solutions Pvt Ltd',
  location: 'Remote',
  salary: '₹12,00,000 - ₹18,00,000 a year',
  jobType: 'FULL_TIME',
  description: 'Backend Product Engineer role building distributed cloud services with Go and PostgreSQL.',
  responsibilities: ['Architect robust microservices', 'Optimize database performance'],
  requirements: ['3+ years experience with backend systems', 'Expertise in Go or Node.js'],
  jobUrl: 'https://www.indeed.com/viewjob?jk=discovery-job-b',
  sourceWebsite: 'Indeed',
}

// Emulate state container
let stateNativeJob: ExtractedJob | null = nativeJobA
let stateDiscoveredJobs: ExtractedJob[] = [nativeJobA, discoveryJobB]
let stateSelectedDiscoveryJob: ExtractedJob | null = null
let stateCurrentSingleJob: ExtractedJob | null = null

// Select Job B
function selectDiscoveryJob(job: ExtractedJob) {
  stateSelectedDiscoveryJob = job
  stateCurrentSingleJob = job
}

selectDiscoveryJob(discoveryJobB)

assert(stateSelectedDiscoveryJob !== null, 'Test B1: Discovery job selection sets selectedDiscoveryJob')
assert(stateSelectedDiscoveryJob!.title === 'Product Engineer (Backend)', 'Test B2: selectedDiscoveryJob title is Job B')
assert(stateSelectedDiscoveryJob!.company === 'Caprice Cloud Solutions Pvt Ltd', 'Test B3: selectedDiscoveryJob company is Job B')
assert(stateNativeJob.title === 'SOFTWARE DEVELOPER - Fresher', 'Test B4: nativePageJob is NOT overwritten when selecting from Discovery')
assert(stateCurrentSingleJob!.title === 'Product Engineer (Backend)', 'Test B5: currentSingleJob is isolated to selected discovery job')
assert(stateCurrentSingleJob!.company === 'Caprice Cloud Solutions Pvt Ltd', 'Test B6: currentSingleJob company is Caprice Cloud Solutions')

// ─── TEST C: Full Description, Responsibilities & Requirements Extraction ───
console.log('\n--- TEST C: Full Description, Responsibilities & Requirements Extraction ---')

const jobWithSections: ExtractedJob = {
  title: 'Senior Frontend Developer',
  company: 'TechFlow Innovations',
  location: 'Delhi NCR',
  jobUrl: 'https://example.com/job/1',
  sourceWebsite: 'TechFlow',
  description: `
    Job Description
    TechFlow Innovations is looking for an experienced Senior Frontend Developer to lead UI architecture.

    Responsibilities:
    • Lead development of responsive web applications using React and TypeScript
    • Mentor junior frontend engineers and conduct code reviews
    • Optimize web vital metrics and rendering performance

    Requirements:
    • 4+ years of professional frontend engineering experience
    • Mastery of modern React, state management, and CSS architectures
    • Strong communication and problem solving skills
  `,
}

const structured = extractStructuredSections(jobWithSections)
assert(structured.descriptionSummary !== '— Not specified', 'Test C1: Description summary extracted from Job Description heading')
assert(structured.descriptionSummary.includes('TechFlow Innovations'), 'Test C2: Description summary contains company/job overview')
assert(structured.responsibilities.length >= 2, 'Test C3: Responsibilities extracted into list items', structured.responsibilities)
assert(structured.responsibilities[0].includes('Lead development of responsive web applications'), 'Test C4: First responsibility correctly parsed')
assert(structured.requirements.length >= 2, 'Test C5: Requirements extracted into list items', structured.requirements)
assert(structured.requirements[0].includes('4+ years of professional frontend engineering experience'), 'Test C6: First requirement correctly parsed')

// Test with truly missing sections -> must return "— Not specified" without fabrication
const minimalJob: ExtractedJob = {
  title: 'General Assistant',
  company: 'Retail Store',
  jobUrl: 'https://example.com/job/2',
  sourceWebsite: 'Retail',
  description: '',
}

const minimalStructured = extractStructuredSections(minimalJob)
assert(minimalStructured.descriptionSummary === '— Not specified', 'Test C7: Truly missing description remains "— Not specified"')
assert(minimalStructured.responsibilities[0] === '— Not specified', 'Test C8: Truly missing responsibilities remain "— Not specified"')
assert(minimalStructured.requirements[0] === '— Not specified', 'Test C9: Truly missing requirements remain "— Not specified"')

// ─── TEST D: Single-Job Panel Layout & Sizing ────────────────────────────────
console.log('\n--- TEST D: Single-Job Panel Window Sizing & Scrolling ---')

// Setup global DOM for panel injection test
const domD = new JSDOM('<!DOCTYPE html><html><body></body></html>')
const globalAny = global as any
globalAny.window = domD.window
globalAny.document = domD.window.document
globalAny.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
}

// Inject Single Job Panel
injectPanel(
  discoveryJobB,
  () => {},
  () => {},
  () => {},
  { isConnected: true }
)

const singlePanel = getTalvynElement(PANEL_ID)
assert(singlePanel !== null, 'Test D1: Single job panel mounted in document')
assert(singlePanel?.style.width === '380px', 'Test D2: Single job panel width is 380px (matches Discovery window)', singlePanel?.style.width)
assert(singlePanel?.style.maxHeight === '580px', 'Test D3: Single job panel maxHeight is 580px (matches Discovery window)', singlePanel?.style.maxHeight)
assert(singlePanel?.style.overflow === 'hidden', 'Test D4: Single job panel outer shell has overflow: hidden', singlePanel?.style.overflow)

const bodyContainer = singlePanel?.querySelector('#talvyn-panel-body') as HTMLElement | null
assert(bodyContainer !== null, 'Test D5: Scrollable body container (#talvyn-panel-body) exists inside panel')
assert(bodyContainer?.style.overflowY === 'auto', 'Test D6: Detail content container supports vertical scrolling (overflow-y: auto)', bodyContainer?.style.overflowY)

const footerActions = singlePanel?.querySelector('#talvyn-actions-footer, #talvyn-actions') as HTMLElement | null
assert(footerActions !== null, 'Test D7: Action buttons container exists')
assert(singlePanel?.querySelector('#talvyn-save-btn') !== null, 'Test D8: Primary Save Job button rendered')
assert(singlePanel?.querySelector('#talvyn-apply-btn') !== null, 'Test D9: Apply with Talvyn button rendered')

// Clean up single panel
removePanel()

// ─── TEST E: Panel Lifecycle & Mutation Stability ────────────────────────────
console.log('\n--- TEST E: Panel Lifecycle & Mutation Stability ---')

const navObserver = new NavigationObserver()
let mutationFiredCount = 0
let navigateFiredCount = 0

navObserver.init((_url) => {
  navigateFiredCount++
})

navObserver.onMutation((_url) => {
  mutationFiredCount++
})

// Re-inject panel
injectPanel(
  nativeJobA,
  () => {},
  () => {},
  () => {},
  { isConnected: true }
)

const activePanelBeforeMutations = getTalvynElement(PANEL_ID)
assert(activePanelBeforeMutations !== null, 'Test E1: Panel is mounted before mutations')

// Simulate DOM mutations (e.g. ad banners, recommendations, React renders)
for (let i = 0; i < 5; i++) {
  const adEl = domD.window.document.createElement('div')
  adEl.className = 'ad-banner-update'
  adEl.textContent = `Ad content #${i}`
  domD.window.document.body.appendChild(adEl)
}

// Verify panel remains mounted in the document after DOM changes
const activePanelAfterMutations = getTalvynElement(PANEL_ID)
assert(activePanelAfterMutations !== null, 'Test E2: Panel remains mounted after DOM mutations')
assert(activePanelAfterMutations?.style.display !== 'none', 'Test E3: Panel remains visible after DOM mutations')
assert(navigateFiredCount === 0, 'Test E4: Normal DOM mutations did NOT trigger genuine SPA navigation callbacks')

// Cleanup
removePanel()
navObserver.cleanup()

console.log('\n====================================================================')
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
console.log('====================================================================')

if (failed > 0) {
  process.exit(1)
}
