import {
  SuccessConfidenceLevel,
  SuccessDetectionResult,
  ApplicationSession,
} from './types'
import {
  SUCCESS_URL_PATTERNS,
  SUCCESS_TEXT_PHRASES,
  SUCCESS_UI_SELECTORS,
} from './successSignals'

export class ConfidenceScorer {
  /**
   * Evaluates page signals and computes deterministic success confidence.
   */
  evaluate(
    url: string,
    doc: Document,
    session: ApplicationSession | null = null,
    overrideSignals: { name: string; score: number; detail: string }[] = []
  ): SuccessDetectionResult {
    let totalScore = 0
    const matchedSignals: string[] = []

    const cleanUrl = url.toLowerCase()

    // Aggregate text from doc.body and any alerts/modals
    let combinedText = (doc.body?.textContent || '').toLowerCase()
    for (const selector of SUCCESS_UI_SELECTORS) {
      const el = doc.querySelector(selector)
      if (el?.textContent) {
        combinedText += ' ' + el.textContent.toLowerCase()
      }
    }
    combinedText = combinedText.replace(/\s+/g, ' ')

    // ── 1. URL Evaluation ───────────────────────────────────────────────────
    for (const p of SUCCESS_URL_PATTERNS) {
      if (p.regex.test(cleanUrl)) {
        totalScore += p.score
        matchedSignals.push(`${p.name} (URL: ${cleanUrl})`)
        break // Match primary pattern
      }
    }

    // ── 2. Page Text Phrases Evaluation ─────────────────────────────────────
    let bestTextScore = 0
    let bestTextPhrase = ''

    for (const t of SUCCESS_TEXT_PHRASES) {
      if (combinedText.includes(t.phrase)) {
        if (t.score > bestTextScore) {
          bestTextScore = t.score
          bestTextPhrase = t.phrase
        }
      }
    }

    if (bestTextScore > 0) {
      totalScore += bestTextScore
      matchedSignals.push(`Confirmation phrase: "${bestTextPhrase}"`)
    }

    // ── 3. Success UI Elements Evaluation ───────────────────────────────────
    for (const selector of SUCCESS_UI_SELECTORS) {
      const el = doc.querySelector(selector)
      if (el && el.textContent?.trim()) {
        const elText = el.textContent.toLowerCase()
        // Check if the alert/modal has meaningful confirmation text
        const hasConfirmWord =
          elText.includes('success') ||
          elText.includes('submitted') ||
          elText.includes('received') ||
          elText.includes('applied') ||
          elText.includes('thank you')

        if (hasConfirmWord) {
          totalScore += 25
          matchedSignals.push(`Success UI element: ${selector}`)
          break
        }
      }
    }

    // ── 4. Active Session / Post-Submit Bonus ────────────────────────────────
    if (session) {
      const isFresh = Date.now() - new Date(session.lastActivityAt).getTime() < 30 * 60 * 1000 // within 30 min
      if (isFresh) {
        totalScore += 15
        matchedSignals.push('Active application session verified')
      }
      if (session.submitted) {
        totalScore += 10
        matchedSignals.push('User submitted form in active session')
      }
    }

    // ── 5. Override / Adapter Custom Signals ─────────────────────────────────
    for (const custom of overrideSignals) {
      totalScore += custom.score
      matchedSignals.push(`${custom.name}: ${custom.detail}`)
    }

    // ── 6. False Positive Protection & Penalties ────────────────────────────
    const allInputs = Array.from(doc.querySelectorAll('input:not([type="hidden"]), textarea'))
    const visibleInputs = allInputs.filter((el) => {
      if (typeof window !== 'undefined' && window.getComputedStyle) {
        const style = window.getComputedStyle(el)
        return style && style.display !== 'none' && style.visibility !== 'hidden'
      }
      return true
    })

    // If there is still an active unsubmitted form with > 3 inputs and no distinct success banner
    if (visibleInputs.length > 3 && !matchedSignals.some((s) => s.includes('URL') || s.includes('UI element'))) {
      totalScore = Math.max(0, totalScore - 40)
      matchedSignals.push('Penalty: Active unsubmitted form inputs present')
    }

    // Job listing detection check (multiple job cards)
    const jobCards = doc.querySelectorAll('.job-card, [class*="job-card" i], [class*="jobCard" i], [data-job-id]')
    if (jobCards.length > 3 && !cleanUrl.includes('applied') && !cleanUrl.includes('success')) {
      totalScore = Math.max(0, totalScore - 50)
      matchedSignals.push('Penalty: Job listing feed detected')
    }

    // Ensure score is clamped between 0 and 100
    const confidence = Math.max(0, Math.min(100, totalScore))

    let confidenceLevel: SuccessConfidenceLevel = 'NOT_CONFIRMED'
    if (confidence >= 90) {
      confidenceLevel = 'CONFIRMED'
    } else if (confidence >= 70) {
      confidenceLevel = 'LIKELY'
    } else if (confidence >= 50) {
      confidenceLevel = 'POSSIBLE'
    }

    const isSuccess = confidence >= 70

    return {
      isSuccess,
      confidence,
      confidenceLevel,
      matchedSignals,
      detectionMethod: matchedSignals.length > 0 ? matchedSignals[0] : 'Deterministic evaluation',
      pageUrl: url,
      timestamp: new Date().toISOString(),
    }
  }
}

export const confidenceScorer = new ConfidenceScorer()
