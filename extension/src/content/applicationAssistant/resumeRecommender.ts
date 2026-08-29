/**
 * Talvyn Resume Recommender (Phase 2F)
 *
 * Deterministically recommends the most relevant resume from the user's saved resumes
 * based on job title, role taxonomy, resume descriptions, and profile skills.
 */

import { Resume } from '../../types'
import { ResumeRecommendation } from './types'

export class ResumeRecommender {
  /**
   * Evaluates all user resumes against the target job and ranks them.
   */
  recommendResume(
    resumes: Resume[],
    jobTitle?: string,
    jobDescription?: string,
    skills: string[] = []
  ): ResumeRecommendation[] {
    if (!resumes || resumes.length === 0) {
      return []
    }

    const titleLower = (jobTitle || '').toLowerCase()
    const descLower = (jobDescription || '').toLowerCase()

    const scored = resumes.map((resume) => {
      let score = 50 // Base score for any uploaded resume
      const matchReasons: string[] = []

      const resumeNameLower = (resume.name || '').toLowerCase()
      const resumeDescLower = (resume.description || '').toLowerCase()

      // 1. Default resume baseline boost
      if (resume.isDefault) {
        score += 15
        matchReasons.push('Default primary resume')
      }

      // 2. Direct title keyword overlap
      const titleTokens = titleLower.split(/\s+/).filter((t) => t.length > 2)
      for (const token of titleTokens) {
        if (resumeNameLower.includes(token)) {
          score += 20
          matchReasons.push(`Resume title matches "${token}"`)
          break
        }
      }

      // 3. Domain keyword matching
      const domains = [
        { key: 'backend', terms: ['backend', 'server', 'java', 'node', 'python', 'api', 'golang'] },
        { key: 'frontend', terms: ['frontend', 'react', 'vue', 'angular', 'ui', 'web', 'javascript'] },
        { key: 'fullstack', terms: ['fullstack', 'full stack', 'software engineer', 'sde', 'swe'] },
        { key: 'data', terms: ['data', 'analytics', 'analyst', 'scientist', 'sql', 'bi'] },
        { key: 'mobile', terms: ['ios', 'android', 'flutter', 'react native', 'mobile'] },
        { key: 'cloud', terms: ['devops', 'cloud', 'aws', 'kubernetes', 'sre'] },
        { key: 'design', terms: ['design', 'ui/ux', 'product design', 'figma'] },
        { key: 'product', terms: ['product manager', 'pm', 'product owner'] },
      ]

      for (const d of domains) {
        const matchesJob = d.terms.some((t) => titleLower.includes(t))
        const matchesResume = d.terms.some((t) => resumeNameLower.includes(t) || resumeDescLower.includes(t))

        if (matchesJob && matchesResume) {
          score += 25
          matchReasons.push(`Domain expertise match: ${d.key.toUpperCase()}`)
          break
        }
      }

      // 4. Skills match in resume description
      for (const skill of skills) {
        const sLower = skill.toLowerCase()
        if (sLower.length > 2 && (resumeDescLower.includes(sLower) || resumeNameLower.includes(sLower))) {
          score += 5
          matchReasons.push(`Matches skill: ${skill}`)
          break
        }
      }

      // Cap score between 0 and 100
      const finalScore = Math.min(100, Math.max(0, score))

      return {
        resume,
        score: finalScore,
        matchReasons: matchReasons.length > 0 ? matchReasons : ['General profile match'],
        isDefault: !!resume.isDefault,
      }
    })

    // Sort highest score first, then default resume
    return scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.isDefault && !a.isDefault) return 1
      if (!b.isDefault && a.isDefault) return -1
      return 0
    })
  }

  /**
   * Returns the single top-recommended resume.
   */
  getBestResume(
    resumes: Resume[],
    jobTitle?: string,
    jobDescription?: string,
    skills: string[] = []
  ): ResumeRecommendation | null {
    const ranked = this.recommendResume(resumes, jobTitle, jobDescription, skills)
    return ranked.length > 0 ? ranked[0] : null
  }
}

export const resumeRecommender = new ResumeRecommender()
