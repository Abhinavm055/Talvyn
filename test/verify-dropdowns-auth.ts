/**
 * Automated Verification Suite:
 * 1. Searchable Dropdown Suggestions (Country, State, City, Institution, Degree, Specialization, Work Auth, Skills, Roles, Languages)
 * 2. Cascade Country -> State -> City filtering
 * 3. Token & Spaced Acronym Matching ("M G" -> MG University)
 * 4. Re-Login & Onboarding Redirect Determinism
 */

import { searchCountries } from '../src/data/countries'
import { searchStates } from '../src/data/states'
import { searchCities } from '../src/data/cities'
import { searchWorkAuthorizations } from '../src/data/workAuthorization'
import { searchDegrees } from '../src/data/degrees'
import { searchFieldsOfStudy } from '../src/data/fieldsOfStudy'
import { searchSkills } from '../src/data/skills'
import { searchRoles } from '../src/data/roles'
import { searchLanguages } from '../src/data/languages'
import { institutionSearchService } from '../src/services/institutionSearch'
import { formatUserProfile } from '../server/routes/auth'
import { normalizeProfile } from '../src/api/profile'

console.log('=================================================================')
console.log('TALVYN: DROPDOWNS & RE-LOGIN AUTHENTICATION VERIFICATION TESTS')
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

async function runTests() {
  // ─── 1. Testing Country Search ──────────────────────────────────────────────
  console.log('--- 1. Testing Country Search ---')

  const indCountries = searchCountries('Ind')
  assert(
    indCountries.includes('India') && indCountries.includes('Indonesia'),
    'Typing "Ind" suggests both "India" and "Indonesia"'
  )

  const usCountries = searchCountries('usa')
  assert(usCountries.includes('United States'), 'Alias search "usa" resolves to "United States"')

  const emptyCountries = searchCountries('')
  assert(emptyCountries.length > 0, 'Empty country query returns top suggestions')

  // ─── 2. Testing State / Province Search & Country Cascade ───────────────────
  console.log('\n--- 2. Testing State Search & Country Cascade ---')

  const keralaState = searchStates('Ker', 'India')
  assert(keralaState.includes('Kerala'), 'Typing "Ker" with Country: "India" suggests "Kerala"')

  const calState = searchStates('Cal', 'United States')
  assert(calState.includes('California'), 'Typing "Cal" with Country: "United States" suggests "California"')

  const allStateSearch = searchStates('Ont')
  assert(allStateSearch.includes('Ontario'), 'State search without country filter finds "Ontario"')

  // ─── 3. Testing City Search & State Cascade ─────────────────────────────────
  console.log('\n--- 3. Testing City Search & State Cascade ---')

  const kochiCities = searchCities('Koc', 'India', 'Kerala')
  assert(
    kochiCities.some((c) => c.toLowerCase().includes('kochi')),
    'Typing "Koc" with Country: "India" and State: "Kerala" suggests "Kochi / Cochin"'
  )

  const blrCities = searchCities('beng', 'India', 'Karnataka')
  assert(
    blrCities.some((c) => c.toLowerCase().includes('bengaluru')),
    'Typing "beng" with Country: "India" and State: "Karnataka" suggests "Bengaluru"'
  )

  const sfCities = searchCities('San', 'United States', 'California')
  assert(
    sfCities.some((c) => c.includes('San Francisco')) && sfCities.some((c) => c.includes('San Jose')),
    'Typing "San" with Country: "United States" and State: "California" suggests San Francisco and San Jose'
  )

  // ─── 4. Testing Institution & Spaced Acronym Matching ───────────────────────
  console.log('\n--- 4. Testing University / Institution Search ---')

  const mgResults = await institutionSearchService.searchInstitutions('M G')
  assert(
    mgResults.some((i) => i.includes('Mahatma Gandhi University')),
    'Typing "M G" (spaced acronym) suggests "Mahatma Gandhi University (MG University)"'
  )

  const iitResults = await institutionSearchService.searchInstitutions('iit')
  assert(
    iitResults.some((i) => i.includes('IIT Madras')) && iitResults.some((i) => i.includes('IIT Bombay')),
    'Typing "iit" suggests premier IIT institutions'
  )

  const ktuResults = await institutionSearchService.searchInstitutions('ktu')
  assert(
    ktuResults.some((i) => i.includes('APJ Abdul Kalam Technological University')),
    'Typing "ktu" suggests "APJ Abdul Kalam Technological University (KTU)"'
  )

  // ─── 5. Testing Degree & Specialization Search ───────────────────────────────
  console.log('\n--- 5. Testing Degree & Specialization Search ---')

  const degreesBTech = searchDegrees('btech')
  assert(
    degreesBTech.some((d) => d.label.includes('B.Tech')),
    'Typing "btech" suggests Bachelor of Technology (B.Tech)'
  )

  const degreesMBA = searchDegrees('mba')
  assert(
    degreesMBA.some((d) => d.label.includes('MBA')),
    'Typing "mba" suggests Master of Business Administration (MBA)'
  )

  const fieldsCSE = searchFieldsOfStudy('cse')
  assert(
    fieldsCSE.some((f) => f.label.includes('Computer Science')),
    'Typing "cse" suggests Computer Science & Engineering'
  )

  const fieldsAI = searchFieldsOfStudy('ai')
  assert(
    fieldsAI.some((f) => f.label.includes('Artificial Intelligence')),
    'Typing "ai" suggests Artificial Intelligence & Machine Learning'
  )

  // ─── 6. Testing Work Authorization & Languages ──────────────────────────────
  console.log('\n--- 6. Testing Work Authorization & Languages ---')

  const workAuth = searchWorkAuthorizations('visa')
  assert(
    workAuth.some((w) => w.includes('Work Visa')) && workAuth.some((w) => w.includes('Student Visa')),
    'Typing "visa" suggests Work Visa and Student Visa options'
  )

  const langResults = searchLanguages('mala')
  assert(
    langResults.some((l) => l.name === 'Malayalam'),
    'Typing "mala" suggests "Malayalam"'
  )

  // ─── 7. Testing Re-Login Onboarding Routing & Profile Loading State ─────────
  console.log('\n--- 7. Testing Re-Login Onboarding Routing ---')

  // Case A: Existing user with onboardingCompleted = true
  const completedProfile = {
    id: 'prof_1',
    userId: 'usr_1',
    onboardingCompleted: true,
    preferredRoles: '["Senior Software Engineer"]',
    skills: '["React", "TypeScript"]',
    languages: '["English"]',
  }
  const formattedA = formatUserProfile(completedProfile)
  const isCompletedA = formattedA?.onboardingCompleted === true
  assert(isCompletedA, 'Existing completed user has explicit onboardingCompleted = true')

  const targetRouteA = isCompletedA ? '/dashboard' : '/onboarding'
  assert(targetRouteA === '/dashboard', 'Existing completed user redirects directly to /dashboard on re-login')

  // Case B: Existing incomplete user with onboardingCompleted = false
  const incompleteProfile = {
    id: 'prof_2',
    userId: 'usr_2',
    onboardingCompleted: false,
    preferredRoles: '[]',
  }
  const formattedB = formatUserProfile(incompleteProfile)
  const targetRouteB = formattedB?.onboardingCompleted === true ? '/dashboard' : '/onboarding'
  assert(targetRouteB === '/onboarding', 'Incomplete user redirects to /onboarding')

  // Case C: SQLite 1/0 integer boolean conversion
  const sqliteProfile = {
    id: 'prof_3',
    userId: 'usr_3',
    onboardingCompleted: 1, // integer from SQLite
  }
  const formattedC = formatUserProfile(sqliteProfile)
  assert(formattedC.onboardingCompleted === true, 'SQLite integer 1 converts safely to boolean true')

  // Case D: Loading state undefined profile guard
  const loadingProfile = undefined
  const normalizedLoading = normalizeProfile(loadingProfile)
  assert(
    normalizedLoading.onboardingCompleted === false && Array.isArray(normalizedLoading.skills),
    'Undefined loading profile initializes safely with empty arrays without crash'
  )

  console.log('\n=================================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('=================================================================')

  if (failedTests > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Dropdowns & Auth test runner failed:', err)
  process.exit(1)
})
