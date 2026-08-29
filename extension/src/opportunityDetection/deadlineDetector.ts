/**
 * Deterministic Deadline Detector (Phase 2E)
 * Extracts explicit application deadlines without AI.
 */

const DEADLINE_PATTERNS = [
  // 1. Explicit labels: "Deadline: [Date]" / "Application deadline: [Date]" / "Closing date: [Date]"
  /(?:application\s+deadline|submission\s+deadline|closing\s+date|due\s+date|apply\s+before|(?:applications?|submissions?|proposals?|entries)?\s*close(?:s)?\s+on|closes\s+on|deadline)\s*[:\-–]\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/i,

  // 2. Sentence form: "Apply before August 30, 2026" / "Submissions close on September 15, 2026"
  /(?:apply\s+before|(?:applications?|submissions?|proposals?|entries)\s+close(?:s)?\s+on|due\s+by)\s+([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?|\d{4}-\d{2}-\d{2})/i,

  // 3. Short label: "Deadline: Aug 30"
  /(?:deadline)\s*:\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
]

const MONTH_NAMES: { [key: string]: number } = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

export class DeadlineDetector {
  /**
   * Extracts deadline from text or document.
   */
  extractDeadline(text: string): string | null {
    if (!text || text.length < 5) return null

    const cleanText = text.replace(/\s+/g, ' ')

    for (const pattern of DEADLINE_PATTERNS) {
      const match = cleanText.match(pattern)
      if (match && match[1]) {
        const rawDate = match[1].trim()
        const parsed = this.parseDateString(rawDate)
        if (parsed) {
          return parsed
        }
      }
    }

    return null
  }

  private parseDateString(raw: string): string | null {
    // Clean ordinals (30th -> 30, 1st -> 1)
    const cleaned = raw.replace(/(\d+)(?:st|nd|rd|th)/i, '$1').trim()

    // 1. ISO format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return cleaned
    }

    // 2. Month Day, Year (e.g. "August 30, 2026" or "Aug 30 2026")
    const monthDayYear = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})?$/i)
    if (monthDayYear) {
      const monthStr = monthDayYear[1].toLowerCase()
      const day = parseInt(monthDayYear[2], 10)
      const currentYear = new Date().getFullYear()
      const year = monthDayYear[3] ? parseInt(monthDayYear[3], 10) : currentYear

      if (MONTH_NAMES[monthStr] !== undefined && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
        const monthNum = String(MONTH_NAMES[monthStr] + 1).padStart(2, '0')
        const dayNum = String(day).padStart(2, '0')
        return `${year}-${monthNum}-${dayNum}`
      }
    }

    // 3. MM/DD/YYYY format
    const slashDate = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (slashDate) {
      const month = String(parseInt(slashDate[1], 10)).padStart(2, '0')
      const day = String(parseInt(slashDate[2], 10)).padStart(2, '0')
      const year = slashDate[3]
      return `${year}-${month}-${day}`
    }

    return null
  }
}

export const deadlineDetector = new DeadlineDetector()
