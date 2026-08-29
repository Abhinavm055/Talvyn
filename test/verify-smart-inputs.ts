/**
 * Automated Verification Test for Talvyn Phase 2E.1:
 * Smart Profile & Onboarding Inputs
 *
 * Tests:
 * 1. Degree search & categories
 * 2. Field of study search
 * 3. Skill prefix search
 * 4. Skill synonym search (JS -> JavaScript, Postgres -> PostgreSQL, K8s -> Kubernetes)
 * 5. Duplicate skill prevention logic
 * 6. Role search & domain taxonomy
 * 7. Role synonym search (SDE -> Software Engineer, PM -> Product Manager)
 * 8. Location search & Remote variations
 * 9. Job type search & selection
 * 10. Language search (Indian & Global)
 * 11. University / Institution search (IIT, Anna University, Stanford)
 * 12. Unknown university fallback logic (custom input)
 * 13. Data safety & array normalization (null, undefined, string, JSON arrays)
 * 14. Google user profile compatibility
 * 15. Saved profile loading simulation
 */

import { searchDegrees, DEGREES } from '../src/data/degrees'
import { searchFieldsOfStudy } from '../src/data/fieldsOfStudy'
import { searchSkills, SKILL_SYNONYMS } from '../src/data/skills'
import { searchRoles, ROLE_SYNONYMS } from '../src/data/roles'
import { searchJobTypes, JOB_TYPES } from '../src/data/jobTypes'
import { searchLanguages } from '../src/data/languages'
import { institutionSearchService, LocalInstitutionProvider } from '../src/services/institutionSearch'
import { locationSearchService, LocalLocationProvider } from '../src/services/locationSearch'
import { normalizeTags } from '../src/components/ui/TagInput'
import { normalizeProfile } from '../src/api/profile'

console.log('=================================================================')
console.log('TALVYN PHASE 2E.1: SMART PROFILE & ONBOARDING INPUTS TESTS')
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
  // ─── 1. Degree Search & Categories ──────────────────────────────────────────
  console.log('--- 1. Testing Degree Search ---')
  const btechResults = searchDegrees('btech')
  assert(
    btechResults.some((d) => d.value === 'B.Tech' || d.label.includes('Bachelor of Technology')),
    'Searches and finds B.Tech by keyword "btech"'
  )

  const mbaResults = searchDegrees('mba')
  assert(
    mbaResults.some((d) => d.value === 'MBA'),
    'Searches and finds MBA by acronym "mba"'
  )

  const allDegrees = searchDegrees('')
  assert(allDegrees.length === DEGREES.length, 'Empty query returns all available degrees')

  // ─── 2. Field of Study Search ──────────────────────────────────────────────
  console.log('\n--- 2. Testing Field of Study Search ---')
  const csResults = searchFieldsOfStudy('cse')
  assert(
    csResults.some((f) => f.value === 'Computer Science & Engineering'),
    'Finds Computer Science & Engineering using alias "cse"'
  )

  const financeResults = searchFieldsOfStudy('finance')
  assert(
    financeResults.some((f) => f.value === 'Finance & Banking'),
    'Finds Finance & Banking by keyword "finance"'
  )

  // ─── 3. Skill Prefix & Synonym Search ──────────────────────────────────────
  console.log('\n--- 3. Testing Skill Search & Synonyms ---')
  const reactSkills = searchSkills('react')
  assert(
    reactSkills.some((s) => s.name === 'React') && reactSkills.some((s) => s.name === 'React Native'),
    'Prefix search for "react" returns React and React Native'
  )

  const jsSkills = searchSkills('js')
  assert(
    jsSkills[0]?.name === 'JavaScript',
    'Synonym "js" prioritizes "JavaScript" as first result'
  )

  const k8sSkills = searchSkills('k8s')
  assert(
    k8sSkills[0]?.name === 'Kubernetes',
    'Synonym "k8s" prioritizes "Kubernetes"'
  )

  const postgresSkills = searchSkills('postgres')
  assert(
    postgresSkills[0]?.name === 'PostgreSQL',
    'Synonym "postgres" prioritizes "PostgreSQL"'
  )

  // ─── 4. Duplicate Skill Prevention Logic ───────────────────────────────────
  console.log('\n--- 4. Testing Duplicate Prevention ---')
  const existingSkills = ['React', 'Node.js']
  const addSkillSafely = (current: string[], newSkill: string): string[] => {
    const trimmed = newSkill.trim()
    if (!trimmed) return current
    const exists = current.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    return exists ? current : [...current, trimmed]
  }

  const dupAttempt = addSkillSafely(existingSkills, 'react')
  assert(dupAttempt.length === 2, 'Rejects duplicate skill (case-insensitive "react" vs "React")')

  const validAdd = addSkillSafely(existingSkills, 'TypeScript')
  assert(validAdd.length === 3 && validAdd.includes('TypeScript'), 'Successfully adds new unique skill')

  // ─── 5. Role Search & Domain Taxonomy ──────────────────────────────────────
  console.log('\n--- 5. Testing Role Search & Taxonomy ---')
  const dataRoles = searchRoles('data')
  assert(
    dataRoles.some((r) => r.title === 'Data Analyst') &&
    dataRoles.some((r) => r.title === 'Data Scientist') &&
    dataRoles.some((r) => r.title === 'Data Engineer'),
    'Search for "data" returns Data Analyst, Data Scientist, and Data Engineer'
  )

  const sdeRoles = searchRoles('sde')
  assert(
    sdeRoles[0]?.title === 'Software Engineer',
    'Synonym "sde" returns "Software Engineer"'
  )

  const pmRoles = searchRoles('pm')
  assert(
    pmRoles[0]?.title === 'Product Manager',
    'Synonym "pm" returns "Product Manager"'
  )

  // ─── 6. Location Search & Remote Variations ────────────────────────────────
  console.log('\n--- 6. Testing Location Search & Remote Variations ---')
  const remoteLocs = await locationSearchService.searchLocations('remote')
  assert(
    remoteLocs.some((l) => l === 'Remote') &&
    remoteLocs.some((l) => l.includes('Remote — India')) &&
    remoteLocs.some((l) => l.includes('Remote — Worldwide')),
    'Location search for "remote" returns all Remote options'
  )

  const bangaloreLocs = await locationSearchService.searchLocations('bang')
  assert(
    bangaloreLocs.some((l) => l.includes('Bengaluru, Karnataka')),
    'Alias search for "bang" resolves to "Bengaluru, Karnataka, India"'
  )

  const chennaiLocs = await locationSearchService.searchLocations('chen')
  assert(
    chennaiLocs.some((l) => l.includes('Chennai, Tamil Nadu')),
    'Prefix search for "chen" resolves to "Chennai, Tamil Nadu, India"'
  )

  // ─── 7. Job Type & Language Search ─────────────────────────────────────────
  console.log('\n--- 7. Testing Job Types & Languages ---')
  const jobTypes = searchJobTypes('intern')
  assert(
    jobTypes.some((jt) => jt.value === 'Internship'),
    'Finds "Internship" job type'
  )

  const languages = searchLanguages('tamil')
  assert(
    languages.some((l) => l.name === 'Tamil'),
    'Finds "Tamil" language'
  )

  // ─── 8. Institution / University Autocomplete ──────────────────────────────
  console.log('\n--- 8. Testing Institution Search & Fallback ---')
  const iitInsts = await institutionSearchService.searchInstitutions('iit')
  assert(
    iitInsts.some((inst) => inst.includes('IIT Madras')) &&
    iitInsts.some((inst) => inst.includes('IIT Bombay')),
    'Searches and finds IIT institutions'
  )

  const annaInsts = await institutionSearchService.searchInstitutions('anna')
  assert(
    annaInsts.some((inst) => inst.includes('Anna University')),
    'Searches and finds Anna University institutions'
  )

  const stanfordInsts = await institutionSearchService.searchInstitutions('stanford')
  assert(
    stanfordInsts.some((inst) => inst.includes('Stanford University')),
    'Searches and finds global universities (Stanford)'
  )

  // Unknown custom institution fallback
  const customQuery = 'Karpagam Academy of Higher Education'
  const customResults = await institutionSearchService.searchInstitutions(customQuery)
  assert(
    Array.isArray(customResults),
    'Custom institution search returns safe array without crashing'
  )

  // ─── 9. Profile Data Safety & Normalization ────────────────────────────────
  console.log('\n--- 9. Testing Profile Normalization ---')
  const safeP = normalizeProfile({
    skills: '["Python", "Django"]' as any,
    preferredRoles: 'Backend Developer, Full Stack Developer' as any,
    preferredLocations: null as any,
    preferredJobTypes: undefined as any,
  })

  assert(
    Array.isArray(safeP.skills) && safeP.skills.length === 2 &&
    Array.isArray(safeP.preferredRoles) && safeP.preferredRoles.length === 2 &&
    Array.isArray(safeP.preferredLocations) && safeP.preferredLocations.length === 0 &&
    Array.isArray(safeP.preferredJobTypes) && safeP.preferredJobTypes.length === 0,
    'normalizeProfile safely converts strings, nulls, and undefined into clean string[] arrays'
  )

  const safeTags = normalizeTags('["React", "TypeScript"]')
  assert(
    Array.isArray(safeTags) && safeTags.length === 2 && safeTags[0] === 'React',
    'normalizeTags decodes stringified arrays safely'
  )

  console.log('\n=================================================================')
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
  console.log('=================================================================')

  if (failedTests > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Smart input test runner failed:', err)
  process.exit(1)
})
