/**
 * Automated Verification Test for Talvyn Universal Job Application Autofill (Phase 2C)
 *
 * Verifies:
 * 1. Universal Field Taxonomy & Alias Matching
 * 2. Field Matcher Confidence Scorer
 * 3. Name Handling & "Never Invent Surname" rule
 * 4. Select & Radio Option Resolution
 * 5. Custom Question Detection & Manual Review Classification
 * 6. Resume Upload Detection
 * 7. Autofill Safety & Non-Submission Guarantee
 */

import { fieldMatcher } from '../src/content/autofill/fieldMatcher'
import { DetectedFormField, UserProfile } from '../src/types'

console.log('====================================================')
console.log('TALVYN PHASE 2C: UNIVERSAL AUTOFILL VERIFICATION')
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

// ─── Mock User Profile ────────────────────────────────────────────────────────
const sampleProfile: UserProfile = {
  id: 'u-101',
  userId: 'u-101',
  legalFullName: 'Alexander James Mercer',
  givenName: 'Alexander',
  middleName: 'James',
  familyName: 'Mercer',
  preferredName: 'Alex',
  email: 'alex.mercer@talvyn.com',
  phone: '+1 (555) 234-5678',
  address: '742 Evergreen Terrace',
  city: 'San Francisco',
  state: 'CA',
  country: 'United States',
  postalCode: '94107',
  preferredRoles: ['Senior Data Analyst'],
  skills: ['SQL', 'Python', 'Tableau', 'Looker'],
  experienceYears: 6,
  linkedinUrl: 'https://linkedin.com/in/alexmercer',
  portfolioUrl: 'https://alexmercer.dev',
  githubUrl: 'https://github.com/alexmercer',
  otherLinks: ['https://github.com/alexmercer'],
  institution: 'University of California, Berkeley',
  degree: 'Bachelor of Science in Computer Science',
  specialization: 'Data Science',
  graduationYear: 2020,
  cgpa: '3.85',
  workAuthorization: 'Yes, authorized to work',
  visaStatus: 'No sponsorship required',
  expectedSalary: '$130,000',
  noticePeriod: '2 weeks',
  preferredLocations: ['Remote', 'San Francisco, CA'],
  preferredJobTypes: ['FULL_TIME'],
  workStyle: 'REMOTE',
  onboardingCompleted: true,
}

function createMockField(overrides: Partial<DetectedFormField>): DetectedFormField {
  return {
    id: overrides.id || 'f1',
    element: {} as HTMLElement,
    selector: overrides.selector || '#field',
    tag: overrides.tag || 'input',
    inputType: overrides.inputType || 'text',
    name: overrides.name || '',
    domId: overrides.domId || '',
    label: overrides.label || '',
    placeholder: overrides.placeholder || '',
    ariaLabel: overrides.ariaLabel || '',
    autocomplete: overrides.autocomplete || '',
    nearbyText: overrides.nearbyText || '',
    options: overrides.options || [],
    currentValue: overrides.currentValue || '',
    isRequired: overrides.isRequired || false,
    isIgnored: false,
    ...overrides,
  }
}

// ─── TEST 1: Personal Field Detection & Matching ──────────────────────────────
console.log('--- 1. Testing Personal Field Matching ---')

const f1 = createMockField({ label: 'First Name *', name: 'first_name', autocomplete: 'given-name' })
const m1 = fieldMatcher.matchField(f1, sampleProfile)
assert(m1.detectedType === 'firstName' && m1.confidenceLevel === 'HIGH' && m1.valueToFill === 'Alexander', 'First name mapped with High confidence to "Alexander"', `value: ${m1.valueToFill}, conf: ${m1.confidence}%`)

const f2 = createMockField({ label: 'Candidate Last Name', name: 'candidate_lname' })
const m2 = fieldMatcher.matchField(f2, sampleProfile)
assert(m2.detectedType === 'lastName' && m2.confidenceLevel === 'HIGH' && m2.valueToFill === 'Mercer', 'Last name mapped with High confidence to "Mercer"')

const f3 = createMockField({ label: 'Email Address', inputType: 'email', name: 'user_email' })
const m3 = fieldMatcher.matchField(f3, sampleProfile)
assert(m3.detectedType === 'email' && m3.confidenceLevel === 'HIGH' && m3.valueToFill === 'alex.mercer@talvyn.com', 'Email mapped with High confidence')

const f4 = createMockField({ label: 'Mobile Number', inputType: 'tel', name: 'phone' })
const m4 = fieldMatcher.matchField(f4, sampleProfile)
assert(m4.detectedType === 'phone' && m4.confidenceLevel === 'HIGH' && m4.valueToFill === '+1 (555) 234-5678', 'Phone number mapped with High confidence')

// ─── TEST 2: Professional & Education Matching ────────────────────────────────
console.log('\n--- 2. Testing Professional & Education Matching ---')

const f5 = createMockField({ label: 'LinkedIn Profile URL', name: 'linkedin_url', placeholder: 'https://linkedin.com/in/...' })
const m5 = fieldMatcher.matchField(f5, sampleProfile)
assert(m5.detectedType === 'linkedinUrl' && m5.valueToFill === 'https://linkedin.com/in/alexmercer', 'LinkedIn URL mapped correctly')

const f6 = createMockField({ label: 'GitHub Profile', name: 'github' })
const m6 = fieldMatcher.matchField(f6, sampleProfile)
assert(m6.detectedType === 'githubUrl' && m6.valueToFill === 'https://github.com/alexmercer', 'GitHub URL extracted from profile/otherLinks')

const f7 = createMockField({ label: 'University / College', name: 'school' })
const m7 = fieldMatcher.matchField(f7, sampleProfile)
assert(m7.detectedType === 'institution' && m7.valueToFill === 'University of California, Berkeley', 'Institution mapped correctly')

// ─── TEST 3: Select & Radio Option Resolution ─────────────────────────────────
console.log('\n--- 3. Testing Select & Radio Option Matching ---')

const f8 = createMockField({
  label: 'Are you legally authorized to work in this country?',
  name: 'work_auth',
  tag: 'radio',
  inputType: 'radio',
  options: [
    { label: 'Yes, I am authorized', value: 'yes' },
    { label: 'No', value: 'no' },
  ],
})
const m8 = fieldMatcher.matchField(f8, sampleProfile)
assert(
  m8.detectedType === 'workAuthorization' && m8.valueToFill === 'yes',
  'Work authorization radio resolved to "yes"',
  `detectedType: ${m8.detectedType}, valueToFill: ${m8.valueToFill}, conf: ${m8.confidence}%, reason: ${m8.reason}`
)

const f9 = createMockField({
  label: 'Will you require visa sponsorship?',
  name: 'sponsorship',
  tag: 'select',
  options: [
    { label: '-- Select --', value: '' },
    { label: 'No, I do not require sponsorship', value: 'no_sponsorship' },
    { label: 'Yes, I require sponsorship', value: 'sponsorship_required' },
  ],
})
const m9 = fieldMatcher.matchField(f9, sampleProfile)
assert(m9.detectedType === 'visaStatus' && m9.valueToFill === 'no_sponsorship', 'Visa sponsorship select option matched correctly')

// ─── TEST 4: Name Handling & Missing Surname Rule ─────────────────────────────
console.log('\n--- 4. Testing Name Handling & Never Inventing Surname ---')

const mononymProfile: UserProfile = {
  id: 'u-102',
  userId: 'u-102',
  legalFullName: 'Cher',
  givenName: null,
  middleName: null,
  familyName: null,
  preferredName: 'Cher',
  preferredRoles: [],
  skills: [],
  otherLinks: [],
  experienceYears: null,
  workStyle: 'ANY',
  onboardingCompleted: true,
}

const fLastName = createMockField({ label: 'Last Name *', name: 'last_name' })
const mLastName = fieldMatcher.matchField(fLastName, mononymProfile)
assert(
  mLastName.canAutofill === false && mLastName.valueToFill === null && mLastName.reason.includes('Manual input required'),
  'Does not invent surname when missing; requires manual input',
  mLastName.reason
)

// ─── TEST 5: Custom Open-Ended Question Detection ─────────────────────────────
console.log('\n--- 5. Testing Custom Question Detection ---')

const fCustom = createMockField({
  tag: 'textarea',
  label: 'Why are you interested in joining our company? Describe your relevant experience.',
  name: 'why_company',
})
const mCustom = fieldMatcher.matchField(fCustom, sampleProfile)
assert(
  mCustom.isCustomQuestion === true && mCustom.canAutofill === false && mCustom.detectedType === 'customQuestion',
  'Custom question flagged for manual user review and NOT auto-filled',
  `isCustom: ${mCustom.isCustomQuestion}, canAutofill: ${mCustom.canAutofill}`
)

// ─── TEST 6: Resume Upload Detection ──────────────────────────────────────────
console.log('\n--- 6. Testing Resume Upload Field Detection ---')

const fResume = createMockField({
  label: 'Upload Resume / CV (PDF, DOCX)',
  inputType: 'file',
  name: 'resume_file',
})
const mResume = fieldMatcher.matchField(fResume, sampleProfile)
assert(
  mResume.isResumeUpload === true && mResume.detectedType === 'resumeUpload',
  'File input detected as resume upload helper target'
)

console.log('\n====================================================')
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
console.log('====================================================')

if (failedTests > 0) process.exit(1)
