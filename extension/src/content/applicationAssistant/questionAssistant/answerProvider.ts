/**
 * Talvyn Question Answer Generation Providers (Phase 2F)
 *
 * Provides deterministic rule-based answer suggestions for common application questions
 * with an extensible provider interface for future AI (Gemini) integrations.
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
    const jobTitle = context.jobTitle || 'this role'
    const company = context.companyName || 'your organization'
    const skills = context.profile.skills || []
    const topSkills = skills.slice(0, 4).join(', ') || 'modern industry technologies'
    const exp = context.profile.experienceYears
      ? `${context.profile.experienceYears}+ years of experience`
      : 'proven hands-on experience'

    // ── 1. "Why do you want to join / work here?" ────────────────────────────
    if (
      q.includes('why do you want to join') ||
      q.includes('why do you want to work') ||
      q.includes('why this company') ||
      q.includes('why work at') ||
      q.includes('interest in this role')
    ) {
      return {
        provider: 'RULE_BASED',
        confidence: 88,
        reasoning: 'Generated from company alignment and candidate technical background.',
        keyPoints: ['Company innovation', 'Technical challenge alignment', 'Impactful contribution'],
        suggestedAnswer: `I am excited about the opportunity at ${company} because of your team's focus on building high-impact, innovative solutions. With my background in ${topSkills} and ${exp}, I am eager to contribute directly to the engineering and product goals of the ${jobTitle} position while continuing to grow alongside a forward-thinking team.`,
      }
    }

    // ── 2. "Why are you a good fit / Why should we hire you?" ────────────────
    if (
      q.includes('why are you a good fit') ||
      q.includes('why should we hire you') ||
      q.includes('what makes you a strong candidate') ||
      q.includes('why are you the best fit')
    ) {
      return {
        provider: 'RULE_BASED',
        confidence: 90,
        reasoning: 'Synthesized from profile skills, years of experience, and role requirements.',
        keyPoints: ['Core skill alignment', 'Proven delivery', 'Strong collaboration'],
        suggestedAnswer: `I believe I am a strong fit for the ${jobTitle} role because I bring ${exp} with core strengths in ${topSkills}. Throughout my projects, I have consistently delivered robust, maintainable solutions and collaborated across multidisciplinary teams to solve complex problems efficiently.`,
      }
    }

    // ── 3. "Tell us about a project / technical accomplishment" ──────────────
    if (
      q.includes('project') ||
      q.includes('accomplishment') ||
      q.includes('challenge you solved') ||
      q.includes('proudest technical')
    ) {
      return {
        provider: 'RULE_BASED',
        confidence: 85,
        reasoning: 'Structured using the STAR framework (Situation, Task, Action, Result).',
        keyPoints: ['Architecture design', 'Problem solving', 'Measurable impact'],
        suggestedAnswer: `In a recent technical project involving ${topSkills}, I designed and implemented modular features that enhanced performance and reliability. By applying best coding practices, clean architecture, and rigorous automated testing, we were able to improve delivery speed and user satisfaction.`,
      }
    }

    // ── 4. "Notice Period / Availability" ────────────────────────────────────
    if (
      q.includes('notice period') ||
      q.includes('when can you start') ||
      q.includes('earliest start date') ||
      q.includes('availability')
    ) {
      const notice = context.profile.noticePeriod || 'Immediate / 2 Weeks'
      return {
        provider: 'RULE_BASED',
        confidence: 95,
        reasoning: 'Directly sourced from profile notice period preference.',
        suggestedAnswer: `My current notice period is ${notice}, and I am available to start upon completing any required transition steps.`,
      }
    }

    // ── 5. "Relocation / Location Preference" ────────────────────────────────
    if (
      q.includes('relocate') ||
      q.includes('willing to relocate') ||
      q.includes('location preference')
    ) {
      return {
        provider: 'RULE_BASED',
        confidence: 90,
        reasoning: 'Open relocation statement matching profile work style.',
        suggestedAnswer: `I am flexible regarding work arrangement (including remote, hybrid, or on-site opportunities) and open to discussing relocation for the right opportunity.`,
      }
    }

    // ── Default Fallback ─────────────────────────────────────────────────────
    return {
      provider: 'RULE_BASED',
      confidence: 65,
      reasoning: 'General professional template tailored to candidate skills and target position.',
      suggestedAnswer: `As a professional with experience in ${topSkills}, I bring a strong problem-solving mindset and dedication to high-quality execution for the ${jobTitle} position at ${company}.`,
    }
  }
}

/**
 * Question Risk Classifier
 * Identifies high-risk questions that require explicit manual user input and must never be blindly filled.
 */
export function classifyQuestionRisk(questionText: string): {
  riskLevel: QuestionRiskLevel
  reason?: string
} {
  const q = questionText.toLowerCase()

  // 1. Legal declarations & Terms
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

  // 2. Sensitive / Compliance questions
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

  // 3. Compensation & Financial commitment
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

  // 4. Visa & Legal Work Authorization
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
      reason: 'Work authorization & visa sponsorship status must be confirmed manually.',
    }
  }

  // 5. Open-ended custom written questions
  if (
    q.includes('why') ||
    q.includes('describe') ||
    q.includes('tell us') ||
    q.includes('project') ||
    q.includes('cover letter')
  ) {
    return {
      riskLevel: 'ASSISTED_ANSWER',
      reason: 'Open-ended question with Talvyn answer suggestion.',
    }
  }

  return { riskLevel: 'SAFE_AUTOFILL' }
}

export const ruleBasedAnswerProvider = new RuleBasedAnswerProvider()
