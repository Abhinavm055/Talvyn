/**
 * Talvyn Deterministic Role Matcher (Phase 2B)
 *
 * Compares job titles against user's preferred roles using:
 * 1. Exact string / normalized equality (1.0)
 * 2. Taxonomy cluster synonyms (0.8)
 * 3. Taxonomy broader related roles (0.6)
 * 4. Token subset & Jaccard similarity (0.3 to 0.7)
 *
 * Deterministic rules — no AI.
 */

import { RoleMatchLevel, RoleMatchResult } from '../types'
import {
  normalizeRole,
  ROLE_TAXONOMY,
  RoleSynonymCluster,
  NormalizedRole,
} from './roleTaxonomy'

export interface RoleComparisonDetail {
  preferredRole: string
  jobTitle: string
  level: RoleMatchLevel
  score: number // 0.0 to 1.0
  reason: string
}

export function matchSingleRole(
  normJob: NormalizedRole,
  normPref: NormalizedRole
): RoleComparisonDetail {
  const jobNorm = normJob.normalized
  const prefNorm = normPref.normalized

  // 1. EXACT MATCH (1.0)
  // Check if normalized strings match completely or raw strings match (case-insensitive)
  if (
    jobNorm === prefNorm ||
    normJob.raw.toLowerCase().trim() === normPref.raw.toLowerCase().trim()
  ) {
    return {
      preferredRole: normPref.raw,
      jobTitle: normJob.raw,
      level: 'EXACT_MATCH',
      score: 1.0,
      reason: `Exact match for preferred role "${normPref.raw}"`,
    }
  }

  // Check if one contains the other as a full phrase
  if (
    jobNorm.length > 2 &&
    prefNorm.length > 2 &&
    (jobNorm.includes(prefNorm) || prefNorm.includes(jobNorm))
  ) {
    // If pref is "data analyst" and job is "product data analyst" -> Exact / Strong match
    return {
      preferredRole: normPref.raw,
      jobTitle: normJob.raw,
      level: 'EXACT_MATCH',
      score: 0.95,
      reason: `Direct title match for preferred role "${normPref.raw}"`,
    }
  }

  // 2. TAXONOMY LOOKUP (0.8 for synonyms, 0.6 for broader related)
  const prefClusters = findTaxonomyClusters(prefNorm)
  const jobClusters = findTaxonomyClusters(jobNorm)

  // Check if job matches any synonym of pref
  for (const cluster of prefClusters) {
    // Exact canonical match
    if (cluster.canonical === jobNorm) {
      return {
        preferredRole: normPref.raw,
        jobTitle: normJob.raw,
        level: 'STRONG_RELATED',
        score: 0.85,
        reason: `Direct synonym match for "${normPref.raw}" in ${cluster.domain}`,
      }
    }

    // Direct synonym list
    const matchedSynonym = cluster.synonyms.find(
      (s) => s === jobNorm || jobNorm.includes(s) || s.includes(jobNorm)
    )
    if (matchedSynonym) {
      return {
        preferredRole: normPref.raw,
        jobTitle: normJob.raw,
        level: 'STRONG_RELATED',
        score: 0.8,
        reason: `Strong related match (${matchedSynonym}) for "${normPref.raw}"`,
      }
    }

    // Broader related list
    const matchedBroader = cluster.broaderRelated.find(
      (b) => b === jobNorm || jobNorm.includes(b) || b.includes(jobNorm)
    )
    if (matchedBroader) {
      return {
        preferredRole: normPref.raw,
        jobTitle: normJob.raw,
        level: 'RELATED',
        score: 0.6,
        reason: `Related career path (${matchedBroader}) for "${normPref.raw}"`,
      }
    }
  }

  // Check if pref matches any synonym of job
  for (const cluster of jobClusters) {
    if (cluster.canonical === prefNorm) {
      return {
        preferredRole: normPref.raw,
        jobTitle: normJob.raw,
        level: 'STRONG_RELATED',
        score: 0.85,
        reason: `Direct synonym match for "${normPref.raw}" in ${cluster.domain}`,
      }
    }

    const matchedSynonym = cluster.synonyms.find(
      (s) => s === prefNorm || prefNorm.includes(s) || s.includes(prefNorm)
    )
    if (matchedSynonym) {
      return {
        preferredRole: normPref.raw,
        jobTitle: normJob.raw,
        level: 'STRONG_RELATED',
        score: 0.8,
        reason: `Strong related match (${matchedSynonym}) for "${normPref.raw}"`,
      }
    }
  }

  // 3. TOKEN OVERLAP / JACCARD SIMILARITY
  const jobTokens = new Set(normJob.tokens)
  const prefTokens = new Set(normPref.tokens)

  if (jobTokens.size > 0 && prefTokens.size > 0) {
    let intersectionCount = 0
    for (const token of prefTokens) {
      if (jobTokens.has(token)) intersectionCount++
    }

    const overlapRatio = intersectionCount / prefTokens.size
    const jaccard =
      intersectionCount / (jobTokens.size + prefTokens.size - intersectionCount)

    if (overlapRatio >= 0.75) {
      return {
        preferredRole: normPref.raw,
        jobTitle: normJob.raw,
        level: 'STRONG_RELATED',
        score: 0.75,
        reason: `Key skill/role tokens match "${normPref.raw}"`,
      }
    }

    if (overlapRatio >= 0.5 || jaccard >= 0.4) {
      return {
        preferredRole: normPref.raw,
        jobTitle: normJob.raw,
        level: 'RELATED',
        score: 0.55,
        reason: `Partial keyword overlap with preferred role "${normPref.raw}"`,
      }
    }

    if (intersectionCount >= 1 && (jobTokens.size <= 3 || prefTokens.size <= 3)) {
      return {
        preferredRole: normPref.raw,
        jobTitle: normJob.raw,
        level: 'WEAK_MATCH',
        score: 0.3,
        reason: `Minor keyword match with "${normPref.raw}"`,
      }
    }
  }

  // 4. NO MATCH (0.0)
  return {
    preferredRole: normPref.raw,
    jobTitle: normJob.raw,
    level: 'NO_MATCH',
    score: 0.0,
    reason: `Role does not match "${normPref.raw}"`,
  }
}

/**
 * Finds all taxonomy clusters that match a normalized string either as canonical,
 * synonym, or broader related.
 */
function findTaxonomyClusters(normStr: string): RoleSynonymCluster[] {
  if (!normStr || normStr.length < 3) return []
  const matched: RoleSynonymCluster[] = []

  for (const cluster of ROLE_TAXONOMY) {
    if (
      cluster.canonical === normStr ||
      isExactPhraseMatch(cluster.canonical, normStr) ||
      cluster.synonyms.some((s) => s === normStr || isExactPhraseMatch(s, normStr)) ||
      cluster.broaderRelated.some((b) => b === normStr || isExactPhraseMatch(b, normStr))
    ) {
      matched.push(cluster)
    }
  }

  return matched
}

function isExactPhraseMatch(phraseA: string, phraseB: string): boolean {
  if (phraseA === phraseB) return true
  // Check if one is a complete sub-phrase of the other (with word boundaries)
  const regexA = new RegExp(`\\b${escapeRegExp(phraseA)}\\b`, 'i')
  const regexB = new RegExp(`\\b${escapeRegExp(phraseB)}\\b`, 'i')
  return regexA.test(phraseB) || regexB.test(phraseA)
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Evaluates a job title against all user preferred roles and picks the best match.
 */
export function evaluateRoleMatch(
  rawJobTitle: string,
  preferredRoles: string[],
  weight: number = 0.45
): RoleMatchResult {
  const normJob = normalizeRole(rawJobTitle)

  if (!preferredRoles || preferredRoles.length === 0) {
    // If user has no preferred roles set, give neutral baseline
    return {
      level: 'RELATED',
      score: 0.5,
      weight,
      weightedScore: 0.5 * weight * 100,
      reason: 'No preferred roles specified in profile',
      rawTitle: rawJobTitle,
      normalizedTitle: normJob.normalized,
    }
  }

  let bestMatch: RoleComparisonDetail = {
    preferredRole: preferredRoles[0],
    jobTitle: rawJobTitle,
    level: 'NO_MATCH',
    score: 0.0,
    reason: 'Role did not match your preferred roles',
  }

  for (const role of preferredRoles) {
    const normPref = normalizeRole(role)
    const result = matchSingleRole(normJob, normPref)
    if (result.score > bestMatch.score) {
      bestMatch = result
    }
    // Early exit on exact match
    if (bestMatch.score === 1.0) break
  }

  return {
    level: bestMatch.level,
    matchedRole: bestMatch.preferredRole,
    score: bestMatch.score,
    weight,
    weightedScore: Math.round(bestMatch.score * weight * 100 * 10) / 10,
    reason: bestMatch.reason,
    rawTitle: rawJobTitle,
    normalizedTitle: normJob.normalized,
  }
}
