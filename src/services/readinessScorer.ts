import {
  UserProfile,
  Resume,
  ApplicationReadinessResult,
  ReadinessItem,
  ReadinessTier,
} from '../types'

export class ReadinessScorer {
  /**
   * Deterministically calculates application readiness score based on user profile and resumes.
   */
  calculateReadiness(
    profile: UserProfile | null,
    resumes: Resume[] = []
  ): ApplicationReadinessResult {
    if (!profile) {
      return {
        score: 0,
        tier: 'INCOMPLETE',
        readyItems: [],
        missingItems: ['Profile data missing'],
        items: [],
        reasons: ['Please complete your Talvyn profile.'],
        summaryText: 'Incomplete · Profile required',
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
      (profile.otherLinks && profile.otherLinks.length > 0)
    )
    items.push({
      key: 'portfolio',
      label: 'Portfolio / GitHub',
      category: 'PROFESSIONAL',
      isReady: hasPortfolioOrGithub,
      value: profile.portfolioUrl || null,
    })

    const weights: { [key: string]: number } = {
      name: 20,
      email: 20,
      phone: 15,
      resume: 25,
      linkedin: 10,
      portfolio: 10,
    }

    let score = 0
    for (const item of items) {
      if (item.isReady) {
        score += weights[item.key] || 0
      }
    }

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
}

export const readinessScorer = new ReadinessScorer()
