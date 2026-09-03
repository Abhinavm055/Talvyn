import {
  DetectedFormField,
  UserProfile,
  MatchedFormField,
  DetectedFieldType,
  AutofillConfidenceLevel,
} from '../../types'
import { FIELD_TAXONOMY, FieldDefinition } from './fieldTaxonomy'

/**
 * Universal Field Matcher & Profile Resolver (Phase 2C)
 * Deterministic rules — no AI.
 */
export class FieldMatcher {
  /**
   * Matches a detected form field against the user profile.
   */
  matchField(field: DetectedFormField, profile: UserProfile): MatchedFormField {
    // 1. Resume / File Upload Check
    if (field.inputType === 'file' || this.isResumeField(field)) {
      return {
        field,
        detectedType: 'resumeUpload',
        confidence: 95,
        confidenceLevel: 'HIGH',
        matchedProfileField: 'resume',
        valueToFill: null, // User selects resume from helper UI
        reason: 'Resume / CV file upload field detected',
        canAutofill: false,
        isCustomQuestion: false,
        isResumeUpload: true,
      }
    }

    // 2. Sensitive Compliance / Legal / Declaration / Disability / Veteran Check
    if (this.isSensitiveQuestion(field)) {
      return {
        field,
        detectedType: 'customQuestion',
        confidence: 90,
        confidenceLevel: 'HIGH',
        matchedProfileField: 'sensitive_declaration',
        valueToFill: null,
        reason: '⚠ Review required: Sensitive question (disability, veteran, or legal declaration)',
        canAutofill: false,
        isCustomQuestion: true,
        isResumeUpload: false,
        isSensitive: true,
        requiresReview: true,
      }
    }

    // 3. Custom Open-Ended Question Check
    if (this.isCustomQuestion(field)) {
      return {
        field,
        detectedType: 'customQuestion',
        confidence: 85,
        confidenceLevel: 'MEDIUM',
        matchedProfileField: 'custom',
        valueToFill: null,
        reason: 'Open-ended custom question requiring manual response',
        canAutofill: false,
        isCustomQuestion: true,
        isResumeUpload: false,
      }
    }

    // 4. Taxonomy Matcher (Autocomplete tokens > Exact label/name aliases > Partial aliases)
    const match = this.resolveFieldType(field)

    if (!match || match.confidence < 50) {
      return {
        field,
        detectedType: 'unknown',
        confidence: match?.confidence || 20,
        confidenceLevel: 'UNKNOWN',
        matchedProfileField: 'none',
        valueToFill: null,
        reason: 'Field type could not be confidently identified',
        canAutofill: false,
        isCustomQuestion: false,
        isResumeUpload: false,
      }
    }

    // 5. Resolve Value from Profile
    const { value, reason, requiresManualInput } = this.resolveProfileValue(
      match.def.type,
      profile,
      field
    )

    const isSensitive =
      match.def.type === 'workAuthorization' ||
      match.def.type === 'visaStatus' ||
      match.def.type === 'expectedSalary' ||
      this.isSensitiveQuestion(field)

    let confidence = match.confidence
    if (requiresManualInput || value === null || value === '') {
      confidence = Math.min(confidence, 65)
    }

    const confidenceLevel: AutofillConfidenceLevel =
      confidence >= 90 ? 'HIGH' : confidence >= 70 ? 'MEDIUM' : confidence >= 50 ? 'LOW' : 'UNKNOWN'

    const canAutofill =
      !isSensitive &&
      !requiresManualInput &&
      value !== null &&
      value !== '' &&
      confidence >= 70

    return {
      field,
      detectedType: match.def.type,
      confidence,
      confidenceLevel,
      matchedProfileField: match.def.type,
      valueToFill: value,
      reason: reason || `Matched ${match.def.label} (${match.reason})`,
      canAutofill,
      isCustomQuestion: false,
      isResumeUpload: false,
      isSensitive,
      requiresReview: isSensitive || requiresManualInput,
    }
  }

  // ─── Field Type Resolver ───────────────────────────────────────────────────

  private resolveFieldType(field: DetectedFormField): { def: FieldDefinition; confidence: number; reason: string } | null {
    const rawAutocomplete = (field.autocomplete || '').toLowerCase().trim()
    const cleanLabel = (field.label || '').toLowerCase().trim()
    const cleanName = (field.name || '').toLowerCase().trim().replace(/[_-]/g, ' ')
    const cleanId = (field.domId || '').toLowerCase().trim().replace(/[_-]/g, ' ')
    const cleanPlaceholder = (field.placeholder || '').toLowerCase().trim()
    const cleanAria = (field.ariaLabel || '').toLowerCase().trim()
    const cleanNearby = (field.nearbyText || '').toLowerCase().trim()

    let bestMatch: { def: FieldDefinition; confidence: number; reason: string } | null = null

    for (const def of FIELD_TAXONOMY) {
      // Rule 1: Autocomplete attribute match (Highest confidence: 95)
      if (rawAutocomplete && def.autocompleteTokens.includes(rawAutocomplete)) {
        return { def, confidence: 95, reason: `HTML autocomplete="${rawAutocomplete}"` }
      }

      // Check negative aliases first
      if (def.negativeAliases) {
        const hasNegative = def.negativeAliases.some(
          (neg) => cleanLabel.includes(neg) || cleanName.includes(neg)
        )
        if (hasNegative) continue
      }

      // Rule 2: Exact Label or Name Alias Match (Confidence: 90 - 95)
      for (const alias of def.aliases) {
        if (cleanLabel === alias || cleanName === alias || cleanId === alias || cleanAria === alias) {
          return { def, confidence: 95, reason: `Exact match for "${alias}"` }
        }
      }

      // Rule 3: Whole Word Substring Match in Label / Name / Placeholder
      for (const alias of def.aliases) {
        const aliasRegex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i')
        const wordCount = alias.trim().split(/\s+/).length
        const multiWordBonus = Math.min(6, (wordCount - 1) * 2) // Bonus for more specific multi-word aliases

        if (aliasRegex.test(cleanLabel)) {
          const score = 88 + multiWordBonus
          if (!bestMatch || score > bestMatch.confidence) {
            bestMatch = { def, confidence: Math.min(95, score), reason: `Label contains "${alias}"` }
          }
        } else if (aliasRegex.test(cleanName) || aliasRegex.test(cleanId) || aliasRegex.test(cleanAria)) {
          const score = 85 + multiWordBonus
          if (!bestMatch || score > bestMatch.confidence) {
            bestMatch = { def, confidence: Math.min(95, score), reason: `Field name/id contains "${alias}"` }
          }
        } else if (aliasRegex.test(cleanPlaceholder)) {
          const score = 80 + multiWordBonus
          if (!bestMatch || score > bestMatch.confidence) {
            bestMatch = { def, confidence: Math.min(90, score), reason: `Placeholder contains "${alias}"` }
          }
        } else if (cleanNearby && aliasRegex.test(cleanNearby)) {
          const score = 70 + multiWordBonus
          if (!bestMatch || score > bestMatch.confidence) {
            bestMatch = { def, confidence: Math.min(85, score), reason: `Nearby text contains "${alias}"` }
          }
        }
      }
    }

    // Input type fallback (e.g. type="email", type="tel")
    if (!bestMatch) {
      if (field.inputType === 'email') {
        const emailDef = FIELD_TAXONOMY.find((d) => d.type === 'email')
        if (emailDef) return { def: emailDef, confidence: 90, reason: 'Input type is email' }
      }
      if (field.inputType === 'tel') {
        const phoneDef = FIELD_TAXONOMY.find((d) => d.type === 'phone')
        if (phoneDef) return { def: phoneDef, confidence: 90, reason: 'Input type is tel' }
      }
    }

    return bestMatch
  }

  // ─── Profile Value Resolver ────────────────────────────────────────────────

  private resolveProfileValue(
    type: DetectedFieldType,
    profile: UserProfile,
    field: DetectedFormField
  ): { value: string | boolean | null; reason?: string; requiresManualInput?: boolean } {
    switch (type) {
      // ── Personal ──
      case 'fullName': {
        const name = profile.legalFullName || (profile.givenName && profile.familyName ? `${profile.givenName} ${profile.familyName}` : profile.givenName || profile.preferredName)
        return { value: name || null }
      }

      case 'firstName': {
        if (profile.givenName) return { value: profile.givenName }
        if (profile.legalFullName) {
          const parts = profile.legalFullName.trim().split(/\s+/)
          return { value: parts[0] }
        }
        if (profile.preferredName) return { value: profile.preferredName }
        return { value: null, reason: 'First name not found in profile' }
      }

      case 'middleName': {
        if (profile.middleName) return { value: profile.middleName }
        if (profile.legalFullName) {
          const parts = profile.legalFullName.trim().split(/\s+/)
          if (parts.length >= 3) return { value: parts.slice(1, -1).join(' ') }
        }
        return { value: '' } // Middle name is optional, blank is valid
      }

      case 'lastName': {
        if (profile.familyName) return { value: profile.familyName }
        if (profile.legalFullName) {
          const parts = profile.legalFullName.trim().split(/\s+/)
          if (parts.length >= 2) return { value: parts[parts.length - 1] }
        }
        // Never invent a surname
        return {
          value: null,
          requiresManualInput: true,
          reason: 'Manual input required (no last name in profile)',
        }
      }

      case 'preferredName':
        return { value: profile.preferredName || profile.givenName || null }

      case 'email':
        return { value: profile.email || null }

      case 'phone':
        return { value: profile.phone || null }

      case 'dateOfBirth':
        return { value: profile.dateOfBirth || null }

      case 'gender': {
        if (field.options.length > 0 && profile.gender) {
          const matchedOpt = this.matchOption(field.options, profile.gender)
          return { value: matchedOpt || profile.gender }
        }
        return { value: profile.gender || null }
      }

      case 'address':
        return { value: profile.address || null }

      case 'city':
        return { value: profile.city || null }

      case 'state':
        return { value: profile.state || null }

      case 'country': {
        if (field.options.length > 0 && profile.country) {
          const matchedOpt = this.matchOption(field.options, profile.country)
          return { value: matchedOpt || profile.country }
        }
        return { value: profile.country || null }
      }

      case 'postalCode':
        return { value: profile.postalCode || null }

      // ── Professional ──
      case 'linkedinUrl':
        return { value: profile.linkedinUrl || null }

      case 'githubUrl': {
        if (profile.githubUrl) return { value: profile.githubUrl }
        const githubLink = profile.otherLinks?.find((l) => l.includes('github.com'))
        return { value: githubLink || null }
      }

      case 'portfolioUrl':
        return { value: profile.portfolioUrl || null }

      case 'websiteUrl': {
        if (profile.websiteUrl) return { value: profile.websiteUrl }
        const web = profile.portfolioUrl || profile.otherLinks?.[0]
        return { value: web || null }
      }

      case 'skills':
        return { value: profile.skills && profile.skills.length > 0 ? profile.skills.join(', ') : null }

      // ── Education ──
      case 'institution':
        return { value: profile.institution || null }

      case 'degree': {
        if (field.options.length > 0 && profile.degree) {
          const matchedOpt = this.matchOption(field.options, profile.degree)
          return { value: matchedOpt || profile.degree }
        }
        return { value: profile.degree || null }
      }

      case 'specialization':
        return { value: profile.specialization || null }

      case 'graduationYear':
        return { value: profile.graduationYear ? String(profile.graduationYear) : null }

      case 'cgpa':
        return { value: profile.cgpa || null }

      // ── Application ──
      case 'workAuthorization': {
        if (field.tag === 'radio' || field.tag === 'select') {
          const yesOpt = this.matchOption(field.options, 'Yes') || this.matchOption(field.options, 'Authorized') || 'yes'
          return { value: yesOpt }
        }
        return { value: profile.workAuthorization || 'Yes, authorized to work' }
      }

      case 'visaStatus': {
        if (field.tag === 'radio' || field.tag === 'select') {
          const noOpt = this.matchOption(field.options, 'No') || this.matchOption(field.options, 'Not required') || 'no'
          return { value: noOpt }
        }
        return { value: profile.visaStatus || 'No sponsorship required' }
      }

      case 'expectedSalary':
        return { value: profile.expectedSalary || null }

      case 'noticePeriod':
        return { value: profile.noticePeriod || null }

      case 'currentCompany':
        return { value: profile.currentCompany || null }

      case 'currentJobTitle':
        return { value: profile.currentJobTitle || (profile.preferredRoles?.[0] ?? null) }

      case 'yearsOfExperience':
        return { value: profile.experienceYears !== null && profile.experienceYears !== undefined ? String(profile.experienceYears) : null }

      default:
        return { value: null }
    }
  }

  // ─── Option Matching (Select & Radios) ──────────────────────────────────────

  private matchOption(options: { label: string; value: string }[], target: string): string | null {
    if (!options || options.length === 0 || !target) return null
    const cleanTarget = target.toLowerCase().trim()

    // 1. Exact value or label match
    for (const opt of options) {
      if (opt.value.toLowerCase() === cleanTarget || opt.label.toLowerCase() === cleanTarget) {
        return opt.value
      }
    }

    // 2. Substring match
    for (const opt of options) {
      const cleanLabel = opt.label.toLowerCase()
      const cleanVal = opt.value.toLowerCase()
      if (cleanLabel.includes(cleanTarget) || cleanTarget.includes(cleanLabel) || cleanVal.includes(cleanTarget)) {
        return opt.value
      }
    }

    return null
  }

  // ─── Special Field Helpers ─────────────────────────────────────────────────

  private isResumeField(field: DetectedFormField): boolean {
    const text = `${field.label} ${field.name} ${field.domId} ${field.placeholder}`.toLowerCase()
    return (
      field.inputType === 'file' ||
      text.includes('resume') ||
      text.includes('cv') ||
      text.includes('curriculum vitae')
    )
  }

  private isSensitiveQuestion(field: DetectedFormField): boolean {
    const text = `${field.label} ${field.name} ${field.domId} ${field.ariaLabel} ${field.placeholder} ${field.nearbyText}`.toLowerCase()
    return (
      text.includes('disability') ||
      text.includes('veteran') ||
      text.includes('equal opportunity') ||
      text.includes('criminal') ||
      text.includes('background check') ||
      text.includes('legal declaration') ||
      text.includes('terms and conditions') ||
      text.includes('agree to terms') ||
      text.includes('consent to') ||
      text.includes('digital signature') ||
      text.includes('sign here')
    )
  }

  private isCustomQuestion(field: DetectedFormField): boolean {
    const text = `${field.label} ${field.placeholder} ${field.ariaLabel}`.toLowerCase()
    const questionPatterns = [
      /why do you want/i,
      /why are you interested/i,
      /describe your/i,
      /tell us about/i,
      /why should we hire/i,
      /cover letter/i,
      /additional information/i,
      /what makes you/i,
      /anything else/i,
      /personal statement/i,
    ]

    return (
      (field.tag === 'textarea' && text.length > 20) ||
      questionPatterns.some((p) => p.test(text))
    )
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const fieldMatcher = new FieldMatcher()
