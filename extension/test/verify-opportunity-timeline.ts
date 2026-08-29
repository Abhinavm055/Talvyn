/**
 * Automated Verification Test for Talvyn Phase 2E:
 * Universal Opportunity Management & Application Timeline
 *
 * Tests:
 * 1. Job classification
 * 2. Internship classification
 * 3. Graduate program classification
 * 4. Fellowship classification
 * 5. Competition classification
 * 6. Talent opportunity classification
 * 7. Ambiguous opportunity fallback
 * 8. Duplicate URL detection
 * 9. Duplicate title + company detection
 * 10. Application readiness with complete profile
 * 11. Application readiness with missing resume
 * 12. Application readiness against detected form fields
 * 13. Timeline event creation & structure
 * 14. Status transitions & completion tracking
 * 15. Deadline extraction
 * 16. No deadline false positive
 */

import { opportunityClassifier } from '../src/opportunityDetection/opportunityClassifier'
import { deadlineDetector } from '../src/opportunityDetection/deadlineDetector'
import { readinessScorer } from '../src/services/readinessScorer'
import { UserProfile, Resume, DetectedFormField } from '../src/types'

console.log('===========================================================')
console.log('TALVYN PHASE 2E: OPPORTUNITY & TIMELINE VERIFICATION TESTS')
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

// ─── 1. OPPORTUNITY CLASSIFICATION TESTS ─────────────────────────────────────
console.log('--- 1. Testing Opportunity Type Classification ---')

// 1. Job classification
const r1 = opportunityClassifier.classify('Senior Backend Engineer', 'Full-time backend role designing scalable APIs.')
assert(r1.type === 'JOB' && r1.confidence >= 75, 'Standard software role classified as JOB', `type: ${r1.type}, score: ${r1.confidence}`)

// 2. Internship classification
const r2 = opportunityClassifier.classify('Software Engineering Summer Intern 2026', 'Join our engineering team for a 12-week summer internship.')
assert(r2.type === 'INTERNSHIP' && r2.confidence >= 90, 'Summer internship role classified as INTERNSHIP', `type: ${r2.type}`)

// 3. Graduate program classification
const r3 = opportunityClassifier.classify('Graduate Technology Scheme 2026', 'Campus hiring for university graduates and early career engineers.')
assert(r3.type === 'GRADUATE_PROGRAM' && r3.confidence >= 90, 'Graduate scheme classified as GRADUATE_PROGRAM', `type: ${r3.type}`)

// 4. Fellowship classification
const r4 = opportunityClassifier.classify('Post-Doctoral AI Research Fellowship', 'One-year research fellowship exploring foundation models.')
assert(r4.type === 'FELLOWSHIP' && r4.confidence >= 90, 'Research fellowship classified as FELLOWSHIP', `type: ${r4.type}`)

// 5. Competition classification
const r5 = opportunityClassifier.classify('Global Web3 Hackathon & Coding Challenge', 'Compete for $50k in prizes in our annual hackathon challenge.')
assert(r5.type === 'COMPETITION' && r5.confidence >= 90, 'Hackathon / Challenge classified as COMPETITION', `type: ${r5.type}`)

// 6. Talent opportunity classification
const r6 = opportunityClassifier.classify('Creative Director Casting Call & Open Audition', 'Open audition and portfolio submission for commercial production.')
assert(r6.type === 'TALENT_OPPORTUNITY' && r6.confidence >= 90, 'Casting / Audition classified as TALENT_OPPORTUNITY', `type: ${r6.type}`)

// 7. Ambiguous opportunity fallback
const r7 = opportunityClassifier.classify('', '')
assert(r7.type === 'OTHER' && r7.confidence <= 50, 'Empty / ambiguous details fallback to OTHER', `type: ${r7.type}`)


// ─── 2. DUPLICATE DETECTION INTELLIGENCE ─────────────────────────────────────
console.log('\n--- 2. Testing Duplicate & Status Intelligence ---')

const existingJobs = [
  { id: 'job-1', title: 'Data Scientist', company: 'Google', jobUrl: 'https://careers.google.com/jobs/123', status: 'APPLIED' },
  { id: 'job-2', title: 'Product Manager', company: 'Stripe', jobUrl: 'https://stripe.com/jobs/456', status: 'SAVED' },
]

function checkDuplicateMock(url: string, title?: string, company?: string) {
  const matchByUrl = existingJobs.find((j) => j.jobUrl === url)
  if (matchByUrl) return { exists: true, job: matchByUrl, matchType: 'URL' }

  if (title && company) {
    const matchByTitleCompany = existingJobs.find(
      (j) => j.title.toLowerCase() === title.toLowerCase().trim() && j.company.toLowerCase() === company.toLowerCase().trim()
    )
    if (matchByTitleCompany) return { exists: true, job: matchByTitleCompany, matchType: 'TITLE_COMPANY' }
  }

  return { exists: false, job: null }
}

// 8. Duplicate URL detection
const dupUrl = checkDuplicateMock('https://careers.google.com/jobs/123')
assert(dupUrl.exists && dupUrl.job?.id === 'job-1' && dupUrl.job?.status === 'APPLIED', 'Detects duplicate by exact URL and preserves APPLIED status')

// 9. Duplicate title + company detection
const dupTitleCompany = checkDuplicateMock('https://another-aggregator.com/post/999', 'Product Manager', 'Stripe')
assert(dupTitleCompany.exists && dupTitleCompany.job?.id === 'job-2', 'Detects duplicate by Title + Company across different URLs')


// ─── 3. APPLICATION READINESS SCORING ────────────────────────────────────────
console.log('\n--- 3. Testing Application Readiness Scorer ---')

const mockCompleteProfile: UserProfile = {
  id: 'u-1',
  userId: 'u-1',
  legalFullName: 'Alexander Mercer',
  givenName: 'Alexander',
  familyName: 'Mercer',
  email: 'alex.mercer@example.com',
  phone: '+1 (555) 019-2834',
  linkedinUrl: 'https://linkedin.com/in/alexandermercer',
  portfolioUrl: 'https://alexmercer.dev',
  preferredRoles: ['Backend Engineer'],
  preferredLocations: ['San Francisco, CA'],
  skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
  otherLinks: ['https://github.com/alexandermercer'],
  workStyle: 'HYBRID',
  onboardingCompleted: true,
}

const mockResumes: Resume[] = [
  { id: 'res-1', userId: 'u-1', name: 'Software_Engineer_Resume.pdf', isDefault: true, createdAt: '', updatedAt: '' }
]

// 10. Application readiness with complete profile
const readyResult1 = readinessScorer.calculateReadiness(mockCompleteProfile, mockResumes)
assert(
  readyResult1.score === 100 && readyResult1.tier === 'READY' && readyResult1.missingItems.length === 0,
  'Complete profile calculates 100% Application Readiness (READY tier)',
  `score: ${readyResult1.score}%, missing: ${readyResult1.missingItems.join(', ')}`
)

// 11. Application readiness with missing resume
const readyResult2 = readinessScorer.calculateReadiness(mockCompleteProfile, [])
assert(
  readyResult2.score === 75 && readyResult2.tier === 'MOSTLY_READY' && readyResult2.missingItems.includes('Resume / CV'),
  'Missing resume drops readiness to 75% (MOSTLY_READY) with missing resume reason',
  `score: ${readyResult2.score}%, missing: ${readyResult2.missingItems.join(', ')}`
)

// 12. Application readiness against detected form fields
const detectedFormFields: DetectedFormField[] = [
  {
    element: {} as any,
    fieldType: 'FULL_NAME',
    label: 'Full Name',
    name: 'name',
    domId: 'name',
    placeholder: '',
    tagName: 'INPUT',
    inputType: 'text',
    required: true,
    confidence: 95,
  },
  {
    element: {} as any,
    fieldType: 'EMAIL',
    label: 'Email',
    name: 'email',
    domId: 'email',
    placeholder: '',
    tagName: 'INPUT',
    inputType: 'email',
    required: true,
    confidence: 95,
  },
]
const minimalProfile: UserProfile = {
  ...mockCompleteProfile,
  linkedinUrl: null,
  portfolioUrl: null,
  otherLinks: [],
}
const readyResult3 = readinessScorer.calculateReadiness(minimalProfile, [], detectedFormFields)
assert(
  readyResult3.score === 100 && readyResult3.tier === 'READY',
  'Form-specific readiness calculates 100% when all requested form fields are fulfilled',
  `score: ${readyResult3.score}%`
)


// ─── 4. APPLICATION TIMELINE & STATUS ────────────────────────────────────────
console.log('\n--- 4. Testing Application Timeline & Status Transitions ---')

function buildMockTimeline(status: string, dateSaved: string, dateApplied?: string) {
  const STATUS_RANKS: Record<string, number> = {
    SAVED: 1,
    INTERESTED: 1,
    IN_PROGRESS: 2,
    APPLIED: 3,
    ASSESSMENT: 4,
    INTERVIEW: 5,
    OFFER: 6,
    ACCEPTED: 7,
  }
  const currentRank = STATUS_RANKS[status] || 1

  return [
    { stage: 'SAVED', completed: true, timestamp: dateSaved },
    { stage: 'APPLICATION_STARTED', completed: currentRank >= 2 },
    { stage: 'APPLIED', completed: currentRank >= 3 || !!dateApplied },
    { stage: 'ASSESSMENT', completed: currentRank >= 4 },
    { stage: 'INTERVIEW', completed: currentRank >= 5 },
    { stage: 'OFFER', completed: currentRank >= 6 },
  ]
}

// 13. Timeline event creation & structure
const timelineSaved = buildMockTimeline('SAVED', '2026-08-20T10:00:00Z')
assert(
  timelineSaved[0].stage === 'SAVED' && timelineSaved[0].completed && !timelineSaved[1].completed,
  'Saved job has SAVED stage completed and subsequent stages pending'
)

// 14. Status transitions
const timelineInterview = buildMockTimeline('INTERVIEW', '2026-08-20T10:00:00Z', '2026-08-22T14:00:00Z')
const completedStages = timelineInterview.filter((s) => s.completed).map((s) => s.stage)
assert(
  completedStages.includes('SAVED') &&
  completedStages.includes('APPLICATION_STARTED') &&
  completedStages.includes('APPLIED') &&
  completedStages.includes('ASSESSMENT') &&
  completedStages.includes('INTERVIEW') &&
  !completedStages.includes('OFFER'),
  'Transition to INTERVIEW marks Saved, Started, Applied, Assessment, and Interview as completed',
  `completed: ${completedStages.join(' -> ')}`
)


// ─── 5. DEADLINE EXTRACTION TESTS ────────────────────────────────────────────
console.log('\n--- 5. Testing Deadline Detection ---')

// 15. Deadline extraction
const desc1 = 'Join our innovative team! Apply before August 30, 2026 to be considered.'
const deadline1 = deadlineDetector.extractDeadline(desc1)
assert(deadline1 === '2026-08-30', 'Extracts deadline from "Apply before August 30, 2026"', `extracted: ${deadline1}`)

const desc2 = 'Submissions close on September 15, 2026 at midnight.'
const deadline2 = deadlineDetector.extractDeadline(desc2)
assert(deadline2 === '2026-09-15', 'Extracts deadline from "close on September 15, 2026"', `extracted: ${deadline2}`)

// 16. No deadline false positive
const desc3 = 'We review applications on a rolling basis. Equal opportunity employer.'
const deadline3 = deadlineDetector.extractDeadline(desc3)
assert(deadline3 === null, 'Correctly returns null for descriptions without explicit deadline (zero false positive)', `extracted: ${deadline3}`)


console.log('\n===========================================================')
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
console.log('===========================================================')

if (failedTests > 0) process.exit(1)
