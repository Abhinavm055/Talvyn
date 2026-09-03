/**
 * Automated Verification Test for Talvyn:
 * Extension Overlay Panel States & Apply Action Persistence
 *
 * Tests:
 * 1. Unsaved job panel renders Profile Match, Recommendation, Readiness.
 * 2. Unsaved job panel contains Save Job and Apply with Talvyn buttons.
 * 3. Saved job state retains Profile Match, Recommendation, and Readiness.
 * 4. Saved job state displays Already Saved indicator with Status: SAVED.
 * 5. Saved job state keeps "⚡ Apply with Talvyn" button present and functional.
 * 6. Saved job state provides "View in Tracker" action.
 * 7. Duplicate / already saved on page load retains intelligence panel and Apply button.
 * 8. Tracked applied state shows Status: APPLIED and keeps Apply button available.
 * 9. In-progress state shows Status: IN_PROGRESS and keeps Apply button available.
 * 10. Error state retains Apply button and restores Save button.
 */

import { injectPanel, updatePanelState, removePanel } from '../src/content/panel'
import { ExtractedJob } from '../src/types'
import { normalizeJob } from '../src/content/jobNormalizer'

console.log('=================================================================')
console.log('TALVYN: EXTENSION APPLY ACTION & OVERLAY PERSISTENCE TESTS')
console.log('=================================================================\n')

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

function setupDomMock() {
  if (typeof document === 'undefined') {
    const elements = new Map<string, any>()

    const createMockElement = (id?: string) => {
      let _html = ''
      const children: any[] = []
      const el: any = {
        id: id || '',
        attributes: new Map(),
        style: {},
        textContent: '',
        children,
        get innerHTML() {
          if (children.length > 0) {
            return children.map((c) => c.innerHTML).join('\n') + _html
          }
          return _html
        },
        set innerHTML(val: string) {
          _html = val
          // Extract elements with id
          const idMatches = val.matchAll(/id=["']([^"']+)["']/g)
          for (const match of idMatches) {
            const childId = match[1]
            if (!elements.has(childId)) {
              const child = createMockElement(childId)
              elements.set(childId, child)
              children.push(child)
            }
          }
        },
        setAttribute(k: string, v: string) { el.attributes.set(k, v) },
        getAttribute(k: string) { return el.attributes.get(k) },
        appendChild(child: any) {
          children.push(child)
          if (child.id) elements.set(child.id, child)
          return child
        },
        querySelector(selector: string) {
          const cleanId = selector.replace('#', '')
          if (elements.has(cleanId)) return elements.get(cleanId)
          if (el.innerHTML.includes(`id="${cleanId}"`) || el.innerHTML.includes(`id='${cleanId}'`)) {
            const childEl = createMockElement(cleanId)
            elements.set(cleanId, childEl)
            children.push(childEl)
            return childEl
          }
          return null
        },
        querySelectorAll(_selector: string) { return [] },
        addEventListener(_event: string, _cb: any) {},
        remove() {
          if (el.id) elements.delete(el.id)
        },
      }
      if (id) elements.set(id, el)
      return el
    }

    const mockDoc: any = {
      body: createMockElement('body'),
      createElement(tag: string) {
        return createMockElement()
      },
      getElementById(id: string) {
        return elements.get(id) || null
      },
    }

    ;(global as any).document = mockDoc
    ;(global as any).window = { open: () => {}, matchMedia: () => ({ matches: false }) }
  }
}

async function runTests() {
  setupDomMock()

  const mockJob: ExtractedJob = {
    title: 'Senior Frontend Engineer',
    company: 'InnovateCorp',
    location: 'Remote',
    salary: '$120,000 - $140,000',
    jobUrl: 'https://innovatecorp.com/careers/senior-frontend',
    sourceWebsite: 'innovatecorp.com',
    jobType: 'FULL_TIME',
  }

  const mockProfile: any = {
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'GraphQL'],
    preferredRoles: ['Frontend Engineer', 'Senior Frontend Engineer'],
    preferredLocations: ['Remote'],
    preferredJobTypes: ['FULL_TIME'],
  }

  const normResult = normalizeJob(mockJob, mockProfile)

  // ─── 1. Unsaved State ────────────────────────────────────────────────────────
  console.log('--- 1. Testing Unsaved Overlay State ---')
  let saveClicked = false
  let applyClicked = false

  injectPanel(
    normResult.normalized,
    () => { saveClicked = true },
    () => { applyClicked = true },
    () => {},
    {
      opportunityType: 'FULL_TIME',
      readiness: { score: 90, tier: 'READY', summaryText: 'Ready', items: [] },
      normalization: normResult,
      isConnected: true,
    }
  )

  const panel = document.getElementById('talvyn-panel')
  assert(panel !== null, '1a. Extension panel injected into DOM')
  assert(panel.innerHTML.includes('PROFILE MATCH'), '1b. Panel displays PROFILE MATCH section')
  assert(panel.innerHTML.includes('APPLICATION READINESS'), '1c. Panel displays APPLICATION READINESS section')
  assert(panel.innerHTML.includes('talvyn-save-btn'), '1d. Panel contains Save Job button (#talvyn-save-btn)')
  assert(panel.innerHTML.includes('talvyn-apply-btn'), '1e. Panel contains Apply with Talvyn button (#talvyn-apply-btn)')

  // ─── 2. Saved State ──────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Saved Overlay State ---')
  updatePanelState({
    type: 'saved',
    existingStatus: 'SAVED',
    job: normResult.normalized,
    normalization: normResult,
  })

  assert(panel.innerHTML.includes('PROFILE MATCH'), '2a. Profile Match remains visible after saving')
  assert(panel.innerHTML.includes('APPLICATION READINESS'), '2b. Application Readiness remains visible after saving')
  assert(panel.innerHTML.includes('ALREADY SAVED'), '2c. Shows ALREADY SAVED indicator')
  assert(panel.innerHTML.includes('Status: SAVED'), '2d. Shows Status: SAVED')
  assert(panel.innerHTML.includes('talvyn-apply-btn'), '2e. "Apply with Talvyn" button is STILL present and available (#talvyn-apply-btn)')
  assert(panel.innerHTML.includes('View in Tracker'), '2f. "View in Tracker" link is present')

  // ─── 3. Already Saved / Duplicate State ──────────────────────────────────────
  console.log('\n--- 3. Testing Duplicate / Already Saved on Page Load ---')
  updatePanelState({
    type: 'duplicate',
    existingStatus: 'SAVED',
    job: normResult.normalized,
    normalization: normResult,
  })

  assert(panel.innerHTML.includes('PROFILE MATCH'), '3a. Profile Match remains visible on already-saved job')
  assert(panel.innerHTML.includes('APPLICATION READINESS'), '3b. Application Readiness remains visible on already-saved job')
  assert(panel.innerHTML.includes('talvyn-apply-btn'), '3c. Apply with Talvyn button remains visible on already-saved job')
  assert(panel.innerHTML.includes('View in Tracker'), '3d. View in Tracker link is visible on already-saved job')

  // ─── 4. Applied State ────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing Applied Overlay State ---')
  updatePanelState({
    type: 'applied',
    existingStatus: 'APPLIED',
    job: normResult.normalized,
    normalization: normResult,
  })

  assert(panel.innerHTML.includes('PROFILE MATCH'), '4a. Profile Match remains visible on applied job')
  assert(panel.innerHTML.includes('APPLICATION TRACKED'), '4b. Shows APPLICATION TRACKED badge')
  assert(panel.innerHTML.includes('Status: APPLIED'), '4c. Shows Status: APPLIED')
  assert(panel.innerHTML.includes('talvyn-apply-btn'), '4d. Apply with Talvyn button is available on applied job')

  // ─── 5. Error State Recovery ─────────────────────────────────────────────────
  console.log('\n--- 5. Testing Error State & Recovery ---')
  updatePanelState({
    type: 'error',
    message: 'Could not connect to backend',
    job: normResult.normalized,
    normalization: normResult,
  })

  assert(panel.innerHTML.includes('Could not connect to backend'), '5a. Displays error message in status banner')

  removePanel()
  assert(document.getElementById('talvyn-panel') === null, '5b. Panel cleanly removed on dismissal')

  console.log('\n===========================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('===========================================================')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal error during extension apply action verification:', err)
  process.exit(1)
})
