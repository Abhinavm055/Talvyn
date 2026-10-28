import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import fs from 'node:fs'
import path from 'node:path'
import { AutofillEngine } from '../src/content/autofill/autofillEngine'
import type { MatchedFormField } from '../src/types'

const dom = new JSDOM('<form><input id="name"><textarea id="bio"></textarea><select id="choice"><option value="">Choose</option><option value="A">A</option><option value="B">B</option></select><input id="check" type="checkbox"><input id="yes" type="radio" name="answer" value="yes"><input id="no" type="radio" name="answer" value="no"><button type="submit">Submit</button></form>')
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Event: dom.window.Event, CSS: { escape: (value: string) => value } })
const engine = new AutofillEngine()
let checks = 0, submissions = 0
document.querySelector('form')!.addEventListener('submit', (event) => { event.preventDefault(); submissions++ })
function match(selector: string, value: string | boolean): MatchedFormField {
  const element = document.querySelector<HTMLElement>(selector)!
  return { field: { id: selector, element, selector, tag: element.tagName.toLowerCase() as 'input' | 'textarea' | 'select', inputType: (element as HTMLInputElement).type || '', name: '', domId: selector, label: '', placeholder: '', ariaLabel: '', autocomplete: '', nearbyText: '', options: [], currentValue: '', isRequired: false, isIgnored: false }, detectedType: 'firstName', confidence: 100, confidenceLevel: 'HIGH', matchedProfileField: 'givenName', valueToFill: value, reason: 'Synthetic direct profile fixture', canAutofill: true, isCustomQuestion: false, isResumeUpload: false }
}
function fill(field: MatchedFormField, expected: number, label: string, force = false) {
  assert.equal(engine.autofillFields([field], force).filledCount, expected, label); checks++
}
try {
  const name = match('#name', 'Profile name'), input = name.field.element as HTMLInputElement
  fill(name, 1, 'Initial empty field fills')
  name.valueToFill = 'Updated profile'
  fill(name, 1, 'Own synthetic events do not prevent updating an unedited fill')
  input.value = 'User correction'; input.dispatchEvent(new Event('input', { bubbles: true }))
  fill(name, 0, 'Edit after fill is preserved')
  assert.equal(input.value, 'User correction'); checks++
  input.value = ''; input.dispatchEvent(new Event('change', { bubbles: true }))
  fill(name, 0, 'User-cleared answer remains empty')
  fill(name, 1, 'Explicit force remains supported for nonsensitive fields', true)
  input.value = 'Silent edit'
  fill(name, 0, 'Live snapshot catches edits without input/change events')
  input.value = ''; fill(name, 0, 'Silent clear is also preserved')
  input.value = 'Typed before this engine'; input.setAttribute('data-talvyn-autofilled', 'true')
  assert.equal(new AutofillEngine().autofillFields([name]).filledCount, 0, 'Page/old marker cannot grant overwrite ownership'); checks++
  const bio = match('#bio', 'Profile bio'), textarea = bio.field.element as HTMLTextAreaElement
  fill(bio, 1, 'Textarea fills'); textarea.value = 'Edited bio'; textarea.dispatchEvent(new Event('change'))
  fill(bio, 0, 'Textarea edits preserved')
  const choice = match('#choice', 'A'), select = choice.field.element as HTMLSelectElement
  fill(choice, 1, 'Select fills'); select.value = 'B'; select.dispatchEvent(new Event('change'))
  fill(choice, 0, 'Select edits preserved')
  const checkbox = match('#check', true), check = checkbox.field.element as HTMLInputElement
  fill(checkbox, 1, 'Unchecked checkbox can fill'); check.checked = false; check.dispatchEvent(new Event('change'))
  fill(checkbox, 0, 'User-unchecked checkbox remains unchecked')
  const radio = match('#yes', 'yes'), no = document.querySelector<HTMLInputElement>('#no')!
  fill(radio, 1, 'Unanswered radio group can fill'); no.checked = true; no.dispatchEvent(new Event('change'))
  fill(radio, 0, 'Changing another radio preserves the group answer')
  assert.equal(no.checked, true); checks++
  document.body.insertAdjacentHTML('beforeend', '<form><input id="other-radio" type="radio" name="answer" value="other" checked></form>')
  fill(radio, 1, 'Explicit fill uses only the field\'s own form group', true)
  assert.equal(document.querySelector<HTMLInputElement>('#other-radio')!.checked, true, 'Another form answer is untouched'); checks++
  document.body.insertAdjacentHTML('beforeend', '<form id="associated"><input id="associated-yes" type="radio" name="associated-answer" value="yes"></form><input id="associated-no" type="radio" name="associated-answer" value="no" form="associated" checked>')
  fill(match('#associated-yes', 'yes'), 0, 'Existing externally associated radio answer is preserved')
  assert.equal(document.querySelector<HTMLInputElement>('#associated-no')!.checked, true); checks++
  const sensitive = { ...name, isSensitive: true, valueToFill: 'Must not fill' }
  fill(sensitive, 0, 'Force never bypasses sensitive guard', true)
  assert.equal(submissions, 0); checks++
  const coordinator = fs.readFileSync(path.resolve(__dirname, '../src/content/autofill/autofillCoordinator.ts'), 'utf8')
  assert.ok(coordinator.includes('executeReviewedAutofill(plan,') && !coordinator.includes('autofillFields([field], true)'), 'Single-field action uses the reviewed non-forcing execution path'); checks++
  console.log(`PASS: ${checks} actual-engine checks for edits, clears, selects, checkbox/radio groups, private ownership and no submission.`)
} finally { dom.window.close() }
