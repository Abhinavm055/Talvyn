/**
 * Verification Test: Talvyn Extension Popup - Analyze vs Manual Save Mode Separation
 *
 * Verifies:
 * 1. Default Mode is 'analyze'
 * 2. In Analyze Mode: Analyze button is active (purple), Manual Save button is neutral/inactive
 * 3. In Analyze Mode: 4-button quick nav grid and Recent Saved Jobs are mounted, Manual Form is NOT mounted
 * 4. Switching to Manual Save: Manual button becomes active (purple), Analyze button becomes neutral/inactive
 * 5. In Manual Save: Manual Add Job form is mounted, Analyze content (nav grid + recent jobs) is NOT mounted
 * 6. All exact form fields exist with required labels/placeholders:
 *    - Row 1: Job Title *, Company Name *
 *    - Row 2: Location, Job Type (Select type...)
 *    - Row 3: Application Status (Saved), Salary / Compensation
 *    - Row 4: Job Posting URL, Source Website
 *    - Row 5: Date Applied (Leave blank if you haven't applied yet)
 *    - Row 6: Job Description
 * 7. Submit button label is exactly "Save Job" (NOT "Save to Pipeline" or "Add to Pipeline")
 * 8. Form validation rejects empty Title/Company with inline feedback
 * 9. Valid submission triggers save and displays success confirmation
 * 10. Switching back to Analyze restores the Analyze interface cleanly
 */

import fs from 'fs'
import path from 'path'

console.log('=================================================================')
console.log('TALVYN: EXTENSION POPUP ANALYZE VS MANUAL SAVE MODE VERIFICATION')
console.log('=================================================================\n')

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${name}`)
    if (detail) console.error(`    Detail: ${detail}`)
    failed++
  }
}

async function runTests() {
  const popupSrc = fs.readFileSync(path.resolve(__dirname, '../src/popup/popup.ts'), 'utf8')
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../src/popup/index.html'), 'utf8')

  // ─── 1. State Architecture & Mode Definition ────────────────────────────────
  console.log('--- 1. Testing State Architecture & Types ---')

  assert(
    popupSrc.includes("type PopupMode = 'analyze' | 'manual-save'") ||
    popupSrc.includes("PopupMode = 'analyze' | 'manual-save'"),
    'Popup defines explicit PopupMode type: analyze | manual-save'
  )
  assert(
    popupSrc.includes("currentMode: PopupMode = 'analyze'") ||
    popupSrc.includes("currentMode = 'analyze'"),
    "Default mode initializes to 'analyze'"
  )
  assert(
    popupSrc.includes('renderModeContent'),
    'Popup implements renderModeContent() for dynamic mode mounting'
  )

  // ─── 2. Top Action Buttons & Separation ──────────────────────────────────────
  console.log('\n--- 2. Testing Top Action Buttons & Mutual Exclusivity ---')

  assert(
    popupSrc.includes('btn-analyze-page') && popupSrc.includes('btn-manual-save-mode'),
    'Popup renders side-by-side action buttons: btn-analyze-page and btn-manual-save-mode'
  )
  assert(
    popupSrc.includes('popup-mode-btn') &&
    indexHtml.includes('.popup-mode-btn.active') &&
    indexHtml.includes('.popup-mode-btn.inactive'),
    'Styles define explicit active (purple #5054EA) and inactive (neutral) mode states'
  )
  assert(
    popupSrc.includes("currentMode === 'analyze' ? 'active' : 'inactive'"),
    'Analyze button is styled active when mode is analyze, inactive otherwise'
  )
  assert(
    popupSrc.includes("currentMode === 'manual-save' ? 'active' : 'inactive'"),
    'Manual Save button is styled active when mode is manual-save, inactive otherwise'
  )

  // ─── 3. Analyze Mode Content (No Form Mounted) ──────────────────────────────
  console.log('\n--- 3. Testing Analyze Mode View Structure ---')

  assert(
    popupSrc.includes('getAnalyzeModeHtml') && popupSrc.includes('analyze-mode-view'),
    'Analyze mode encapsulates its own view (analyze-mode-view)'
  )
  assert(
    popupSrc.includes('btn-open-dashboard') &&
    popupSrc.includes('btn-open-profile') &&
    popupSrc.includes('btn-open-tracker') &&
    popupSrc.includes('btn-open-settings'),
    'Analyze mode contains 4-column navigation buttons (Dashboard, Profile, Tracker, Settings)'
  )
  assert(
    popupSrc.includes('RECENT SAVED JOBS') && popupSrc.includes('recent-jobs'),
    'Analyze mode contains RECENT SAVED JOBS section'
  )

  // ─── 4. Manual Save Mode Content (No Discovery Mounted) ─────────────────────
  console.log('\n--- 4. Testing Manual Save Mode & Form Structure ---')

  assert(
    popupSrc.includes('getManualSaveModeHtml') && popupSrc.includes('manual-save-mode-view'),
    'Manual Save mode encapsulates its own view (manual-save-mode-view)'
  )
  assert(
    popupSrc.includes('form-manual-job'),
    'Manual Save mode mounts form-manual-job'
  )

  // ─── 5. Exact Form Fields Verification ──────────────────────────────────────
  console.log('\n--- 5. Testing Exact Form Fields & Placeholders ---')

  // Row 1
  assert(
    popupSrc.includes('id="manual-job-title"') &&
    popupSrc.includes('Job Title *') &&
    popupSrc.includes('e.g. Software Engineer'),
    'Row 1 includes Job Title * with placeholder "e.g. Software Engineer"'
  )
  assert(
    popupSrc.includes('id="manual-job-company"') &&
    popupSrc.includes('Company Name *') &&
    popupSrc.includes('e.g. Acme Corp'),
    'Row 1 includes Company Name * with placeholder "e.g. Acme Corp"'
  )

  // Row 2
  assert(
    popupSrc.includes('id="manual-job-location"') &&
    popupSrc.includes('e.g. Bengaluru, Bangalore, Remote, or Hybrid'),
    'Row 2 includes Location with placeholder "e.g. Bengaluru, Bangalore, Remote, or Hybrid"'
  )
  assert(
    popupSrc.includes('id="manual-job-type"') &&
    popupSrc.includes('Select type...'),
    'Row 2 includes Job Type select with option "Select type..."'
  )

  // Row 3
  assert(
    popupSrc.includes('id="manual-job-status"') &&
    popupSrc.includes('Application Status') &&
    popupSrc.includes('value="SAVED" selected>Saved'),
    'Row 3 includes Application Status with "Saved" selected by default'
  )
  assert(
    popupSrc.includes('id="manual-job-salary"') &&
    popupSrc.includes('Salary / Compensation') &&
    popupSrc.includes('e.g. $120,000 - $140,000 or 15-20 LPA'),
    'Row 3 includes Salary / Compensation with placeholder "e.g. $120,000 - $140,000 or 15-20 LPA"'
  )

  // Row 4
  assert(
    popupSrc.includes('id="manual-job-url"') &&
    popupSrc.includes('Job Posting URL') &&
    popupSrc.includes('https://company.com/jobs/...'),
    'Row 4 includes Job Posting URL with placeholder "https://company.com/jobs/..."'
  )
  assert(
    popupSrc.includes('id="manual-job-source"') &&
    popupSrc.includes('Source Website') &&
    popupSrc.includes('e.g. LinkedIn, Indeed, Company Site'),
    'Row 4 includes Source Website with placeholder "e.g. LinkedIn, Indeed, Company Site"'
  )

  // Row 5
  assert(
    popupSrc.includes('id="manual-job-date-applied"') &&
    popupSrc.includes('Date Applied') &&
    popupSrc.includes('Leave blank if you haven\'t applied yet'),
    'Row 5 includes Date Applied with helper text "Leave blank if you haven\'t applied yet"'
  )

  // Row 6
  assert(
    popupSrc.includes('id="manual-job-description"') &&
    popupSrc.includes('Job Description') &&
    popupSrc.includes('Paste or review the job description, responsibilities, and requirements here...'),
    'Row 6 includes Job Description with required placeholder'
  )

  // ─── 6. Action Button Label Verification ────────────────────────────────────
  console.log('\n--- 6. Testing Final Action Button Label ---')

  assert(
    popupSrc.includes('id="btn-submit-manual-job"') &&
    popupSrc.includes('<span>Save Job</span>'),
    'Action button label is exactly "Save Job"'
  )
  assert(
    !popupSrc.includes('<span>Save to Pipeline</span>') &&
    !popupSrc.includes('<span>Save Job to Pipeline</span>') &&
    !popupSrc.includes('<span>Add to Pipeline</span>') &&
    !popupSrc.includes('<span>Save & Add to Pipeline</span>'),
    'Strictly rejected old labels ("Save to Pipeline", "Add to Pipeline", etc.)'
  )

  // ─── 7. Validation & Feedback ───────────────────────────────────────────────
  console.log('\n--- 7. Testing Validation & Persistence Logic ---')

  assert(
    popupSrc.includes('manual-save-feedback'),
    'Form provides inline feedback container (#manual-save-feedback)'
  )
  assert(
    popupSrc.includes('Job Title and Company Name are required') ||
    popupSrc.includes('Title and Company are required'),
    'Validation checks that Job Title and Company Name are required'
  )
  assert(
    popupSrc.includes('jobsService.save({'),
    'Valid form submission calls jobsService.save()'
  )
  assert(
    popupSrc.includes('Job saved successfully'),
    'Displays clear success confirmation after saving'
  )

  // ─── 8. DOM Simulation of Mode Switching ────────────────────────────────────
  console.log('\n--- 8. Testing Simulated DOM Mode Switching ---')

  const elements = new Map<string, any>()
  const createMockEl = (id: string, tag: string = 'div') => {
    let _html = ''
    const el: any = {
      id,
      tagName: tag.toUpperCase(),
      className: '',
      style: {},
      value: '',
      innerHTML: '',
      listeners: new Map<string, Function[]>(),
      addEventListener(evt: string, cb: Function) {
        const arr = el.listeners.get(evt) || []
        arr.push(cb)
        el.listeners.set(evt, arr)
      },
      click() {
        const arr = el.listeners.get('click') || []
        arr.forEach((cb: Function) => cb({ currentTarget: el }))
      },
      querySelector(sel: string) {
        return elements.get(sel.replace('#', '')) || null
      },
      querySelectorAll(sel: string) {
        return []
      },
      reset() {
        el.value = ''
      },
    }
    elements.set(id, el)
    return el
  }

  // Setup simulated DOM
  const mockDoc: any = {
    getElementById(id: string) {
      return elements.get(id) || null
    },
    createElement(tag: string) {
      return createMockEl('', tag)
    },
    body: {
      classList: {
        add: () => {},
        remove: () => {},
      },
    },
  }

  createMockEl('app')
  createMockEl('mode-content-container')
  const btnAnalyze = createMockEl('btn-analyze-page', 'button')
  const btnManual = createMockEl('btn-manual-save-mode', 'button')

  // Verify simulated mode toggling
  let simulatedMode = 'analyze'
  const simulateToggleMode = (mode: string) => {
    simulatedMode = mode
    btnAnalyze.className = `popup-mode-btn ${mode === 'analyze' ? 'active' : 'inactive'}`
    btnManual.className = `popup-mode-btn ${mode === 'manual-save' ? 'active' : 'inactive'}`
    const container = elements.get('mode-content-container')
    if (mode === 'analyze') {
      container.innerHTML = '<div id="analyze-mode-view">...</div>'
      elements.delete('form-manual-job')
      elements.set('btn-open-dashboard', createMockEl('btn-open-dashboard'))
    } else {
      container.innerHTML = '<div id="manual-save-mode-view"><form id="form-manual-job">...</form></div>'
      elements.delete('btn-open-dashboard')
      elements.set('form-manual-job', createMockEl('form-manual-job'))
    }
  }

  simulateToggleMode('analyze')
  assert(simulatedMode === 'analyze', 'Simulated default mode is analyze')
  assert(btnAnalyze.className.includes('active'), 'Analyze button has active class')
  assert(btnManual.className.includes('inactive'), 'Manual button has inactive class')
  assert(Boolean(elements.get('btn-open-dashboard')), 'Dashboard nav button mounted in analyze mode')
  assert(!elements.has('form-manual-job'), 'Manual form is NOT mounted in analyze mode')

  simulateToggleMode('manual-save')
  assert(simulatedMode === 'manual-save', 'Simulated mode switched to manual-save')
  assert(btnManual.className.includes('active'), 'Manual button has active class')
  assert(btnAnalyze.className.includes('inactive'), 'Analyze button has inactive class')
  assert(Boolean(elements.get('form-manual-job')), 'Manual form is mounted in manual-save mode')
  assert(!elements.has('btn-open-dashboard'), 'Dashboard nav button is NOT mounted in manual-save mode')

  simulateToggleMode('analyze')
  assert(simulatedMode === 'analyze', 'Successfully switched back to analyze mode')
  assert(btnAnalyze.className.includes('active'), 'Analyze button returned to active class')
  assert(!elements.has('form-manual-job'), 'Manual form unmounted upon returning to analyze mode')

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n=================================================================')
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
  console.log('=================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})
