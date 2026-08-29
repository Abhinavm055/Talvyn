/**
 * Success Detection Signals & Patterns (Phase 2D)
 * Deterministic detection patterns without AI.
 */

export interface SignalMatch {
  name: string
  score: number // Contribution to confidence
  matchDetail: string
}

export const SUCCESS_URL_PATTERNS = [
  { regex: /\/(?:application|apply|jobs?|postings?|careers?)\/.*(?:success|confirmation|thank-you|complete|applied|done)/i, score: 45, name: 'URL application confirmation path' },
  { regex: /\/(?:application|apply|job|posting)-(?:submitted|complete|success|confirmation)/i, score: 45, name: 'URL slug confirmation' },
  { regex: /\/(?:confirmation|thank-you|applied|success)\/?(?:$|\?)/i, score: 45, name: 'URL confirmation endpoint' },
  { regex: /[?&](?:status=applied|applied=true|application_submitted=true|submitted=1|success=1)/i, score: 40, name: 'URL query confirmation parameter' },
]

export const SUCCESS_TEXT_PHRASES = [
  { phrase: 'application successfully submitted', score: 75, exact: false },
  { phrase: 'application submitted successfully', score: 75, exact: false },
  { phrase: 'application has been submitted', score: 75, exact: false },
  { phrase: 'application submitted', score: 70, exact: false },
  { phrase: 'thank you for applying', score: 75, exact: false },
  { phrase: 'thanks for applying', score: 70, exact: false },
  { phrase: 'your application has been received', score: 75, exact: false },
  { phrase: 'we received your application', score: 75, exact: false },
  { phrase: 'we have received your application', score: 75, exact: false },
  { phrase: 'you have successfully applied', score: 75, exact: false },
  { phrase: 'your application was sent', score: 70, exact: false },
  { phrase: 'application complete', score: 70, exact: false },
  { phrase: 'submission complete', score: 70, exact: false },
  { phrase: 'thanks for your application', score: 70, exact: false },
  { phrase: 'thank you for your application', score: 70, exact: false },
  { phrase: 'application sent', score: 55, exact: false },
]

export const SUCCESS_UI_SELECTORS = [
  '[role="alert"]',
  '[aria-live="polite"]',
  '[aria-live="assertive"]',
  '.application-confirmation',
  '.application-success',
  '.submission-success',
  '#application-confirmation',
  '#submission-success',
  '[class*="success-message" i]',
  '[class*="confirmation-modal" i]',
  '[data-test="application-success"]',
  '[data-automation-id="applicationSubmittedMessage"]',
]

export const NEGATIVE_SIGNALS = [
  // Words indicating this is a search or unsubmitted form, not a success confirmation
  /search jobs/i,
  /apply now/i,
  /apply below/i,
  /how to apply/i,
  /ready to apply/i,
  /click apply/i,
  /submit application/i, // Present on the unsubmitted button
  /before you apply/i,
]
