import type { DetectedFormField, MatchedFormField, UserProfile } from '../../types'
import type { QuestionRiskLevel } from '../applicationAssistant/types'
import { classifyQuestionRisk } from '../applicationAssistant/questionAssistant/answerProvider'
import type { AutofillEngine, AutofillResult } from './autofillEngine'
import { fieldDetector } from './fieldDetector'

/** One policy for the preview, matcher and execution paths. */
export function classifyFieldRisk(field: DetectedFormField): { riskLevel: QuestionRiskLevel; reason?: string } {
  const text = [field.label, field.name, field.domId, field.placeholder, field.ariaLabel, field.nearbyText]
    .join(' ').replace(/[_-]+/g, ' ')
  // These explicit declarations remain manual even when a name/autocomplete token also matches.
  if (/\b(?:signature|e\s?signature)\b|\bsign\s+(?:here|your\s+name)\b|\bi\s+(?:hereby\s+)?(?:certify|attest|affirm|agree|consent|accept|acknowledge)\b|\bi\s+have\s+read\s+and\s+(?:agree|accept|consent)\b/i.test(text)) {
    return { riskLevel: 'USER_ACTION_REQUIRED', reason: 'A signature, consent or declaration must be completed manually.' }
  }
  return classifyQuestionRisk(text)
}

export function isReviewedAutofillEligible(matched: MatchedFormField): boolean {
  const answered = typeof matched.field.currentValue === 'string'
    ? matched.field.currentValue.trim().length > 0 : matched.field.currentValue
  return matched.canAutofill && !matched.isSensitive && !matched.requiresReview &&
    matched.valueToFill !== null && matched.valueToFill !== undefined &&
    isOwnRadioTarget(matched) &&
    !answered &&
    classifyFieldRisk(matched.field).riskLevel === 'SAFE_AUTOFILL'
}

function isOwnRadioTarget(matched: MatchedFormField): boolean {
  const input = matched.field.element as HTMLInputElement
  if (matched.field.inputType !== 'radio') return true
  const target = String(matched.valueToFill).toLowerCase().trim()
  return input.value.toLowerCase().trim() === target ||
    (input.labels?.[0]?.textContent || '').toLowerCase().trim() === target
}

/** Stable in-memory comparison only. Profile values are never persisted or logged here. */
function stableValue(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined'
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableValue(object[key])}`).join(',')}}`
}

function meaning(field: DetectedFormField): string {
  return stableValue({
    tag: field.tag, inputType: field.inputType, name: field.name, domId: field.domId,
    label: field.label, placeholder: field.placeholder, ariaLabel: field.ariaLabel,
    autocomplete: field.autocomplete, nearbyText: field.nearbyText,
    isRequired: field.isRequired, isIgnored: field.isIgnored,
    options: field.options.map(({ label, value }) => ({ label, value })),
  })
}

interface ReviewedEntry {
  readonly matched: MatchedFormField
  readonly meaning: string
  readonly value: string | boolean
  readonly form: HTMLFormElement | null
  readonly root: Node
  readonly radioGroup: readonly ReviewedRadioMember[] | null
}

interface ReviewedRadioMember {
  readonly element: HTMLInputElement
  readonly meaning: string | null
  readonly checked: boolean
  readonly form: HTMLFormElement | null
  readonly root: Node
}

function nativeRadioGroup(element: HTMLElement): HTMLInputElement[] {
  const radio = element as HTMLInputElement
  if (radio.type !== 'radio') return []
  if (!radio.name) return [radio]
  const root = radio.getRootNode() as Document | ShadowRoot
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
    .filter((member) => member.name === radio.name && member.form === radio.form)
}

function radioSnapshot(element: HTMLElement): readonly ReviewedRadioMember[] | null {
  if ((element as HTMLInputElement).type !== 'radio') return null
  return nativeRadioGroup(element).map((member) => {
    const field = fieldDetector.extractField(member)
    return {
      element: member, meaning: field ? meaning(field) : null,
      checked: member.checked, form: member.form, root: member.getRootNode(),
    }
  })
}

function radioGroupUnchanged(entry: ReviewedEntry): boolean {
  if (!entry.radioGroup) return true
  const members = nativeRadioGroup(entry.matched.field.element)
  return members.length === entry.radioGroup.length && members.every((member, index) => {
    const snapshot = entry.radioGroup![index]
    const field = fieldDetector.extractField(member)
    return member === snapshot.element && member.form === snapshot.form &&
      member.getRootNode() === snapshot.root && member.checked === snapshot.checked &&
      (field ? meaning(field) : null) === snapshot.meaning
  })
}

export interface ReviewedAutofillPlan {
  readonly entries: readonly ReviewedEntry[]
  readonly elements: ReadonlySet<HTMLElement>
  readonly profileSnapshot: string
  readonly pageUrl: string
}

export interface ReviewedAutofillResult extends AutofillResult {
  eligibleCount: number
  staleCount: number
  unreviewedCount: number
  blockedReason?: string
}

/** Capture exactly the values and native elements represented by this rendered preview. */
export function captureReviewedAutofill(
  fields: MatchedFormField[], profile: UserProfile, pageUrl: string,
): ReviewedAutofillPlan {
  const entries = fields.filter(isReviewedAutofillEligible).map((matched): ReviewedEntry => {
    const field = { ...matched.field, options: matched.field.options.map((option) => ({ ...option })) }
    return Object.freeze({
      matched: { ...matched, field }, meaning: meaning(field), value: field.currentValue,
      form: (field.element as HTMLInputElement).form ?? null, root: field.element.getRootNode(),
      radioGroup: radioSnapshot(field.element),
    })
  })
  return Object.freeze({
    entries: Object.freeze(entries), elements: new Set(fields.map((matched) => matched.field.element)),
    profileSnapshot: stableValue(profile), pageUrl,
  })
}

export function reviewedProfileMatches(plan: ReviewedAutofillPlan, profile: UserProfile): boolean {
  return plan.profileSnapshot === stableValue(profile)
}

export function blockedReviewedAutofill(plan: ReviewedAutofillPlan, blockedReason: string): ReviewedAutofillResult {
  return {
    filledCount: 0, skippedCount: plan.entries.length, failedCount: 0, filledFields: [],
    eligibleCount: plan.entries.length, staleCount: plan.entries.length, unreviewedCount: 0, blockedReason,
  }
}

/** Execute only preview entries, with a live check immediately before each native write. */
export function executeReviewedAutofill(
  plan: ReviewedAutofillPlan,
  options: {
    engine: AutofillEngine
    readFields: () => MatchedFormField[]
    profile: UserProfile
    pageUrl: string
    isCurrent: () => boolean
    select?: (matched: MatchedFormField) => boolean
  },
): ReviewedAutofillResult {
  if (!options.isCurrent() || options.pageUrl !== plan.pageUrl || !reviewedProfileMatches(plan, options.profile)) {
    return blockedReviewedAutofill(plan, 'This preview is out of date. Review the form again before filling.')
  }
  const entries = plan.entries.filter((entry) => !options.select || options.select(entry.matched))
  const unreviewed = new Set<HTMLElement>()
  const read = () => {
    const fields = options.readFields()
    fields.forEach((matched) => {
      if (!plan.elements.has(matched.field.element)) unreviewed.add(matched.field.element)
    })
    return fields
  }
  // Also discover additions when the preview has no eligible fields.
  try { read() } catch {
    return blockedReviewedAutofill(plan, 'The form could not be checked. Review the form again before filling.')
  }
  let staleCount = 0
  const snapshots = new Map(entries.map((entry) => [entry.matched, entry]))
  const result = options.engine.autofillFields(entries.map((entry) => entry.matched), false, (matched) => {
    const entry = snapshots.get(matched)!
    const element = matched.field.element
    let live: MatchedFormField | undefined
    try { live = read().find((field) => field.field.element === element) } catch { /* fail closed */ }
    const unchanged = options.isCurrent() && options.pageUrl === plan.pageUrl &&
      reviewedProfileMatches(plan, options.profile) && element.isConnected &&
      element.getRootNode() === entry.root && (element as HTMLInputElement).form === entry.form &&
      !!live && meaning(live.field) === entry.meaning && live.field.currentValue === entry.value &&
      isReviewedAutofillEligible(live) && live.valueToFill === matched.valueToFill &&
      live.matchedProfileField === matched.matchedProfileField
    let unchangedGroup = false
    try { unchangedGroup = radioGroupUnchanged(entry) } catch { /* fail closed */ }
    if (!unchanged || !unchangedGroup) staleCount++
    return !!unchanged && unchangedGroup
  })
  return { ...result, eligibleCount: entries.length, staleCount, unreviewedCount: unreviewed.size }
}
