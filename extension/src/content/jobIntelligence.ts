import { ExtractedJob, UserProfile } from '../types'
import { COMMON_SKILLS_CANONICAL, isValidSkillToken } from '../services/relevanceScorer'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const unique = (items: string[]) => [...new Set(items.filter(Boolean))]
// Reuse the scorer's vocabulary; compile once rather than once per line/analysis.
const skillMatchers = Object.entries(COMMON_SKILLS_CANONICAL)
  .filter(([, skill]) => isValidSkillToken(skill))
  .map(([alias, skill]) => ({ skill, pattern: new RegExp(`(?:^|[^a-z0-9])${escapeRegex(alias)}(?=$|[^a-z0-9])`, 'i') }))

export function detectCanonicalSkills(text: string): string[] {
  return unique(skillMatchers.filter(({ pattern }) => pattern.test(text)).map(({ skill }) => skill))
}

/** Conservative clause-level guard, not general natural-language understanding. */
function isExplicitNonRequirement(text: string): boolean {
  return /\b(?:not|never|no longer)\s+(?:(?:strictly|necessarily)\s+)?(?:required|mandatory|needed|necessary)\b/i.test(text) ||
    /\b(?:do(?:es)?\s+not|don't|doesn't)\s+(?:require|need)\b/i.test(text) ||
    /\bno\b[^.;\n]{0,160}\b(?:required|mandatory|needed|necessary)\b/i.test(text)
}

function descriptionLines(text: string): string[] {
  return text.replace(/<\/(?:li|p|h[1-6]|div)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/\b(required skills|preferred skills|(?:required|preferred|minimum|basic) qualifications|eligibility criteria|requirements|qualifications|responsibilities|duties|benefits|application deadline|apply by)\s*:/gi, '\n$1:\n').split(/[;\n]|(?<=[.!?])\s+/).map((line) => line.replace(/^[•*\-]\s*/, '').trim()).filter(Boolean)
}

/** Enriches adapter facts only when the source text contains explicit evidence. */
export function enrichJobFacts(job: ExtractedJob): ExtractedJob {
  const lines = descriptionLines(job.description || '')
  const required: string[] = [...(job.requiredSkills || [])]
  const preferred: string[] = [...(job.preferredSkills || [])]
  const eligibility: string[] = [...(job.eligibility || [])]
  let section: 'required' | 'preferred' | 'eligibility' | null = null
  for (const line of lines) {
    if (/^(preferred|desirable|nice[- ]to[- ]have|bonus)(?:\s+(qualifications|skills|requirements))?\s*:?/i.test(line)) section = 'preferred'
    else if (/^(required|minimum|basic|essential)(?:\s+(qualifications|skills|requirements))?\s*(?::|$)|^(requirements|qualifications|must have|skills required)\s*(?::|$)/i.test(line)) section = 'required'
    else if (/^eligibility(?: criteria)?\s*:/i.test(line)) section = 'eligibility'
    else if (/^(responsibilities|duties|what you(?:'ll| will) do|benefits|about (us|the company)|compensation|salary)\s*:?/i.test(line)) section = null
    const skills = isExplicitNonRequirement(line) ? [] : detectCanonicalSkills(line)
    if (/\b(preferred|desirable|nice[- ]to[- ]have|bonus|a plus)\b/i.test(line) || section === 'preferred') preferred.push(...skills)
    else if (/\b(required|must have|essential|mandatory|minimum qualifications)\b/i.test(line) || section === 'required') required.push(...skills)
    if (section === 'eligibility' && !/^eligibility(?: criteria)?\s*:?$/i.test(line) && line.length <= 350) eligibility.push(line)
  }
  // Structured adapter requirements represent requirements, unlike arbitrary mentions in a description.
  for (const requirement of job.requirements || []) {
    if (isExplicitNonRequirement(requirement)) continue
    for (const skill of detectCanonicalSkills(requirement)) {
      const target = /\b(preferred|desirable|nice[- ]to[- ]have|a plus|bonus)\b/i.test(requirement) || preferred.includes(skill) && !required.includes(skill) ? preferred : required
      target.push(skill)
    }
  }
  const fullText = lines.join('\n')
  const experience = job.experience || fullText.match(/\b(?:\d+(?:\.\d+)?\s*(?:[-–]\s*\d+(?:\.\d+)?|\+)?)\s*years?\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+)?experience\b/i)?.[0]
  const education = job.education || lines.find((line) => /\b(bachelor'?s?|master'?s?|ph\.?d|diploma|degree)\b/i.test(line) && /\b(required|qualification|minimum|must|in|or equivalent)\b/i.test(line))
  const deadline = job.deadline || fullText.match(/(?:application deadline|apply by|last date(?: to apply)?|applications? close(?:s)?)[\s:–-]+([^\n.]{3,80})/i)?.[0]
  const arrangementText = `${job.location || ''} ${fullText}`
  const workArrangement = job.workArrangement || (/\bhybrid\b/i.test(arrangementText) ? 'HYBRID' : /\b(?:fully remote|100% remote|work from home)\b/i.test(arrangementText) || /^remote\b/i.test(job.location || '') ? 'REMOTE' : /\b(?:on[- ]site|in[- ]office|in[- ]person)\b/i.test(arrangementText) ? 'ONSITE' : undefined)
  return { ...job, requiredSkills: unique(required), preferredSkills: unique(preferred).filter((skill) => !required.includes(skill)), eligibility: unique(eligibility), experience, education: education?.slice(0, 350), deadline, workArrangement }
}

export interface JobPreparation {
  requiredSkills: string[]
  preferredSkills: string[]
  matchedRequiredSkills: string[]
  missingRequiredSkills: string[]
  matchedPreferredSkills: string[]
  missingPreferredSkills: string[]
  eligibility: string[]
  recommendations: string[]
}

/** Additional explanations; never changes Talvyn's existing official match score. */
export function prepareJobGuidance(job: ExtractedJob, profile?: UserProfile | null): JobPreparation {
  const facts = enrichJobFacts(job)
  const profileSkills = (profile?.skills || []).flatMap((skill) => [skill.toLowerCase().trim(), (COMMON_SKILLS_CANONICAL[skill.toLowerCase().trim()] || skill).toLowerCase()])
  const matches = (skill: string) => profileSkills.includes(skill.toLowerCase())
  const requiredSkills = facts.requiredSkills || []
  const preferredSkills = facts.preferredSkills || []
  const matchedRequiredSkills = requiredSkills.filter(matches)
  const missingRequiredSkills = requiredSkills.filter((skill) => !matches(skill))
  const matchedPreferredSkills = preferredSkills.filter(matches)
  const missingPreferredSkills = preferredSkills.filter((skill) => !matches(skill))
  const recommendations: string[] = []
  if (!facts.description || facts.description.length < 100) recommendations.push('The description is incomplete. Review the original posting before applying.')
  if (!profile?.skills.length) recommendations.push('Add verified skills to your profile to compare the explicit job requirements.')
  else if (missingRequiredSkills.length) recommendations.push(`Review required skills absent from your profile: ${missingRequiredSkills.join(', ')}. Add them only if you have those skills.`)
  if (missingPreferredSkills.length) recommendations.push(`Optional preparation: review ${missingPreferredSkills.join(', ')} listed as preferred.`)
  if (facts.experience) recommendations.push(`Compare your verified experience with the posting: ${facts.experience}.`)
  if (facts.education) recommendations.push(`Check the education requirement: ${facts.education}.`)
  if (facts.eligibility?.length) recommendations.push('Review the extracted eligibility criteria yourself. Talvyn cannot verify declarations or work authorization.')
  if (facts.deadline) recommendations.push(`Confirm the deadline on the source page: ${facts.deadline}.`)
  recommendations.push('Prepare examples of your real work related to the listed requirements and review every application field before submitting.')
  return { requiredSkills, preferredSkills, matchedRequiredSkills, missingRequiredSkills, matchedPreferredSkills, missingPreferredSkills, eligibility: facts.eligibility || [], recommendations }
}
