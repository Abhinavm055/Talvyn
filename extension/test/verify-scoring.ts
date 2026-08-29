/**
 * Automated Verification Test for Talvyn Smart Job List Analyzer (Phase 2B)
 *
 * Verifies:
 * 1. Role Normalization (stripping seniority, fluff)
 * 2. Role Matching (Exact, Strong Related, Related, Weak, No Match)
 * 3. Deterministic Relevance Scoring across different user career profiles
 * 4. Multi-domain support (Data, Tech, Design, Marketing, HR, Finance, Sales)
 */

import { normalizeRole } from '../src/services/roleTaxonomy'
import { evaluateRoleMatch } from '../src/services/roleMatcher'
import { analyzeJobRelevance } from '../src/services/relevanceScorer'
import { ExtractedJob, UserProfile } from '../src/types'

console.log('====================================================')
console.log('TALVYN PHASE 2B: SMART JOB LIST ANALYZER VERIFICATION')
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

// ─── TEST 1: Role Normalization ───────────────────────────────────────────────
console.log('--- 1. Testing Role Normalization ---')

const norm1 = normalizeRole('Senior Data Analyst - Remote [Urgent]')
assert(norm1.normalized === 'data analyst', 'Senior Data Analyst stripped to "data analyst"', norm1.normalized)
assert(norm1.seniority.level === 'SENIOR', 'Detected SENIOR seniority level', norm1.seniority.level)

const norm2 = normalizeRole('Lead UX/UI Product Designer (Contract)')
assert(norm2.normalized.includes('designer'), 'Designer title cleaned properly', norm2.normalized)
assert(norm2.seniority.level === 'LEAD', 'Detected LEAD seniority', norm2.seniority.level)

const norm3 = normalizeRole('Junior Talent Acquisition Specialist')
assert(norm3.seniority.level === 'ENTRY', 'Detected ENTRY seniority', norm3.seniority.level)

// ─── TEST 2: Role Matching Levels ─────────────────────────────────────────────
console.log('\n--- 2. Testing Role Matching Levels ---')

// 2a. Exact Match
const matchExact = evaluateRoleMatch('Senior Data Analyst', ['Data Analyst'])
assert(matchExact.level === 'EXACT_MATCH' && matchExact.score >= 0.95, 'Exact match for Senior Data Analyst vs Data Analyst', `score: ${matchExact.score}`)

// 2b. Strong Related Match (Taxonomy Synonym)
const matchSynonym = evaluateRoleMatch('Business Intelligence Analyst', ['Data Analyst'])
assert(matchSynonym.level === 'STRONG_RELATED' && matchSynonym.score >= 0.8, 'Strong related match for BI Analyst vs Data Analyst', `score: ${matchSynonym.score}, level: ${matchSynonym.level}`)

const matchReporting = evaluateRoleMatch('Reporting Analyst', ['Data Analyst'])
assert(matchReporting.level === 'STRONG_RELATED' && matchReporting.score >= 0.8, 'Strong related match for Reporting Analyst vs Data Analyst', `score: ${matchReporting.score}`)

// 2c. Broader Related Match
const matchDataSci = evaluateRoleMatch('Data Scientist', ['Data Analyst'])
assert(matchDataSci.level === 'RELATED' && matchDataSci.score >= 0.55, 'Broader related match for Data Scientist vs Data Analyst', `score: ${matchDataSci.score}`)

// 2d. No Match
const matchUnrelated = evaluateRoleMatch('Account Executive', ['Data Analyst'])
assert(matchUnrelated.level === 'NO_MATCH' && matchUnrelated.score === 0.0, 'No match for Account Executive vs Data Analyst', `score: ${matchUnrelated.score}`)

// ─── TEST 3: Multi-Domain Profile Scenarios ──────────────────────────────────
console.log('\n--- 3. Testing Full Relevance Scoring Across Career Domains ---')

// Scenario A: Data Analyst User
const dataProfile: UserProfile = {
  id: 'u-1',
  userId: 'u-1',
  preferredRoles: ['Data Analyst', 'BI Analyst'],
  preferredLocations: ['Remote', 'New York, NY'],
  preferredJobTypes: ['FULL_TIME'],
  experienceYears: 4,
  workStyle: 'REMOTE',
  expectedSalary: '$100,000',
  skills: ['SQL', 'Tableau', 'Python'],
  onboardingCompleted: true,
}

const jobData1: ExtractedJob = {
  title: 'Senior Data Analyst',
  company: 'GlobalTech Insights',
  location: 'Remote',
  salary: '$120,000',
  jobType: 'Full-time',
  jobUrl: 'https://example.com/jobs/1',
  sourceWebsite: 'Careers',
  confidence: 'HIGH',
}

const scoreData1 = analyzeJobRelevance(jobData1, dataProfile)
assert(
  scoreData1.relevanceScore >= 90 && scoreData1.category === 'EXCELLENT',
  `Data Analyst job receives EXCELLENT score (${scoreData1.relevanceScore}%)`,
  `Reasons: ${scoreData1.matchedReasons.join('; ')}`
)

const jobData2: ExtractedJob = {
  title: 'Enterprise Account Executive',
  company: 'SaaS Corp',
  location: 'Remote',
  salary: '$140,000',
  jobType: 'Full-time',
  jobUrl: 'https://example.com/jobs/18',
  sourceWebsite: 'Careers',
  confidence: 'HIGH',
}

const scoreData2 = analyzeJobRelevance(jobData2, dataProfile)
assert(
  scoreData2.relevanceScore < 55 && scoreData2.category === 'LOW_RELEVANCE',
  `Unrelated Sales job receives LOW_RELEVANCE score (${scoreData2.relevanceScore}%)`,
  `Score: ${scoreData2.relevanceScore}%`
)

// Scenario B: UX/UI Designer User
const designProfile: UserProfile = {
  id: 'u-2',
  userId: 'u-2',
  preferredRoles: ['Product Designer', 'UX Designer'],
  preferredLocations: ['Remote'],
  preferredJobTypes: ['FULL_TIME'],
  experienceYears: 5,
  workStyle: 'REMOTE',
  expectedSalary: '$120,000',
  skills: ['Figma', 'Prototyping', 'User Research'],
  onboardingCompleted: true,
}

const jobDesign: ExtractedJob = {
  title: 'Senior Product Designer (UX/UI)',
  company: 'DesignLab Studio',
  location: 'Remote',
  salary: '$130,000',
  jobType: 'Full-time',
  jobUrl: 'https://example.com/jobs/8',
  sourceWebsite: 'DesignLab',
  confidence: 'HIGH',
}

const scoreDesign = analyzeJobRelevance(jobDesign, designProfile)
assert(
  scoreDesign.relevanceScore >= 90 && scoreDesign.category === 'EXCELLENT',
  `Product Designer receives EXCELLENT score (${scoreDesign.relevanceScore}%)`,
  `Matched reasons: ${scoreDesign.matchedReasons.join('; ')}`
)

// Scenario C: Financial Analyst User
const financeProfile: UserProfile = {
  id: 'u-3',
  userId: 'u-3',
  preferredRoles: ['Financial Analyst', 'FP&A Analyst'],
  preferredLocations: ['New York, NY'],
  preferredJobTypes: ['FULL_TIME'],
  experienceYears: 3,
  workStyle: 'HYBRID',
  expectedSalary: '$90,000',
  skills: ['Financial Modeling', 'Excel', 'Budgeting'],
  onboardingCompleted: true,
}

const jobFinance: ExtractedJob = {
  title: 'FP&A Financial Analyst',
  company: 'Apex Capital Group',
  location: 'New York, NY',
  salary: '$105,000',
  jobType: 'Full-time',
  jobUrl: 'https://example.com/jobs/16',
  sourceWebsite: 'Apex Capital',
  confidence: 'HIGH',
}

const scoreFinance = analyzeJobRelevance(jobFinance, financeProfile)
assert(
  scoreFinance.relevanceScore >= 90 && scoreFinance.category === 'EXCELLENT',
  `Financial Analyst receives EXCELLENT score (${scoreFinance.relevanceScore}%)`,
  `Score: ${scoreFinance.relevanceScore}%`
)

// ─── TEST 4: Determinism Check ────────────────────────────────────────────────
console.log('\n--- 4. Testing Score Determinism ---')

const scoreRun1 = analyzeJobRelevance(jobData1, dataProfile)
const scoreRun2 = analyzeJobRelevance(jobData1, dataProfile)
assert(
  scoreRun1.relevanceScore === scoreRun2.relevanceScore &&
    scoreRun1.roleMatch.score === scoreRun2.roleMatch.score,
  'Scoring is 100% deterministic on repeated runs',
  `Run 1: ${scoreRun1.relevanceScore}%, Run 2: ${scoreRun2.relevanceScore}%`
)

console.log('\n====================================================')
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`)
console.log('====================================================')

if (failedTests > 0) process.exit(1)
