import { DetectedFormField } from '../../types'

/**
 * Universal Form Field Detector (Phase 2C)
 * Inspects DOM form elements, extracts rich metadata, and ignores noise.
 * Deterministic rules — no AI.
 */

const IGNORED_INPUT_TYPES = new Set([
  'hidden',
  'password',
  'submit',
  'button',
  'reset',
  'image',
  'search',
])

const IGNORED_NAMES = [
  'csrf',
  'token',
  'authenticity_token',
  '__viewstate',
  'recaptcha',
  'hcaptcha',
  'turnstile',
  'search',
  'query',
  'q',
  'filter',
]

export class FieldDetector {
  /**
   * Detects all actionable form fields in the document or specific form container.
   */
  detectFields(root: Document | HTMLElement = document): DetectedFormField[] {
    const rawElements = Array.from(
      root.querySelectorAll('input, textarea, select')
    ) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[]

    const detected: DetectedFormField[] = []
    const seenElements = new Set<HTMLElement>()

    for (const el of rawElements) {
      if (seenElements.has(el)) continue
      seenElements.add(el)

      const field = this.extractField(el)
      if (field && !field.isIgnored) {
        detected.push(field)
      }
    }

    return detected
  }

  /**
   * Extracts detailed metadata for a single DOM form element.
   */
  extractField(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): DetectedFormField | null {
    const tagName = el.tagName.toLowerCase() as 'input' | 'textarea' | 'select'
    const inputType = el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : tagName

    // Ignore check
    if (this.shouldIgnore(el, inputType)) {
      return null
    }

    const name = el.name || ''
    const domId = el.id || ''
    const placeholder = el.getAttribute('placeholder') || ''
    const ariaLabel = el.getAttribute('aria-label') || ''
    const autocomplete = el.getAttribute('autocomplete') || ''
    const isRequired = el.required || el.getAttribute('aria-required') === 'true'

    const label = this.resolveLabel(el)
    const nearbyText = this.resolveNearbyText(el)
    const options = this.resolveOptions(el)
    const currentValue = this.resolveCurrentValue(el)
    const selector = this.generateSelector(el)

    return {
      id: domId || name || selector,
      element: el,
      selector,
      tag: inputType === 'radio' ? 'radio' : inputType === 'checkbox' ? 'checkbox' : tagName,
      inputType,
      name,
      domId,
      label,
      placeholder,
      ariaLabel,
      autocomplete,
      nearbyText,
      options,
      currentValue,
      isRequired: isRequired || label.includes('*') || nearbyText.includes('*'),
      isIgnored: false,
    }
  }

  // ─── Label Resolution ───────────────────────────────────────────────────────

  private resolveLabel(el: HTMLElement): string {
    // 1. Explicit <label for="id">
    if (el.id) {
      const explicitLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (explicitLabel?.textContent?.trim()) {
        return this.cleanText(explicitLabel.textContent)
      }
    }

    // 2. Enclosing <label>
    const enclosingLabel = el.closest('label')
    if (enclosingLabel) {
      // Clone and remove the input itself to get just the label text
      const clone = enclosingLabel.cloneNode(true) as HTMLElement
      const innerInput = clone.querySelector('input, select, textarea')
      innerInput?.remove()
      if (clone.textContent?.trim()) {
        return this.cleanText(clone.textContent)
      }
    }

    // 3. aria-labelledby
    const labelledby = el.getAttribute('aria-labelledby')
    if (labelledby) {
      const labelledEl = document.getElementById(labelledby)
      if (labelledEl?.textContent?.trim()) {
        return this.cleanText(labelledEl.textContent)
      }
    }

    // 4. aria-label
    if (el.getAttribute('aria-label')) {
      return this.cleanText(el.getAttribute('aria-label')!)
    }

    // 5. Check immediate preceding sibling or parent container label/legend
    const parent = el.parentElement
    if (parent) {
      const prev = el.previousElementSibling
      if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'P')) {
        if (prev.textContent?.trim() && prev.textContent.trim().length <= 80) {
          return this.cleanText(prev.textContent)
        }
      }

      // Check fieldset legend for radios/checkboxes
      const fieldset = el.closest('fieldset')
      if (fieldset) {
        const legend = fieldset.querySelector('legend')
        if (legend?.textContent?.trim()) {
          return this.cleanText(legend.textContent)
        }
      }

      // Look for any header or label in the parent container
      const containerLabel = parent.querySelector('label, [class*="label" i], [class*="title" i], [class*="heading" i]')
      if (containerLabel && containerLabel !== el && containerLabel.textContent?.trim()) {
        return this.cleanText(containerLabel.textContent)
      }
    }

    return ''
  }

  // ─── Nearby Text Resolution ────────────────────────────────────────────────

  private resolveNearbyText(el: HTMLElement): string {
    const parent = el.closest('.form-group, .field, [class*="field" i], [class*="control" i], div, tr')
    if (!parent) return ''

    const text = parent.textContent || ''
    return this.cleanText(text).slice(0, 200)
  }

  // ─── Option Resolution (Select / Radio / Checkbox) ──────────────────────────

  private resolveOptions(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): { label: string; value: string; selected?: boolean }[] {
    if (el instanceof HTMLSelectElement) {
      return Array.from(el.options).map((opt) => ({
        label: this.cleanText(opt.textContent || ''),
        value: opt.value,
        selected: opt.selected,
      }))
    }

    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      const radioGroup = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)) as HTMLInputElement[]
      return radioGroup.map((r) => {
        const radioLabel = this.resolveLabel(r) || r.value
        return {
          label: radioLabel,
          value: r.value,
          selected: r.checked,
        }
      })
    }

    return []
  }

  // ─── Current Value Resolution ──────────────────────────────────────────────

  private resolveCurrentValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | boolean {
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      return el.checked
    }
    return el.value || ''
  }

  // ─── Ignore Filters ────────────────────────────────────────────────────────

  private shouldIgnore(el: HTMLElement, inputType: string): boolean {
    // 1. Ignored input types
    if (IGNORED_INPUT_TYPES.has(inputType)) return true

    // 2. Disabled or read-only
    if ((el as HTMLInputElement).disabled || (el as HTMLInputElement).readOnly) return true

    // 3. Hidden from view (check bounding rect or inline styles)
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      // File inputs often have opacity:0 but are still actionable — keep file inputs!
      if (inputType !== 'file') return true
    }

    // 4. Ignored names (CSRF tokens, search fields, captchas)
    const name = (el.getAttribute('name') || '').toLowerCase()
    const domId = (el.id || '').toLowerCase()
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase()

    for (const ign of IGNORED_NAMES) {
      if (name.includes(ign) || domId.includes(ign) || ariaLabel.includes(ign)) {
        return true
      }
    }

    return false
  }

  // ─── Selector Generator ────────────────────────────────────────────────────

  private generateSelector(el: HTMLElement): string {
    if (el.id) return `#${CSS.escape(el.id)}`
    if (el.getAttribute('name')) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.getAttribute('name')!)}"]`
    return el.tagName.toLowerCase()
  }

  private cleanText(str: string): string {
    return str.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, ' ').trim()
  }
}

export const fieldDetector = new FieldDetector()
