import {
  UserProfile,
  Resume,
  DetectedFormField,
  ApplicationReadinessResult,
  ReadinessItem,
  ReadinessTier,
} from '../types'

export class ReadinessScorer {
  /**
   * Deterministically calculates application readiness score based on user profile, resumes, and optional form fields.
   */
  calculateReadiness(
    profile: UserProfile | null,
    resumes: Resume[] = [],
    detectedFields: DetectedFormField[] = []
  ): ApplicationReadinessResult {
    if (!profile) {
      return {
        score: 0,
        tier: 'INCOMPLETE',
        readyItems: [],
        missingItems: ['Profile data missing'],
        items: [],
        reasons: ['Please log in to Talvyn to calculate your Application Readiness.'],
        summaryText: 'Incomplete · Sign in required',
      }
    }

    const items: ReadinessItem[] = []

    // ── 1. PERSONAL CHECKS ──────────────────────────────────────────────────
    const hasName = !!(profile.legalFullName || profile.givenName || profile.preferredName)
    items.push({
      key: 'name',
      label: 'Full Name',
      category: 'PERSONAL',
      isReady: hasName,
      value: profile.legalFullName || profile.givenName || null,
    })

    const hasEmail = !!profile.email
    items.push({
      key: 'email',
      label: 'Email Address',
      category: 'PERSONAL',
      isReady: hasEmail,
      value: profile.email || null,
    })

    const hasPhone = !!profile.phone
    items.push({
      key: 'phone',
      label: 'Phone Number',
      category: 'PERSONAL',
      isReady: hasPhone,
      value: profile.phone || null,
    })

    // ── 2. DOCUMENT CHECKS ──────────────────────────────────────────────────
    const hasResume = resumes.some((r) => r.isDefault) || resumes.length > 0
    const defaultResume = resumes.find((r) => r.isDefault) || (resumes.length > 0 ? resumes[0] : null)
    items.push({
      key: 'resume',
      label: 'Resume / CV',
      category: 'DOCUMENTS',
      isReady: hasResume,
      value: defaultResume?.name || null,
    })

    // ── 3. PROFESSIONAL CHECKS ──────────────────────────────────────────────
    const hasLinkedIn = !!profile.linkedinUrl
    items.push({
      key: 'linkedin',
      label: 'LinkedIn Profile',
      category: 'PROFESSIONAL',
      isReady: hasLinkedIn,
      value: profile.linkedinUrl || null,
    })

    const hasPortfolioOrGithub = !!(
      profile.portfolioUrl ||
      profile.githubUrl ||
      (profile.otherLinks && profile.otherLinks.length > 0)
    )
    items.push({
      key: 'portfolio',
      label: 'Portfolio / GitHub',
      category: 'PROFESSIONAL',
      isReady: hasPortfolioOrGithub,
      value: profile.portfolioUrl || profile.githubUrl || null,
    })

    // ── 4. Form-Specific Weight Adjustment ──────────────────────────────────
    let score = 0
    const weights: { [key: string]: number } = {
      name: 20,
      email: 20,
      phone: 15,
      resume: 25,
      linkedin: 10,
      portfolio: 10,
    }

    if (detectedFields.length > 0) {
      // Adjust weights based on fields requested by the form
      let totalFormWeight = 0
      let earnedFormWeight = 0

      for (const item of items) {
        const isRequested = detectedFields.some((f) => {
          const text = `${f.label} ${f.name} ${f.domId} ${f.placeholder}`.toLowerCase()
          if (item.key === 'name') return text.includes('name')
          if (item.key === 'email') return text.includes('email') || f.inputType === 'email'
          if (item.key === 'phone') return text.includes('phone') || f.inputType === 'tel'
          if (item.key === 'resume') return text.includes('resume') || text.includes('cv') || f.inputType === 'file'
          if (item.key === 'linkedin') return text.includes('linkedin')
          if (item.key === 'portfolio') return text.includes('portfolio') || text.includes('github') || text.includes('website')
          return false
        })

        item.isRequiredByForm = isRequested
        const itemWeight = weights[item.key] || 15

        if (isRequested) {
          totalFormWeight += itemWeight
          if (item.isReady) earnedFormWeight += itemWeight
        }
      }

      if (totalFormWeight > 0) {
        score = Math.round((earnedFormWeight / totalFormWeight) * 100)
      } else {
        score = this.calculateStandardScore(items, weights)
      }
    } else {
      score = this.calculateStandardScore(items, weights)
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score))

    let tier: ReadinessTier = 'INCOMPLETE'
    if (score >= 90) {
      tier = 'READY'
    } else if (score >= 70) {
      tier = 'MOSTLY_READY'
    } else if (score >= 40) {
      tier = 'NEEDS_ATTENTION'
    }

    const readyItems = items.filter((i) => i.isReady).map((i) => i.label)
    const missingItems = items.filter((i) => !i.isReady).map((i) => i.label)

    const reasons: string[] = []
    readyItems.forEach((r) => reasons.push(`✓ ${r}`))
    missingItems.forEach((m) => reasons.push(`✗ Missing ${m}`))

    const summaryText =
      tier === 'READY'
        ? `${score}% · Ready to Apply`
        : tier === 'MOSTLY_READY'
        ? `${score}% · Mostly Ready`
        : tier === 'NEEDS_ATTENTION'
        ? `${score}% · Needs Attention`
        : `${score}% · Incomplete`

    return {
      score,
      tier,
      readyItems,
      missingItems,
      items,
      reasons,
      summaryText,
    }
  }

  private calculateStandardScore(items: ReadinessItem[], weights: { [key: string]: number }): number {
    let totalScore = 0
    for (const item of items) {
      if (item.isReady) {
        totalScore += weights[item.key] || 0
      }
    }
    return totalScore
  }
}

export const readinessScorer = new ReadinessScorer()
