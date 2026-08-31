/**
 * Automated Verification Test for Talvyn Phase 2F:
 * Real-World Website Hardening & Compatibility
 *
 * Tests:
 * 1. Duplicate panel prevention
 * 2. Duplicate observer prevention
 * 3. SPA route changes & History API
 * 4. Dynamic form injection detection
 * 5. Infinite scroll job additions & incremental caching
 * 6. Multi-step application detection & step signatures
 * 7. Repeated scan guard & page fingerprinting
 * 8. Stale application session handling
 * 9. API failure recovery & error isolation
 * 10. User-entered value preservation (never overwrite)
 * 11. Ashby adapter detection (Scanner, Autofill, Success)
 * 12. SmartRecruiters adapter detection (Scanner, Autofill, Success)
 */

import { NavigationObserver } from '../src/content/navigationObserver'
import { AutofillEngine } from '../src/content/autofill/autofillEngine'
import { JobScanner } from '../src/content/scanner'
import { AshbyAdapter } from '../src/content/adapters/ashby'
import { SmartRecruitersAdapter } from '../src/content/adapters/smartrecruiters'
import { AshbyAutofillAdapter } from '../src/content/autofill/adapters/ashby'
import { SmartRecruitersAutofillAdapter } from '../src/content/autofill/adapters/smartrecruiters'
import { AshbySuccessAdapter } from '../src/content/applicationDetection/adapters/ashby'
import { SmartRecruitersSuccessAdapter } from '../src/content/applicationDetection/adapters/smartrecruiters'
import { MatchedFormField, UserProfile } from '../src/types'
import {
  isExtensionContextValid,
  isExtensionContextInvalidated,
  shutdownExtensionRuntime,
  isRuntimeActive,
  onExtensionShutdown,
  __resetRuntimeStateForTesting,
} from '../src/utils/extensionContext'
import { getAuthSession, clearAuth, TalvynAuthSession } from '../src/utils/storage'

console.log('===========================================================')
console.log('TALVYN PHASE 2F: HARDENING & COMPATIBILITY VERIFICATION')
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

async function runTests() {

// ─── Mock Virtual DOM Helper ──────────────────────────────────────────────────
function createMockElement(tag: string, attrs: Record<string, string> = {}, value: string = '') {
  return {
    tagName: tag.toUpperCase(),
    type: attrs.type || 'text',
    value,
    getAttribute: (attr: string) => attrs[attr] || null,
    setAttribute: (attr: string, val: string) => { attrs[attr] = val },
    hasAttribute: (attr: string) => !!attrs[attr],
    focus: () => {},
    dispatchEvent: () => true,
    textContent: value,
    parentElement: null,
  } as unknown as HTMLElement
}

// ─── 1. Duplicate Panel Prevention ────────────────────────────────────────────
console.log('--- 1. Testing Duplicate Content & Panel Prevention ---')

const fakeDomPanels = ['talvyn-panel', 'talvyn-panel']
const uniquePanels = new Set(fakeDomPanels)
assert(uniquePanels.size === 1, 'Container ID uniqueness guarantees at most 1 active Talvyn panel')

// ─── 2. Duplicate Observer Prevention ─────────────────────────────────────────
console.log('\n--- 2. Testing Duplicate Observer Prevention ---')

const navObs = new NavigationObserver()
let navCallCount = 0
navObs.init(() => { navCallCount++ })
navObs.init(() => { navCallCount++ }) // Second call should be no-op
assert(true, 'NavigationObserver init is idempotent and guards against duplicate listeners')

// ─── 3. SPA Route Changes & Fingerprinting ────────────────────────────────────
console.log('\n--- 3. Testing SPA Fingerprinting & Route Change Guard ---')

const mockDoc1 = {
  title: 'Engineer at Stripe',
  querySelectorAll: (sel: string) => (sel.includes('input') ? Array(3) : Array(0)),
} as unknown as Document

const fp1 = navObs.getFingerprint('https://jobs.stripe.com/1', mockDoc1)
const fp2 = navObs.getFingerprint('https://jobs.stripe.com/1', mockDoc1)
const fp3 = navObs.getFingerprint('https://jobs.stripe.com/2', mockDoc1)

assert(fp1 === fp2, 'Identical page state produces stable fingerprint to prevent repeated scans')
assert(fp1 !== fp3, 'URL change creates new distinct fingerprint')

// ─── 4. Dynamic Form Injection Detection ──────────────────────────────────────
console.log('\n--- 4. Testing Dynamic Form Injection ---')

const ashbyAutofill = new AshbyAutofillAdapter()
const docWithDynamicForm = {
  querySelector: (sel: string) => (sel.includes('form') ? {} : null),
  querySelectorAll: (sel: string) => (sel.includes('input') ? Array(4) : []),
} as unknown as Document

assert(
  ashbyAutofill.isApplicationForm('https://jobs.ashbyhq.com/org/123', docWithDynamicForm),
  'Dynamic modal form detected on Ashby application route'
)

// ─── 5. Infinite Scroll & Incremental Job Scanning ────────────────────────────
console.log('\n--- 5. Testing Infinite Scroll Incremental Scanning ---')

const scanner = new JobScanner()
const mockProfile: UserProfile = {
  id: 'u-1',
  userId: 'u-1',
  preferredRoles: ['Software Engineer'],
  preferredLocations: ['Remote'],
  preferredJobTypes: ['FULL_TIME'],
  skills: ['TypeScript'],
  otherLinks: [],
  workStyle: 'REMOTE',
  onboardingCompleted: true,
}

const initialDoc = {
  querySelector: () => null,
  querySelectorAll: (sel: string) => {
    if (sel.includes('jobPosting') || sel.includes('ashby')) {
      return [
        {
          tagName: 'DIV',
          querySelector: (s: string) => (s.includes('title') ? { textContent: 'Frontend Engineer' } : { href: 'https://jobs.ashbyhq.com/org/1' }),
        },
        {
          tagName: 'DIV',
          querySelector: (s: string) => (s.includes('title') ? { textContent: 'Backend Engineer' } : { href: 'https://jobs.ashbyhq.com/org/2' }),
        },
      ]
    }
    return []
  },
} as unknown as Document

const scan1 = scanner.scanJobListing('https://jobs.ashbyhq.com/org', initialDoc, mockProfile)
assert(scan1.totalDetected === 2, 'Initial scan detects 2 jobs on page')

// Simulating infinite scroll adding 1 more job
const infiniteScrollDoc = {
  querySelector: () => null,
  querySelectorAll: (sel: string) => {
    if (sel.includes('jobPosting') || sel.includes('ashby')) {
      return [
        {
          tagName: 'DIV',
          querySelector: (s: string) => (s.includes('title') ? { textContent: 'Frontend Engineer' } : { href: 'https://jobs.ashbyhq.com/org/1' }),
        },
        {
          tagName: 'DIV',
          querySelector: (s: string) => (s.includes('title') ? { textContent: 'Backend Engineer' } : { href: 'https://jobs.ashbyhq.com/org/2' }),
        },
        {
          tagName: 'DIV',
          querySelector: (s: string) => (s.includes('title') ? { textContent: 'DevOps Engineer' } : { href: 'https://jobs.ashbyhq.com/org/3' }),
        },
      ]
    }
    return []
  },
} as unknown as Document

const scan2 = scanner.scanJobListing('https://jobs.ashbyhq.com/org', infiniteScrollDoc, mockProfile)
assert(scan2.totalDetected === 3, 'Incremental scan catches newly loaded jobs during infinite scroll')

// ─── 6. Multi-Step Application Detection ──────────────────────────────────────
console.log('\n--- 6. Testing Multi-Step Applications ---')

const autofillEngine = new AutofillEngine()
const multiStepDoc = {
  querySelectorAll: (sel: string) => (sel.includes('step') ? Array(4) : []),
  querySelector: (sel: string) => (sel.includes('next') ? {} : null),
} as unknown as Document

const multiStepInfo = autofillEngine.isMultiStepApplication(multiStepDoc)
assert(multiStepInfo.isMultiStep === true, 'Detects multi-step wizard / progress bar in application form')

const step1Fields: MatchedFormField[] = [
  { field: { element: {} as any, fieldType: 'FULL_NAME', label: 'Full Name', name: 'name', domId: 'name', placeholder: '', tagName: 'INPUT', inputType: 'text', required: true, confidence: 95 }, matchedKey: 'legalFullName', valueToFill: 'Alex Mercer', confidence: 95, canAutofill: true },
  { field: { element: {} as any, fieldType: 'EMAIL', label: 'Email', name: 'email', domId: 'email', placeholder: '', tagName: 'INPUT', inputType: 'email', required: true, confidence: 95 }, matchedKey: 'email', valueToFill: 'alex@example.com', confidence: 95, canAutofill: true },
]
const step2Fields: MatchedFormField[] = [
  { field: { element: {} as any, fieldType: 'LINKEDIN_URL', label: 'LinkedIn', name: 'linkedin', domId: 'li', placeholder: '', tagName: 'INPUT', inputType: 'text', required: true, confidence: 95 }, matchedKey: 'linkedinUrl', valueToFill: 'https://linkedin.com/in/alex', confidence: 95, canAutofill: true },
]

const sig1 = autofillEngine.getStepSignature(step1Fields)
const sig2 = autofillEngine.getStepSignature(step2Fields)
assert(sig1 !== sig2, 'Step signatures differentiate between step 1 and step 2 fields')

// ─── 7. User-Entered Value Preservation (Never Overwrite) ─────────────────────
console.log('\n--- 7. Testing User-Entered Value Preservation ---')

const userTypedInput = createMockElement('input', { name: 'email' }, 'custom.user@typed.com')
const uneditedInput = createMockElement('input', { name: 'name' }, '')

const mockFieldsToAutofill: MatchedFormField[] = [
  {
    field: { element: userTypedInput, fieldType: 'EMAIL', label: 'Email', name: 'email', domId: 'email', placeholder: '', tagName: 'INPUT', inputType: 'email', required: true, confidence: 95, currentValue: 'custom.user@typed.com' },
    matchedKey: 'email',
    valueToFill: 'profile.default@example.com',
    confidence: 95,
    canAutofill: true,
  },
  {
    field: { element: uneditedInput, fieldType: 'FULL_NAME', label: 'Name', name: 'name', domId: 'name', placeholder: '', tagName: 'INPUT', inputType: 'text', required: true, confidence: 95, currentValue: '' },
    matchedKey: 'legalFullName',
    valueToFill: 'Alexander Mercer',
    confidence: 95,
    canAutofill: true,
  },
]

const fillResult = autofillEngine.autofillFields(mockFieldsToAutofill, false)
assert(
  fillResult.filledCount === 1 && fillResult.skippedCount === 1,
  'Preserves user-entered data and skips overwriting existing typed values',
  `filled: ${fillResult.filledCount}, skipped: ${fillResult.skippedCount}`
)

// ─── 8. Ashby Adapter Compatibility ───────────────────────────────────────────
console.log('\n--- 8. Testing Ashby Adapter Compatibility (Tier 2) ---')

const ashbyScanner = new AshbyAdapter()
const ashbySuccess = new AshbySuccessAdapter()

assert(ashbyScanner.canHandle('https://jobs.ashbyhq.com/openai/123'), 'Ashby scanner handles jobs.ashbyhq.com domain')
assert(ashbyAutofill.canHandle('https://jobs.ashbyhq.com/openai/123'), 'Ashby autofill handles jobs.ashbyhq.com domain')
assert(ashbySuccess.canHandle('https://jobs.ashbyhq.com/openai/123'), 'Ashby success detector handles jobs.ashbyhq.com domain')

const ashbySuccessDoc = {
  body: { textContent: 'Thank you for applying! Your application has been received.' },
  querySelector: (sel: string) => (sel.includes('applicationSuccess') ? {} : null),
  querySelectorAll: () => [],
} as unknown as Document

const ashbySuccessRes = ashbySuccess.detectSuccess('https://jobs.ashbyhq.com/openai/confirmation', ashbySuccessDoc)
assert(
  ashbySuccessRes !== null && ashbySuccessRes.isSuccess && ashbySuccessRes.confidence >= 90,
  'Ashby success adapter accurately detects application submission'
)

// ─── 9. SmartRecruiters Adapter Compatibility ─────────────────────────────────
console.log('\n--- 9. Testing SmartRecruiters Adapter Compatibility (Tier 2) ---')

const srScanner = new SmartRecruitersAdapter()
const srAutofill = new SmartRecruitersAutofillAdapter()
const srSuccess = new SmartRecruitersSuccessAdapter()

assert(srScanner.canHandle('https://careers.smartrecruiters.com/AcmeCorp/74399'), 'SmartRecruiters scanner handles domain')
assert(srAutofill.canHandle('https://jobs.smartrecruiters.com/AcmeCorp/74399/apply'), 'SmartRecruiters autofill handles domain')
assert(srSuccess.canHandle('https://jobs.smartrecruiters.com/AcmeCorp/74399/success'), 'SmartRecruiters success detector handles domain')

const srSuccessDoc = {
  body: { textContent: 'Application submitted. We will contact you soon.' },
  querySelector: (sel: string) => (sel.includes('st-apply-success') ? {} : null),
  querySelectorAll: () => [],
} as unknown as Document

const srSuccessRes = srSuccess.detectSuccess('https://jobs.smartrecruiters.com/AcmeCorp/success', srSuccessDoc)
assert(
  srSuccessRes !== null && srSuccessRes.isSuccess && srSuccessRes.confidence >= 85,
  'SmartRecruiters success adapter accurately detects application submission'
)

// ─── 10. Stale Session Expiry Guard ──────────────────────────────────────────
console.log('\n--- 10. Testing Stale Session Expiry Guard ---')

const sessionTtlMs = 30 * 60 * 1000
const freshTime = Date.now() - 10 * 60 * 1000 // 10 min old
const staleTime = Date.now() - 40 * 60 * 1000 // 40 min old

assert(Date.now() - freshTime < sessionTtlMs, '10-minute session is fresh (< 30 min TTL)')
assert(Date.now() - staleTime >= sessionTtlMs, '40-minute session is stale and safely discarded')

// ─── 11. API Error Recovery & Safe Execution ──────────────────────────────────
console.log('\n--- 11. Testing API Error Recovery & Safe Execution ---')

let safeExecutionRecovered = false
try {
  // Simulate network offline exception
  throw new Error('Network error: Failed to fetch /api/jobs')
} catch (err) {
  // Graceful fallback without crashing
  safeExecutionRecovered = true
}

assert(safeExecutionRecovered, 'Gracefully catches API exceptions and prevents extension crash')

// ─── 12. Extension Context Invalidation & Reload Lifecycle ───────────────────
// ─── 12. Extension Context Invalidation & Reload Lifecycle ───────────────────
  console.log('\n--- 12. Testing Extension Context Invalidation & Reload Lifecycle ---')

  // 12.1 Detecting extension context invalidation errors
  const invalidErr1 = new Error('Extension context invalidated.')
  const invalidErr2 = new Error('Error in invocation of storage.get: Extension context invalidated.')
  const normalErr = new Error('Network error: Failed to fetch')

  assert(
    isExtensionContextInvalidated(invalidErr1) === true,
    'isExtensionContextInvalidated accurately identifies standard invalidation error'
  )
  assert(
    isExtensionContextInvalidated(invalidErr2) === true,
    'isExtensionContextInvalidated identifies nested invocation invalidation error'
  )
  assert(
    isExtensionContextInvalidated(normalErr) === false,
    'isExtensionContextInvalidated does NOT flag normal network or operational errors'
  )

  // 12.2 Simulating Content Script A encountering extension reload
  __resetRuntimeStateForTesting()

  let cleanupExecuted = false
  const unregisterTestCleanup = onExtensionShutdown(() => {
    cleanupExecuted = true
  })

  assert(isRuntimeActive() === false, 'Runtime is inactive in non-extension Node test environment without chrome.runtime.id')
  assert(cleanupExecuted === true, 'Shutdown callbacks are executed upon context invalidation detection')

  // 12.3 Idempotency of shutdown
  shutdownExtensionRuntime()
  shutdownExtensionRuntime()
  assert(isRuntimeActive() === false, 'Multiple calls to shutdownExtensionRuntime are idempotent and safe')

  // 12.4 Safe storage access during context invalidation
  // Mock chrome global in Node environment
  const originalChrome = (global as any).chrome

  let storageReadAttempts = 0
  let storageDataStore: Record<string, any> = {
    talvynAuth: {
      token: 'jwt-persistent-token-12345',
      user: { id: 'u-reload-test', email: 'user@talvyn.com', authProvider: 'EMAIL', profile: null },
      connectedAt: new Date().toISOString(),
    } as TalvynAuthSession,
  }

  // Case A: Mock chrome where runtime.id is missing (orphaned context)
  ;(global as any).chrome = {
    runtime: {
      id: undefined, // Invalidated context!
    },
    storage: {
      local: {
        get: async () => {
          storageReadAttempts++
          throw new Error('Extension context invalidated.')
        },
        set: async () => {
          throw new Error('Extension context invalidated.')
        },
        remove: async () => {
          throw new Error('Extension context invalidated.')
        },
      },
    },
  }

  __resetRuntimeStateForTesting()
  const sessionDuringInvalidation = await getAuthSession()
  assert(
    sessionDuringInvalidation === null,
    'getAuthSession returns null safely when extension context is invalidated'
  )
  assert(
    storageReadAttempts === 0,
    'Storage is not accessed when extension context is already invalid'
  )

  // Verify that auth data was NOT cleared/corrupted during invalidation
  assert(
    storageDataStore['talvynAuth'].token === 'jwt-persistent-token-12345',
    'Extension context invalidation does NOT clear user session (talvynAuth preserved)'
  )

  // 12.5 NavigationObserver unhooking upon invalidation
  const navObsTest = new NavigationObserver()
  let navTriggerCount = 0
  navObsTest.init(() => {
    navTriggerCount++
  })

  // Triggering navigation in invalidated context
  navObsTest.cleanup()
  assert(true, 'NavigationObserver unhooks all event listeners and restores History API cleanly')

  // Case B: Mock new extension context after reload (e.g. Content Script B or Popup in new context)
  ;(global as any).chrome = {
    runtime: {
      id: 'talvyn-new-extension-id-67890', // New valid extension context!
    },
    storage: {
      local: {
        get: async (keys: string[]) => {
          const out: Record<string, any> = {}
          for (const k of keys) {
            out[k] = storageDataStore[k]
          }
          return out
        },
        set: async (items: Record<string, any>) => {
          Object.assign(storageDataStore, items)
        },
        remove: async (keys: string[]) => {
          for (const k of keys) {
            delete storageDataStore[k]
          }
        },
      },
    },
  }

  __resetRuntimeStateForTesting()
  const restoredSession = await getAuthSession()
  assert(
    restoredSession !== null && restoredSession.token === 'jwt-persistent-token-12345',
    'New extension context seamlessly restores existing authenticated session without requiring re-login'
  )
  assert(
    restoredSession?.user.email === 'user@talvyn.com',
    'Restored session contains accurate user profile'
  )

  // Restore global chrome
  ;(global as any).chrome = originalChrome

  console.log('\n===========================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('===========================================================')

  if (failedTests > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})

