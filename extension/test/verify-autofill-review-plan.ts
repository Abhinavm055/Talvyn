/** Actual reviewed-plan helper, detector, matcher and native engine on real JSDOM controls. */
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { AutofillEngine } from '../src/content/autofill/autofillEngine'
import { FieldDetector } from '../src/content/autofill/fieldDetector'
import { FieldMatcher } from '../src/content/autofill/fieldMatcher'
import { captureReviewedAutofill, executeReviewedAutofill } from '../src/content/autofill/reviewedAutofill'
import type { DetectedFormField, MatchedFormField, UserProfile } from '../src/types'

const PAGE = 'https://boards.greenhouse.io/fixture/jobs/1'
const EMAIL = '<div><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email"></div>'
const CITY = '<div><label for="city">City</label><input id="city" name="city" autocomplete="address-level2"></div>'
const COUNTRY = '<div><label for="country">Country</label><select id="country" name="country"><option value="">Choose</option><option value="Canada">Canada</option><option value="France">France</option></select></div>'
let fixtures = 0

function profile(): UserProfile {
  return { id: 'profile-fixture', userId: 'user-fixture', legalFullName: 'Candidate Example', givenName: 'Candidate', familyName: 'Example',
    email: 'candidate@example.test', city: 'Ottawa', country: 'Canada', phone: '5550101000', skills: ['SQL'], preferredRoles: [],
    preferredLocations: [], preferredJobTypes: [], workStyle: 'REMOTE', onboardingCompleted: true }
}

function fixture(name: string, markup: string, run: (context: ReturnType<typeof harness>) => void): void {
  const context = harness(markup)
  try {
    run(context)
    assert.equal(context.submissions(), 0, `${name}: native application submission must never occur`)
    fixtures++
    console.log(`PASS: ${name}`)
  } finally { context.dom.window.close() }
}

function harness(markup: string) {
  const dom = new JSDOM(`<form id="application_form">${markup}<button type="submit">Submit application</button></form><form id="other_form"></form>`, { url: PAGE })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Event: dom.window.Event, Node: dom.window.Node,
    HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLSelectElement: dom.window.HTMLSelectElement, HTMLFormElement: dom.window.HTMLFormElement, CSS: { escape: (value: string) => value } })
  const detector = new FieldDetector()
  const matcher = new FieldMatcher()
  const candidate = profile()
  const engine = new AutofillEngine()
  let submitted = 0
  dom.window.document.addEventListener('submit', (event) => { event.preventDefault(); submitted++ })
  const readFields = () => detector.detectFields(dom.window.document).map((field) => matcher.matchField(field, candidate))
  const capture = () => captureReviewedAutofill(readFields(), candidate, PAGE)
  const execute = (plan: ReturnType<typeof capture>, overrides: Partial<Parameters<typeof executeReviewedAutofill>[1]> = {}) =>
    executeReviewedAutofill(plan, { engine, readFields, profile: candidate, pageUrl: PAGE, isCurrent: () => true, ...overrides })
  const control = <T extends HTMLElement = HTMLInputElement>(selector: string): T => {
    const element = dom.window.document.querySelector<T>(selector)
    assert.ok(element, `Expected native fixture control ${selector}`)
    return element
  }
  return { dom, detector, matcher, profile: candidate, engine, readFields, capture, execute, control, submissions: () => submitted }
}

/** Raw checkbox/radio values deliberately test engine transport, not profile taxonomy support. */
function synthetic(field: DetectedFormField, value: string | boolean): MatchedFormField {
  return { field, detectedType: 'country', confidence: 95, confidenceLevel: 'HIGH', matchedProfileField: 'country', valueToFill: value,
    reason: 'Synthetic transport fixture with an explicit reviewed value', canAutofill: true, isCustomQuestion: false, isResumeUpload: false }
}

fixture('unchanged native input, textarea and select fill only reviewed profile facts', `${EMAIL}<div><label for="city">City</label><textarea id="city" name="city"></textarea></div>${COUNTRY}`, (h) => {
  const plan = h.capture()
  const result = h.execute(plan)
  assert.equal(result.eligibleCount, 3)
  assert.equal(result.filledCount, 3)
  assert.equal(result.staleCount, 0)
  assert.equal(result.unreviewedCount, 0)
  assert.equal(h.control('#email').value, h.profile.email)
  assert.equal(h.control<HTMLTextAreaElement>('#city').value, h.profile.city)
  assert.equal(h.control<HTMLSelectElement>('#country').value, h.profile.country)
})

fixture('legal, sensitive, assisted and unknown fields have no executable review entry', `${EMAIL}<div><label for="legal">I certify that this full name is accurate and complete</label><input id="legal" name="full_name"></div><div><label for="salary">Desired salary</label><input id="salary" name="salary"></div><div><label for="story">Describe your project</label><textarea id="story"></textarea></div><div><label for="mystery">Unmapped fixture detail</label><input id="mystery"></div>`, (h) => {
  const plan = h.capture()
  assert.equal(plan.entries.length, 1)
  assert.equal(h.execute(plan).filledCount, 1)
  for (const selector of ['#legal', '#salary', '#story', '#mystery']) assert.equal(h.control(selector).value, '')
})

const semanticChanges: [string, (h: ReturnType<typeof harness>) => void][] = [
  ['label', (h) => { h.control('label[for="email"]').textContent = 'Alternate email' }],
  ['name', (h) => { h.control('#email').name = 'alternate_email' }],
  ['id', (h) => { h.control('#email').id = 'alternate_email' }],
  ['input type', (h) => { h.control('#email').type = 'text' }],
  ['placeholder', (h) => { h.control('#email').placeholder = 'Alternate email' }],
  ['accessible name', (h) => { h.control('#email').setAttribute('aria-label', 'Alternate email') }],
  ['autocomplete', (h) => { h.control('#email').autocomplete = 'off' }],
  ['required state', (h) => { h.control('#email').required = true }],
  ['form association', (h) => { h.control('#email').setAttribute('form', 'other_form') }],
  ['replaced form owner', (h) => {
    const old = h.control<HTMLFormElement>('#application_form')
    const replacement = document.createElement('form')
    replacement.id = old.id
    while (old.firstChild) replacement.append(old.firstChild)
    old.replaceWith(replacement)
  }],
  ['disabled control', (h) => { h.control('#email').disabled = true }],
  ['readonly control', (h) => { h.control('#email').readOnly = true }],
  ['hidden control', (h) => { h.control('#email').style.display = 'none' }],
  ['detached control', (h) => { h.control('#email').remove() }],
]
for (const [name, change] of semanticChanges) {
  fixture(`${name} change invalidates its reviewed control`, EMAIL, (h) => {
    const input = h.control('#email')
    const plan = h.capture()
    change(h)
    const result = h.execute(plan)
    assert.equal(result.filledCount, 0)
    assert.equal(result.staleCount, 1)
    assert.equal(input.value, '')
  })
}

for (const [name, mutate] of [
  ['value', (option: HTMLOptionElement) => { option.value = 'Different' }],
  ['label', (option: HTMLOptionElement) => { option.textContent = 'Different' }],
] as const) {
  fixture(`select option ${name} change invalidates the preview`, COUNTRY, (h) => {
    const plan = h.capture()
    mutate(h.control<HTMLSelectElement>('#country').options[1])
    const result = h.execute(plan)
    assert.equal(result.filledCount, 0)
    assert.equal(result.staleCount, 1)
    assert.equal(h.control<HTMLSelectElement>('#country').value, '')
  })
}

fixture('replacement native node with identical attributes needs a fresh preview', EMAIL, (h) => {
  const plan = h.capture()
  const old = h.control('#email')
  const replacement = old.cloneNode() as HTMLInputElement
  old.replaceWith(replacement)
  const result = h.execute(plan)
  assert.equal(result.filledCount, 0)
  assert.equal(result.staleCount, 1)
  assert.equal(result.unreviewedCount, 1)
  assert.equal(replacement.value, '')
})

fixture('new controls are reported as unreviewed and excluded from existing approval', EMAIL, (h) => {
  const plan = h.capture()
  h.control('#application_form').insertAdjacentHTML('beforeend', CITY)
  const result = h.execute(plan)
  assert.equal(result.filledCount, 1)
  assert.equal(result.unreviewedCount, 1)
  assert.equal(h.control('#city').value, '')
})

fixture('new controls are discovered even when the old preview had no eligible entries', '<div><label for="unknown">Unmapped fixture detail</label><input id="unknown"></div>', (h) => {
  const plan = h.capture()
  assert.equal(plan.entries.length, 0)
  h.control('#application_form').insertAdjacentHTML('beforeend', EMAIL)
  const result = h.execute(plan)
  assert.equal(result.filledCount, 0)
  assert.equal(result.unreviewedCount, 1)
  assert.equal(h.control('#email').value, '')
})

fixture('profile value changed after preview blocks every field', EMAIL, (h) => {
  const plan = h.capture()
  h.profile.email = 'changed@example.test'
  const result = h.execute(plan)
  assert.equal(result.filledCount, 0)
  assert.match(result.blockedReason || '', /out of date/i)
  assert.equal(h.control('#email').value, '')
})

fixture('account switch invalidates a captured preview even with identical fill values', EMAIL, (h) => {
  const plan = h.capture()
  h.profile.userId = 'different-user'
  const result = h.execute(plan)
  assert.equal(result.filledCount, 0)
  assert.ok(result.blockedReason)
})

fixture('page navigation invalidates the captured preview', EMAIL, (h) => {
  const result = h.execute(h.capture(), { pageUrl: `${PAGE}?step=2` })
  assert.equal(result.filledCount, 0)
  assert.ok(result.blockedReason)
})

fixture('dismissed or superseded preview cannot execute', EMAIL, (h) => {
  const result = h.execute(h.capture(), { isCurrent: () => false })
  assert.equal(result.filledCount, 0)
  assert.ok(result.blockedReason)
})

fixture('per-field selection fills only the selected reviewed entry', `${EMAIL}${CITY}`, (h) => {
  const result = h.execute(h.capture(), { select: (matched) => matched.matchedProfileField === 'city' })
  assert.equal(result.eligibleCount, 1)
  assert.equal(result.filledCount, 1)
  assert.equal(h.control('#city').value, h.profile.city)
  assert.equal(h.control('#email').value, '')
})

fixture('initial field read failure fails closed without native writes', EMAIL, (h) => {
  const result = h.execute(h.capture(), { readFields: () => { throw new Error('Synthetic detector failure') } })
  assert.equal(result.filledCount, 0)
  assert.ok(result.blockedReason)
  assert.equal(h.control('#email').value, '')
})

fixture('earlier native input handler retargeting a later label blocks that later write', `${EMAIL}${CITY}`, (h) => {
  const plan = h.capture()
  h.control('#email').addEventListener('input', () => { h.control('label[for="city"]').textContent = 'I certify that this city is accurate and complete' })
  const result = h.execute(plan)
  assert.equal(result.filledCount, 1)
  assert.equal(result.staleCount, 1)
  assert.equal(h.control('#city').value, '')
})

fixture('earlier native input handler changing profile blocks subsequent values', `${EMAIL}${CITY}`, (h) => {
  const plan = h.capture()
  h.control('#email').addEventListener('input', () => { h.profile.city = 'Changed city' })
  const result = h.execute(plan)
  assert.equal(result.filledCount, 1)
  assert.equal(result.staleCount, 1)
  assert.equal(h.control('#city').value, '')
})

fixture('earlier native input handler adding a control cannot expand the reviewed plan', `${EMAIL}${CITY}`, (h) => {
  const plan = h.capture()
  h.control('#email').addEventListener('input', () => { h.control('#application_form').insertAdjacentHTML('beforeend', '<div><label for="phone">Phone</label><input id="phone" type="tel" name="phone"></div>') })
  const result = h.execute(plan)
  assert.equal(result.filledCount, 2)
  assert.equal(result.unreviewedCount, 1)
  assert.equal(h.control('#phone').value, '')
})

fixture('a detector failure during a later write leaves the earlier safe write intact', `${EMAIL}${CITY}`, (h) => {
  const plan = h.capture()
  let reads = 0
  const result = h.execute(plan, { readFields: () => { reads++; if (reads >= 3) throw new Error('Synthetic later read failure'); return h.readFields() } })
  assert.equal(result.filledCount, 1)
  assert.equal(result.staleCount, 1)
  assert.equal(h.control('#city').value, '')
})

fixture('a user answer entered after preview is preserved', EMAIL, (h) => {
  const plan = h.capture()
  h.control('#email').value = 'user-entered@example.test'
  const result = h.execute(plan)
  assert.equal(result.filledCount, 0)
  assert.equal(result.skippedCount, 1)
  assert.equal(h.control('#email').value, 'user-entered@example.test')
})

for (const [name, value, dispatch] of [
  ['edited answer with input event', 'user-edited@example.test', true],
  ['cleared answer with input event', '', true],
  ['silently cleared answer', '', false],
] as const) {
  fixture(`engine ownership preserves ${name} through a fresh preview`, EMAIL, (h) => {
    assert.equal(h.execute(h.capture()).filledCount, 1)
    h.control('#email').value = value
    if (dispatch) h.control('#email').dispatchEvent(new Event('input', { bubbles: true }))
    const result = h.execute(h.capture())
    assert.equal(result.filledCount, 0)
    assert.equal(result.eligibleCount, value ? 0 : 1, 'Answered values leave the preview; cleared controls remain engine protected')
    assert.equal(result.skippedCount, value ? 0 : 1)
    assert.equal(h.control('#email').value, value)
  })
}

fixture('select chosen by user after preview remains selected', COUNTRY, (h) => {
  const plan = h.capture()
  h.control<HTMLSelectElement>('#country').value = 'France'
  const result = h.execute(plan)
  assert.equal(result.filledCount, 0)
  assert.equal(h.control<HTMLSelectElement>('#country').value, 'France')
})

fixture('engine-filled select cleared by user remains cleared after fresh preview', COUNTRY, (h) => {
  assert.equal(h.execute(h.capture()).filledCount, 1)
  h.control<HTMLSelectElement>('#country').value = ''
  h.control('#country').dispatchEvent(new Event('change', { bubbles: true }))
  assert.equal(h.execute(h.capture()).filledCount, 0)
  assert.equal(h.control<HTMLSelectElement>('#country').value, '')
})

fixture('checkbox uses native checked state and preserves a later user uncheck', '<div><label for="choice">Display preference</label><input id="choice" type="checkbox" name="display_preference"></div>', (h) => {
  const readFields = () => [synthetic(h.detector.extractField(h.control('#choice'))!, true)]
  const capture = () => captureReviewedAutofill(readFields(), h.profile, PAGE)
  assert.equal(h.execute(capture(), { readFields }).filledCount, 1)
  assert.equal(h.control('#choice').checked, true)
  h.control('#choice').checked = false
  h.control('#choice').dispatchEvent(new Event('change', { bubbles: true }))
  assert.equal(h.execute(capture(), { readFields }).filledCount, 0)
  assert.equal(h.control('#choice').checked, false)
})

fixture('checkbox state changed after preview cannot be overwritten', '<div><label for="choice">Display preference</label><input id="choice" type="checkbox" name="display_preference"></div>', (h) => {
  const readFields = () => [synthetic(h.detector.extractField(h.control('#choice'))!, false)]
  const plan = captureReviewedAutofill(readFields(), h.profile, PAGE)
  h.control('#choice').checked = true
  assert.equal(h.execute(plan, { readFields }).filledCount, 0)
  assert.equal(h.control('#choice').checked, true)
})

const RADIOS = '<div><label for="morning">Morning</label><input id="morning" name="time_preference" type="radio" value="morning"><label for="evening">Evening</label><input id="evening" name="time_preference" type="radio" value="evening"></div>'
fixture('radio selection and a subsequent user change stay within the reviewed native group', RADIOS, (h) => {
  const readFields = () => ['#morning', '#evening'].map((selector) => synthetic(h.detector.extractField(h.control(selector))!, 'evening'))
  const capture = () => captureReviewedAutofill(readFields(), h.profile, PAGE)
  assert.equal(h.execute(capture(), { readFields }).filledCount, 1)
  assert.equal(h.control('#evening').checked, true)
  h.control('#morning').checked = true
  h.control('#morning').dispatchEvent(new Event('change', { bubbles: true }))
  assert.equal(h.execute(capture(), { readFields }).filledCount, 0)
  assert.equal(h.control('#morning').checked, true)
  assert.equal(h.control('#evening').checked, false)
})

fixture('silently clearing an engine-filled radio group survives a fresh preview', RADIOS, (h) => {
  const readFields = () => ['#morning', '#evening'].map((selector) => synthetic(h.detector.extractField(h.control(selector))!, 'evening'))
  const capture = () => captureReviewedAutofill(readFields(), h.profile, PAGE)
  assert.equal(h.execute(capture(), { readFields }).filledCount, 1)
  h.control('#evening').checked = false
  assert.equal(h.execute(capture(), { readFields }).filledCount, 0)
  assert.equal(h.control('#morning').checked, false)
  assert.equal(h.control('#evening').checked, false)
})

fixture('radio groups respect native form owners including external form-associated controls', '<div><label for="morning">Morning</label><input id="morning" name="time_preference" type="radio" value="morning"></div>', (h) => {
  document.body.insertAdjacentHTML('beforeend', '<div><label for="evening">Evening</label><input id="evening" form="application_form" name="time_preference" type="radio" value="evening"></div>')
  h.control('#other_form').insertAdjacentHTML('beforeend', '<label for="unrelated">Unrelated selection</label><input id="unrelated" name="time_preference" type="radio" value="evening" checked>')
  const readFields = () => ['#morning', '#evening'].map((selector) => synthetic(h.detector.extractField(h.control(selector))!, 'evening'))
  const result = h.execute(captureReviewedAutofill(readFields(), h.profile, PAGE), { readFields })
  assert.equal(result.filledCount, 1)
  assert.equal(h.control('#evening').checked, true)
  assert.equal(h.control('#morning').checked, false)
  assert.equal(h.control('#unrelated').checked, true, 'Another form with the same radio name retains its answer')
})

fixture('a replaced radio target cannot inherit its reviewed siblings permission', RADIOS, (h) => {
  const readFields = () => ['#morning', '#evening'].map((selector) => synthetic(h.detector.extractField(h.control(selector))!, 'evening'))
  const plan = captureReviewedAutofill(readFields(), h.profile, PAGE)
  h.control('#evening').replaceWith(h.control('#evening').cloneNode())
  const result = h.execute(plan, { readFields })
  assert.equal(result.filledCount, 0)
  assert.equal(h.control('#evening').checked, false)
  assert.equal(result.unreviewedCount, 1)
})

fixture('a radio target changed to a declaration stays manual through every sibling', RADIOS, (h) => {
  const readFields = () => ['#morning', '#evening'].map((selector) => synthetic(h.detector.extractField(h.control(selector))!, 'evening'))
  const plan = captureReviewedAutofill(readFields(), h.profile, PAGE)
  document.querySelector('label[for="evening"]')!.textContent = 'I certify that the information is true'
  assert.equal(h.execute(plan, { readFields }).filledCount, 0)
  assert.equal(h.control('#evening').checked, false)
})

fixture('a hidden radio target cannot be filled through a still-visible sibling', RADIOS, (h) => {
  const readFields = () => ['#morning', '#evening'].flatMap((selector) => {
    const field = h.detector.extractField(h.control(selector))
    return field ? [synthetic(field, 'evening')] : []
  })
  const plan = captureReviewedAutofill(readFields(), h.profile, PAGE)
  h.control('#evening').style.display = 'none'
  assert.equal(h.execute(plan, { readFields }).filledCount, 0)
  assert.equal(h.control('#evening').checked, false)
})

fixture('focus-created user answer is preserved by the engine without a reviewed callback', EMAIL, (h) => {
  h.control('#email').addEventListener('focus', () => { h.control('#email').value = 'focus-choice@example.test' })
  assert.equal(h.engine.autofillFields(h.readFields()).filledCount, 0)
  assert.equal(h.control('#email').value, 'focus-choice@example.test')
})

console.log(`PASS: ${fixtures} real-DOM reviewed-autofill fixtures; no native application submission in any fixture.`)
