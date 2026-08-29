import { OpportunityType, OpportunityClassificationResult } from '../types'

export type { OpportunityType, OpportunityClassificationResult }

export interface OpportunitySignal {
  type: OpportunityType
  score: number // Confidence weight
  regex: RegExp
  name: string
}
