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
  readinessScore: number
  readinessFactors: string[]
  readinessIssues: string[]
}

const COMMON_SKILLS_CANONICAL: Record<string, string> = {
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
 * Computes profile match percentage, matched/missing skills, shortlist recommendations, and application readiness.
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

  // ─── Skill & Profile Intelligence ──────────────────────────────────────────
  const fullText = `${title} ${description || ''}`.toLowerCase()
  const detectedJobSkills: string[] = []

  for (const [key, canonical] of Object.entries(COMMON_SKILLS_CANONICAL)) {
    // Word boundary check to prevent false substring positives
    const regex = new RegExp(`(?:^|[\\s,.;/()+-])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s,.;/()+-])`, 'i')
    if (regex.test(fullText)) {
      if (!detectedJobSkills.includes(canonical)) {
        detectedJobSkills.push(canonical)
      }
    }
  }

  const userSkills = (userProfile?.skills || []).map((s) => s.trim())
  const userSkillsLower = userSkills.map((s) => s.toLowerCase())
  const userRoles = (userProfile?.preferredRoles || []).map((r) => r.toLowerCase())
  const titleLower = title.toLowerCase()

  const matchedSkills: string[] = []
  const missingSkills: string[] = []

  // Check detected skills in job against user profile
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

  // If no job skills matched yet, check user skills appearing in title/description
  if (matchedSkills.length === 0 && userSkills.length > 0) {
    for (const us of userSkills) {
      if (fullText.includes(us.toLowerCase()) && !matchedSkills.includes(us)) {
        matchedSkills.push(us)
      }
    }
  }

  // ─── Profile Match Breakdown ────────────────────────────────────────────────
  const matchedFactors: string[] = []
  const unmatchedFactors: string[] = []
  let matchScore = 70 // baseline neutral

  let hasRoleMatch = false
  if (userRoles.length > 0) {
    hasRoleMatch = userRoles.some(
      (r) => titleLower.includes(r) || r.includes(titleLower)
    )
    if (hasRoleMatch) {
      matchScore += 12
      matchedFactors.push('Role match')
    } else {
      matchScore -= 14
      unmatchedFactors.push('Different role focus')
    }
  }

  if (matchedSkills.length > 0) {
    matchScore += Math.min(15, matchedSkills.length * 4)
    matchedFactors.push('Skills match')
  }

  if (missingSkills.length > 0) {
    matchScore -= Math.min(12, missingSkills.length * 3)
  }

  if (userProfile?.education && userProfile.education.length > 0) {
    matchScore += 3
    matchedFactors.push('Education match')
  }

  if (userProfile?.experienceYears !== null && userProfile?.experienceYears !== undefined) {
    matchScore += 3
    matchedFactors.push('Experience match')
  }

  // Location match
  if (location && userProfile?.preferredLocations?.length) {
    const locLower = location.toLowerCase()
    const locMatch = userProfile.preferredLocations.some((pl) =>
      locLower.includes(pl.toLowerCase())
    )
    if (locMatch || locLower.includes('remote')) {
      matchScore += 5
      matchedFactors.push('Location match')
    } else if (!locLower.includes('remote')) {
      matchScore -= 6
    }
  }

  if (matchedFactors.length === 0) {
    matchedFactors.push('Skills match')
    matchedFactors.push('Experience match')
    matchedFactors.push('Education match')
  }

  if (missingSkills.length > 0) {
    unmatchedFactors.push(`Missing: ${missingSkills.slice(0, 2).join(' • ')}`)
  }

  if (missingOptionalFields.includes('salary')) {
    unmatchedFactors.push('Salary unavailable')
  }

  if (missingOptionalFields.length >= 2) {
    unmatchedFactors.push('Some job info unavailable')
  }

  matchScore = Math.max(30, Math.min(98, matchScore))

  // ─── Shortlist Recommendation ───────────────────────────────────────────────
  let recommendation: ShortlistRecommendation = 'GOOD_MATCH'
  let recommendationLabel = 'GOOD MATCH'
  let recommendationSubtitle = 'Worth applying'
  let recommendationIcon = '🟢'

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

  // ─── Application Readiness Calculation ──────────────────────────────────────
  let readinessScore = 90
  const readinessFactors: string[] = []
  const readinessIssues: string[] = []

  readinessFactors.push('Resume available')
  readinessFactors.push('Profile complete')

  if (matchedSkills.length > 0) {
    readinessFactors.push('Required skills')
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

  // Minimum required for saving is title & URL
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
    readinessScore,
    readinessFactors,
    readinessIssues,
  }
}
