import { MatchedFormField } from '../../types'

/**
 * Universal Autofill Engine (Phase 2C)
 *
 * Fills DOM form fields safely and triggers native event cycles so modern
 * single-page application frameworks (React, Angular, Vue, Svelte) recognize changes.
 *
 * Safety Rules:
 * 1. NEVER automatically perform form submission.
 * 2. Never overwrite non-empty user-entered data by default.
 * 3. Deterministic execution only — no AI.
 */

export interface AutofillResult {
  filledCount: number
  skippedCount: number
  failedCount: number
  filledFields: MatchedFormField[]
}

export class AutofillEngine {
  // Page attributes are presentation metadata, never overwrite authorization.
  private readonly filledValues = new WeakMap<HTMLElement, string>()
  private readonly editedFields = new WeakSet<HTMLElement>()
  private readonly observedFields = new WeakSet<HTMLElement>()
  private readonly observedValues = new WeakMap<HTMLElement, string>()
  private readonly fillingFields = new WeakSet<HTMLElement>()

  private radioGroup(element: HTMLInputElement): HTMLInputElement[] {
    if (!element.name) return [element]
    // form="id" controls can live outside the form's descendant subtree.
    const root = element.getRootNode() as Document | ShadowRoot
    return Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
      .filter((radio) => radio.name === element.name && radio.form === element.form)
  }

  private liveValue(element: HTMLElement): string {
    const input = element as HTMLInputElement
    if (input.type === 'checkbox') return input.checked ? 'checked' : 'unchecked'
    if (input.type === 'radio') return JSON.stringify(this.radioGroup(input).filter((radio) => radio.checked).map((radio) => radio.value))
    return String((element as HTMLInputElement).value ?? '')
  }

  private hasAnswer(element: HTMLElement): boolean {
    const input = element as HTMLInputElement
    if (input.type === 'checkbox') return input.checked
    if (input.type === 'radio') return this.radioGroup(input).some((radio) => radio.checked)
    return this.liveValue(element).trim().length > 0
  }

  private observeEdits(element: HTMLElement): void {
    if (this.observedFields.has(element)) return
    this.observedFields.add(element)
    this.observedValues.set(element, this.liveValue(element))
    const edited = () => {
      if (this.fillingFields.has(element)) return
      this.editedFields.add(element)
      element.removeAttribute?.('data-talvyn-autofilled')
    }
    element.addEventListener?.('input', edited)
    element.addEventListener?.('change', edited)
  }

  /** Observe the entire preview, including existing answers, without granting overwrite ownership. */
  trackFields(elements: Iterable<HTMLElement>): void {
    for (const element of elements) {
      this.observeEdits(element)
      // Retain the original/last-owned baseline across rescans so silent clears
      // of an initially user-filled field remain user edits too.
      if (this.observedValues.get(element) !== this.liveValue(element)) this.editedFields.add(element)
    }
  }

  /**
   * Fills a list of matched form fields.
   */
  autofillFields(
    fields: MatchedFormField[], forceOverwrite: boolean = false,
    beforeWrite?: (matched: MatchedFormField) => boolean,
  ): AutofillResult {
    let filledCount = 0
    let skippedCount = 0
    let failedCount = 0
    const filledFields: MatchedFormField[] = []

    for (const matched of fields) {
      if (!matched.canAutofill || matched.isSensitive || matched.requiresReview || matched.valueToFill === null || matched.valueToFill === undefined) {
        skippedCount++
        continue
      }

      const el = matched.field.element as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)
      if (!el) {
        skippedCount++
        continue
      }

      this.trackFields([el])
      // Focus can synchronously run site handlers. Finish it before the final
      // answer/edit checks and reviewed-plan guard, never between guard and setter.
      try { el.focus?.() } catch (err: unknown) {
        matched.error = err instanceof Error ? err.message : 'Focus failed'
        failedCount++
        continue
      }
      this.trackFields([el])
      const previous = this.filledValues.get(el)
      // Live snapshots also catch edits made without input/change events.
      if (previous !== undefined && previous !== this.liveValue(el)) this.editedFields.add(el)
      if (!forceOverwrite && (this.editedFields.has(el) || previous === undefined && this.hasAnswer(el))) {
        skippedCount++
        continue
      }

      // Reviewed callers revalidate every entry after preceding fields' synchronous site handlers.
      if (beforeWrite && !beforeWrite(matched)) {
        skippedCount++
        continue
      }

      try {
        this.fillingFields.add(el)
        const success = this.fillSingleField(matched.field.element, matched.valueToFill, matched.field.tag, {
          focus: false, restrictRadioTarget: !!beforeWrite,
        })
        if (success) {
          this.filledValues.set(el, this.liveValue(el))
          this.observedValues.set(el, this.liveValue(el))
          if (el.type === 'radio') {
            this.radioGroup(el as HTMLInputElement).forEach((member) => {
              if (this.observedFields.has(member)) this.observedValues.set(member, this.liveValue(member))
            })
          }
          this.editedFields.delete(el)
          matched.isFilled = true
          el.setAttribute?.('data-talvyn-autofilled', 'true')
          filledCount++
          filledFields.push(matched)
        } else {
          failedCount++
        }
      } catch (err: unknown) {
        console.error('[Talvyn Autofill] Failed to fill field:', matched.field.name || matched.field.domId, err)
        matched.error = err instanceof Error ? err.message : 'Fill failed'
        failedCount++
      } finally {
        this.fillingFields.delete(el)
      }
    }

    return { filledCount, skippedCount, failedCount, filledFields }
  }

  /**
   * Generates a signature representing the current form step's visible fields.
   */
  getStepSignature(fields: MatchedFormField[]): string {
    return fields
      .map((f) => `${f.field.name || f.field.domId || f.field.label}:${f.matchedProfileField}`)
      .sort()
      .join('|')
  }

  /**
   * Checks if an application has multi-step progression indicators.
   */
  isMultiStepApplication(doc: Document = document): { isMultiStep: boolean; currentStep?: number; totalSteps?: number } {
    const stepIndicators = doc.querySelectorAll(
      '[class*="step" i], [aria-label*="step" i], [data-test*="step" i], [class*="progress" i], .wizard'
    )
    const nextBtn = doc.querySelector('button[class*="next" i], button[id*="next" i], [data-qa="next-step"]')
    const isMulti = stepIndicators.length > 0 || !!nextBtn
    return { isMultiStep: isMulti }
  }

  /**
   * Fills an individual DOM form element safely with React/Vue/Angular event simulation.
   */
  fillSingleField(
    element: HTMLElement, value: string | boolean, tag: string,
    options: { focus?: boolean; restrictRadioTarget?: boolean } = {},
  ): boolean {
    if (!element) return false

    const tagName = (element.tagName || tag || '').toUpperCase()
    const inputType = ((element as HTMLInputElement).type || '').toLowerCase()
    // Direct helper callers retain the previous native focus behavior. Reviewed
    // bulk callers have already focused and checked the resulting live form.
    if (options.focus !== false && (tagName === 'TEXTAREA' || tagName === 'SELECT' ||
      tagName === 'INPUT' && inputType !== 'radio' && inputType !== 'file')) element.focus?.()

    // 1. Text Input & Textarea
    if (tagName === 'INPUT' && inputType !== 'radio' && inputType !== 'checkbox' && inputType !== 'file') {
      return this.setNativeInputValue(element as HTMLInputElement, String(value))
    }

    if (tagName === 'TEXTAREA') {
      return this.setNativeTextareaValue(element as HTMLTextAreaElement, String(value))
    }

    // 2. Select Dropdown
    if (tagName === 'SELECT') {
      return this.setNativeSelectValue(element as HTMLSelectElement, String(value))
    }

    // 3. Radio Button
    if (tagName === 'INPUT' && inputType === 'radio') {
      return this.setNativeRadioValue(element as HTMLInputElement, String(value), !!options.restrictRadioTarget)
    }

    // 4. Checkbox
    if (tagName === 'INPUT' && inputType === 'checkbox') {
      const boolVal = typeof value === 'boolean' ? value : value === 'true' || value === '1' || value === 'yes'
      return this.setNativeCheckboxValue(element as HTMLInputElement, boolVal)
    }

    return false
  }

  // ─── Native Property Setters (Crucial for React 16+ / Vue / Angular) ───────

  private setNativeInputValue(input: HTMLInputElement, value: string): boolean {
    // Use native prototype descriptor to bypass React's synthetic input tracker
    const nativeProto = typeof window !== 'undefined' && window.HTMLInputElement ? window.HTMLInputElement.prototype : null
    const nativeSetter = nativeProto ? Object.getOwnPropertyDescriptor(nativeProto, 'value')?.set : null

    if (nativeSetter) {
      nativeSetter.call(input, value)
    } else {
      input.value = value
    }

    this.dispatchInputEvents(input)
    return true
  }

  private setNativeTextareaValue(textarea: HTMLTextAreaElement, value: string): boolean {
    const nativeProto = typeof window !== 'undefined' && window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : null
    const nativeSetter = nativeProto ? Object.getOwnPropertyDescriptor(nativeProto, 'value')?.set : null

    if (nativeSetter) {
      nativeSetter.call(textarea, value)
    } else {
      textarea.value = value
    }

    this.dispatchInputEvents(textarea)
    return true
  }

  private setNativeSelectValue(select: HTMLSelectElement, targetValue: string): boolean {
    const cleanTarget = targetValue.toLowerCase().trim()

    let matchedIndex = -1

    // Find best option index
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i]
      const optVal = opt.value.toLowerCase().trim()
      const optText = (opt.textContent || '').toLowerCase().trim()

      if (optVal === cleanTarget || optText === cleanTarget) {
        matchedIndex = i
        break
      }
    }

    if (matchedIndex >= 0) {
      select.selectedIndex = matchedIndex

      const nativeProto = typeof window !== 'undefined' && window.HTMLSelectElement ? window.HTMLSelectElement.prototype : null
      const nativeSetter = nativeProto ? Object.getOwnPropertyDescriptor(nativeProto, 'value')?.set : null

      if (nativeSetter) {
        nativeSetter.call(select, select.options[matchedIndex].value)
      }

      this.dispatchInputEvents(select)
      return true
    }

    return false
  }

  private setNativeRadioValue(radio: HTMLInputElement, targetValue: string, restrictTarget = false): boolean {
    const radioName = radio.name
    if (!radioName || restrictTarget) {
      const ownLabel = (radio.labels?.[0]?.textContent || '').toLowerCase().trim()
      const target = targetValue.toLowerCase().trim()
      if (radio.value.toLowerCase().trim() !== target && ownLabel !== target) return false
      radio.checked = true
      this.dispatchInputEvents(radio)
      return true
    }

    const group = this.radioGroup(radio)

    const cleanTarget = targetValue.toLowerCase().trim()

    for (const r of group) {
      const rVal = r.value.toLowerCase().trim()
      const rLabel = (r.labels?.[0]?.textContent || '').toLowerCase().trim()

      if (rVal === cleanTarget || rLabel === cleanTarget) {
        r.checked = true
        this.dispatchInputEvents(r)
        return true
      }
    }

    return false
  }

  private setNativeCheckboxValue(checkbox: HTMLInputElement, checked: boolean): boolean {
    const nativeProto = typeof window !== 'undefined' && window.HTMLInputElement ? window.HTMLInputElement.prototype : null
    const nativeSetter = nativeProto ? Object.getOwnPropertyDescriptor(nativeProto, 'checked')?.set : null

    if (nativeSetter) {
      nativeSetter.call(checkbox, checked)
    } else {
      checkbox.checked = checked
    }

    this.dispatchInputEvents(checkbox)
    return true
  }

  // ─── Dispatch Bubbling Events ───────────────────────────────────────────────

  private dispatchInputEvents(element: HTMLElement): void {
    if (typeof Event === 'undefined' || !element.dispatchEvent) return

    // 1. input event
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }))

    // 2. change event
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }))

    // 3. blur event (signals validation to form handlers)
    element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }))
  }
}

export const autofillEngine = new AutofillEngine()
