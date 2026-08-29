export type JobStatus =
  | 'SAVED'
  | 'INTERESTED'
  | 'IN_PROGRESS'
  | 'APPLIED'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'OFFER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'EXPIRED'

export type OpportunityType =
  | 'JOB'
  | 'INTERNSHIP'
  | 'GRADUATE_PROGRAM'
  | 'FELLOWSHIP'
  | 'COMPETITION'
  | 'TALENT_OPPORTUNITY'
  | 'OTHER'

export type JobType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'CONTRACT'
  | 'FREELANCE'
  | 'INTERNSHIP'
  | 'TEMPORARY'
  | 'OTHER'
  | OpportunityType

export type WorkStyle = 'REMOTE' | 'HYBRID' | 'ONSITE' | 'ANY'

// ─── Timeline ─────────────────────────────────────────────────────────────────

export type TimelineStage =
  | 'SAVED'
  | 'APPLICATION_STARTED'
  | 'APPLIED'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'OFFER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'

export interface TimelineEvent {
  id: string
  jobId: string
  stage: TimelineStage
  title: string
  timestamp: string
  source?: string
  note?: string
  completed: boolean
}

// ─── Application Readiness ────────────────────────────────────────────────────

export type ReadinessTier = 'READY' | 'MOSTLY_READY' | 'NEEDS_ATTENTION' | 'INCOMPLETE'

export interface ReadinessItem {
  key: string
  label: string
  category: 'PERSONAL' | 'PROFESSIONAL' | 'DOCUMENTS'
  isReady: boolean
  value?: string | null
  isRequiredByForm?: boolean
}

export interface ApplicationReadinessResult {
  score: number // 0 to 100
  tier: ReadinessTier
  readyItems: string[]
  missingItems: string[]
  items: ReadinessItem[]
  reasons: string[]
  summaryText: string
}

export interface OpportunityClassificationResult {
  type: OpportunityType
  confidence: number
  reasons: string[]
  signals: string[]
  deadline?: string | null
}


export type AuthProvider = 'EMAIL' | 'GOOGLE'

export interface User {
  id: string
  email: string
  authProvider?: AuthProvider
  avatarUrl?: string | null
  profile: UserProfile | null
}

export interface UserProfile {
  id: string
  userId: string
  // Personal
  legalFullName?: string | null
  givenName?: string | null
  middleName?: string | null
  familyName?: string | null
  prefix?: string | null
  preferredName?: string | null
  email?: string | null
  phone?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  address?: string | null
  postalCode?: string | null
  // Professional
  preferredRoles: string[]
  skills: string[]
  experienceYears?: number | null
  linkedinUrl?: string | null
  githubUrl?: string | null
  portfolioUrl?: string | null
  otherLinks: string[]
  languages?: string[]
  avatarUrl?: string | null
  // Education
  institution?: string | null
  degree?: string | null
  specialization?: string | null
  cgpa?: string | null
  graduationYear?: number | null
  // Application
  workAuthorization?: string | null
  expectedSalary?: string | null
  noticePeriod?: string | null
  preferredLocations: string[]
  preferredJobTypes?: string[]
  workStyle: WorkStyle
  onboardingCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface Job {
  id: string
  userId: string
  title: string
  company: string
  jobUrl?: string | null
  sourceWebsite?: string | null
  location?: string | null
  jobType?: JobType | null
  salary?: string | null
  description?: string | null
  status: JobStatus
  dateSaved: string
  dateApplied?: string | null
  createdAt: string
  updatedAt: string
  notes?: Note[]
  _count?: { notes: number }
}

export interface Note {
  id: string
  jobId: string
  userId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface Resume {
  id: string
  userId: string
  name: string
  description?: string | null
  isDefault: boolean
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  mimeType?: string | null
  storagePath?: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  total: number
  applied: number
  interviews: number
  offers: number
  rejected: number
}
