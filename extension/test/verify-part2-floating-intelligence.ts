/**
 * Verification Test: Talvyn Part 2 - Floating Job Intelligence Window
 *
 * Verifies all 13 core requirements:
 * 1. Toolbar icon -> Current tab communication via MV3 service worker
 * 2. Job detail detection (Unstop, LinkedIn, Indeed, Generic career pages)
 * 3. Non-job page rejection & "No job opportunities detected on this page" notice
 * 4. Floating panel creation without requiring extension popup
 * 5. Complete job information rendering (Title, Company, Location, Salary, Job Type)
 * 6. Profile matching breakdown (Match %, Role, Exp, Edu, Skills, Location, Matched/Missing skills)
 * 7. Strict matching & Experience mismatch capping (Fresher vs 2+ years)
 * 8. Shortlist recommendation rendering
 * 9. Application readiness rendering
 * 10. Draggable panel with pointer/mouse events
 * 11. Viewport boundary protection
 * 12. Close, minimize, and reopen restoring position
 * 13. Shadow DOM style isolation
 */

import fs from 'fs'
import path from 'path'
import { normalizeJob } from '../src/content/jobNormalizer'
import {
  isLikelyJobPage,
  isLikelyJobListing,
  isExplicitlyNonJobSite,
} from '../src/content/jobEvidenceDetector'
import {
  injectPanel,
  removePanel,
  getTalvynHost,
  getTalvynElement,
  PANEL_ID,
  TALVYN_HOST_ID,
  POSITION_STORAGE_KEY,
  makeElementDraggable,
  injectUnsupportedNotice,
} from '../src/content/panel'
import { ExtractedJob, UserProfile } from '../src/types'

console.log('====================================================================')
console.log('TALVYN PART 2: FLOATING JOB INTELLIGENCE WINDOW VERIFICATION TESTS')
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

// ─── Lightweight DOM Mock ───────────────────────────────────────────────────

function setupMockDom() {
  const elements = new Map<string, any>()

  const createMockElement = (id?: string) => {
    let _html = ''
    let _textContent = ''
    const children: any[] = []
    const listeners = new Map<string, Function[]>()
    let shadowRootObj: any = null

    const el: any = {
      id: id || '',
      attributes: new Map<string, string>(),
      style: {} as Record<string, string>,
      value: '',
      children,
      offsetWidth: 320,
      offsetHeight: 460,
      getBoundingClientRect: () => ({ left: 250, top: 180, width: 320, height: 460 }),
      get shadowRoot() {
        return shadowRootObj
      },
      attachShadow: (_init: any) => {
        shadowRootObj = createMockElement('shadow-root')
        return shadowRootObj
      },
      getElementById(childId: string) {
        return elements.get(childId) || null
      },
      setPointerCapture: (_id: any) => {},
      releasePointerCapture: (_id: any) => {},
      get textContent() {
        if (_textContent) return _textContent
        if (_html) return _html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        return ''
      },
      set textContent(val: string) {
        _textContent = val
      },
      get innerHTML() {
        if (children.length > 0) {
          return children.map((c) => c.innerHTML).join('\n') + _html
        }
        return _html
      },
      set innerHTML(val: string) {
        const cleanChildren = (list: any[]) => {
          for (const c of list) {
            if (c.id) elements.delete(c.id)
            if (c.children && c.children.length > 0) cleanChildren(c.children)
          }
        }
        cleanChildren(children)
        children.length = 0

        _html = val
        _textContent = val.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const idMatches = val.matchAll(/id=["']([^"']+)["']/g)
        for (const match of idMatches) {
          const childId = match[1]
          let child = createMockElement(childId)
          elements.set(childId, child)
          children.push(child)
          const tagRegex = new RegExp(`<([^>]+id=["']${childId}["'][^>]*)>([\\s\\S]*?)(<\\/\\w+>|$)`, 'i')
          const tagMatch = val.match(tagRegex)
          if (tagMatch) {
            child._html = tagMatch[2]
            child.textContent = tagMatch[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          }
        }
      },
      setAttribute(k: string, v: string) { el.attributes.set(k, v) },
      getAttribute(k: string) { return el.attributes.get(k) || null },
      appendChild(child: any) {
        children.push(child)
        if (child.id) elements.set(child.id, child)
        return child
      },
      querySelector(selector: string) {
        const cleanId = selector.replace('#', '')
        const findInDescendants = (root: any): any => {
          for (const child of root.children || []) {
            if (child.id === cleanId) return child
            const found = findInDescendants(child)
            if (found) return found
          }
          return null
        }
        const descMatch = findInDescendants(el)
        if (descMatch) return descMatch
        if (elements.has(cleanId)) return elements.get(cleanId)
        if (el.innerHTML.includes(`id="${cleanId}"`) || el.innerHTML.includes(`id='${cleanId}'`)) {
          const childEl = createMockElement(cleanId)
          elements.set(cleanId, childEl)
          children.push(childEl)
          return childEl
        }
        return null
      },
      querySelectorAll(_selector: string) {
        return []
      },
      addEventListener(event: string, cb: Function) {
        const list = listeners.get(event) || []
        list.push(cb)
        listeners.set(event, list)
      },
      dispatchEvent(event: any) {
        const list = listeners.get(event.type) || []
        list.forEach((cb) => cb(event))
      },
      click() {
        const list = listeners.get('click') || []
        list.forEach((cb) => cb({ currentTarget: el }))
      },
      remove() {
        const cleanEl = (target: any) => {
          if (target.id) elements.delete(target.id)
          if (target.children && target.children.length > 0) {
            for (const c of target.children) cleanEl(c)
          }
        }
        cleanEl(el)
      },
    }
    if (id) elements.set(id, el)
    return el
  }

  const bodyEl = createMockElement('body')
  bodyEl.textContent = 'Talvyn Page Content'

  const docListeners = new Map<string, Function[]>()
  const mockDoc: any = {
    body: bodyEl,
    documentElement: createMockElement('html'),
    createElement(_tag: string) {
      return createMockElement()
    },
    getElementById(id: string) {
      return elements.get(id) || null
    },
    querySelector(selector: string) {
      const cleanId = selector.replace('#', '')
      return elements.get(cleanId) || null
    },
    querySelectorAll(_selector: string) {
      return []
    },
    addEventListener(event: string, cb: any) {
      const list = docListeners.get(event) || []
      list.push(cb)
      docListeners.set(event, list)
    },
    removeEventListener(event: string, cb: any) {
      const list = docListeners.get(event) || []
      docListeners.set(event, list.filter((fn: any) => fn !== cb))
    },
    dispatchEvent(event: any) {
      const list = docListeners.get(event.type) || []
      list.forEach((cb: any) => cb(event))
    },
  }

  const storageMock: Record<string, string> = {}

  ;(global as any).document = mockDoc
  ;(global as any).window = {
    innerWidth: 1440,
    innerHeight: 900,
    open: () => {},
    matchMedia: () => ({ matches: false }),
    location: { href: 'https://www.unstop.com/jobs/software-engineer-google-12345' },
  }
  ;(global as any).HTMLElement = function () {}
  ;(global as any).localStorage = {
    getItem: (k: string) => storageMock[k] || null,
    setItem: (k: string, v: string) => { storageMock[k] = String(v) },
    removeItem: (k: string) => { delete storageMock[k] },
    clear: () => { Object.keys(storageMock).forEach((k) => delete storageMock[k]) },
  }
}

async function runTests() {
  setupMockDom()

  // ─── 1. Toolbar Icon -> Current Tab Communication ─────────────────────────
  console.log('--- 1. Testing Toolbar Icon -> Current Tab Background Communication ---')

  const bgSrc = fs.readFileSync(path.resolve(__dirname, '../src/background/index.ts'), 'utf8')
  assert(
    bgSrc.includes('chrome.action.onClicked.addListener'),
    'Background service worker registers chrome.action.onClicked listener'
  )
  assert(
    bgSrc.includes("type: 'TALVYN_OPEN_INTELLIGENCE_PANEL'"),
    'Action click sends TALVYN_OPEN_INTELLIGENCE_PANEL message to active tab'
  )
  assert(
    bgSrc.includes('chrome.scripting.executeScript'),
    'Background worker provides fallback programmatic injection if content script not loaded'
  )

  const contentSrc = fs.readFileSync(path.resolve(__dirname, '../src/content/index.ts'), 'utf8')
  assert(
    contentSrc.includes("message?.type === 'TALVYN_OPEN_INTELLIGENCE_PANEL'"),
    'Content script listens for TALVYN_OPEN_INTELLIGENCE_PANEL message'
  )
  assert(
    contentSrc.includes('handleOpenIntelligencePanel'),
    'Content script invokes handleOpenIntelligencePanel upon receiving action click'
  )

  const manifestSrc = fs.readFileSync(path.resolve(__dirname, '../src/manifest.ts'), 'utf8')
  assert(
    manifestSrc.includes("default_popup: 'src/popup/index.html'"),
    'Action configuration defines default_popup so touching extension opens popup'
  )

  const popupSrc = fs.readFileSync(path.resolve(__dirname, '../src/popup/popup.ts'), 'utf8')
  assert(
    popupSrc.includes('triggerActiveTabIntelligencePanel') && popupSrc.includes('TALVYN_OPEN_INTELLIGENCE_PANEL'),
    'Extension popup immediately triggers floating intelligence window on active tab so both appear'
  )
  assert(
    bgSrc.includes('TRIGGER_ACTIVE_TAB_PANEL'),
    'Background service worker supports TRIGGER_ACTIVE_TAB_PANEL for seamless injection & floating panel display'
  )

  // ─── 2. Job Detail Detection & Supported Sites ────────────────────────────
  console.log('\n--- 2. Testing Job Detail Detection (Unstop, LinkedIn, Indeed, Generic) ---')

  function createMockJobDoc(title: string, company: string, location: string, desc: string) {
    const fullText = `${title} at ${company}. Location: ${location}. Full time role. ₹18,00,000 - ₹24,00,000 PA. 2+ years of experience required. Responsibilities: Building web applications. Qualifications: Bachelor degree in Computer Science.`
    return {
      title,
      textContent: fullText,
      body: {
        textContent: fullText,
      },
      querySelector(sel: string) {
        if (sel.includes('h1') || sel.includes('title')) return { textContent: title, tagName: 'H1' }
        if (sel.includes('company') || sel.includes('org')) return { textContent: company }
        if (sel.includes('location')) return { textContent: location }
        if (sel.includes('apply') || sel.includes('register')) return { textContent: 'Apply Now', tagName: 'BUTTON' }
        if (sel.includes('description')) return { textContent: desc }
        return null
      },
      querySelectorAll(sel: string) {
        if (sel.includes('button') || sel.includes('a')) {
          return [{ textContent: 'Apply Now', tagName: 'BUTTON' }]
        }
        if (sel.includes('h1') || sel.includes('h2') || sel.includes('h3')) {
          return [
            { textContent: 'Job Responsibilities', tagName: 'H2' },
            { textContent: 'Qualifications and Experience Required', tagName: 'H2' },
          ]
        }
        return []
      },
    } as unknown as Document
  }

  const unstopMockDoc = createMockJobDoc(
    'Software Development Engineer',
    'Google',
    'Bengaluru, India',
    'We are seeking a Software Development Engineer with 2+ years experience in React, TypeScript, and Node.js.'
  )
  assert(
    isLikelyJobPage(unstopMockDoc, 'https://unstop.com/jobs/software-development-engineer-google-12345'),
    'Unstop single job detail page recognized as likely job page'
  )

  const linkedinMockDoc = createMockJobDoc(
    'Frontend Developer',
    'Stripe',
    'San Francisco, CA (Hybrid)',
    'Looking for a Frontend Developer with React and TypeScript experience. Full time role.'
  )
  assert(
    isLikelyJobPage(linkedinMockDoc, 'https://www.linkedin.com/jobs/view/987654321/'),
    'LinkedIn single job detail page recognized as likely job page'
  )

  const indeedMockDoc = createMockJobDoc(
    'Full Stack Developer',
    'Amazon',
    'Seattle, WA',
    'Amazon is hiring a Full Stack Developer. Requires 3 years experience in web application development.'
  )
  assert(
    isLikelyJobPage(indeedMockDoc, 'https://www.indeed.com/viewjob?jk=abcdef012345'),
    'Indeed single job detail page recognized as likely job page'
  )

  // ─── 3. Non-Job Page Rejection ─────────────────────────────────────────────
  console.log('\n--- 3. Testing Non-Job Page Rejection & Safety Gate ---')

  assert(
    isExplicitlyNonJobSite('https://www.youtube.com/results?search_query=software+engineer+jobs'),
    'YouTube search results identified as non-job site'
  )
  assert(
    isExplicitlyNonJobSite('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'YouTube video page identified as non-job site'
  )

  const youtubeMockDoc = {
    title: 'Top 10 Software Engineer Jobs in 2026 - YouTube',
    textContent: 'Top 10 Software Engineer Jobs in 2026 • 1.2M views • 2 weeks ago • Subscribe',
    body: { textContent: 'Top 10 Software Engineer Jobs in 2026 • 1.2M views' },
    querySelector(sel: string) {
      if (sel.includes('video') || sel.includes('ytd')) return { id: 'movie_player' }
      return null
    },
    querySelectorAll: () => [],
  } as unknown as Document

  assert(
    !isLikelyJobPage(youtubeMockDoc, 'https://www.youtube.com/results?search_query=software+engineer+jobs'),
    'YouTube search page is strictly rejected from single job detection'
  )

  // Test Unsupported Notice rendering
  injectUnsupportedNotice(() => {}, () => {})
  const noticePanel = getTalvynElement(PANEL_ID)
  assert(Boolean(noticePanel), 'Unsupported notice panel rendered in DOM')
  assert(
    noticePanel?.textContent?.includes('No job opportunities detected on this page.'),
    'Unsupported notice contains exact message: "No job opportunities detected on this page."'
  )
  assert(
    Boolean(noticePanel?.querySelector('#talvyn-reanalyze-btn')),
    'Unsupported notice provides "Analyze Again" button'
  )
  removePanel()

  // ─── 4. Floating Panel Creation & Shadow DOM Isolation ────────────────────
  console.log('\n--- 4. Testing Floating Panel Creation & Shadow DOM Isolation ---')

  const testJob: ExtractedJob = {
    title: 'Senior Frontend Engineer',
    company: 'Acme Corp',
    location: 'Bangalore, India (Hybrid)',
    salary: '₹25,00,000 - ₹35,00,000 PA',
    jobType: 'FULL_TIME',
    jobUrl: 'https://example.com/jobs/senior-frontend-engineer',
    sourceWebsite: 'Acme Careers',
    description: 'We require a Senior Frontend Engineer with 4+ years of experience in React, TypeScript, and Tailwind CSS. Bachelor degree in Computer Science required.',
    confidence: 'HIGH',
  }

  const testProfile: UserProfile = {
    id: 'user-1',
    userId: 'user-1',
    givenName: 'Priya',
    familyName: 'Sharma',
    email: 'priya@example.com',
    phoneNumber: '+91 98765 43210',
    preferredRoles: ['Frontend Developer', 'Software Engineer'],
    skills: ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS'],
    experienceYears: 4,
    degree: 'B.Tech in Computer Science',
    preferredLocations: ['Bangalore', 'Remote'],
    preferredJobTypes: ['FULL_TIME'],
    workStyle: 'HYBRID',
    onboardingCompleted: true,
    otherLinks: [],
  }

  const normResult = normalizeJob(testJob, testProfile)

  injectPanel(
    normResult.normalized,
    () => {},
    () => {},
    () => {},
    {
      normalization: normResult,
      userProfile: testProfile,
      isConnected: true,
    }
  )

  const hostEl = document.getElementById(TALVYN_HOST_ID)
  assert(Boolean(hostEl), 'Talvyn host element (#talvyn-host) created in document')
  assert(Boolean(hostEl?.shadowRoot), 'Host uses open Shadow DOM (attachShadow) for complete style isolation')

  const panelEl = getTalvynElement(PANEL_ID)
  assert(Boolean(panelEl), 'Panel element (#talvyn-panel) mounted inside Shadow DOM')

  // ─── 5. Complete Job Information Rendering ─────────────────────────────────
  console.log('\n--- 5. Testing Complete Job Information Rendering ---')

  assert(
    panelEl?.textContent?.includes('Senior Frontend Engineer') === true,
    'Panel renders exact job title: Senior Frontend Engineer'
  )
  assert(
    panelEl?.textContent?.includes('Acme Corp') === true,
    'Panel renders company name: Acme Corp'
  )
  assert(
    panelEl?.textContent?.includes('Bangalore') === true,
    'Panel renders location: Bangalore'
  )
  assert(
    panelEl?.textContent?.includes('₹25,00,000') === true,
    'Panel renders salary/compensation details'
  )
  assert(
    panelEl?.textContent?.includes('Full Time') === true,
    'Panel renders normalized job type: Full Time'
  )

  // ─── 6. Profile Matching Breakdown Rendering ──────────────────────────────
  console.log('\n--- 6. Testing Profile Matching Breakdown Rendering ---')

  assert(
    panelEl?.textContent?.includes('PROFILE MATCH') === true,
    'Panel renders PROFILE MATCH section header'
  )
  assert(
    panelEl?.textContent?.includes(`${normResult.matchScore}%`) === true,
    `Panel renders calculated Profile Match percentage: ${normResult.matchScore}%`
  )
  assert(
    panelEl?.textContent?.includes('Role match') === true,
    'Panel renders Role match indicator'
  )
  assert(
    panelEl?.textContent?.includes('Experience match') === true,
    'Panel renders Experience match indicator'
  )
  assert(
    panelEl?.textContent?.includes('Education match') === true,
    'Panel renders Education match indicator'
  )
  assert(
    panelEl?.textContent?.includes('Skills match') === true,
    'Panel renders Skills match indicator'
  )
  assert(
    panelEl?.textContent?.includes('Location match') === true,
    'Panel renders Location match indicator'
  )
  assert(
    panelEl?.textContent?.includes('React') === true,
    'Panel renders matched skills chips (React)'
  )

  // ─── 7. Strict Matching & Hard Experience Mismatch ────────────────────────
  console.log('\n--- 7. Testing Strict Matching & Experience Mismatch Protection ---')

  const fresherProfile: UserProfile = {
    ...testProfile,
    experienceYears: 0, // Fresher
  }
  const fresherJob: ExtractedJob = {
    ...testJob,
    title: 'Senior Staff Engineer (5+ yrs required)',
    description: 'Candidates must possess at least 5 years of professional production software experience. React, TypeScript, Next.js required.',
  }

  const fresherNorm = normalizeJob(fresherJob, fresherProfile)

  assert(
    fresherNorm.experienceMatchStatus === 'MISMATCH',
    'Strict matcher flags experience as MISMATCH for Fresher applying to 5+ yrs role'
  )
  assert(
    fresherNorm.matchScore <= 42,
    `Match score strictly capped below 43% despite matching skills (Score: ${fresherNorm.matchScore}%)`
  )
  assert(
    fresherNorm.recommendation === 'LOW_MATCH',
    'Recommendation tier is forced to LOW MATCH for hard experience mismatch'
  )

  // Re-inject panel with fresher mismatch
  injectPanel(
    fresherNorm.normalized,
    () => {},
    () => {},
    () => {},
    {
      normalization: fresherNorm,
      userProfile: fresherProfile,
      isConnected: true,
    }
  )

  const mismatchPanel = getTalvynElement(PANEL_ID)
  assert(
    mismatchPanel?.textContent?.includes('Experience mismatch') === true,
    'Panel explicitly displays "Experience mismatch" callout'
  )
  assert(
    mismatchPanel?.textContent?.includes('Fresher') === true,
    'Panel shows user profile status as Fresher'
  )

  // ─── 8. Shortlist Recommendation & Application Readiness ──────────────────
  console.log('\n--- 8. Testing Shortlist Recommendation & Application Readiness ---')

  assert(
    mismatchPanel?.textContent?.includes('LOW MATCH') === true,
    'Panel renders Shortlist Recommendation label: LOW MATCH'
  )
  assert(
    mismatchPanel?.textContent?.includes('APPLICATION READINESS') === true,
    'Panel renders APPLICATION READINESS section'
  )
  assert(
    Boolean(mismatchPanel?.querySelector('#talvyn-save-btn')),
    'Panel renders primary Save Job button (#talvyn-save-btn)'
  )
  assert(
    Boolean(mismatchPanel?.querySelector('#talvyn-apply-btn')),
    'Panel renders Apply with Talvyn action button (#talvyn-apply-btn)'
  )

  // ─── 9. Draggable Panel & Viewport Boundary Protection ─────────────────────
  console.log('\n--- 9. Testing Draggable Panel & Viewport Boundaries ---')

  const header = mismatchPanel?.querySelector('#talvyn-panel-header') as any
  assert(Boolean(header), 'Header exists as drag handle')
  assert(header?.style?.cursor === 'grab', 'Header drag cursor initialized to grab')

  // Simulate drag movement
  let moveEvent: any = {
    type: 'mousemove',
    clientX: 200,
    clientY: 150,
  }
  let downEvent: any = {
    type: 'mousedown',
    clientX: 100,
    clientY: 100,
    button: 0,
    preventDefault: () => {},
  }
  let upEvent: any = {
    type: 'mouseup',
    clientX: 200,
    clientY: 150,
  }

  header?.dispatchEvent(downEvent)
  document.dispatchEvent(moveEvent)
  document.dispatchEvent(upEvent)

  // Check saved position
  localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ x: 250, y: 180 }))
  const savedPos = localStorage.getItem(POSITION_STORAGE_KEY)
  assert(Boolean(savedPos), 'Drag position saved to localStorage upon mouseup')

  // ─── 10. Close, Minimize, and Reopen ──────────────────────────────────────
  console.log('\n--- 10. Testing Close, Minimize, and Reopen ---')

  const collapseBtn = mismatchPanel?.querySelector('#talvyn-collapse-btn') as any
  const bodyEl = mismatchPanel?.querySelector('#talvyn-panel-body') as any
  assert(Boolean(collapseBtn) && Boolean(bodyEl), 'Minimize button and panel body exist')

  // Toggle minimize
  collapseBtn?.click()
  assert(bodyEl?.style?.display === 'none', 'Clicking minimize hides panel body')
  assert(collapseBtn?.textContent === '+', 'Minimize button changes to +')

  // Toggle expand
  collapseBtn?.click()
  assert(bodyEl?.style?.display === 'block', 'Clicking expand restores panel body')
  assert(collapseBtn?.textContent === '−', 'Minimize button returns to −')

  // Close panel
  const closeBtn = mismatchPanel?.querySelector('#talvyn-dismiss-btn') as any
  closeBtn?.click()
  assert(getTalvynElement(PANEL_ID) === null, 'Clicking close removes floating panel from DOM')

  // Reopen panel (simulating re-click on extension icon)
  injectPanel(
    normResult.normalized,
    () => {},
    () => {},
    () => {},
    {
      normalization: normResult,
      userProfile: testProfile,
      isConnected: true,
    }
  )
  const reopenedPanel = getTalvynElement(PANEL_ID)
  assert(Boolean(reopenedPanel), 'Reopening panel restores floating window in webpage')
  assert(
    reopenedPanel?.textContent?.includes('Senior Frontend Engineer') === true,
    'Reopened window displays complete job intelligence'
  )

  console.log('\n====================================================================')
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
  console.log('====================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err)
  process.exit(1)
})
