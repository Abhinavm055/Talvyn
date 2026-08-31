// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  authProvider?: 'EMAIL' | 'GOOGLE'
  avatarUrl?: string | null
  profile: UserProfile | null
}

export interface AuthResponse {
  token: string
  user: AuthUser
  isNewUser?: boolean
}

// ─── Profile ─────────────────────────────────────────────────────────────────

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
  dateOfBirth?: string | null
  gender?: string | null
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
  websiteUrl?: string | null
  otherLinks: string[]
  currentCompany?: string | null
  currentJobTitle?: string | null
  // Education
  institution?: string | null
  degree?: string | null
  specialization?: string | null
  cgpa?: string | null
  graduationYear?: number | null
  // Application
  workAuthorization?: string | null
  visaStatus?: string | null
  expectedSalary?: string | null
  noticePeriod?: string | null
  preferredLocations: string[]
  preferredJobTypes: string[]
  workStyle: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'ANY'
  onboardingCompleted: boolean
}

// ─── Resumes ──────────────────────────────────────────────────────────────────

export interface Resume {
  id: string
  userId: string
  name: string
  description?: string | null
  isDefault: boolean
  fileUrl?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Phase 2C: Universal Autofill Taxonomy & Types ────────────────────────────

export type PersonalFieldType =
  | 'fullName'
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'preferredName'
  | 'email'
  | 'phone'
  | 'dateOfBirth'
  | 'gender'
  | 'address'
  | 'city'
  | 'state'
  | 'country'
  | 'postalCode'

export type ProfessionalFieldType =
  | 'linkedinUrl'
  | 'githubUrl'
  | 'portfolioUrl'
  | 'websiteUrl'
  | 'skills'

export type EducationFieldType =
  | 'institution'
  | 'degree'
  | 'specialization'
  | 'graduationYear'
  | 'cgpa'

export type ApplicationFieldType =
  | 'workAuthorization'
  | 'visaStatus'
  | 'expectedSalary'
  | 'noticePeriod'
  | 'currentCompany'
  | 'currentJobTitle'
  | 'yearsOfExperience'

export type SpecialFieldType =
  | 'customQuestion'
  | 'resumeUpload'
  | 'unknown'

export type DetectedFieldType =
  | PersonalFieldType
  | ProfessionalFieldType
  | EducationFieldType
  | ApplicationFieldType
  | SpecialFieldType

export type AutofillConfidenceLevel =
  | 'HIGH'    // 90 - 100
  | 'MEDIUM'  // 70 - 89
  | 'LOW'     // 50 - 69
  | 'UNKNOWN' // Below 50

export interface DetectedFormField {
  id: string
  element: HTMLElement
  selector: string
  tag: 'input' | 'textarea' | 'select' | 'radio' | 'checkbox'
  inputType: string
  name: string
  domId: string
  label: string
  placeholder: string
  ariaLabel: string
  autocomplete: string
  nearbyText: string
  options: { label: string; value: string; selected?: boolean }[]
  currentValue: string | boolean
  isRequired: boolean
  isIgnored: boolean
}

export interface MatchedFormField {
  field: DetectedFormField
  detectedType: DetectedFieldType
  confidence: number // 0 to 100
  confidenceLevel: AutofillConfidenceLevel
  matchedProfileField: string
  valueToFill: string | boolean | null
  reason: string
  canAutofill: boolean
  isCustomQuestion: boolean
  isResumeUpload: boolean
  isFilled?: boolean
  error?: string
}

export interface FormAnalysisSummary {
  totalFields: number
  highConfidenceCount: number
  mediumConfidenceCount: number
  lowConfidenceCount: number
  unknownCount: number
  customQuestionsCount: number
  resumeUploadDetected: boolean
  matchedFields: MatchedFormField[]
  availableResumes?: Resume[]
  defaultResume?: Resume | null
  pageUrl: string
  detectedAt: string
}

// ─── Autofill Adapter Interface ───────────────────────────────────────────────

export interface AutofillSiteAdapter {
  name: string
  canHandle(url: string, doc: Document): boolean
  isApplicationForm(url: string, doc: Document): boolean
  findFormRoots(doc: Document): HTMLElement[]
  extractFieldMetadata(element: HTMLElement): DetectedFormField | null
}


// ─── Jobs & Universal Opportunities (Phase 2E) ───────────────────────────────

export type JobStatus =
  | 'SAVED' | 'INTERESTED' | 'IN_PROGRESS' | 'APPLIED' | 'ASSESSMENT'
  | 'INTERVIEW' | 'OFFER' | 'ACCEPTED' | 'REJECTED'
  | 'WITHDRAWN' | 'EXPIRED'

export type OpportunityType =
  | 'JOB'
  | 'INTERNSHIP'
  | 'GRADUATE_PROGRAM'
  | 'FELLOWSHIP'
  | 'COMPETITION'
  | 'TALENT_OPPORTUNITY'
  | 'OTHER'

export type JobType =
  | 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE'
  | 'INTERNSHIP' | 'TEMPORARY' | 'OTHER'
  | OpportunityType

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
}

export interface CreateJobPayload {
  title: string
  company: string
  jobUrl?: string
  sourceWebsite?: string
  location?: string
  jobType?: JobType
  salary?: string
  description?: string
  status?: JobStatus
}

export interface CheckUrlResponse {
  exists: boolean
  job: Pick<Job, 'id' | 'title' | 'company' | 'status'> | null
}

// ─── Extracted Job Data (from content script) ────────────────────────────────

export interface ExtractedJob {
  id?: string
  title: string
  company: string
  location?: string
  salary?: string
  jobType?: string
  description?: string
  jobUrl: string
  sourceWebsite: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  seniority?: string
  extractedAt?: string
}

// ─── Role Matching & Scoring (Phase 2B) ───────────────────────────────────────

export type RoleMatchLevel =
  | 'EXACT_MATCH'
  | 'STRONG_RELATED'
  | 'RELATED'
  | 'WEAK_MATCH'
  | 'NO_MATCH'

export type RecommendationCategory =
  | 'EXCELLENT'       // 90 - 100
  | 'HIGHLY_RELEVANT' // 75 - 89
  | 'RELEVANT'        // 55 - 74
  | 'LOW_RELEVANCE'   // Below 55

export interface ComponentScore {
  score: number // 0.0 to 1.0
  weight: number // 0.0 to 1.0
  weightedScore: number // score * weight * 100
  reason: string
}

export interface RoleMatchResult extends ComponentScore {
  level: RoleMatchLevel
  matchedRole?: string
  rawTitle: string
  normalizedTitle: string
}

export interface AnalyzedJob {
  job: ExtractedJob
  relevanceScore: number // 0 to 100
  category: RecommendationCategory
  roleMatch: RoleMatchResult
  locationMatch: ComponentScore
  experienceMatch: ComponentScore
  jobTypeMatch: ComponentScore
  salaryMatch: ComponentScore
  matchedReasons: string[]
  unmatchedReasons: string[]
  isSaved?: boolean
  savedJobId?: string
}

export interface JobListAnalysisSummary {
  totalDetected: number
  excellentCount: number
  highlyRelevantCount: number
  relevantCount: number
  lowRelevanceCount: number
  analyzedJobs: AnalyzedJob[]
  pageUrl: string
  scannedAt: string
}

// ─── Extension Messages ───────────────────────────────────────────────────────

export type MessageType =
  | 'JOB_DETECTED'
  | 'JOB_LIST_DETECTED'
  | 'SAVE_JOB'
  | 'JOB_SAVED'
  | 'GET_AUTH'
  | 'AUTH_STATE'
  | 'CHECK_DUPLICATE'
  | 'DUPLICATE_RESULT'
  | 'GET_PROFILE'
  | 'PROFILE_DATA'
  | 'TALVYN_API_REQUEST'
  | 'TALVYN_SAVE_JOB'
  | 'TALVYN_CHECK_DUPLICATE'
  | 'TALVYN_UPDATE_JOB_STATUS'
  | 'TALVYN_TRACK_APPLIED'
  | 'TALVYN_UNDO_APPLIED'
  | 'TALVYN_GET_PROFILE'
  | 'TALVYN_GET_RESUMES'
  | 'TALVYN_GET_TIMELINE'
  | 'TALVYN_ADD_TIMELINE_EVENT'
  | 'ERROR'

export interface ExtensionMessage<T = unknown> {
  type: MessageType | string
  payload?: T
  error?: string
  method?: string
  path?: string
  body?: unknown
  headers?: Record<string, string>
  status?: number
  success?: boolean
  data?: unknown
  job?: Job
}


// ─── Storage ──────────────────────────────────────────────────────────────────

export interface StorageData {
  token: string | null
  user: AuthUser | null
  lastDetectedJob: ExtractedJob | null
  lastScanSummary: JobListAnalysisSummary | null
}

// ─── Site Adapter Interface ───────────────────────────────────────────────────

export interface SiteAdapter {
  name: string
  canHandle(url: string, doc: Document): boolean
  isJobDetailPage(url: string, doc: Document): boolean
  isJobListingPage(url: string, doc: Document): boolean
  extractJobList(doc: Document): ExtractedJob[]
  extractSingleJob(doc: Document): ExtractedJob | null
}

// ─── Phase 2D: Application Success Detection & Tracking ───────────────────────

export type SuccessConfidenceLevel =
  | 'CONFIRMED'     // 90 - 100: Auto-update to Applied
  | 'LIKELY'        // 70 - 89: Prompt user to confirm
  | 'POSSIBLE'      // 50 - 69: Do not auto-update
  | 'NOT_CONFIRMED' // Below 50: Ignore

export interface SuccessDetectionResult {
  isSuccess: boolean
  confidence: number // 0 to 100
  confidenceLevel: SuccessConfidenceLevel
  matchedSignals: string[]
  detectionMethod: string
  pageUrl: string
  timestamp: string
}

export interface ApplicationSession {
  id: string
  pageUrl: string
  jobUrl?: string | null
  jobTitle?: string | null
  company?: string | null
  location?: string | null
  startedAt: string
  lastActivityAt: string
  submitted?: boolean
}

export interface TrackAppliedPayload {
  title: string
  company: string
  jobUrl?: string | null
  sourceWebsite?: string | null
  location?: string | null
  salary?: string | null
  description?: string | null
  confidence?: number
  detectionMethod?: string
}

export interface TrackAppliedResponse {
  job: Job
  isNew: boolean
  previousStatus: JobStatus | null
  message: string
}

export interface UndoAppliedPayload {
  previousStatus?: JobStatus | null
  isNew?: boolean
}

export interface UndoAppliedResponse {
  success: boolean
  deleted?: boolean
  job?: Job
  message: string
}

export interface SuccessSiteAdapter {
  name: string
  canHandle(url: string, doc: Document): boolean
  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null
  extractSubmittedJobInfo?(doc: Document, session?: ApplicationSession | null): Partial<ExtractedJob> | null
}

