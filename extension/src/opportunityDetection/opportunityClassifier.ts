import { OpportunityClassificationResult, OpportunityType } from './types'
import { OPPORTUNITY_SIGNALS } from './opportunitySignals'
import { deadlineDetector } from './deadlineDetector'

export class OpportunityClassifier {
  /**
   * Deterministically classifies an opportunity posting into its opportunity type.
   */
  classify(
    title: string = '',
    description: string = '',
    metadataType: string = ''
  ): OpportunityClassificationResult {
    const cleanTitle = title.trim()
    const cleanDesc = description.trim()
    const cleanMeta = metadataType.trim().toUpperCase()

    const reasons: string[] = []
    const signals: string[] = []

    // ── 1. Direct Metadata Check ───────────────────────────────────────────
    if (cleanMeta === 'INTERNSHIP') {
      return {
        type: 'INTERNSHIP',
        confidence: 95,
        reasons: ['Opportunity type declared as Internship in metadata'],
        signals: ['metadata:INTERNSHIP'],
        deadline: deadlineDetector.extractDeadline(cleanDesc),
      }
    }

    // ── 2. Title Signal Evaluation (Highest Priority) ───────────────────────
    for (const sig of OPPORTUNITY_SIGNALS) {
      if (sig.regex.test(cleanTitle)) {
        signals.push(`Title matched ${sig.name}`)
        reasons.push(`Title "${cleanTitle}" identifies this opportunity as ${sig.type.replace(/_/g, ' ')}`)
        return {
          type: sig.type,
          confidence: sig.score,
          reasons,
          signals,
          deadline: deadlineDetector.extractDeadline(cleanDesc),
        }
      }
    }

    // ── 3. Description Signal Evaluation ───────────────────────────────────
    if (cleanDesc) {
      for (const sig of OPPORTUNITY_SIGNALS) {
        // Only evaluate non-generic signals on description
        if (sig.type !== 'JOB' && sig.regex.test(cleanDesc)) {
          signals.push(`Description matched ${sig.name}`)
          reasons.push(`Posting details describe a ${sig.type.replace(/_/g, ' ')}`)
          return {
            type: sig.type,
            confidence: Math.max(70, sig.score - 10),
            reasons,
            signals,
            deadline: deadlineDetector.extractDeadline(cleanDesc),
          }
        }
      }
    }

    // ── 4. Fallback Default ────────────────────────────────────────────────
    // If standard title is present but no specialized opportunity keywords matched, classify as standard JOB
    if (cleanTitle.length > 2) {
      return {
        type: 'JOB',
        confidence: 80,
        reasons: [`Standard professional role: "${cleanTitle}"`],
        signals: ['default:JOB'],
        deadline: deadlineDetector.extractDeadline(cleanDesc),
      }
    }

    // If completely empty or ambiguous
    return {
      type: 'OTHER',
      confidence: 40,
      reasons: ['Ambiguous or unclassified opportunity details'],
      signals: ['fallback:OTHER'],
      deadline: deadlineDetector.extractDeadline(cleanDesc),
    }
  }
}

export const opportunityClassifier = new OpportunityClassifier()
