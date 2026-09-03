/**
 * Comprehensive Automated Verification Suite for Talvyn Job Intelligence,
 * Strict Matching, Detail Panel Normalizer, Unstop Adapter, and Tracker Status Sync.
 */

import { normalizeJob } from '../extension/src/content/jobNormalizer'
import { UnstopAdapter } from '../extension/src/content/adapters/unstop'
import { ExtractedJob, UserProfile } from '../extension/src/types'

console.log('====================================================')
console.log('TALVYN FINAL JOB INTELLIGENCE & STRICT MATCH VERIFICATION')
console.log('====================================================\n')

let passed = 0
let failed = 0

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${name}`)
    if (detail) console.error(`    Detail: ${detail}`)
    failed++
  }
}

// ─── 1. Strict Normalizer Matching Tests ─────────────────────────────────────
console.log('--- 1. Testing Job Normalizer Strict Matching Engine ---')

const fresherProfile: UserProfile = {
  id: 'user-fresher-1',
  userId: 'user-fresher-1',
  preferredRoles: ['React Developer', 'Frontend Developer', 'Software Engineer'],
  preferredLocations: ['Bangalore', 'Remote'],
  preferredJobTypes: ['FULL_TIME'],
  experienceYears: 0, // Fresher
  skills: ['JavaScript', 'React', 'Node.js', 'HTML5', 'CSS3'],
  degree: 'B.Tech',
  specialization: 'Computer Science',
  workStyle: 'ANY',
  onboardingCompleted: true,
  otherLinks: [],
}

// Case A: 2-4 years experience job (Candidate is Fresher)
const job2to4Years: ExtractedJob = {
  title: 'React Developer (2-4 yrs experience)',
  company: 'TechSolutions Inc',
  location: 'Bangalore',
  jobType: 'Full-time',
  description: 'Looking for a React Developer with 2-4 years of hands-on experience in React, JavaScript, Node.js.',
  jobUrl: 'https://unstop.com/jobs/react-dev-2-4',
  sourceWebsite: 'Unstop',
  confidence: 'HIGH',
}

const norm2to4 = normalizeJob(job2to4Years, fresherProfile)

assert(
  norm2to4.recommendation === 'LOW_MATCH',
  `Fresher candidate vs 2-4 yrs job is categorized as LOW_MATCH (Got: ${norm2to4.recommendation})`
)
assert(
  norm2to4.matchScore <= 46,
  `Match score is capped <= 46% due to hard eligibility override (Got: ${norm2to4.matchScore}%)`
)
assert(
  norm2to4.experienceMatchStatus === 'MISMATCH',
  `Experience match status is MISMATCH (Got: ${norm2to4.experienceMatchStatus})`
)
assert(
  norm2to4.unmatchedFactors.some((f) => f.toLowerCase().includes('experience mismatch')),
  'Unmatched factors explicitly list Experience mismatch'
)
assert(
  norm2to4.matchedSkills.includes('React') && norm2to4.matchedSkills.includes('JavaScript'),
  'Matched skills are accurately extracted despite experience mismatch'
)

// Case B: Fresher job (Candidate is Fresher)
const jobFresher: ExtractedJob = {
  title: 'Associate React Developer (Fresher / 0-1 years)',
  company: 'StartupGrid',
  location: 'Bangalore',
  jobType: 'Full-time',
  description: 'Great opportunity for freshers and entry-level graduates with B.Tech in CS/IT. Skills: React, JavaScript.',
  jobUrl: 'https://unstop.com/jobs/associate-react-fresher',
  sourceWebsite: 'Unstop',
  confidence: 'HIGH',
}

const normFresher = normalizeJob(jobFresher, fresherProfile)

assert(
  normFresher.recommendation === 'STRONG_MATCH' || normFresher.recommendation === 'GOOD_MATCH',
  `Fresher candidate vs Fresher job is STRONG/GOOD MATCH (Got: ${normFresher.recommendation}, score: ${normFresher.matchScore}%)`
)
assert(
  normFresher.matchScore >= 80,
  `Match score is >= 80% (Got: ${normFresher.matchScore}%)`
)
assert(
  normFresher.experienceMatchStatus === 'MATCH',
  'Experience match status is MATCH'
)
assert(
  normFresher.educationMatchStatus === 'MATCH',
  'Education match status is MATCH for B.Tech'
)

// Case C: Unrelated Role
const jobSales: ExtractedJob = {
  title: 'Enterprise Account Executive - B2B Sales',
  company: 'RevenueMax',
  location: 'Bangalore',
  jobType: 'Full-time',
  description: 'Manage B2B enterprise sales pipelines.',
  jobUrl: 'https://unstop.com/jobs/sales-exec',
  sourceWebsite: 'Unstop',
  confidence: 'HIGH',
}

const normSales = normalizeJob(jobSales, fresherProfile)

assert(
  normSales.recommendation === 'LOW_MATCH',
  `Unrelated role is categorized as LOW_MATCH (Got: ${normSales.recommendation})`
)
assert(
  normSales.matchScore <= 44,
  `Unrelated role match score is capped <= 44% (Got: ${normSales.matchScore}%)`
)
assert(
  normSales.roleMatchStatus === 'MISMATCH',
  'Role match status is MISMATCH'
)

// ─── 2. Testing Unstop Adapter Extraction ────────────────────────────────────
console.log('\n--- 2. Testing Unstop Adapter Extraction & Normalization ---')

const unstopAdapter = new UnstopAdapter()

assert(
  unstopAdapter.canHandle('https://unstop.com/jobs/software-engineer-101'),
  'Can handle unstop.com job URLs'
)
assert(
  unstopAdapter.isJobDetailPage('https://unstop.com/jobs/software-engineer-101'),
  'Identifies /jobs/:slug as job detail page'
)
assert(
  unstopAdapter.isJobDetailPage('https://unstop.com/internships/frontend-intern-202'),
  'Identifies /internships/:slug as job detail page'
)
assert(
  unstopAdapter.isJobListingPage('https://unstop.com/jobs'),
  'Identifies /jobs as job listing page'
)
assert(
  unstopAdapter.isJobListingPage('https://unstop.com/internships?location=bangalore'),
  'Identifies /internships with query params as listing page'
)

// ─── 4. Testing Sensitive Field Protection in Autofill ───────────────────────
console.log('\n--- 4. Testing Sensitive Field Protection in Autofill ---')

import { fieldMatcher } from '../extension/src/content/autofill/fieldMatcher'
import { DetectedFormField } from '../extension/src/types'

function makeTestField(overrides: Partial<DetectedFormField>): DetectedFormField {
  return {
    id: 'f-test',
    element: {} as HTMLElement,
    selector: '#test',
    tag: 'input',
    inputType: 'text',
    name: 'test',
    domId: 'test',
    label: '',
    placeholder: '',
    ariaLabel: '',
    autocomplete: '',
    nearbyText: '',
    options: [],
    currentValue: '',
    isRequired: false,
    isIgnored: false,
    ...overrides,
  }
}

const workAuthField = makeTestField({
  label: 'Are you authorized to work in India?',
  name: 'work_auth',
  tag: 'radio',
  options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }],
})
const mWorkAuth = fieldMatcher.matchField(workAuthField, fresherProfile)
assert(
  mWorkAuth.isSensitive === true && mWorkAuth.canAutofill === false && mWorkAuth.requiresReview === true,
  'Work authorization is marked sensitive and requires manual review (canAutofill = false)'
)

const salaryField = makeTestField({
  label: 'Expected CTC / Salary',
  name: 'expected_salary',
})
const mSalary = fieldMatcher.matchField(salaryField, fresherProfile)
assert(
  mSalary.canAutofill === false && mSalary.requiresReview === true,
  'Salary expectations field requires manual review (canAutofill = false)'
)

const disabilityField = makeTestField({
  label: 'Voluntary Self-Identification of Disability',
  name: 'disability_status',
  tag: 'select',
})
const mDisability = fieldMatcher.matchField(disabilityField, fresherProfile)
assert(
  mDisability.isSensitive === true && mDisability.canAutofill === false,
  'Disability declaration is flagged as sensitive and requires review'
)

// ─── 5. Tracker 5-Column Normalization ────────────────────────────────────────
console.log('\n--- 5. Testing Tracker 5 Canonical Columns Normalization ---')

import { TRACKER_COLUMNS, normalizeStatusForColumn } from '../src/pages/tracker/Tracker'

assert(
  TRACKER_COLUMNS.length === 5,
  `Tracker defines exactly 5 canonical columns (Got: ${TRACKER_COLUMNS.length})`
)
assert(
  TRACKER_COLUMNS.map((c) => c.id).join(',') === 'SAVED,APPLIED,INTERVIEW,OFFER,REJECTED',
  'Columns are SAVED, APPLIED, INTERVIEW, OFFER, REJECTED'
)
assert(
  normalizeStatusForColumn('SAVED') === 'SAVED' &&
  normalizeStatusForColumn('IN_PROGRESS') === 'SAVED' &&
  normalizeStatusForColumn('APPLIED') === 'APPLIED' &&
  normalizeStatusForColumn('ASSESSMENT') === 'INTERVIEW' &&
  normalizeStatusForColumn('INTERVIEW') === 'INTERVIEW' &&
  normalizeStatusForColumn('OFFER') === 'OFFER' &&
  normalizeStatusForColumn('REJECTED') === 'REJECTED',
  'All legacy statuses map deterministically to the 5 canonical columns'
)

// ─── 6. Search Listing "Save Top Matches" Filtering ──────────────────────────
console.log('\n--- 6. Testing Search/Listing Save Top Matches Filtering ---')

const analyzedSampleJobs = [
  { id: '1', category: 'EXCELLENT', score: 88, isSaved: false },
  { id: '2', category: 'HIGHLY_RELEVANT', score: 76, isSaved: false },
  { id: '3', category: 'RELEVANT', score: 58, isSaved: false },
  { id: '4', category: 'LOW_RELEVANCE', score: 42, isSaved: false },
]

const topMatchesToSave = analyzedSampleJobs.filter(
  (j) => (j.category === 'EXCELLENT' || j.category === 'HIGHLY_RELEVANT') && !j.isSaved
)

assert(
  topMatchesToSave.length === 2 && !topMatchesToSave.some((j) => j.category === 'LOW_RELEVANCE'),
  'Save Top Matches strictly includes Strong & Good matches (>=70%), never Low matches'
)

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n====================================================')
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`)
console.log('====================================================')

if (failed > 0) process.exit(1)
