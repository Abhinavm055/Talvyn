import {
  SuccessConfidenceLevel,
  SuccessDetectionResult,
  ApplicationSession,
  TrackAppliedPayload,
  TrackAppliedResponse,
  UndoAppliedPayload,
  UndoAppliedResponse,
  ExtractedJob,
  Job,
} from '../../types'

export type {
  SuccessConfidenceLevel,
  SuccessDetectionResult,
  ApplicationSession,
  TrackAppliedPayload,
  TrackAppliedResponse,
  UndoAppliedPayload,
  UndoAppliedResponse,
  ExtractedJob,
  Job,
}

export interface SuccessSiteAdapter {
  name: string
  canHandle(url: string, doc: Document): boolean
  detectSuccess(url: string, doc: Document, session?: ApplicationSession | null): SuccessDetectionResult | null
  extractSubmittedJobInfo?(doc: Document, session?: ApplicationSession | null): Partial<ExtractedJob> | null
}
