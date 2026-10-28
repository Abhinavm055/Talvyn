/**
 * Provides only direct, verified profile values for application questions.
 * Open-ended questions without profile source data are left for the user.
 */

import {
  AnswerGenerationProvider,
  QuestionContext,
  QuestionAnswerResult,
  QuestionRiskLevel,
} from '../types'

export class RuleBasedAnswerProvider implements AnswerGenerationProvider {
  name = 'RuleBasedAnswerProvider'

  canHandle(context: QuestionContext): boolean {
    return !!context.questionText && context.questionText.trim().length > 0
  }

  async generateAnswer(context: QuestionContext): Promise<QuestionAnswerResult> {
    const q = context.questionText.toLowerCase().trim()
    const profile = context.profile
    const directValue = (value: string, label: string): QuestionAnswerResult => ({
      provider: 'RULE_BASED',
      confidence: 100,
      reasoning: `Copied the verified ${label} value from the candidate profile.`,
      suggestedAnswer: value,
    })

    if (q.includes('notice period') && profile.noticePeriod?.trim()) {
      return directValue(profile.noticePeriod.trim(), 'notice period')
    }

    if (
      (q.includes('years of experience') || q.includes('how many years')) &&
      profile.experienceYears !== null && profile.experienceYears !== undefined
    ) {
      return directValue(String(profile.experienceYears), 'experience-years')
    }

    if ((q.includes('list your skills') || q.includes('what skills') || q === 'skills') && profile.skills?.length) {
      return directValue(profile.skills.join(', '), 'skills')
    }

    if ((q.includes('degree') || q.includes('education')) && profile.degree?.trim()) {
      const education = [profile.degree.trim(), profile.specialization?.trim()].filter(Boolean).join(' in ')
      return directValue(education, 'education')
    }

    return {
      provider: 'RULE_BASED',
      confidence: 0,
      reasoning: 'No verified profile value can answer this question. Add your own response; Talvyn will leave it blank.',
      suggestedAnswer: '',
    }
  }
}

/**
 * Identifies questions that require explicit personal review before any value
 * can be filled into an application.
 */
export function classifyQuestionRisk(questionText: string): {
  riskLevel: QuestionRiskLevel
  reason?: string
} {
  const q = questionText.toLowerCase()

  if (
    q.includes('declare') ||
    q.includes('certify that') ||
    q.includes('agree to terms') ||
    q.includes('under penalty of perjury') ||
    q.includes('accurate and complete')
  ) {
    return {
      riskLevel: 'USER_ACTION_REQUIRED',
      reason: 'Legal declaration or agreement requires user manual verification.',
    }
  }

  if (
    q.includes('criminal') ||
    q.includes('convicted') ||
    q.includes('disability') ||
    q.includes('veteran') ||
    q.includes('gender identity') ||
    q.includes('race') ||
    q.includes('ethnicity')
  ) {
    return {
      riskLevel: 'USER_ACTION_REQUIRED',
      reason: 'Sensitive equal opportunity / compliance question requires personal selection.',
    }
  }

  if (
    q.includes('salary expectation') ||
    q.includes('desired salary') ||
    q.includes('compensation requirement') ||
    q.includes('minimum rate')
  ) {
    return {
      riskLevel: 'USER_ACTION_REQUIRED',
      reason: 'Salary expectation is a sensitive negotiation decision.',
    }
  }

  if (
    q.includes('sponsorship') ||
    q.includes('visa') ||
    q.includes('authorized to work') ||
    q.includes('work authorization') ||
    q.includes('work permit') ||
    q.includes('legally authorized')
  ) {
    return {
      riskLevel: 'USER_ACTION_REQUIRED',
      reason: 'Work authorization and visa sponsorship status must be confirmed manually.',
    }
  }

  if (
    q.includes('why') ||
    q.includes('describe') ||
    q.includes('tell us') ||
    q.includes('project') ||
    q.includes('cover letter')
  ) {
    return {
      riskLevel: 'ASSISTED_ANSWER',
      reason: 'Open-ended question needs an answer supplied by the user.',
    }
  }

  return { riskLevel: 'SAFE_AUTOFILL' }
}

export const ruleBasedAnswerProvider = new RuleBasedAnswerProvider()
