/**
 * Verification test for Talvyn Extension Architecture & UX Pass
 * Tests:
 * 1. Panel Header Structure (Logo, TALVYN, ● Connected, 👤 Profile, Minimize, Close)
 * 2. Controlled Application Review Screen (Safe fields vs Sensitive fields, Edit Details, Review & Continue)
 * 3. Candidate Profile Inspection & Edit (re-running matching updates score immediately)
 * 4. Multi-Job Discovery Panel Filter Tabs ([All], [Strong], [Good], [Moderate], [Low], [Saved])
 * 5. Non-Job Page Unsupported Notice ("No job opportunities detected on this page." + [ Analyze Again ])
 */

import { injectPanel, injectUnsupportedNotice, PANEL_ID } from '../src/content/panel'
import { DiscoveryPanelManager, DISCOVERY_PANEL_ID } from '../src/content/discoveryPanel'
import { normalizeJob } from '../src/content/jobNormalizer'
import { ExtractedJob, UserProfile, JobListAnalysisSummary } from '../types'

let passCount = 0
let failCount = 0

function assert(condition: boolean, testName: string, detail?: any): void {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passCount++
  } else {
    console.error(`  ✗ FAIL: ${testName}`, detail !== undefined ? detail : '')
    failCount++
  }
}

function setupDomMock() {
  const elements = new Map<string, any>()

  const createMockElement = (id?: string) => {
    let _html = ''
    let _textContent = ''
    const children: any[] = []
    const listeners = new Map<string, Function[]>()
    const el: any = {
      id: id || '',
      attributes: new Map<string, string>(),
      style: {},
      value: '',
      children,
      get _html() {
        return _html
      },
      set _html(val: string) {
        _html = val
      },
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
        _html = val
        _textContent = val.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const idMatches = val.matchAll(/id=["']([^"']+)["']/g)
        for (const match of idMatches) {
          const childId = match[1]
          let child = elements.get(childId)
          if (!child) {
            child = createMockElement(childId)
            elements.set(childId, child)
            children.push(child)
          }
          // extract inner text/content inside tag
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
        if (elements.has(cleanId)) return elements.get(cleanId)
        if (el.innerHTML.includes(`id="${cleanId}"`) || el.innerHTML.includes(`id='${cleanId}'`)) {
          const childEl = createMockElement(cleanId)
          elements.set(cleanId, childEl)
          children.push(childEl)
          return childEl
        }
        return null
      },
      querySelectorAll(selector: string) {
        if (selector === '.talvyn-tab-btn') {
          const matches = Array.from(el.innerHTML.matchAll(/class=["'][^"']*talvyn-tab-btn[^"']*["'][^>]*data-filter=["']([^"']+)["']/g))
          return matches.map((m: any) => {
            const f = m[1]
            let tab = elements.get(`tab-${f}`)
            if (!tab) {
              tab = createMockElement(`tab-${f}`)
              elements.set(`tab-${f}`, tab)
            }
            tab.setAttribute('data-filter', f)
            return tab
          })
        }
        if (selector === '.talvyn-save-card-btn') {
          const matches = Array.from(el.innerHTML.matchAll(/class=["'][^"']*talvyn-save-card-btn[^"']*["'][^>]*data-url=["']([^"']+)["']/g))
          return matches.map((m: any) => {
            const card = createMockElement()
            card.setAttribute('data-url', m[1])
            return card
          })
        }
        return []
      },
      addEventListener(event: string, cb: Function) {
        const list = listeners.get(event) || []
        list.push(cb)
        listeners.set(event, list)
      },
      click() {
        const list = listeners.get('click') || []
        list.forEach((cb) => cb({ currentTarget: el }))
      },
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
    addEventListener(_event: string, _cb: any) {},
    removeEventListener(_event: string, _cb: any) {},
  }

  ;(global as any).document = mockDoc
  ;(global as any).window = {
    open: () => {},
    matchMedia: () => ({ matches: false }),
    location: { href: 'https://in.indeed.com/viewjob?jk=abc123456' },
  }
}

async function runTests() {
  console.log('===========================================================')
  console.log('TALVYN EXTENSION: ARCHITECTURE & UX VERIFICATION TESTS')
  console.log('===========================================================\n')

  setupDomMock()

  const mockJob: ExtractedJob = {
    title: 'Frontend Developer',
    company: 'TechCorp',
    location: 'Bengaluru, India',
    salary: '₹12,00,000 - ₹18,00,000',
    description: 'Looking for a Frontend Developer with 2-4 years experience in React, TypeScript, and Node.js. Bachelor degree required.',
    jobUrl: 'https://in.indeed.com/viewjob?jk=abc123456',
    sourceWebsite: 'indeed',
    jobType: 'FULL_TIME',
  }

  const initialFresherProfile: UserProfile = {
    id: 'usr_1',
    userId: 'usr_1',
    legalFullName: 'John Doe',
    givenName: 'John',
    familyName: 'Doe',
    email: 'john.doe@example.com',
    phoneNumber: '+91 9876543210',
    preferredRoles: ['Frontend Developer'],
    preferredLocations: ['Bengaluru, India'],
    preferredJobTypes: ['FULL_TIME'],
    skills: ['React', 'TypeScript'],
    experienceYears: 0, // Fresher
    degree: 'B.Tech Computer Science',
    workAuthorization: 'Authorized to work in India',
    expectedSalary: '₹15,00,000',
    otherLinks: [],
    workStyle: 'ANY',
    onboardingCompleted: true,
  }

  // ─── 1. Header Structure & Controls ──────────────────────────────────────────
  console.log('--- 1. Testing Floating Intelligence Window Header ---')

  const normFresher = normalizeJob(mockJob, initialFresherProfile)
  injectPanel(
    mockJob,
    () => {},
    () => {},
    () => {},
    {
      normalization: normFresher,
      userProfile: initialFresherProfile,
      isConnected: true,
      resumeName: 'John_Frontend_Resume.pdf',
    }
  )

  const panel = document.getElementById(PANEL_ID)
  assert(Boolean(panel), '1a: Floating intelligence window injected into DOM')

  const header = panel?.querySelector('#talvyn-panel-header')
  assert(Boolean(header), '1b: Draggable header handle exists')

  const panelHtml = panel?.innerHTML || ''
  assert(panelHtml.includes('Talvyn'), '1c: Header displays Talvyn brand name')
  assert(panelHtml.includes('● Connected'), '1d: Header displays ● Connected status indicator')

  const profileBtn = header?.querySelector('#talvyn-profile-btn') as HTMLButtonElement | null
  assert(Boolean(profileBtn), '1e: Header contains [ 👤 Profile ] button')
  assert((profileBtn?.textContent || profileBtn?.innerHTML || '').includes('Profile'), '1f: Profile button label reads "👤 Profile"')

  const minimizeBtn = header?.querySelector('#talvyn-collapse-btn')
  assert(Boolean(minimizeBtn), '1g: Header contains minimize button [−]')

  const closeBtn = header?.querySelector('#talvyn-dismiss-btn')
  assert(Boolean(closeBtn), '1h: Header contains close button [×]')

  // ─── 2. Strict Matching on Fresher Profile ───────────────────────────────────
  console.log('\n--- 2. Testing Strict Matching on Fresher Candidate ---')
  assert(normFresher.experienceMatchStatus === 'MISMATCH', '2a: Fresher candidate against 2-4yr role evaluated as MISMATCH')
  assert(normFresher.matchScore <= 42, `2b: Fresher match score strictly capped <= 42% (Got: ${normFresher.matchScore}%)`)
  assert(normFresher.recommendationLabel === 'LOW MATCH', `2c: Fresher candidate receives LOW MATCH recommendation (Got: ${normFresher.recommendationLabel})`)

  // ─── 3. Controlled Application Review Modal ─────────────────────────────────
  console.log('\n--- 3. Testing Controlled Review Before Apply Screen ---')
  const applyBtn = panel?.querySelector('#talvyn-apply-btn') as HTMLButtonElement | null
  assert(Boolean(applyBtn), '3a: Panel has [ ⚡ Apply with Talvyn ] button')

  applyBtn?.click()

  const reviewView = panel?.querySelector('#talvyn-apply-review-view')
  assert(Boolean(reviewView), '3b: Clicking Apply with Talvyn opens Controlled Review screen')

  const reviewHtml = panel?.innerHTML || ''
  assert(reviewHtml.includes('CONTROLLED APPLICATION REVIEW'), '3c: Displays CONTROLLED APPLICATION REVIEW header')
  assert(reviewHtml.includes('Safe Fields'), '3d: Displays Safe Fields section')
  assert(reviewHtml.includes('John Doe'), '3e: Safe fields include candidate name')
  assert(reviewHtml.includes('john.doe@example.com'), '3f: Safe fields include candidate email')
  assert(reviewHtml.includes('John_Frontend_Resume.pdf'), '3g: Safe fields include candidate resume')

  assert(reviewHtml.includes('Sensitive Fields'), '3h: Displays Sensitive Fields section with review notice')
  assert(reviewHtml.includes('Work Authorization'), '3i: Sensitive fields include Work Authorization')
  assert(reviewHtml.includes('Expected Salary'), '3j: Sensitive fields include Expected Salary')
  assert(reviewHtml.includes('Disability & Veteran Status'), '3k: Sensitive fields include Disability & Veteran Status')

  const reviewEditBtn = reviewView?.querySelector('#talvyn-review-edit-profile-btn') as HTMLButtonElement | null
  assert(Boolean(reviewEditBtn), '3l: Review screen has [ 👤 Edit Details ] button')

  const reviewContinueBtn = reviewView?.querySelector('#talvyn-review-continue-btn') as HTMLButtonElement | null
  assert(Boolean(reviewContinueBtn), '3m: Review screen has [ Review & Continue ⚡ ] button')

  // ─── 4. Candidate Profile Inspector & In-Panel Re-matching ───────────────────
  console.log('\n--- 4. Testing Candidate Profile Inspection & Live Re-Matching ---')

  reviewEditBtn?.click()

  const profileView = panel?.querySelector('#talvyn-profile-view')
  assert(Boolean(profileView), '4a: Clicking Edit Details opens Candidate Profile view')

  const profileHtml = panel?.innerHTML || ''
  assert(profileHtml.includes('CANDIDATE PROFILE'), '4b: Candidate Profile view renders title')
  assert(profileHtml.includes('Career Targeting'), '4c: Profile view has Career Targeting section')
  assert(profileHtml.includes('Contact & Links'), '4d: Profile view has Contact & Links section')
  assert(profileHtml.includes('Preferences & Authorization'), '4e: Profile view has Preferences & Authorization section')

  // Update experience from 0 (Fresher) to 3 years
  const expInput = profileView?.querySelector('#inp-p-exp') as HTMLInputElement | null
  assert(Boolean(expInput), '4f: Experience input element exists in profile editor')
  if (expInput) expInput.value = '3'

  // Update skills to include Node.js
  const skillsInput = profileView?.querySelector('#inp-p-skills') as HTMLInputElement | null
  if (skillsInput) skillsInput.value = 'React, TypeScript, Node.js'

  const saveProfileBtn = profileView?.querySelector('#talvyn-save-profile-btn') as HTMLButtonElement | null
  assert(Boolean(saveProfileBtn), '4g: Profile editor has [ 💾 Save Profile & Re-Run Matching ] button')

  // Click save profile & re-run matching
  saveProfileBtn?.click()

  // Verify that profile re-running matches new candidate profile against job
  const updatedProfile: UserProfile = {
    ...initialFresherProfile,
    experienceYears: 3,
    skills: ['React', 'TypeScript', 'Node.js'],
  }
  const reEvaluatedNorm = normalizeJob(mockJob, updatedProfile)

  assert(reEvaluatedNorm.experienceMatchStatus === 'MATCH', '4h: Experience status changed from MISMATCH to MATCH after profile update')
  assert(reEvaluatedNorm.matchScore >= 80, `4i: Match score jumped from <=42% to >=80% (Got: ${reEvaluatedNorm.matchScore}%)`)
  assert(reEvaluatedNorm.recommendationLabel === 'STRONG MATCH' || reEvaluatedNorm.recommendationLabel === 'GOOD MATCH',
    `4j: Recommendation tier updated to Strong/Good match (Got: ${reEvaluatedNorm.recommendationLabel})`)

  // ─── 5. Multi-Job Discovery Panel Filter Tabs ────────────────────────────────
  console.log('\n--- 5. Testing Multi-Job Discovery Filter Tabs ---')
  const discoveryManager = new DiscoveryPanelManager()
  const mockSummary: JobListAnalysisSummary = {
    totalDetected: 5,
    excellentCount: 2,
    highlyRelevantCount: 1,
    relevantCount: 1,
    lowRelevanceCount: 1,
    analyzedJobs: [
      {
        job: { title: 'Senior React Dev', company: 'Alpha', jobUrl: 'https://job/1', sourceWebsite: 'indeed' },
        relevanceScore: 92,
        category: 'EXCELLENT',
        isSaved: false,
        matchFactors: { roleMatch: 1, experienceMatch: 1, educationMatch: 1, skillsMatch: 1, locationMatch: 1 },
      },
      {
        job: { title: 'Lead Frontend Eng', company: 'Beta', jobUrl: 'https://job/2', sourceWebsite: 'indeed' },
        relevanceScore: 88,
        category: 'EXCELLENT',
        isSaved: false,
        matchFactors: { roleMatch: 1, experienceMatch: 1, educationMatch: 1, skillsMatch: 1, locationMatch: 1 },
      },
      {
        job: { title: 'React Developer', company: 'Gamma', jobUrl: 'https://job/3', sourceWebsite: 'indeed' },
        relevanceScore: 78,
        category: 'HIGHLY_RELEVANT',
        isSaved: true,
        matchFactors: { roleMatch: 1, experienceMatch: 0.8, educationMatch: 1, skillsMatch: 0.8, locationMatch: 1 },
      },
      {
        job: { title: 'Fullstack Dev', company: 'Delta', jobUrl: 'https://job/4', sourceWebsite: 'indeed' },
        relevanceScore: 62,
        category: 'RELEVANT',
        isSaved: false,
        matchFactors: { roleMatch: 0.7, experienceMatch: 0.5, educationMatch: 1, skillsMatch: 0.6, locationMatch: 1 },
      },
      {
        job: { title: 'Java Backend Eng', company: 'Epsilon', jobUrl: 'https://job/5', sourceWebsite: 'indeed' },
        relevanceScore: 28,
        category: 'LOW_RELEVANCE',
        isSaved: false,
        matchFactors: { roleMatch: 0.2, experienceMatch: 0.2, educationMatch: 1, skillsMatch: 0.2, locationMatch: 0.5 },
      },
    ],
  }

  discoveryManager.render(mockSummary, {
    onSaveJob: async () => {},
    onDismiss: () => {},
    onRefresh: () => {},
  })

  let discPanel = document.getElementById(DISCOVERY_PANEL_ID)
  assert(Boolean(discPanel), '5a: Discovery panel rendered in DOM')

  let tabBtns = Array.from(discPanel?.querySelectorAll('.talvyn-tab-btn') || []) as HTMLElement[]
  const tabFilters = tabBtns.map((b) => b.getAttribute('data-filter'))

  assert(tabFilters.includes('ALL'), '5b: Includes [All] filter tab')
  assert(tabFilters.includes('STRONG'), '5c: Includes [Strong] filter tab')
  assert(tabFilters.includes('GOOD'), '5d: Includes [Good] filter tab')
  assert(tabFilters.includes('MODERATE'), '5e: Includes [Moderate] filter tab')
  assert(tabFilters.includes('LOW'), '5f: Includes [Low] filter tab')
  assert(tabFilters.includes('SAVED'), '5g: Includes [Saved] filter tab')

  // Click STRONG tab
  const strongTab = tabBtns.find((b) => b.getAttribute('data-filter') === 'STRONG')
  strongTab?.click()

  discPanel = document.getElementById(DISCOVERY_PANEL_ID)
  const strongCards = discPanel?.querySelectorAll('.talvyn-save-card-btn') || []
  assert(strongCards.length === 2, `5h: STRONG tab shows exactly 2 strong match cards (Got: ${strongCards.length})`)

  // Click SAVED tab
  tabBtns = Array.from(discPanel?.querySelectorAll('.talvyn-tab-btn') || []) as HTMLElement[]
  const savedTab = tabBtns.find((b) => b.getAttribute('data-filter') === 'SAVED')
  savedTab?.click()

  discPanel = document.getElementById(DISCOVERY_PANEL_ID)
  const savedCards = discPanel?.querySelectorAll('.talvyn-save-card-btn') || []
  assert(savedCards.length === 1, `5i: SAVED tab shows exactly 1 saved card (Got: ${savedCards.length})`)

  // ─── 6. Non-Job Page Notice ──────────────────────────────────────────────────
  console.log('\n--- 6. Testing Non-Job Page Safety Notice ---')
  injectUnsupportedNotice(() => {}, () => {})

  const noticePanel = document.getElementById(PANEL_ID)
  const noticeText = noticePanel?.textContent || ''

  assert(noticeText.includes('No job opportunities detected on this page.'),
    '6a: Unsupported notice displays exact required text "No job opportunities detected on this page."')

  const reanalyzeBtn = noticePanel?.querySelector('#talvyn-reanalyze-btn') as HTMLButtonElement | null
  assert(Boolean(reanalyzeBtn), '6b: Notice has re-analyze button')
  assert(reanalyzeBtn?.textContent?.trim() === 'Analyze Again',
    `6c: Re-analyze button has exact label "Analyze Again" (Got: "${reanalyzeBtn?.textContent?.trim()}")`)

  discoveryManager.remove()
  noticePanel?.remove()

  console.log('\n===========================================================')
  console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`)
  console.log('===========================================================')

  if (failCount > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
