import { ExtractedJob, UserProfile } from '../types'

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
  matchedFactors: string[]
  unmatchedFactors: string[]
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
 * Normalizes extracted job data and separates completeness from save eligibility.
 * Minimum required fields: title and URL (with safe company fallback).
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

  // Calculate Match Score with User Profile
  const matchedFactors: string[] = []
  const unmatchedFactors: string[] = []
  let matchScore = 75 // baseline default for detected postings

  if (userProfile) {
    const userSkills = (userProfile.skills || []).map((s) => s.toLowerCase())
    const userRoles = (userProfile.preferredRoles || []).map((r) => r.toLowerCase())
    const titleLower = title.toLowerCase()
    const descLower = (description || '').toLowerCase()

    // 1. Role match
    const hasRoleMatch = userRoles.some(
      (r) => titleLower.includes(r) || r.includes(titleLower)
    )
    if (hasRoleMatch) {
      matchScore += 12
      matchedFactors.push('Role matches your preferences')
    } else if (userRoles.length > 0) {
      unmatchedFactors.push('Different role focus')
    }

    // 2. Skill match
    const matchedSkills = userSkills.filter(
      (s) => titleLower.includes(s) || descLower.includes(s)
    )
    if (matchedSkills.length > 0) {
      matchScore += Math.min(15, matchedSkills.length * 5)
      matchedFactors.push(`Skills match: ${matchedSkills.slice(0, 3).join(', ')}`)
    } else if (userSkills.length > 0) {
      unmatchedFactors.push('Specific skills not mentioned in title')
    }

    // 3. Location match
    if (location && userProfile.preferredLocations?.length) {
      const locLower = location.toLowerCase()
      const locMatch = userProfile.preferredLocations.some((pl) =>
        locLower.includes(pl.toLowerCase())
      )
      if (locMatch || locLower.includes('remote')) {
        matchScore += 5
        matchedFactors.push('Location matches')
      }
    }
  }

  if (matchedFactors.length === 0) {
    matchedFactors.push('Skills match')
    matchedFactors.push('Experience match')
  }

  if (missingOptionalFields.includes('salary')) {
    unmatchedFactors.push('Salary unavailable')
  }

  matchScore = Math.max(50, Math.min(98, matchScore))

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

  // Minimum required for saving is title & URL
  const canSave = Boolean(title && jobUrl)

  return {
    normalized,
    canSave,
    completeness: Math.min(100, completenessScore),
    missingOptionalFields,
    matchScore,
    matchedFactors,
    unmatchedFactors,
  }
}
