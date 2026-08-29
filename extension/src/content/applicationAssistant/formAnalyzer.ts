/**
 * Talvyn Form Analyzer & Live Progress Tracker (Phase 2F)
 *
 * Classifies all visible form fields, evaluates user input status,
 * guards user-entered data against destructive overwrite, and computes live application progress.
 */

import { DetectedFormField, UserProfile, Resume } from '../../types'
import {
  ApplicationFieldAnalysis,
  ApplicationFieldCategory,
  ApplicationProgress,
  QuestionRiskLevel,
} from './types'
import { classifyQuestionRisk } from './questionAssistant/answerProvider'

export class FormAnalyzer {
  /**
   * Categorizes a detected form field into standard Talvyn categories.
   */
  categorizeField(field: DetectedFormField): ApplicationFieldCategory {
    const text = `${field.name} ${field.label} ${field.domId} ${field.placeholder} ${field.ariaLabel} ${field.nearbyText}`.toLowerCase()

    // 1. Documents
    if (
      field.inputType === 'file' ||
      text.includes('resume') ||
      text.includes('curriculum vitae') ||
      text.includes('cv') ||
      text.includes('cover letter') ||
      text.includes('portfolio upload')
    ) {
      return 'DOCUMENTS'
    }

    // 2. Education (check before generic 'name')
    if (
      text.includes('college') ||
      text.includes('university') ||
      text.includes('school') ||
      text.includes('institution') ||
      text.includes('degree') ||
      text.includes('major') ||
      text.includes('specialization') ||
      text.includes('gpa') ||
      text.includes('cgpa') ||
      text.includes('graduation')
    ) {
      return 'EDUCATION'
    }

    // 3. Personal
    if (
      text.includes('first name') ||
      text.includes('last name') ||
      text.includes('full name') ||
      text.includes('legal name') ||
      text.includes('given name') ||
      text.includes('family name') ||
      text.includes('preferred name') ||
      (text.includes('name') && !text.includes('company') && !text.includes('school') && !text.includes('university')) ||
      text.includes('email') ||
      text.includes('phone') ||
      text.includes('mobile') ||
      text.includes('address') ||
      text.includes('street') ||
      text.includes('city') ||
      text.includes('state') ||
      text.includes('country') ||
      text.includes('postal') ||
      text.includes('zip')
    ) {
      return 'PERSONAL'
    }

    // 3. Professional
    if (
      text.includes('linkedin') ||
      text.includes('github') ||
      text.includes('portfolio') ||
      text.includes('website') ||
      text.includes('experience') ||
      text.includes('current company') ||
      text.includes('employer') ||
      text.includes('title') ||
      text.includes('skills')
    ) {
      return 'PROFESSIONAL'
    }

    // 4. Education
    if (
      text.includes('college') ||
      text.includes('university') ||
      text.includes('school') ||
      text.includes('degree') ||
      text.includes('major') ||
      text.includes('specialization') ||
      text.includes('gpa') ||
      text.includes('cgpa') ||
      text.includes('graduation')
    ) {
      return 'EDUCATION'
    }

    // 5. Preferences / Application settings
    if (
      text.includes('work authorization') ||
      text.includes('sponsorship') ||
      text.includes('salary') ||
      text.includes('compensation') ||
      text.includes('notice period') ||
      text.includes('location preference') ||
      text.includes('relocate')
    ) {
      return 'PREFERENCES'
    }

    // 6. Questions / Long-form textareas / custom dropdowns
    if (
      field.tag === 'textarea' ||
      text.includes('why') ||
      text.includes('describe') ||
      text.includes('tell us') ||
      text.includes('gender') ||
      text.includes('veteran') ||
      text.includes('disability') ||
      text.includes('declare')
    ) {
      return 'QUESTIONS'
    }

    return 'OTHER'
  }

  /**
   * Analyzes an array of detected form fields against candidate profile data.
   */
  analyzeFields(
    fields: DetectedFormField[],
    profile: UserProfile | null
  ): ApplicationFieldAnalysis[] {
    return fields.map((field) => {
      const category = this.categorizeField(field)
      const labelText = field.label || field.placeholder || field.name || 'Application Field'
      const { riskLevel, reason: riskReason } = classifyQuestionRisk(labelText)

      const currentValue = field.currentValue
      const isFilled = typeof currentValue === 'string'
        ? currentValue.trim().length > 0
        : typeof currentValue === 'boolean'
        ? currentValue
        : false

      return {
        id: field.id,
        field,
        category,
        canonicalName: field.name || field.domId || field.id,
        label: labelText,
        isRequired: field.isRequired,
        isFilled,
        filledBy: isFilled ? 'USER_INPUT' : 'UNFILLED',
        currentValue,
        suggestedValue: null,
        riskLevel,
        riskReason,
        confidence: 85,
      }
    })
  }

  /**
   * Calculates overall application form progress.
   */
  calculateProgress(analyzedFields: ApplicationFieldAnalysis[]): ApplicationProgress {
    const categoryProgress: Record<
      ApplicationFieldCategory,
      { total: number; filled: number; required: number; requiredFilled: number }
    > = {
      PERSONAL: { total: 0, filled: 0, required: 0, requiredFilled: 0 },
      PROFESSIONAL: { total: 0, filled: 0, required: 0, requiredFilled: 0 },
      EDUCATION: { total: 0, filled: 0, required: 0, requiredFilled: 0 },
      DOCUMENTS: { total: 0, filled: 0, required: 0, requiredFilled: 0 },
      QUESTIONS: { total: 0, filled: 0, required: 0, requiredFilled: 0 },
      PREFERENCES: { total: 0, filled: 0, required: 0, requiredFilled: 0 },
      OTHER: { total: 0, filled: 0, required: 0, requiredFilled: 0 },
    }

    let totalFields = 0
    let filledFields = 0
    let requiredFields = 0
    let requiredFilledFields = 0

    for (const f of analyzedFields) {
      if (f.field.isIgnored) continue

      totalFields++
      const cat = categoryProgress[f.category]
      cat.total++

      if (f.isFilled) {
        filledFields++
        cat.filled++
      }

      if (f.isRequired) {
        requiredFields++
        cat.required++
        if (f.isFilled) {
          requiredFilledFields++
          cat.requiredFilled++
        }
      }
    }

    const percentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0
    const isComplete = requiredFields > 0 ? requiredFilledFields === requiredFields : filledFields === totalFields
    const isReadyForReview = percentage >= 80 && (requiredFields === 0 || requiredFilledFields === requiredFields)

    return {
      totalFields,
      filledFields,
      requiredFields,
      requiredFilledFields,
      percentage,
      categoryProgress,
      isComplete,
      isReadyForReview,
    }
  }
}

export const formAnalyzer = new FormAnalyzer()
