/**
 * Talvyn Deterministic Relevance Scoring Engine (Phase 2B)
 *
 * Evaluates extracted jobs against user profile preferences.
 * Calculates weighted scores for:
 * 1. Role Match (45%)
 * 2. Location Match (20%)
 * 3. Experience Match (15%)
 * 4. Job Type Match (10%)
 * 5. Salary Match (10%)
 *
 * Generates clear, human-readable matched and unmatched reasons.
 * Deterministic rules — no AI.
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
  role: number // default 0.45
  location: number // default 0.20
  experience: number // default 0.15
  jobType: number // default 0.10
  salary: number // default 0.10
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  role: 0.45,
  location: 0.20,
  experience: 0.15,
  jobType: 0.10,
  salary: 0.10,
}

// ─── 1. Location Matching (20%) ──────────────────────────────────────────────

export function evaluateLocationMatch(
  jobLocation: string | undefined,
  jobDescription: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.20
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

  // Case A: User prefers ANY
  if (workStyle === 'ANY' && prefLocs.length === 0) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: 'Open to all locations and work styles',
    }
  }

  // Case B: User prefers REMOTE
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

  // Case C: Check preferred location list
  if (prefLocs.length > 0) {
    for (const pref of prefLocs) {
      const cleanPref = pref.toLowerCase().trim()

      if (!cleanPref) continue

      // Remote listed as preferred location
      if (cleanPref.includes('remote') && isJobRemote) {
        return {
          score: 1.0,
          weight,
          weightedScore: weight * 100,
          reason: 'Remote job matches preferred location "Remote"',
        }
      }

      // City / State / Country matches
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

  // If user is open to remote and job is remote
  if ((workStyle === 'HYBRID' || workStyle === 'ANY') && isJobRemote) {
    return {
      score: 0.9,
      weight,
      weightedScore: 0.9 * weight * 100,
      reason: 'Remote job provides work flexibility',
    }
  }

  // Location missing from job posting
  if (!loc) {
    return {
      score: 0.5,
      weight,
      weightedScore: 0.5 * weight * 100,
      reason: 'Location not specified in job posting',
    }
  }

  // Mismatch
  return {
    score: 0.1,
    weight,
    weightedScore: 0.1 * weight * 100,
    reason: `Location "${jobLocation}" does not match preferred locations`,
  }
}

// ─── 2. Experience Matching (15%) ─────────────────────────────────────────────

export function evaluateExperienceMatch(
  jobTitle: string,
  jobDescription: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.15
): ComponentScore {
  const norm = normalizeRole(jobTitle)
  const jobSeniority = norm.seniority
  const userYrs = userProfile.experienceYears ?? null

  // If user hasn't specified years, baseline neutral
  if (userYrs === null) {
    return {
      score: 0.7,
      weight,
      weightedScore: 0.7 * weight * 100,
      reason: 'Experience years not specified in profile',
    }
  }

  // Try extracting explicit year range from description (e.g. "3-5 years", "3+ years")
  let requiredMinYrs: number | null = null
  let requiredMaxYrs: number | null = null

  if (jobDescription) {
    const yrMatch = jobDescription.match(/(\d+)\s*(?:-|to|\+)?\s*(\d+)?\s*(?:years?|yrs?)(?:\s+of\s+experience)?/i)
    if (yrMatch) {
      requiredMinYrs = parseInt(yrMatch[1], 10)
      if (yrMatch[2]) requiredMaxYrs = parseInt(yrMatch[2], 10)
    }
  }

  // Fallback to title seniority if description has no explicit years
  if (requiredMinYrs === null && jobSeniority.level !== 'UNSPECIFIED') {
    requiredMinYrs = jobSeniority.yearsMin
    requiredMaxYrs = jobSeniority.yearsMax ?? null
  }

  // If no experience requirements detected, give good neutral score
  if (requiredMinYrs === null) {
    return {
      score: 0.8,
      weight,
      weightedScore: 0.8 * weight * 100,
      reason: 'Experience requirements appear standard/flexible',
    }
  }

  // Compare user years vs required years
  if (requiredMaxYrs !== null && userYrs >= requiredMinYrs && userYrs <= requiredMaxYrs) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: `Your ${userYrs} years experience matches required range (${requiredMinYrs}–${requiredMaxYrs} yrs)`,
    }
  }

  if (userYrs >= requiredMinYrs) {
    const diff = userYrs - requiredMinYrs
    if (diff <= 3) {
      return {
        score: 1.0,
        weight,
        weightedScore: weight * 100,
        reason: `Your ${userYrs} yrs experience exceeds required minimum (${requiredMinYrs}+ yrs)`,
      }
    }
    // Overqualified slightly
    return {
      score: 0.75,
      weight,
      weightedScore: 0.75 * weight * 100,
      reason: `You exceed requirements (${userYrs} yrs vs ${requiredMinYrs}+ yrs)`,
    }
  }

  // Under-qualified
  const shortBy = requiredMinYrs - userYrs
  if (shortBy <= 1) {
    return {
      score: 0.6,
      weight,
      weightedScore: 0.6 * weight * 100,
      reason: `Close to required experience (${userYrs} yrs vs ${requiredMinYrs}+ yrs)`,
    }
  }

  return {
    score: 0.2,
    weight,
    weightedScore: 0.2 * weight * 100,
    reason: `Requires ${requiredMinYrs}+ yrs experience (profile: ${userYrs} yrs)`,
  }
}

// ─── 3. Job Type Matching (10%) ───────────────────────────────────────────────

export function evaluateJobTypeMatch(
  jobType: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.10
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

  // Exact match with enum keys (e.g. FULL_TIME, CONTRACT)
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

// ─── 4. Salary Matching (10%) ─────────────────────────────────────────────────

export function evaluateSalaryMatch(
  jobSalary: string | undefined,
  userProfile: UserProfile,
  weight: number = 0.10
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

  // Parse numbers from strings
  const expectedNum = parseSalaryNumber(expectedStr)
  const jobNums = extractSalaryRange(jobSalary)

  if (!expectedNum || jobNums.length === 0) {
    return {
      score: 0.7,
      weight,
      weightedScore: 0.7 * weight * 100,
      reason: `Salary listed as "${jobSalary}"`,
    }
  }

  const jobMax = Math.max(...jobNums)
  const jobMin = Math.min(...jobNums)

  // Annualize hourly rates if needed (e.g. $50/hr ≈ $100k)
  const normalizedJobMax = jobMax < 500 ? jobMax * 2000 : jobMax
  const normalizedJobMin = jobMin < 500 ? jobMin * 2000 : jobMin
  const normalizedExpected = expectedNum < 500 ? expectedNum * 2000 : expectedNum

  if (normalizedJobMax >= normalizedExpected) {
    return {
      score: 1.0,
      weight,
      weightedScore: weight * 100,
      reason: `Offered salary (${jobSalary}) meets expected compensation`,
    }
  }

  const ratio = normalizedJobMax / normalizedExpected
  if (ratio >= 0.85) {
    return {
      score: 0.75,
      weight,
      weightedScore: 0.75 * weight * 100,
      reason: `Salary (${jobSalary}) is close to expected compensation`,
    }
  }

  return {
    score: 0.3,
    weight,
    weightedScore: 0.3 * weight * 100,
    reason: `Offered salary (${jobSalary}) is below expected compensation`,
  }
}

function parseSalaryNumber(str: string): number | null {
  const clean = str.replace(/[$,kK]/g, (m) => (m.toLowerCase() === 'k' ? '000' : ''))
  const match = clean.match(/\d+[\d,]*/g)
  if (!match) return null
  const num = parseInt(match[0].replace(/,/g, ''), 10)
  return isNaN(num) ? null : num
}

function extractSalaryRange(str: string): number[] {
  const matches = str.match(/\$?\d[\d,.]*\s*(?:k|K)?/g)
  if (!matches) return []
  return matches
    .map((m) => {
      let isK = /k/i.test(m)
      let numStr = m.replace(/[^0-9.]/g, '')
      let val = parseFloat(numStr)
      if (isK && val < 1000) val *= 1000
      return val
    })
    .filter((v) => !isNaN(v) && v > 0)
}

// ─── Main Relevance Scorer ────────────────────────────────────────────────────

export function analyzeJobRelevance(
  job: ExtractedJob,
  userProfile: UserProfile,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): AnalyzedJob {
  const roleMatch = evaluateRoleMatch(job.title, userProfile.preferredRoles, weights.role)
  const locationMatch = evaluateLocationMatch(job.location, job.description, userProfile, weights.location)
  const experienceMatch = evaluateExperienceMatch(job.title, job.description, userProfile, weights.experience)
  const jobTypeMatch = evaluateJobTypeMatch(job.jobType, userProfile, weights.jobType)
  const salaryMatch = evaluateSalaryMatch(job.salary, userProfile, weights.salary)

  const totalScore = Math.round(
    roleMatch.weightedScore +
      locationMatch.weightedScore +
      experienceMatch.weightedScore +
      jobTypeMatch.weightedScore +
      salaryMatch.weightedScore
  )

  const clampedScore = Math.min(100, Math.max(0, totalScore))

  // Recommendation Category
  let category: RecommendationCategory
  if (clampedScore >= 90) {
    category = 'EXCELLENT'
  } else if (clampedScore >= 75) {
    category = 'HIGHLY_RELEVANT'
  } else if (clampedScore >= 55) {
    category = 'RELEVANT'
  } else {
    category = 'LOW_RELEVANCE'
  }

  // Collect Matched & Unmatched Reasons
  const matchedReasons: string[] = []
  const unmatchedReasons: string[] = []

  if (roleMatch.score >= 0.6) matchedReasons.push(roleMatch.reason)
  else unmatchedReasons.push(roleMatch.reason)

  if (locationMatch.score >= 0.7) matchedReasons.push(locationMatch.reason)
  else if (locationMatch.score < 0.5) unmatchedReasons.push(locationMatch.reason)

  if (experienceMatch.score >= 0.75) matchedReasons.push(experienceMatch.reason)
  else if (experienceMatch.score < 0.5) unmatchedReasons.push(experienceMatch.reason)

  if (jobTypeMatch.score >= 0.8) matchedReasons.push(jobTypeMatch.reason)
  else if (jobTypeMatch.score < 0.5) unmatchedReasons.push(jobTypeMatch.reason)

  if (salaryMatch.score >= 0.8 && job.salary) matchedReasons.push(salaryMatch.reason)
  else if (salaryMatch.score < 0.5) unmatchedReasons.push(salaryMatch.reason)

  return {
    job,
    relevanceScore: clampedScore,
    category,
    roleMatch,
    locationMatch,
    experienceMatch,
    jobTypeMatch,
    salaryMatch,
    matchedReasons,
    unmatchedReasons,
  }
}
