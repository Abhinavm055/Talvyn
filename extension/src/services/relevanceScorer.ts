/**
 * Talvyn Deterministic Relevance Scoring Engine (Strict Matching)
 *
 * Evaluates extracted jobs against user profile preferences.
 * Calculates weighted scores for:
 * 1. Role Match (30%)
 * 2. Experience Match (25%)
 * 3. Education Match (20%)
 * 4. Skills Match (20%)
 * 5. Location Match (5%)
 *
 * HARD ELIGIBILITY OVERRIDES:
 * - Experience Mismatch (e.g. Fresher applying to 2-4 yrs job) -> 🔴 LOW MATCH (score capped <= 48%)
 * - Role Mismatch (unrelated domain) -> 🔴 LOW MATCH (score capped <= 45%)
 * - Education Mismatch (incompatible qualification) -> 🔴 LOW MATCH (score capped <= 48%)
 * - Skills cannot override hard eligibility mismatches.
 */

import {
  ExtractedJob,
  UserProfile,
  AnalyzedJob,
  ComponentScore,
  RecommendationCategory,
} from '../types'
import { evaluateRoleMatch } from './roleMatcher'
import { normalizeRole } from './roleTaxonomy'

export interface ScoringWeights {
  role: number // default 0.30
  experience: number // default 0.25
  education: number // default 0.20
  skills: number // default 0.20
  location: number // default 0.05
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  role: 0.30,
  experience: 0.25,
  education: 0.20,
  skills: 0.20,
  location: 0.05,
}

export const COMMON_SKILLS_CANONICAL: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  react: 'React',
  'react native': 'React Native',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  node: 'Node.js',
  python: 'Python',
  java: 'Java',
  'c++': 'C++',
  'c#': 'C#',
  '.net': '.NET',
  aws: 'AWS',
  'amazon web services': 'AWS',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  sql: 'SQL',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  postgres: 'PostgreSQL',
  mongodb: 'MongoDB',
  graphql: 'GraphQL',
  'rest api': 'REST APIs',
  rest: 'REST APIs',
  git: 'Git',
  github: 'GitHub',
  html: 'HTML5',
  css: 'CSS3',
  tailwind: 'Tailwind CSS',
  'next.js': 'Next.js',
  nextjs: 'Next.js',
  vue: 'Vue.js',
  angular: 'Angular',
  django: 'Django',
  fastapi: 'FastAPI',
  flask: 'Flask',
  'spring boot': 'Spring Boot',
  spring: 'Spring Boot',
  go: 'Golang',
  golang: 'Golang',
  rust: 'Rust',
  ruby: 'Ruby',
  'ruby on rails': 'Rails',
  rails: 'Rails',
  php: 'PHP',
  laravel: 'Laravel',
  flutter: 'Flutter',
  swift: 'Swift',
  kotlin: 'Kotlin',
  figma: 'Figma',
  jira: 'Jira',
  agile: 'Agile',
  'ci/cd': 'CI/CD',
  linux: 'Linux',
  azure: 'Azure',
  gcp: 'GCP',
  redis: 'Redis',
  kafka: 'Kafka',
  microservices: 'Microservices',
  devops: 'DevOps',
  pandas: 'Pandas',
  numpy: 'NumPy',
  'machine learning': 'Machine Learning',
  ai: 'AI',
  tableau: 'Tableau',
  excel: 'Excel',
  powerbi: 'PowerBI',
  'power bi': 'PowerBI',
  'financial modeling': 'Financial Modeling',
  budgeting: 'Budgeting',
  prototyping: 'Prototyping',
  'user research': 'User Research',
}

// ─── 1. Experience Extraction & Matching (25%) ───────────────────────────────

export interface ExperienceRequirement {
  minYears: number
  maxYears: number | null
  isFresher: boolean
  rawText: string
}

export function extractExperienceRequirement(
  title: string = '',
  description: string = '',
  jobType: string = ''
): ExperienceRequirement | null {
  const fullText = `${title} ${jobType} ${description || ''}`.toLowerCase()

  // 1. Explicit range like "2-4 years", "2 to 4 years", "2 - 4 yrs", "2–4 years", "2—4 years"
  const rangeMatch =
    fullText.match(/\b(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*(?:years?|yrs?)(?:\s+of\s+experience)?/i) ||
    fullText.match(/\bexperience\s*(?:required)?\s*[:\-–—]\s*(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*(?:years?|yrs?)?/i)
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10)
    const max = parseInt(rangeMatch[2], 10)
    return {
      minYears: min,
      maxYears: max,
      isFresher: min === 0,
      rawText: `${min}–${max} years`,
    }
  }

  // 2. Explicit min like "3+ years", "3 + yrs", "minimum 2 years", "at least 2 years"
  const plusMatch =
    fullText.match(/\b(\d+)\s*\+\s*(?:years?|yrs?)(?:\s+of\s+experience)?/i) ||
    fullText.match(/\b(?:min(?:imum)?|at\s+least)\s+(\d+)\s*(?:years?|yrs?)/i) ||
    fullText.match(/\bexperience\s*(?:required)?\s*[:\-–—]\s*(\d+)\s*\+\s*(?:years?|yrs?)?/i)
  if (plusMatch) {
    const min = parseInt(plusMatch[1], 10)
    return {
      minYears: min,
      maxYears: null,
      isFresher: min === 0,
      rawText: `${min}+ years`,
    }
  }

  // 3. Simple "2 years experience", "1 year of experience"
  const singleMatch =
    fullText.match(/\b(\d+)\s*(?:years?|yrs?)(?:\s+of)?\s+experience\b/i) ||
    fullText.match(/\bexperience\s*(?:required)?\s*[:\-–—]\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (singleMatch) {
    const min = parseInt(singleMatch[1], 10)
    return {
      minYears: min,
      maxYears: null,
      isFresher: min === 0,
      rawText: min === 1 ? '1 year' : `${min} years`,
    }
  }

  // 4. Check fresher / entry-level / intern indicators
  const isFresherMentioned =
    /\b(fresher|entry[\s-]level|trainee|graduate|intern|internship|campus)\b/i.test(title) ||
    /\b(fresher|entry[\s-]level|0[\s-]*1\s*years?|0[\s-]*0\s*years?)\b/i.test(fullText)

  if (isFresherMentioned) {
    return {
      minYears: 0,
      maxYears: 1,
      isFresher: true,
      rawText: 'Fresher / 0–1 years',
    }
  }

  return null
}

export interface StrictExperienceMatchResult extends ComponentScore {
  isHardMismatch: boolean
  requiredText: string
  profileText: string
  status: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED'
}

export function evaluateExperienceMatchStrict(
  jobTitle: string,
  jobDescription: string | undefined,
  jobType: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.25
): StrictExperienceMatchResult {
  const req = extractExperienceRequirement(jobTitle, jobDescription || '', jobType || '')
  const userYrs = userProfile.experienceYears ?? null
  const isCandidateFresher = userYrs === 0 || userYrs === null

  const profileText = isCandidateFresher ? 'Fresher' : `${userYrs} year${userYrs === 1 ? '' : 's'}`

  // Case 1: Job does NOT specify experience requirements
  if (!req) {
    return {
      score: 0.8,
      weight,
      weightedScore: 0.8 * weight * 100,
      reason: 'Experience requirements appear standard/flexible',
      isHardMismatch: false,
      requiredText: 'Not specified',
      profileText,
      status: 'UNSPECIFIED',
    }
  }

  const requiredText = req.rawText

  // Case 2: Candidate is FRESHER (0 years)
  if (isCandidateFresher) {
    if (req.isFresher || req.minYears === 0) {
      return {
        score: 1.0,
        weight,
        weightedScore: weight * 100,
        reason: 'Fresher / entry-level role matches your profile',
        isHardMismatch: false,
        requiredText,
        profileText,
        status: 'MATCH',
      }
    }

    // Significant hard mismatch: Fresher applying to 2-4 years, 3+ years, 1-2 years
    const isMajor = req.minYears >= 2
    return {
      score: isMajor ? 0.05 : 0.2,
      weight,
      weightedScore: (isMajor ? 0.05 : 0.2) * weight * 100,
      reason: `Experience mismatch: Required: ${requiredText}, Your profile: Fresher`,
      isHardMismatch: true,
      requiredText,
      profileText,
      status: 'MISMATCH',
    }
  }

  // Case 3: Candidate has experienced years (e.g. 1, 3, 5 years)
  const candidateYears = userYrs as number

  if (req.maxYears !== null && candidateYears >= req.minYears && candidateYears <= req.maxYears) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: `Your ${candidateYears} years experience matches required range (${requiredText})`,
      isHardMismatch: false,
      requiredText,
      profileText,
      status: 'MATCH',
    }
  }

  if (candidateYears >= req.minYears) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: `Your ${candidateYears} yrs experience satisfies requirement (${requiredText})`,
      isHardMismatch: false,
      requiredText,
      profileText,
      status: 'MATCH',
    }
  }

  // Underqualified
  const shortBy = req.minYears - candidateYears
  const isMajor = shortBy >= 2 || req.minYears >= 2
  return {
    score: isMajor ? 0.1 : 0.35,
    weight,
    weightedScore: (isMajor ? 0.1 : 0.35) * weight * 100,
    reason: `Experience mismatch: Required: ${requiredText}, Your profile: ${profileText}`,
    isHardMismatch: isMajor,
    requiredText,
    profileText,
    status: 'MISMATCH',
  }
}

// Fallback compatibility alias
export function evaluateExperienceMatch(
  jobTitle: string,
  jobDescription: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.25
): ComponentScore {
  return evaluateExperienceMatchStrict(jobTitle, jobDescription, undefined, userProfile, weight)
}

// ─── 2. Education Extraction & Matching (20%) ────────────────────────────────

export interface StrictEducationMatchResult extends ComponentScore {
  isHardMismatch: boolean
  status: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED'
  requiredText: string
}

export function evaluateEducationMatchStrict(
  jobTitle: string,
  jobDescription: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.20
): StrictEducationMatchResult {
  const fullText = `${jobTitle} ${jobDescription || ''}`.toLowerCase()

  const degreesKnown = [
    { key: 'b.tech', label: 'B.Tech' },
    { key: 'btech', label: 'B.Tech' },
    { key: 'b.e.', label: 'B.E.' },
    { key: 'be ', label: 'B.E.' },
    { key: 'm.tech', label: 'M.Tech' },
    { key: 'mtech', label: 'M.Tech' },
    { key: 'mca', label: 'MCA' },
    { key: 'bca', label: 'BCA' },
    { key: 'b.sc', label: 'B.Sc' },
    { key: 'bsc', label: 'B.Sc' },
    { key: 'bachelor', label: "Bachelor's" },
    { key: 'master', label: "Master's" },
    { key: 'computer science', label: 'Computer Science' },
    { key: 'cs/it', label: 'CS/IT' },
    { key: 'information technology', label: 'Information Technology' },
    { key: 'engineering', label: 'Engineering' },
    { key: 'undergraduate', label: 'Undergraduate' },
    { key: 'graduate', label: 'Graduate' },
  ]

  const detectedEduReqs: string[] = []
  for (const d of degreesKnown) {
    if (fullText.includes(d.key) && !detectedEduReqs.includes(d.label)) {
      detectedEduReqs.push(d.label)
    }
  }

  const profileDegree = (userProfile.degree || '').toLowerCase()
  const profileSpec = (userProfile.specialization || '').toLowerCase()
  const profileEduText = `${profileDegree} ${profileSpec}`.trim()

  // Job did not specify explicit education
  if (detectedEduReqs.length === 0) {
    return {
      score: 0.85,
      weight,
      weightedScore: 0.85 * weight * 100,
      reason: 'Education: Not specified',
      isHardMismatch: false,
      status: 'UNSPECIFIED',
      requiredText: 'Not specified',
    }
  }

  const requiredText = detectedEduReqs.slice(0, 3).join(' / ')

  // Check candidate profile
  if (!profileEduText) {
    return {
      score: 0.6,
      weight,
      weightedScore: 0.6 * weight * 100,
      reason: 'Education not specified in profile',
      isHardMismatch: false,
      status: 'UNSPECIFIED',
      requiredText,
    }
  }

  const matchesAny = detectedEduReqs.some((req) => {
    const rLower = req.toLowerCase()
    return (
      profileEduText.includes(rLower) ||
      (rLower.includes('b.tech') && (profileEduText.includes('btech') || profileEduText.includes('b.e.') || profileEduText.includes('engineering'))) ||
      (rLower.includes('b.e.') && (profileEduText.includes('btech') || profileEduText.includes('b.tech') || profileEduText.includes('engineering'))) ||
      (rLower.includes('computer science') && (profileEduText.includes('cs') || profileEduText.includes('it') || profileEduText.includes('information technology'))) ||
      (rLower.includes('bachelor') && (profileEduText.includes('b.tech') || profileEduText.includes('b.e.') || profileEduText.includes('bca') || profileEduText.includes('bsc') || profileEduText.includes('bachelor')))
    )
  })

  if (matchesAny) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: `Education match: ${userProfile.degree || 'Degree'} aligns with ${requiredText}`,
      isHardMismatch: false,
      status: 'MATCH',
      requiredText,
    }
  }

  // Explicit mismatch
  return {
    score: 0.15,
    weight,
    weightedScore: 0.15 * weight * 100,
    reason: `Education mismatch: Requires ${requiredText}`,
    isHardMismatch: true,
    status: 'MISMATCH',
    requiredText,
  }
}

// ─── 3. Skills Extraction & Matching (20%) ───────────────────────────────────

export interface StrictSkillsMatchResult extends ComponentScore {
  matchedSkills: string[]
  missingSkills: string[]
  status: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED'
}

export function evaluateSkillsMatchStrict(
  jobTitle: string,
  jobDescription: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.20
): StrictSkillsMatchResult {
  const fullText = `${jobTitle} ${jobDescription || ''}`.toLowerCase()
  const detectedJobSkills: string[] = []

  for (const [key, canonical] of Object.entries(COMMON_SKILLS_CANONICAL)) {
    const regex = new RegExp(`(?:^|[\\s,.;/()+-])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s,.;/()+-])`, 'i')
    if (regex.test(fullText)) {
      if (!detectedJobSkills.includes(canonical)) {
        detectedJobSkills.push(canonical)
      }
    }
  }

  const userSkills = (userProfile.skills || []).map((s) => s.trim())
  const userSkillsLower = userSkills.map((s) => s.toLowerCase())

  const matchedSkills: string[] = []
  const missingSkills: string[] = []

  for (const jobSkill of detectedJobSkills) {
    const jobSkillLower = jobSkill.toLowerCase()
    const hasSkill = userSkillsLower.some(
      (us) => us.includes(jobSkillLower) || jobSkillLower.includes(us)
    )
    if (hasSkill) {
      if (!matchedSkills.includes(jobSkill)) matchedSkills.push(jobSkill)
    } else {
      if (!missingSkills.includes(jobSkill)) missingSkills.push(jobSkill)
    }
  }

  // Fallback: Check if user profile skills appear in job description
  if (matchedSkills.length === 0 && userSkills.length > 0) {
    for (const us of userSkills) {
      if (fullText.includes(us.toLowerCase()) && !matchedSkills.includes(us)) {
        matchedSkills.push(us)
      }
    }
  }

  if (detectedJobSkills.length === 0 && matchedSkills.length === 0) {
    return {
      score: 0.85,
      weight,
      weightedScore: 0.85 * weight * 100,
      reason: 'General technical skill alignment',
      matchedSkills: userSkills.slice(0, 3),
      missingSkills: [],
      status: 'UNSPECIFIED',
    }
  }

  const totalEvaluated = matchedSkills.length + missingSkills.length
  let score = 0.5
  if (totalEvaluated > 0) {
    score = matchedSkills.length / totalEvaluated
    if (matchedSkills.length > 0 && score < 0.4) score = 0.4
  } else if (matchedSkills.length > 0) {
    score = 1.0
  }

  const isPass = matchedSkills.length >= 1

  return {
    score,
    weight,
    weightedScore: score * weight * 100,
    reason: isPass
      ? `Skills match: ${matchedSkills.slice(0, 3).join(', ')}`
      : `Missing key skills: ${missingSkills.slice(0, 2).join(', ')}`,
    matchedSkills,
    missingSkills,
    status: isPass ? 'MATCH' : 'MISMATCH',
  }
}

// ─── 4. Location Matching (5%) ────────────────────────────────────────────────

export function evaluateLocationMatch(
  jobLocation: string | undefined,
  jobDescription: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.05
): ComponentScore {
  const loc = (jobLocation || '').toLowerCase().trim()
  const desc = (jobDescription || '').toLowerCase()
  const prefLocs = userProfile.preferredLocations || []
  const workStyle = userProfile.workStyle || 'ANY'

  const isJobRemote =
    loc.includes('remote') ||
    loc.includes('wfh') ||
    loc.includes('anywhere') ||
    desc.includes('100% remote') ||
    desc.includes('fully remote') ||
    desc.includes('work from home')

  const isJobHybrid =
    loc.includes('hybrid') || desc.includes('hybrid work') || desc.includes('hybrid schedule')

  if (workStyle === 'ANY' && prefLocs.length === 0) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: 'Open to all locations and work styles',
    }
  }

  if (workStyle === 'REMOTE') {
    if (isJobRemote) {
      return {
        score: 1.0,
        weight,
        weightedScore: weight * 100,
        reason: 'Remote position aligns with your Remote preference',
      }
    }
    if (isJobHybrid) {
      return {
        score: 0.5,
        weight,
        weightedScore: 0.5 * weight * 100,
        reason: 'Hybrid role (partially remote)',
      }
    }
  }

  if (prefLocs.length > 0) {
    for (const pref of prefLocs) {
      const cleanPref = pref.toLowerCase().trim()
      if (!cleanPref) continue

      if (cleanPref.includes('remote') && isJobRemote) {
        return {
          score: 1.0,
          weight,
          weightedScore: weight * 100,
          reason: 'Remote job matches preferred location "Remote"',
        }
      }

      if (loc && (loc.includes(cleanPref) || cleanPref.includes(loc))) {
        return {
          score: 1.0,
          weight,
          weightedScore: weight * 100,
          reason: `Location matches preferred location "${pref}"`,
        }
      }
    }
  }

  if ((workStyle === 'HYBRID' || workStyle === 'ANY') && isJobRemote) {
    return {
      score: 0.9,
      weight,
      weightedScore: 0.9 * weight * 100,
      reason: 'Remote job provides work flexibility',
    }
  }

  if (!loc) {
    return {
      score: 0.6,
      weight,
      weightedScore: 0.6 * weight * 100,
      reason: 'Location not specified in job posting',
    }
  }

  return {
    score: 0.2,
    weight,
    weightedScore: 0.2 * weight * 100,
    reason: `Location "${jobLocation}" differs from preferred locations`,
  }
}

// ─── 5. Job Type & Salary Helpers ─────────────────────────────────────────────

export function evaluateJobTypeMatch(
  jobType: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.05
): ComponentScore {
  const preferredTypes = userProfile.preferredJobTypes || []
  if (preferredTypes.length === 0) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: 'Open to all employment types',
    }
  }
  if (!jobType) {
    return {
      score: 0.6,
      weight,
      weightedScore: 0.6 * weight * 100,
      reason: 'Job type not disclosed in listing',
    }
  }
  const cleanJobType = jobType.toUpperCase().replace(/[-\s]/g, '_')
  const isDirectMatch = preferredTypes.some((p) => {
    const cleanPref = p.toUpperCase().replace(/[-\s]/g, '_')
    return cleanJobType.includes(cleanPref) || cleanPref.includes(cleanJobType)
  })
  if (isDirectMatch) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: `Employment type (${jobType}) matches your preference`,
    }
  }
  return {
    score: 0.2,
    weight,
    weightedScore: 0.2 * weight * 100,
    reason: `Job type (${jobType}) differs from preferred (${preferredTypes.join(', ')})`,
  }
}

export function evaluateSalaryMatch(
  jobSalary: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.05
): ComponentScore {
  const expectedStr = userProfile.expectedSalary
  if (!expectedStr) {
    return {
      score: 0.8,
      weight,
      weightedScore: 0.8 * weight * 100,
      reason: 'No expected salary specified in profile',
    }
  }
  if (!jobSalary) {
    return {
      score: 0.6,
      weight,
      weightedScore: 0.6 * weight * 100,
      reason: 'Salary not disclosed in listing',
    }
  }
  return {
    score: 0.8,
    weight,
    weightedScore: 0.8 * weight * 100,
    reason: `Salary listed as "${jobSalary}"`,
  }
}

// ─── Main Strict Relevance Scorer ────────────────────────────────────────────

export function analyzeJobRelevance(
  job: ExtractedJob,
  userProfile: UserProfile,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): AnalyzedJob {
  const roleMatch = evaluateRoleMatch(job.title, userProfile.preferredRoles, weights.role)
  const experienceMatch = evaluateExperienceMatchStrict(job.title, job.description, job.jobType, userProfile, weights.experience)
  const educationMatch = evaluateEducationMatchStrict(job.title, job.description, userProfile, weights.education)
  const skillsMatch = evaluateSkillsMatchStrict(job.title, job.description, userProfile, weights.skills)
  const locationMatch = evaluateLocationMatch(job.location, job.description, userProfile, weights.location)

  let rawTotalScore = Math.round(
    roleMatch.weightedScore +
      experienceMatch.weightedScore +
      educationMatch.weightedScore +
      skillsMatch.weightedScore +
      locationMatch.weightedScore
  )

  const isRoleMismatch = roleMatch.level === 'NO_MATCH' || roleMatch.score === 0
  const isExpMismatch = experienceMatch.isHardMismatch || experienceMatch.status === 'MISMATCH'
  const isEduMismatch = educationMatch.status === 'MISMATCH' && educationMatch.isHardMismatch

  // ─── HARD ELIGIBILITY RULES OVERRIDE THE RAW SCORE ───
  let clampedScore = Math.min(100, Math.max(0, rawTotalScore))
  let category: RecommendationCategory
  let forcedLowReason = ''

  if (isExpMismatch && experienceMatch.isHardMismatch) {
    // Hard experience mismatch strictly caps score at ~42% and forces LOW MATCH
    clampedScore = Math.min(42, Math.max(25, Math.round(rawTotalScore * 0.46)))
    category = 'LOW_RELEVANCE'
    forcedLowReason = 'Experience requirement does not match your profile.'
  } else if (isRoleMismatch) {
    // Unrelated role strictly caps score and forces LOW MATCH
    clampedScore = Math.min(44, Math.max(20, Math.round(rawTotalScore * 0.42)))
    category = 'LOW_RELEVANCE'
    forcedLowReason = 'Role does not align with your profile.'
  } else if (isEduMismatch) {
    clampedScore = Math.min(45, Math.max(25, Math.round(rawTotalScore * 0.45)))
    category = 'LOW_RELEVANCE'
    forcedLowReason = 'Education requirement differs from your profile.'
  } else {
    if (clampedScore >= 85) {
      category = 'EXCELLENT'
    } else if (clampedScore >= 70) {
      category = 'HIGHLY_RELEVANT'
    } else if (clampedScore >= 50) {
      category = 'RELEVANT'
    } else {
      category = 'LOW_RELEVANCE'
    }
  }

  // Collect Matched & Unmatched Reasons
  const matchedReasons: string[] = []
  const unmatchedReasons: string[] = []

  if (roleMatch.score >= 0.6) {
    matchedReasons.push(roleMatch.reason)
  } else {
    unmatchedReasons.push(roleMatch.reason)
  }

  if (experienceMatch.status === 'MATCH') {
    matchedReasons.push(experienceMatch.reason)
  } else if (experienceMatch.status === 'MISMATCH') {
    unmatchedReasons.push(experienceMatch.reason)
  }

  if (educationMatch.status === 'MATCH') {
    matchedReasons.push(educationMatch.reason)
  } else if (educationMatch.status === 'MISMATCH') {
    unmatchedReasons.push(educationMatch.reason)
  }

  if (skillsMatch.status === 'MATCH' && skillsMatch.matchedSkills.length > 0) {
    matchedReasons.push(`Skills match: ${skillsMatch.matchedSkills.slice(0, 3).join(', ')}`)
  }
  if (skillsMatch.missingSkills.length > 0) {
    unmatchedReasons.push(`Missing skills: ${skillsMatch.missingSkills.slice(0, 2).join(', ')}`)
  }

  if (locationMatch.score >= 0.7) {
    matchedReasons.push(locationMatch.reason)
  } else if (locationMatch.score < 0.5) {
    unmatchedReasons.push(locationMatch.reason)
  }

  if (forcedLowReason && !unmatchedReasons.includes(forcedLowReason)) {
    unmatchedReasons.unshift(forcedLowReason)
  }

  const jobTypeMatch = evaluateJobTypeMatch(job.jobType, userProfile, 0.05)
  const salaryMatch = evaluateSalaryMatch(job.salary, userProfile, 0.05)

  return {
    job,
    relevanceScore: clampedScore,
    category,
    roleMatch,
    locationMatch,
    experienceMatch,
    educationMatch,
    skillsMatch,
    jobTypeMatch,
    salaryMatch,
    matchedReasons,
    unmatchedReasons,
    matchedSkills: skillsMatch.matchedSkills,
    missingSkills: skillsMatch.missingSkills,
  }
}

