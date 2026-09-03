import { ExtractedJob, UserProfile } from '../types'
import {
  evaluateRoleMatch,
} from '../services/roleMatcher'
import {
  evaluateExperienceMatchStrict,
  evaluateEducationMatchStrict,
  evaluateSkillsMatchStrict,
  evaluateLocationMatch,
  COMMON_SKILLS_CANONICAL,
} from '../services/relevanceScorer'

export type BackendJobType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'FREELANCE'
  | 'INTERNSHIP'
  | 'TEMPORARY'
  | 'GRADUATE_PROGRAM'
  | 'FELLOWSHIP'
  | 'COMPETITION'
  | 'TALENT_OPPORTUNITY'
  | 'OTHER'

export type ShortlistRecommendation =
  | 'STRONG_MATCH'
  | 'GOOD_MATCH'
  | 'MODERATE_MATCH'
  | 'LOW_MATCH'

export interface NormalizedJob {
  title: string
  company: string
  jobUrl: string
  sourceWebsite: string
  location: string | null
  salary: string | null
  description: string | null
  jobType: BackendJobType
  status: 'SAVED'
}

export interface JobNormalizationResult {
  normalized: NormalizedJob
  canSave: boolean
  completeness: number
  missingOptionalFields: string[]
  matchScore: number
  recommendation: ShortlistRecommendation
  recommendationLabel: string
  recommendationSubtitle: string
  recommendationIcon: string
  matchedFactors: string[]
  unmatchedFactors: string[]
  matchedSkills: string[]
  missingSkills: string[]
  roleMatchStatus: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED'
  roleMatchReason: string
  experienceMatchStatus: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED'
  experienceMatchReason: string
  experienceRequiredText?: string
  experienceProfileText?: string
  educationMatchStatus: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED'
  educationMatchReason: string
  skillsMatchStatus: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED'
  skillsMatchReason: string
  locationMatchStatus: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED'
  locationMatchReason: string
  readinessScore: number
  readinessFactors: string[]
  readinessIssues: string[]
}

/**
 * Normalizes raw job type strings into supported backend enum values.
 */
export function normalizeJobType(
  rawType: string = '',
  title: string = '',
  description: string = ''
): BackendJobType {
  const clean = rawType.trim().toLowerCase().replace(/[-_]/g, ' ')
  const cleanTitle = title.toLowerCase()

  // 1. Direct type matching
  if (clean.includes('intern') || clean.includes('stipend')) return 'INTERNSHIP'
  if (clean.includes('full time') || clean.includes('permanent')) return 'FULL_TIME'
  if (clean.includes('part time')) return 'PART_TIME'
  if (clean.includes('contract')) return 'CONTRACT'
  if (clean.includes('freelance')) return 'FREELANCE'
  if (clean.includes('temp') || clean.includes('temporary')) return 'TEMPORARY'
  if (clean.includes('graduate') || clean.includes('fresher')) return 'GRADUATE_PROGRAM'
  if (clean.includes('fellowship') || clean.includes('scholarship')) return 'FELLOWSHIP'
  if (clean.includes('competition') || clean.includes('hackathon') || clean.includes('challenge') || clean.includes('quiz')) return 'COMPETITION'
  if (clean.includes('talent') || clean.includes('audition') || clean.includes('casting')) return 'TALENT_OPPORTUNITY'

  // 2. Title fallback signals
  if (cleanTitle.includes('intern')) return 'INTERNSHIP'
  if (cleanTitle.includes('hackathon') || cleanTitle.includes('competition') || cleanTitle.includes('quiz') || cleanTitle.includes('challenge')) return 'COMPETITION'
  if (cleanTitle.includes('fellowship')) return 'FELLOWSHIP'
  if (cleanTitle.includes('graduate') || cleanTitle.includes('fresher')) return 'GRADUATE_PROGRAM'
  if (cleanTitle.includes('part time')) return 'PART_TIME'
  if (cleanTitle.includes('contract')) return 'CONTRACT'
  if (cleanTitle.includes('freelance')) return 'FREELANCE'

  // 3. Fallback
  if (clean.length > 0 && clean !== 'job' && clean !== 'work from home' && clean !== 'in office' && clean !== 'hybrid') {
    return 'OTHER'
  }

  return 'FULL_TIME'
}

/**
 * Normalizes opportunity URLs by stripping tracking parameters while keeping canonical paths.
 */
export function normalizeJobUrl(rawUrl: string = ''): string {
  if (!rawUrl) {
    return typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''
  }
  try {
    const parsed = new URL(rawUrl)
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'ref_id', 'source', 'shared_by', 'fbclid', 'gclid', 'trk'
    ]
    for (const p of trackingParams) {
      parsed.searchParams.delete(p)
    }
    return parsed.toString()
  } catch {
    return rawUrl.trim()
  }
}

/**
 * Normalizes extracted job data and performs strict deterministic profile matching.
 * Weights:
 * - Role Match (30%)
 * - Experience Match (25%)
 * - Education Match (20%)
 * - Skills Match (20%)
 * - Location Match (5%)
 *
 * Hard eligibility overrides:
 * - Fresher on 2-4 yrs job -> 🔴 LOW MATCH (capped <= 46%)
 * - Unrelated role -> 🔴 LOW MATCH (capped <= 44%)
 * - Incompatible education -> 🔴 LOW MATCH (capped <= 48%)
 */
export function normalizeJob(
  rawJob: ExtractedJob,
  userProfile?: UserProfile | null
): JobNormalizationResult {
  const title = (rawJob.title || '').trim() || 'Untitled Job'
  const company = (rawJob.company || '').trim() || 'Unknown Company'
  const rawUrl = (rawJob.jobUrl || '').trim() || (typeof window !== 'undefined' ? window.location.href : '')
  const jobUrl = normalizeJobUrl(rawUrl)
  
  const location = (rawJob.location || '').trim() || null
  const salary = (rawJob.salary || '').trim() || null
  const description = (rawJob.description || '').trim() || null
  const sourceWebsite =
    (rawJob.sourceWebsite || '').trim() ||
    (typeof window !== 'undefined'
      ? window.location.hostname.replace(/^www\./i, '')
      : 'Web')

  const jobType = normalizeJobType(rawJob.jobType || '', title, description || '')

  const missingOptionalFields: string[] = []
  let completenessScore = 0

  // Title (30%)
  if (title && title !== 'Untitled Job') completenessScore += 30
  // Company (25%)
  if (company && company !== 'Unknown Company') completenessScore += 25
  // URL (25%)
  if (jobUrl) completenessScore += 25

  // Optional: Location (10%)
  if (location) {
    completenessScore += 10
  } else {
    missingOptionalFields.push('location')
  }

  // Optional: Salary (5%)
  if (salary) {
    completenessScore += 5
  } else {
    missingOptionalFields.push('salary')
  }

  // Optional: Description (5%)
  if (description && description.length > 20) {
    completenessScore += 5
  } else {
    missingOptionalFields.push('description')
  }

  const profile: UserProfile = userProfile || {
    id: 'guest',
    userId: 'guest',
    preferredRoles: [],
    skills: [],
    preferredLocations: [],
    preferredJobTypes: [],
    workStyle: 'ANY',
    onboardingCompleted: false,
    otherLinks: [],
  }

  // ─── 1. Role Match (30%) ────────────────────────────────────────────────────
  const roleMatch = evaluateRoleMatch(title, profile.preferredRoles, 0.30)
  const isRolePass = roleMatch.score >= 0.6
  const isRoleMismatch = roleMatch.level === 'NO_MATCH' || roleMatch.score === 0
  const roleMatchStatus: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED' =
    profile.preferredRoles?.length === 0
      ? 'UNSPECIFIED'
      : isRolePass
      ? 'MATCH'
      : 'MISMATCH'
  const roleMatchReason = isRolePass ? 'Role match' : 'Role mismatch'

  // ─── 2. Experience Match (25%) ──────────────────────────────────────────────
  const experienceMatch = evaluateExperienceMatchStrict(title, description || undefined, rawJob.jobType, profile, 0.25)
  const isExpHardMismatch = experienceMatch.isHardMismatch || experienceMatch.status === 'MISMATCH'
  const experienceMatchStatus = experienceMatch.status
  const experienceMatchReason = experienceMatch.status === 'MATCH'
    ? 'Experience match'
    : experienceMatch.status === 'MISMATCH'
    ? `Experience mismatch: Required ${experienceMatch.requiredText}, Profile: ${experienceMatch.profileText}`
    : 'Experience standard/flexible'

  // ─── 3. Education Match (20%) ───────────────────────────────────────────────
  const educationMatch = evaluateEducationMatchStrict(title, description || undefined, profile, 0.20)
  const isEduHardMismatch = educationMatch.isHardMismatch && educationMatch.status === 'MISMATCH'
  const educationMatchStatus = educationMatch.status
  const educationMatchReason = educationMatch.status === 'MATCH'
    ? 'Education match'
    : educationMatch.status === 'MISMATCH'
    ? `Education mismatch: Requires ${educationMatch.requiredText}`
    : 'Education: Not specified'

  // ─── 4. Skills Match (20%) ──────────────────────────────────────────────────
  const skillsMatch = evaluateSkillsMatchStrict(title, description || undefined, profile, 0.20)
  const matchedSkills = skillsMatch.matchedSkills
  const missingSkills = skillsMatch.missingSkills
  const skillsMatchStatus = skillsMatch.status
  const skillsMatchReason = skillsMatch.status === 'MATCH' ? 'Skills match' : 'Missing key skills'

  // ─── 5. Location Match (5%) ─────────────────────────────────────────────────
  const locationMatch = evaluateLocationMatch(location || undefined, description || undefined, profile, 0.05)
  const locationMatchStatus: 'MATCH' | 'MISMATCH' | 'UNSPECIFIED' =
    !location || !profile.preferredLocations?.length
      ? 'UNSPECIFIED'
      : locationMatch.score >= 0.7
      ? 'MATCH'
      : 'MISMATCH'
  const locationMatchReason = locationMatch.reason

  // ─── Raw Score Calculation ─────────────────────────────────────────────────
  let rawScore = Math.round(
    roleMatch.weightedScore +
      experienceMatch.weightedScore +
      educationMatch.weightedScore +
      skillsMatch.weightedScore +
      locationMatch.weightedScore
  )

  // ─── HARD ELIGIBILITY RULES OVERRIDE THE RAW SCORE ─────────────────────────
  let matchScore = Math.min(100, Math.max(0, rawScore))
  let recommendation: ShortlistRecommendation = 'GOOD_MATCH'
  let recommendationLabel = 'GOOD MATCH'
  let recommendationSubtitle = 'Worth applying'
  let recommendationIcon = '🟢'

  if (isExpHardMismatch && experienceMatch.isHardMismatch) {
    // Hard experience mismatch (e.g. Fresher applying to 2-4 years) strictly caps score at ~42% and forces LOW MATCH
    matchScore = Math.min(42, Math.max(25, Math.round(rawScore * 0.46)))
    recommendation = 'LOW_MATCH'
    recommendationLabel = 'LOW MATCH'
    recommendationSubtitle = 'Experience requirement does not match your profile.'
    recommendationIcon = '🔴'
  } else if (isRoleMismatch && profile.preferredRoles?.length > 0) {
    // Hard role mismatch (e.g. Sales Executive for Developer)
    matchScore = Math.min(44, Math.max(20, Math.round(rawScore * 0.42)))
    recommendation = 'LOW_MATCH'
    recommendationLabel = 'LOW MATCH'
    recommendationSubtitle = 'Role does not align with your target preferences'
    recommendationIcon = '🔴'
  } else if (isEduHardMismatch) {
    // Hard education mismatch
    matchScore = Math.min(45, Math.max(25, Math.round(rawScore * 0.45)))
    recommendation = 'LOW_MATCH'
    recommendationLabel = 'LOW MATCH'
    recommendationSubtitle = 'Education requirement differs from your profile.'
    recommendationIcon = '🔴'
  } else {
    if (matchScore >= 85) {
      recommendation = 'STRONG_MATCH'
      recommendationLabel = 'STRONG MATCH'
      recommendationSubtitle = 'Recommended to apply'
      recommendationIcon = '🟢'
    } else if (matchScore >= 70) {
      recommendation = 'GOOD_MATCH'
      recommendationLabel = 'GOOD MATCH'
      recommendationSubtitle = 'Worth applying'
      recommendationIcon = '🟢'
    } else if (matchScore >= 50) {
      recommendation = 'MODERATE_MATCH'
      recommendationLabel = 'MODERATE MATCH'
      recommendationSubtitle = 'Review before applying'
      recommendationIcon = '🟡'
    } else {
      recommendation = 'LOW_MATCH'
      recommendationLabel = 'LOW MATCH'
      recommendationSubtitle = 'Low priority'
      recommendationIcon = '🔴'
    }
  }

  // ─── Matched & Unmatched Factors Breakdown ──────────────────────────────────
  const matchedFactors: string[] = []
  const unmatchedFactors: string[] = []

  if (roleMatchStatus === 'MATCH') {
    matchedFactors.push('Role match')
  } else if (roleMatchStatus === 'MISMATCH') {
    unmatchedFactors.push('Role mismatch')
  }

  if (educationMatchStatus === 'MATCH') {
    matchedFactors.push('Education match')
  } else if (educationMatchStatus === 'MISMATCH') {
    unmatchedFactors.push(educationMatchReason)
  }

  if (experienceMatchStatus === 'MATCH') {
    matchedFactors.push('Experience match')
  } else if (experienceMatchStatus === 'MISMATCH') {
    unmatchedFactors.push(experienceMatchReason)
  }

  if (skillsMatchStatus === 'MATCH' && matchedSkills.length > 0) {
    matchedFactors.push('Skills match')
  }
  if (missingSkills.length > 0) {
    unmatchedFactors.push(`Missing: ${missingSkills.slice(0, 2).join(' • ')}`)
  }

  if (locationMatchStatus === 'MATCH') {
    matchedFactors.push('Location match')
  }

  if (matchedFactors.length === 0 && !isExpHardMismatch && !isRoleMismatch) {
    matchedFactors.push('Skills match')
    matchedFactors.push('Experience match')
  }

  // ─── Application Readiness Calculation ──────────────────────────────────────
  let readinessScore = 90
  const readinessFactors: string[] = []
  const readinessIssues: string[] = []

  readinessFactors.push('Resume available')
  readinessFactors.push('Profile complete')

  if (isExpHardMismatch) {
    readinessIssues.push('Experience level differs')
  } else {
    readinessFactors.push('Experience suitable')
  }

  if (missingSkills.length > 2) {
    readinessScore -= 10
    readinessIssues.push(`Missing: ${missingSkills[0]}`)
  }

  if (completenessScore < 70) {
    readinessIssues.push('Resume could be tailored')
  }

  readinessScore = Math.max(70, Math.min(100, readinessScore))

  const normalized: NormalizedJob = {
    title,
    company,
    jobUrl,
    sourceWebsite,
    location,
    salary,
    description,
    jobType,
    status: 'SAVED',
  }

  const canSave = Boolean(title && jobUrl)

  return {
    normalized,
    canSave,
    completeness: Math.min(100, completenessScore),
    missingOptionalFields,
    matchScore,
    recommendation,
    recommendationLabel,
    recommendationSubtitle,
    recommendationIcon,
    matchedFactors,
    unmatchedFactors,
    matchedSkills,
    missingSkills,
    roleMatchStatus,
    roleMatchReason,
    experienceMatchStatus,
    experienceMatchReason,
    experienceRequiredText: experienceMatch.requiredText,
    experienceProfileText: experienceMatch.profileText,
    educationMatchStatus,
    educationMatchReason,
    skillsMatchStatus,
    skillsMatchReason,
    locationMatchStatus,
    locationMatchReason,
    readinessScore,
    readinessFactors,
    readinessIssues,
  }
}

