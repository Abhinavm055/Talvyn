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
  /**
   * Fills a list of matched form fields.
   */
  autofillFields(fields: MatchedFormField[], forceOverwrite: boolean = false): AutofillResult {
    let filledCount = 0
    let skippedCount = 0
    let failedCount = 0
    const filledFields: MatchedFormField[] = []

    for (const matched of fields) {
      if (!matched.canAutofill || matched.valueToFill === null || matched.valueToFill === undefined) {
        skippedCount++
        continue
      }

      const el = matched.field.element as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)
      if (!el) {
        skippedCount++
        continue
      }

      // Check existing value — preserve user-entered content unless forceOverwrite is true
      const existingVal = (el as HTMLInputElement).value || matched.field.currentValue
      const isAlreadyFilledByUser =
        typeof existingVal === 'string' &&
        existingVal.trim().length > 0 &&
        el.getAttribute?.('data-talvyn-autofilled') !== 'true'

      if (isAlreadyFilledByUser && !forceOverwrite) {
        skippedCount++
        continue
      }

      try {
        const success = this.fillSingleField(matched.field.element, matched.valueToFill, matched.field.tag)
        if (success) {
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
      }
    }

    return { filledCount, skippedCount, failedCount, filledFields }
  }

  /**
   * Generates a signature representing the current form step's visible fields.
   */
  getStepSignature(fields: MatchedFormField[]): string {
    return fields
      .map((f) => `${f.field.name || f.field.domId || f.field.label}:${f.matchedKey}`)
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
  fillSingleField(element: HTMLElement, value: string | boolean, tag: string): boolean {
    if (!element) return false

    const tagName = (element.tagName || tag || '').toUpperCase()
    const inputType = ((element as HTMLInputElement).type || '').toLowerCase()

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
      return this.setNativeRadioValue(element as HTMLInputElement, String(value))
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
    input.focus?.()

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
    textarea.focus?.()

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
    select.focus()
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
      if (optText.includes(cleanTarget) || cleanTarget.includes(optText)) {
        matchedIndex = i
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

  private setNativeRadioValue(radio: HTMLInputElement, targetValue: string): boolean {
    const radioName = radio.name
    if (!radioName) {
      radio.checked = true
      this.dispatchInputEvents(radio)
      return true
    }

    const group = Array.from(
      document.querySelectorAll(`input[type="radio"][name="${CSS.escape(radioName)}"]`)
    ) as HTMLInputElement[]

    const cleanTarget = targetValue.toLowerCase().trim()

    for (const r of group) {
      const rVal = r.value.toLowerCase().trim()
      const rLabel = (r.parentElement?.textContent || '').toLowerCase().trim()

      if (rVal === cleanTarget || rLabel.includes(cleanTarget)) {
        r.checked = true
        this.dispatchInputEvents(r)
        return true
      }
    }

    return false
  }

  private setNativeCheckboxValue(checkbox: HTMLInputElement, checked: boolean): boolean {
    checkbox.focus?.()

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
