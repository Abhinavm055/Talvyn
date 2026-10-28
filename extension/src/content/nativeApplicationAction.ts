/** Inspect a native control without invoking site handlers or form defaults. */
export type NativeApplicationAction =
  | { kind: 'navigate'; url: string }
  | { kind: 'manual'; message: string }
  | { kind: 'none' }

export function inspectNativeApplicationAction(doc: Document): NativeApplicationAction {
  const control = doc.querySelector<HTMLElement>([
    'button[id*="indeedApplyButton" i]', 'button[data-testid*="indeedApplyButton" i]',
    'a[href*="/rc/clk" i]', 'a[href*="indeed.com/apply" i]',
    'button[class*="jobs-apply-button" i]', 'button[aria-label*="apply" i]',
    'a[aria-label*="apply" i]', 'button[class*="apply" i]:not(#talvyn-apply-btn)',
    'a[class*="apply" i]:not(#talvyn-apply-btn)', 'button[data-testid*="apply" i]',
    'a[data-testid*="apply" i]', '[class*="apply-button" i]', '[class*="ApplyButton" i]',
    'button[class*="register" i]', 'a[class*="register" i]', '[data-testid*="apply-button" i]',
    'input[type="submit"][value*="apply" i]', 'input[type="submit"][value*="register" i]',
  ].join(', '))
  if (!control) return { kind: 'none' }
  if (control.tagName === 'A') {
    try {
      const current = new URL(doc.URL)
      const href = control.getAttribute('href')
      const target = new URL(href || '', doc.baseURI)
      if (href && ['http:', 'https:'].includes(target.protocol) && !target.username && !target.password &&
          (target.origin !== current.origin || target.pathname !== current.pathname || target.search !== current.search)) {
        return { kind: 'navigate', url: target.href }
      }
    } catch { /* An absent or invalid destination requires a direct user action. */ }
  }
  return { kind: 'manual', message: "Use the website's Apply or Register control to open its form, then choose Apply with Talvyn again. Review the form before submitting." }
}
