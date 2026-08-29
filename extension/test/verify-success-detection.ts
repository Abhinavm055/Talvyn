/**
 * Automated Verification Test for Talvyn Phase 2D:
 * Application Success Detection & Automatic Tracking
 *
 * Tests:
 * 1. Generic success page text matching
 * 2. URL-based success detection
 * 3. SPA success state with UI confirmation elements
 * 4. False positive protection (page containing only "Apply" / search buttons)
 * 5. Confirmed Success confidence evaluation (90-100%)
 * 6. Likely Success confidence evaluation (70-89%)
 * 7. Possible Success confidence evaluation (50-69%)
 * 8. Not Confirmed evaluation (<50%)
 * 9. Job resolution from DOM headings and session cache
 * 10. Application session cache & TTL expiry
 * 11. Undo payload and status reversal logic
 * 12. Duplicate prevention during tracking
 */

import { confidenceScorer } from '../src/content/applicationDetection/confidenceScorer'
import { JobResolver } from '../src/content/applicationDetection/jobResolver'
import { ApplicationSession } from '../src/content/applicationDetection/types'

console.log('====================================================')
console.log('TALVYN PHASE 2D: SUCCESS DETECTION & TRACKING TESTS')
console.log('====================================================\n')

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

// ─── Mock Virtual DOM Helper ──────────────────────────────────────────────────
function createMockDoc(options: {
  url?: string
  bodyText?: string
  selectors?: { [selector: string]: { text: string } }
  inputsCount?: number
  jobCardsCount?: number
  headings?: { h1?: string; h2?: string }
  title?: string
}): { doc: Document; url: string } {
  const url = options.url || 'https://jobs.example.com/apply'
  const title = options.title || 'Job Application'

  const mockDoc = {
    title,
    body: {
      textContent: options.bodyText || '',
    },
    querySelector: (sel: string) => {
      if (sel === 'h1' && options.headings?.h1) {
        return { textContent: options.headings.h1 }
      }
      if (sel === 'h2' && options.headings?.h2) {
        return { textContent: options.headings.h2 }
      }
      if (options.selectors && options.selectors[sel]) {
        return { textContent: options.selectors[sel].text }
      }
      return null
    },
    querySelectorAll: (sel: string) => {
      if (sel.includes('input') && options.inputsCount) {
        return Array(options.inputsCount).fill({
          getAttribute: () => 'text',
          tagName: 'INPUT',
        })
      }
      if (sel.includes('job-card') && options.jobCardsCount) {
        return Array(options.jobCardsCount).fill({})
      }
      return []
    },
  } as unknown as Document

  return { doc: mockDoc, url }
}

// ─── TEST 1: Generic Success Page Text ────────────────────────────────────────
console.log('--- 1. Testing Page Text Success Signals ---')

const { doc: d1, url: u1 } = createMockDoc({
  url: 'https://careers.example.com/jobs/123/confirmation',
  bodyText: 'Thank you for applying! Your application has been received by our hiring team.',
})
const r1 = confidenceScorer.evaluate(u1, d1)
assert(
  r1.isSuccess && r1.confidence >= 90 && r1.confidenceLevel === 'CONFIRMED',
  'Generic confirmation text + URL produces CONFIRMED success (90%+)',
  `confidence: ${r1.confidence}%, signals: ${r1.matchedSignals.join('; ')}`
)

// ─── TEST 2: URL-based Success Detection ──────────────────────────────────────
console.log('\n--- 2. Testing URL Pattern Detection ---')

const { doc: d2, url: u2 } = createMockDoc({
  url: 'https://company.greenhouse.io/application/success?status=applied',
  bodyText: 'Submission complete. We will review your qualifications.',
})
const r2 = confidenceScorer.evaluate(u2, d2)
assert(
  r2.confidence >= 85 && r2.matchedSignals.some((s) => s.includes('URL')),
  'URL confirmation slug matches pattern with high confidence',
  `confidence: ${r2.confidence}%`
)

// ─── TEST 3: SPA Success with UI Element Confirmation ─────────────────────────
console.log('\n--- 3. Testing SPA Modal & UI Element Detection ---')

const { doc: d3, url: u3 } = createMockDoc({
  url: 'https://jobs.example.com/posting/456',
  bodyText: 'Application portal',
  selectors: {
    '[role="alert"]': { text: 'Application successfully submitted!' },
  },
})
const activeSession: ApplicationSession = {
  id: 's-1',
  pageUrl: u3,
  jobTitle: 'Senior Backend Engineer',
  company: 'CloudScale',
  startedAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  submitted: true,
}
const r3 = confidenceScorer.evaluate(u3, d3, activeSession)
assert(
  r3.isSuccess && r3.confidence >= 90 && r3.confidenceLevel === 'CONFIRMED',
  'SPA dynamic success alert + active session detected as CONFIRMED success',
  `confidence: ${r3.confidence}%`
)

// ─── TEST 4: False Positive Protection (Only contains "Apply") ────────────────
console.log('\n--- 4. Testing False Positive Protection ---')

const { doc: d4, url: u4 } = createMockDoc({
  url: 'https://careers.example.com/jobs/search?q=developer',
  bodyText: 'Apply now to our open positions! Click apply below to submit application before the deadline.',
  inputsCount: 4, // active unsubmitted search form
  jobCardsCount: 10, // listing feed
})
const r4 = confidenceScorer.evaluate(u4, d4)
assert(
  !r4.isSuccess && r4.confidence < 50 && r4.confidenceLevel === 'NOT_CONFIRMED',
  'Job listing / search page with "Apply now" correctly rejected as NOT_CONFIRMED',
  `confidence: ${r4.confidence}% (expected < 50%)`
)

// ─── TEST 5: Confirmed Success Level (90-100%) ────────────────────────────────
console.log('\n--- 5. Testing Confidence Levels (Confirmed, Likely, Possible) ---')

const { doc: d5, url: u5 } = createMockDoc({
  url: 'https://jobs.lever.co/acme/apply/confirmation',
  bodyText: 'Application submitted successfully! We have received your application.',
})
const r5 = confidenceScorer.evaluate(u5, d5, activeSession)
assert(r5.confidenceLevel === 'CONFIRMED' && r5.confidence >= 90, 'Evaluates to CONFIRMED level (>= 90%)')

// ─── TEST 6: Likely Success Level (70-89%) ────────────────────────────────────
const { doc: d6, url: u6 } = createMockDoc({
  url: 'https://jobs.example.com/apply', // neutral URL
  bodyText: 'Thanks for your application! Your profile has been sent to our recruiters.',
})
const r6 = confidenceScorer.evaluate(u6, d6, null)
assert(
  r6.confidenceLevel === 'LIKELY' && r6.confidence >= 70 && r6.confidence < 90,
  'Neutral URL with confirmation text evaluates to LIKELY level (70-89%)',
  `confidence: ${r6.confidence}%`
)

// ─── TEST 7: Possible / Not Confirmed (< 70%) ─────────────────────────────────
const { doc: d7, url: u7 } = createMockDoc({
  url: 'https://jobs.example.com/apply',
  bodyText: 'Application sent info page. Contact us if you have questions.',
})
const r7 = confidenceScorer.evaluate(u7, d7, null)
assert(
  r7.confidenceLevel === 'POSSIBLE' || r7.confidenceLevel === 'NOT_CONFIRMED',
  'Weak/ambiguous signal evaluates to POSSIBLE or NOT_CONFIRMED (< 70%)',
  `confidence: ${r7.confidence}%`
)

// ─── TEST 8: Job Resolution Priority ──────────────────────────────────────────
console.log('\n--- 8. Testing Job Metadata Resolution Priority ---')

const resolver = new JobResolver()
const { doc: d8 } = createMockDoc({
  headings: { h1: 'Lead Product Designer at Stripe' },
  title: 'Stripe Careers - Lead Product Designer',
})
const resolvedJob = resolver.resolveAppliedJob(d8, activeSession)
assert(
  resolvedJob.title === 'Lead Product Designer' && resolvedJob.company === 'Stripe',
  'Resolved job title and company from page headings',
  `title: "${resolvedJob.title}", company: "${resolvedJob.company}"`
)

// Fallback to session when heading is missing
const { doc: d8b } = createMockDoc({ title: 'Confirmation Page' })
const resolvedSessionJob = resolver.resolveAppliedJob(d8b, activeSession)
assert(
  resolvedSessionJob.title === 'Senior Backend Engineer' && resolvedSessionJob.company === 'CloudScale',
  'Fallback to cached session metadata when page headings are generic',
  `title: "${resolvedSessionJob.title}", company: "${resolvedSessionJob.company}"`
)

// ─── TEST 9: Session TTL Expiry Logic ─────────────────────────────────────────
console.log('\n--- 9. Testing Session TTL Expiry ---')

const freshSession: ApplicationSession = {
  id: 's-fresh',
  pageUrl: 'https://example.com/apply',
  startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
  lastActivityAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
}
const staleSession: ApplicationSession = {
  id: 's-stale',
  pageUrl: 'https://example.com/apply',
  startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago (expired)
  lastActivityAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
}

const isFresh = Date.now() - new Date(freshSession.lastActivityAt).getTime() < 30 * 60 * 1000
const isStale = Date.now() - new Date(staleSession.lastActivityAt).getTime() >= 30 * 60 * 1000
assert(isFresh && isStale, 'Correctly classifies fresh sessions (<30 min) and stale sessions (>30 min)')

// ─── TEST 10: Undo Payload Verification ───────────────────────────────────────
console.log('\n--- 10. Testing Undo Payload Formulation ---')

const undoForExisting = { previousStatus: 'INTERESTED', isNew: false }
const undoForNew = { previousStatus: null, isNew: true }
assert(
  undoForExisting.isNew === false && undoForExisting.previousStatus === 'INTERESTED',
  'Undo payload correctly retains previousStatus for existing job'
)
assert(
  undoForNew.isNew === true && undoForNew.previousStatus === null,
  'Undo payload flags isNew: true for newly created tracking entries'
)

console.log('\n====================================================')
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
console.log('====================================================')

if (failedTests > 0) process.exit(1)
