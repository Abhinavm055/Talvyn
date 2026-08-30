/**
 * Talvyn Curated Work Authorization Taxonomy
 */

export interface WorkAuthOption {
  value: string
  label: string
  aliases?: string[]
}

export const WORK_AUTHORIZATIONS: WorkAuthOption[] = [
  { value: 'Citizen', label: 'Citizen', aliases: ['citizen', 'national', 'passport holder'] },
  { value: 'Permanent Resident / Green Card', label: 'Permanent Resident / Green Card', aliases: ['permanent resident', 'green card', 'pr', 'gc'] },
  { value: 'Authorized to Work (No Sponsorship Needed)', label: 'Authorized to Work (No Sponsorship Needed)', aliases: ['authorized', 'no sponsorship', 'eligible to work'] },
  { value: 'Work Visa (H-1B, L-1, O-1, Tier 2)', label: 'Work Visa (H-1B, L-1, O-1, Tier 2)', aliases: ['work visa', 'h1b', 'h-1b', 'l1', 'o1', 'tier 2', 'work permit'] },
  { value: 'Student Visa (OPT / CPT)', label: 'Student Visa (OPT / CPT)', aliases: ['opt', 'cpt', 'student visa', 'f1 opt', 'stem opt'] },
  { value: 'Requires Visa Sponsorship', label: 'Requires Visa Sponsorship', aliases: ['require sponsorship', 'need sponsorship', 'sponsorship required'] },
  { value: 'Other', label: 'Other', aliases: ['other'] },
]

export function searchWorkAuthorizations(query: string, maxResults = 10): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return WORK_AUTHORIZATIONS.slice(0, maxResults).map((w) => w.label)

  const exact: string[] = []
  const startsWith: string[] = []
  const contains: string[] = []

  for (const w of WORK_AUTHORIZATIONS) {
    const lowerLabel = w.label.toLowerCase()
    const lowerVal = w.value.toLowerCase()
    const aliasMatch = w.aliases?.some((a) => a.toLowerCase().includes(q))

    if (lowerLabel === q || lowerVal === q) {
      exact.push(w.label)
    } else if (lowerLabel.startsWith(q) || lowerVal.startsWith(q) || w.aliases?.some((a) => a.toLowerCase().startsWith(q))) {
      startsWith.push(w.label)
    } else if (lowerLabel.includes(q) || lowerVal.includes(q) || aliasMatch) {
      contains.push(w.label)
    }
  }

  return Array.from(new Set([...exact, ...startsWith, ...contains])).slice(0, maxResults)
}
