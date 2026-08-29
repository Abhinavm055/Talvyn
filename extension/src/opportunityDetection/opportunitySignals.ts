import { OpportunitySignal } from './types'

export const OPPORTUNITY_SIGNALS: OpportunitySignal[] = [
  // ── 1. INTERNSHIP ─────────────────────────────────────────────────────────
  {
    type: 'INTERNSHIP',
    score: 95,
    name: 'Internship Title/Role Keyword',
    regex: /\b(?:internship|internships|intern|summer intern|winter intern|spring intern|fall intern|co-op|trainee|student worker|apprenticeship)\b/i,
  },

  // ── 2. GRADUATE_PROGRAM ───────────────────────────────────────────────────
  {
    type: 'GRADUATE_PROGRAM',
    score: 90,
    name: 'Graduate Program Keyword',
    regex: /\b(?:graduate\s+(?:\w+\s+)?(?:program|scheme)|graduate program|graduate scheme|campus hiring|fresher program|university graduate|early career program|new grad|new graduate|campus recruitment|management trainee)\b/i,
  },

  // ── 3. FELLOWSHIP ─────────────────────────────────────────────────────────
  {
    type: 'FELLOWSHIP',
    score: 90,
    name: 'Fellowship Keyword',
    regex: /\b(?:fellowship|fellowships|scholar program|research fellowship|post-doctoral fellowship|postdoctoral fellow|visiting fellow|academic fellow)\b/i,
  },

  // ── 4. COMPETITION ────────────────────────────────────────────────────────
  {
    type: 'COMPETITION',
    score: 95,
    name: 'Competition / Hackathon Keyword',
    regex: /\b(?:hackathon|competition|coding challenge|case competition|contest|innovation challenge|prize challenge|kaggle competition|hackathon challenge)\b/i,
  },

  // ── 5. TALENT_OPPORTUNITY ─────────────────────────────────────────────────
  {
    type: 'TALENT_OPPORTUNITY',
    score: 90,
    name: 'Talent / Casting / Residency Keyword',
    regex: /\b(?:audition|talent search|talent hunt|casting call|casting|portfolio submission|artist residency|creator residency|creator program|open call for artists)\b/i,
  },

  // ── 6. JOB ────────────────────────────────────────────────────────────────
  {
    type: 'JOB',
    score: 75,
    name: 'Standard Job / Employment Keyword',
    regex: /\b(?:full-time|part-time|contract|permanent|engineer|developer|analyst|manager|specialist|consultant|associate|director|coordinator|designer|executive|technician|officer|job opening|employment)\b/i,
  },
]
