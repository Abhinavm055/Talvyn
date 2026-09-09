/**
 * Verification Test: Custom Elements & Malformed Selector Protection
 *
 * Verifies:
 * 1. findJobCardCandidates() does NOT throw on pages with custom elements (e.g. <app-job-card>)
 * 2. classifyPage() does NOT throw on pages with custom elements
 * 3. Custom elements (e.g. Angular <app-*>, web components) participate in candidate discovery
 * 4. safeQuerySelectorAll catches malformed/invalid selectors and never crashes the pipeline
 * 5. Universal job detection pipeline continues normally across normal HTML, custom elements, and listings
 */

import { JSDOM } from 'jsdom'
import {
  findJobCardCandidates,
  isLikelyJobListing,
  safeQuerySelectorAll,
  safeQuerySelector,
} from '../src/content/jobEvidenceDetector'
import { jobScanner } from '../src/content/scanner'

console.log('====================================================================')
console.log('TALVYN: CUSTOM ELEMENTS & SELECTOR EXCEPTION REGRESSION TESTS')
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

// ─── 1. Testing Raw DOM querySelectorAll vs safeQuerySelectorAll ───
console.log('--- 1. Testing Raw DOM querySelectorAll vs safeQuerySelectorAll ---')
const rawDom = new JSDOM('<!DOCTYPE html><html><body><div class="test">Hello</div></body></html>')
const rawDoc = rawDom.window.document

let rawSelectorThrew = false
try {
  rawDoc.querySelectorAll(':invalid-syntax((')
} catch (err: any) {
  rawSelectorThrew = true
  assert(
    err.name === 'SyntaxError' || String(err).includes('SyntaxError') || String(err).includes('not a valid selector'),
    'Raw DOM querySelectorAll strictly throws SyntaxError on invalid CSS selector syntax',
    err.message
  )
}
assert(rawSelectorThrew, 'Confirmed: Invalid CSS selectors throw SyntaxError in DOM engines')

// Verify safeQuerySelectorAll catches syntax errors and returns []
const safeResult = safeQuerySelectorAll(rawDoc, ':invalid-syntax((')
assert(Array.isArray(safeResult) && safeResult.length === 0, 'safeQuerySelectorAll catches syntax errors and safely returns empty array')

// Verify safeQuerySelectorAll with app-* safely returns array without throwing
const appWildcardResult = safeQuerySelectorAll(rawDoc, 'ul, ol, app-*')
assert(Array.isArray(appWildcardResult), 'safeQuerySelectorAll with app-* returns safely without throwing')

// Verify safeQuerySelector catches invalid selector and returns null
const safeSingle = safeQuerySelector(rawDoc, ':invalid-syntax((')
assert(safeSingle === null, 'safeQuerySelector catches invalid selector and safely returns null')

// ─── 2. Custom Elements Discovery Without Throwing ───────────────────────────
console.log('\n--- 2. Testing Custom Element <app-job-card> Discovery ---')

const angularAppHtml = `
<!DOCTYPE html>
<html>
<head><title>Engineering Careers at TechCorp</title></head>
<body>
  <app-root>
    <main>
      <h1>Open Positions</h1>
      <app-job-list class="job-results">
        <app-job-card class="opportunity">
          <h3>Software Engineer</h3>
          <span class="company">TechCorp</span>
          <span class="location">Bengaluru, India (Hybrid)</span>
          <p class="description">We are looking for a Software Engineer with 2+ years experience in TypeScript and React.</p>
          <a href="/jobs/101/apply">Apply Now</a>
        </app-job-card>

        <app-job-card class="opportunity">
          <h3>Data Analyst</h3>
          <span class="company">TechCorp</span>
          <span class="location">Remote</span>
          <p class="description">Seeking a Data Analyst with SQL and Python skills. Full time role with competitive compensation.</p>
          <a href="/jobs/102/apply">Apply Now</a>
        </app-job-card>

        <app-job-card class="opportunity">
          <h3>Product Manager</h3>
          <span class="company">TechCorp</span>
          <span class="location">Mumbai, India</span>
          <p class="description">Leading product initiatives across cross-functional engineering and design teams.</p>
          <a href="/jobs/103/apply">Apply Now</a>
        </app-job-card>
      </app-job-list>
    </main>
  </app-root>
</body>
</html>
`

const angularDom = new JSDOM(angularAppHtml, { url: 'https://techcorp.com/careers/openings' })
const angularDoc = angularDom.window.document

// 1. findJobCardCandidates() must NOT throw
let candidatesThrew = false
let candidates: HTMLElement[] = []
try {
  candidates = findJobCardCandidates(angularDoc as unknown as Document)
} catch (err) {
  candidatesThrew = true
  console.error('findJobCardCandidates threw an unexpected error:', err)
}

assert(!candidatesThrew, 'findJobCardCandidates() does NOT throw on DOM containing <app-job-card>')
assert(candidates.length >= 2, `Discovered candidate job cards from custom elements (Found: ${candidates.length})`)

const foundAppJobCards = candidates.filter((c) => c.tagName.toLowerCase() === 'app-job-card')
assert(foundAppJobCards.length >= 2, `Custom <app-job-card> elements successfully discovered as candidates (Count: ${foundAppJobCards.length})`)

// 2. isLikelyJobListing() must NOT throw and return true
let listingEvidenceThrew = false
let isListing = false
try {
  isListing = isLikelyJobListing(angularDoc as unknown as Document, 'https://techcorp.com/careers/openings')
} catch (err) {
  listingEvidenceThrew = true
  console.error('isLikelyJobListing threw:', err)
}

assert(!listingEvidenceThrew, 'isLikelyJobListing() does NOT throw on DOM containing custom elements')
assert(isListing, 'isLikelyJobListing() identifies custom element repeated job cards as a job listing')

// 3. classifyPage() must NOT throw and classify as JOB_LIST
let classifyThrew = false
let classificationResult: any = null
try {
  jobScanner.clearCache()
  classificationResult = jobScanner.classifyPage('https://techcorp.com/careers/openings', angularDoc as unknown as Document)
} catch (err) {
  classifyThrew = true
  console.error('classifyPage threw:', err)
}

assert(!classifyThrew, 'classifyPage() does NOT throw on page with custom elements')
assert(
  classificationResult?.classification === 'JOB_LIST',
  `classifyPage() classifies custom element page as JOB_LIST (Got: ${classificationResult?.classification})`
)

// ─── 3. Single Custom Element Job Detail Page ────────────────────────────────
console.log('\n--- 3. Testing Single Custom Element Job Detail Page ---')

const singleCustomJobHtml = `
<!DOCTYPE html>
<html>
<head><title>Senior Frontend Engineer - Acme Corp</title></head>
<body>
  <app-root>
    <main>
      <app-job-detail>
        <h1>Senior Frontend Engineer</h1>
        <div class="company">Acme Corp</div>
        <div class="location">Bengaluru, India</div>
        <div class="salary">₹25,00,000 - ₹35,00,000 PA</div>
        <div class="job-type">Full Time</div>
        <div class="experience">3+ years of experience</div>
        <div class="description">
          <h2>Job Responsibilities</h2>
          <p>You will build web applications using React, TypeScript, and modern CSS.</p>
          <h2>Qualifications and Requirements</h2>
          <p>Bachelor degree in Computer Science or equivalent. 3+ years experience.</p>
        </div>
        <button class="apply-button">Apply Now</button>
      </app-job-detail>
    </main>
  </app-root>
</body>
</html>
`

const singleDom = new JSDOM(singleCustomJobHtml, { url: 'https://acme.com/jobs/senior-frontend-engineer' })
const singleDoc = singleDom.window.document

let singleClassifyThrew = false
let singleClassification: any = null
try {
  jobScanner.clearCache()
  singleClassification = jobScanner.classifyPage('https://acme.com/jobs/senior-frontend-engineer', singleDoc as unknown as Document)
} catch (err) {
  singleClassifyThrew = true
  console.error('single classifyPage threw:', err)
}

assert(!singleClassifyThrew, 'classifyPage() does not throw on single job detail with custom elements')
assert(
  singleClassification?.classification === 'SINGLE_JOB',
  `classifyPage() identifies single job with custom elements as SINGLE_JOB (Got: ${singleClassification?.classification})`
)

// ─── 4. Non-Job Page with Custom Elements (e.g. Video / Social App) ─────────
console.log('\n--- 4. Testing Non-Job Page with Custom Elements ---')

const nonJobCustomHtml = `
<!DOCTYPE html>
<html>
<head><title>Video Feed - MediaApp</title></head>
<body>
  <app-root>
    <app-header><nav>Home | Trending | Subscriptions</nav></app-header>
    <app-video-feed>
      <app-video-card>
        <h4>Funny Cats Compilation</h4>
        <span>1.5M views • 3 days ago</span>
      </app-video-card>
      <app-video-card>
        <h4>Cooking Tutorial</h4>
        <span>200K views • 1 week ago</span>
      </app-video-card>
    </app-video-feed>
  </app-root>
</body>
</html>
`

const nonJobDom = new JSDOM(nonJobCustomHtml, { url: 'https://mediaapp.com/feed' })
const nonJobDoc = nonJobDom.window.document

let nonJobClassifyThrew = false
let nonJobClassification: any = null
try {
  jobScanner.clearCache()
  nonJobClassification = jobScanner.classifyPage('https://mediaapp.com/feed', nonJobDoc as unknown as Document)
} catch (err) {
  nonJobClassifyThrew = true
  console.error('nonJob classifyPage threw:', err)
}

assert(!nonJobClassifyThrew, 'classifyPage() does not throw on non-job custom element page')
assert(
  nonJobClassification?.classification === 'OTHER',
  `classifyPage() classifies non-job custom element app as OTHER (Got: ${nonJobClassification?.classification})`
)

console.log('\n====================================================================')
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
console.log('====================================================================')

if (failed > 0) {
  process.exit(1)
}
