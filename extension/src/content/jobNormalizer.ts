import { ExtractedJob, UserProfile } from '../types'

export interface NormalizedJob {
  title: string
  company: string
  jobUrl: string
  sourceWebsite: string
  location: string | null
  salary: string | null
  description: string | null
  jobType: string
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
 * Normalizes extracted job data and separates completeness from save eligibility.
 * Minimum required fields: title and URL (with safe company fallback).
 */
export function normalizeJob(
  rawJob: ExtractedJob,
  userProfile?: UserProfile | null
): JobNormalizationResult {
  const title = (rawJob.title || '').trim() || 'Untitled Job'
  const company = (rawJob.company || '').trim() || 'Unknown Company'
  const jobUrl =
    (rawJob.jobUrl || '').trim() ||
    (typeof window !== 'undefined' ? window.location.href : '')
  const location = (rawJob.location || '').trim() || null
  const salary = (rawJob.salary || '').trim() || null
  const description = (rawJob.description || '').trim() || null
  const sourceWebsite =
    (rawJob.sourceWebsite || '').trim() ||
    (typeof window !== 'undefined'
      ? window.location.hostname.replace(/^www\./i, '')
      : 'Web')
  const jobType = rawJob.jobType || 'JOB'

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
