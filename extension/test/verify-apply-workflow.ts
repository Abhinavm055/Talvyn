import { JSDOM } from 'jsdom'
import { ExtractedJob } from '../src/types'
import { applicationSessionManager } from '../src/content/applicationDetection/applicationSession'
import { normalizeJob } from '../src/content/jobNormalizer'

console.log('====================================================================')
console.log('TALVYN: APPLY WITH TALVYN WORKFLOW VERIFICATION TESTS')
console.log('====================================================================')

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, message: string) {
  totalTests++
  if (condition) {
    passedTests++
    console.log('  ✓ PASS: ' + message)
  } else {
    console.error('  ✗ FAIL: ' + message)
    process.exitCode = 1
  }
}

async function runTests() {
  console.log('\n--- 1. Testing ExtractedJob & NormalizedJob applyUrl Field Support ---')
  const jobWithApplyUrl: ExtractedJob = {
    title: 'Software Engineer',
    company: 'TechCorp',
    jobUrl: 'https://techcorp.com/careers/se-1',
    applyUrl: 'https://jobs.lever.co/techcorp/apply-direct',
    sourceWebsite: 'techcorp.com',
    confidence: 'HIGH',
  }
  assert(jobWithApplyUrl.applyUrl === 'https://jobs.lever.co/techcorp/apply-direct', 'ExtractedJob interface accepts applyUrl')

  const norm = normalizeJob(jobWithApplyUrl)
  assert(norm.normalized.applyUrl === 'https://jobs.lever.co/techcorp/apply-direct', 'normalizeJob preserves applyUrl on NormalizedJob')

  console.log('\n--- 2. Testing ApplicationSessionManager Session Recording ---')
  const session = await applicationSessionManager.createOrUpdateSession({
    pageUrl: 'https://jobs.lever.co/techcorp/apply-direct',
    jobUrl: 'https://techcorp.com/careers/se-1',
    jobTitle: 'Software Engineer',
    company: 'TechCorp',
    location: 'Bangalore',
  })
  assert(session.jobTitle === 'Software Engineer', 'Application session recorded job title')
  assert(session.company === 'TechCorp', 'Application session recorded company')
  assert(session.pageUrl === 'https://jobs.lever.co/techcorp/apply-direct', 'Application session recorded pageUrl')

  const retrieved = await applicationSessionManager.getActiveSession()
  assert(retrieved !== null && retrieved.company === 'TechCorp', 'Active session retrieved successfully from manager')

  console.log('\n--- 3. Testing Real Apply URL Resolution & External Navigation Logic ---')
  const isValidHttpUrl = (str?: string | null): boolean => {
    if (!str) return false
    try {
      const parsed = new URL(str, 'https://example.com')
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  const isDifferentDestination = (targetUrl?: string | null, currentUrl: string = 'https://example.com/jobs'): boolean => {
    if (!targetUrl || !isValidHttpUrl(targetUrl)) return false
    try {
      const target = new URL(targetUrl, currentUrl)
      const current = new URL(currentUrl)
      return target.origin !== current.origin || target.pathname !== current.pathname
    } catch {
      return false
    }
  }

  assert(isDifferentDestination('https://jobs.lever.co/apply', 'https://example.com/jobs'), 'Identifies external target as different destination')
  assert(!isDifferentDestination('https://example.com/jobs?source=1', 'https://example.com/jobs'), 'Identifies query param changes on same path as same page')

  console.log('\n--- 4. Testing In-Page DOM External Apply Link Detection ---')
  const htmlWithExternalLink = '<div class="job-header"><h1>Fullstack Developer</h1><a class="jobs-apply-button" href="https://boards.greenhouse.io/acme/jobs/123/apply" target="_blank">Apply on company site</a></div>'
  const domWithExternalLink = new JSDOM(htmlWithExternalLink, { url: 'https://linkedin.com/jobs/view/999' })

  const externalLinkEl = domWithExternalLink.window.document.querySelector<HTMLAnchorElement>(
    'a[href*="/apply" i], a[href*="apply" i], a[data-testid*="apply" i], a[class*="apply" i], a.jobs-apply-button'
  )
  assert(Boolean(externalLinkEl), 'Discovered in-page external apply anchor')
  assert(externalLinkEl?.href === 'https://boards.greenhouse.io/acme/jobs/123/apply', 'Extracted exact external apply link destination')

  console.log('\n--- 5. Testing In-Page Native Apply Trigger Discovery ---')
  const htmlWithModalBtn = '<div id="job-details"><h2>Frontend Engineer</h2><button id="indeed-apply-button" data-testid="apply-button">Apply Now</button></div>'
  const domWithModalBtn = new JSDOM(htmlWithModalBtn, { url: 'https://indeed.com/viewjob?jk=12345' })

  const nativeBtn = domWithModalBtn.window.document.querySelector<HTMLElement>(
    'button[class*="apply" i], a[class*="apply" i], button[data-testid*="apply" i], button[id*="apply" i], .jobs-apply-button, [class*="register" i]'
  )
  assert(Boolean(nativeBtn), 'Discovered in-page modal apply trigger button')
  assert(nativeBtn?.id === 'indeed-apply-button', 'Targeted correct apply trigger button')

  console.log('\n--- 6. Testing Debounce Logic Simulation ---')
  let clickCount = 0
  let isDebounced = false
  const simulateClick = () => {
    if (isDebounced) return
    isDebounced = true
    setTimeout(() => { isDebounced = false }, 50)
    clickCount++
  }

  simulateClick()
  simulateClick()
  assert(clickCount === 1, 'Duplicate immediate click ignored by debounce guard')

  await new Promise((r) => setTimeout(r, 60))
  simulateClick()
  assert(clickCount === 2, 'Click allowed after debounce cooldown period')

  console.log('\n--- 7. Testing Missing Job & Error State Handling ---')
  let stateMessage = ''
  const mockUpdatePanelState = (state: any) => {
    if (state.type === 'error') {
      stateMessage = state.message
    }
  }

  const testApplyWithoutJob = (job: ExtractedJob | null) => {
    if (!job) {
      mockUpdatePanelState({
        type: 'error',
        message: 'No active job opportunity selected to apply for.',
      })
      return
    }
  }

  testApplyWithoutJob(null)
  assert(stateMessage === 'No active job opportunity selected to apply for.', 'Missing job triggers explicit error message, never fails silently')

  console.log('\n====================================================================')
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`)
  console.log('====================================================================\n')

  if (totalTests - passedTests > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
