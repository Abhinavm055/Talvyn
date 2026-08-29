/**
 * Talvyn Universal Application Assistant Types (Phase 2F)
 */

import { UserProfile, Resume, DetectedFormField, MatchedFormField } from '../../types'

export type ApplicationSessionState =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'READY_FOR_REVIEW'
  | 'SUBMITTED'
  | 'ABANDONED'

export type ApplicationFieldCategory =
  | 'PERSONAL'
  | 'PROFESSIONAL'
  | 'EDUCATION'
  | 'DOCUMENTS'
  | 'QUESTIONS'
  | 'PREFERENCES'
  | 'OTHER'

export type QuestionRiskLevel =
  | 'SAFE_AUTOFILL'     // e.g. Name, Email, LinkedIn
  | 'ASSISTED_ANSWER'   // e.g. "Why do you want to join?", "Tell us about yourself"
  | 'USER_ACTION_REQUIRED' // e.g. Salary, Legal declaration, Work Authorization, Sponsorship, Criminal history

export interface ApplicationFieldAnalysis {
  id: string
  field: DetectedFormField
  category: ApplicationFieldCategory
  canonicalName: string
  label: string
  isRequired: boolean
  isFilled: boolean
  filledBy: 'TALVYN_AUTOFILL' | 'USER_INPUT' | 'UNFILLED'
  currentValue: string | boolean
  suggestedValue: string | null
  riskLevel: QuestionRiskLevel
  riskReason?: string
  confidence: number
}

export interface ApplicationProgress {
  totalFields: number
  filledFields: number
  requiredFields: number
  requiredFilledFields: number
  percentage: number
  categoryProgress: Record<
    ApplicationFieldCategory,
    { total: number; filled: number; required: number; requiredFilled: number }
  >
  isComplete: boolean
  isReadyForReview: boolean
}

export interface QuestionContext {
  questionText: string
  jobTitle?: string
  companyName?: string
  jobDescription?: string
  profile: UserProfile
  resumes?: Resume[]
  selectedResume?: Resume | null
}

export interface QuestionAnswerResult {
  suggestedAnswer: string
  confidence: number
  reasoning: string
  provider: 'RULE_BASED' | 'AI_GEMINI' | 'CUSTOM'
  keyPoints?: string[]
}

export interface AnswerGenerationProvider {
  name: string
  canHandle(context: QuestionContext): boolean
  generateAnswer(context: QuestionContext): Promise<QuestionAnswerResult>
}

export interface ResumeRecommendation {
  resume: Resume
  score: number // 0 - 100
  matchReasons: string[]
  isDefault: boolean
}

export interface ApplicationAssistantSession {
  id: string
  jobId?: string | null
  jobTitle: string
  company: string
  jobUrl: string
  state: ApplicationSessionState
  startedAt: string
  lastActivityAt: string
  progress: ApplicationProgress
  selectedResumeId?: string | null
  fields: ApplicationFieldAnalysis[]
  highRiskQuestions: ApplicationFieldAnalysis[]
  missingRequiredCount: number
}
