/**
 * Talvyn Preferred Job Types Taxonomy
 */

export interface JobTypeOption {
  value: string
  label: string
  description?: string
}

export const JOB_TYPES: JobTypeOption[] = [
  { value: 'Full Time', label: 'Full Time', description: 'Standard permanent full-time employment' },
  { value: 'Part Time', label: 'Part Time', description: 'Flexible part-time hours' },
  { value: 'Internship', label: 'Internship / Co-op', description: 'Student or entry-level training internship' },
  { value: 'Contract', label: 'Contract', description: 'Fixed-term or project-based contract role' },
  { value: 'Freelance', label: 'Freelance', description: 'Independent contractor / freelance gigs' },
  { value: 'Remote', label: 'Remote', description: '100% work from home / anywhere' },
  { value: 'Hybrid', label: 'Hybrid', description: 'Split between office and remote' },
  { value: 'On Site', label: 'On Site', description: 'Physical office / workplace location' },
  { value: 'Graduate Program', label: 'Graduate Program', description: 'Rotational graduate development program' },
  { value: 'Fellowship', label: 'Fellowship', description: 'Academic or institutional fellowship' },
  { value: 'Apprenticeship', label: 'Apprenticeship', description: 'Hands-on learning and mentorship program' },
  { value: 'Temporary', label: 'Temporary', description: 'Seasonal or short-term work' },
]

export function searchJobTypes(query: string): JobTypeOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return JOB_TYPES

  return JOB_TYPES.filter(
    (jt) => jt.value.toLowerCase().includes(q) || jt.label.toLowerCase().includes(q) || jt.description?.toLowerCase().includes(q)
  )
}
