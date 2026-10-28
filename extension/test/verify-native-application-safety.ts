import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { inspectNativeApplicationAction } from '../src/content/nativeApplicationAction'

const fixtures = [
  '<button aria-label="apply now">Apply</button>',
  '<button type="submit" class="apply">Apply</button>',
  '<input type="submit" value="Register">',
  '<button type="button" class="register">Register</button>',
  '<button type="button" aria-label="easy apply">Open modal</button>',
  '<div role="button" class="apply-button">Apply</div>',
  '<a aria-label="apply" href="javascript:window.unsafe=true">Apply</a>',
  '<a class="apply" href="#application">Open form</a>',
]
let checks = 0
for (const fixture of fixtures) {
  const dom = new JSDOM(`<form>${fixture}</form>`, { url: 'https://example.test/job' })
  let clicks = 0, submits = 0
  const doc = dom.window.document
  doc.addEventListener('click', () => { clicks++ })
  doc.querySelector('form')!.addEventListener('submit', (event) => { event.preventDefault(); submits++ })
  const result = inspectNativeApplicationAction(doc)
  assert.equal(result.kind, 'manual', fixture)
  assert.equal(clicks, 0); assert.equal(submits, 0)
  // Explicit site interaction remains the user's action, not a simulated Talvyn event.
  if (fixture.includes('type="submit"')) {
    const control = doc.querySelector<HTMLButtonElement>('button, input')!
    control.click(); assert.equal(submits, 1)
  }
  checks++; dom.window.close()
}
for (const href of ['https://careers.example.test/apply/1', '/apply/1']) {
  const dom = new JSDOM(`<a aria-label="apply" href="${href}">Apply</a>`, { url: 'https://example.test/job' })
  const action = inspectNativeApplicationAction(dom.window.document)
  assert.equal(action.kind, 'navigate')
  if (action.kind === 'navigate') assert.equal(action.url, new URL(href, dom.window.document.URL).href)
  checks++; dom.window.close()
}
const empty = new JSDOM('<p>No application control</p>', { url: 'https://example.test/job' })
assert.equal(inspectNativeApplicationAction(empty.window.document).kind, 'none'); checks++; empty.window.close()
const coordinator = fs.readFileSync(path.resolve(__dirname, '../src/content/index.ts'), 'utf8')
assert.ok(coordinator.includes('inspectNativeApplicationAction(doc)'), 'Actual coordinator uses tested native-control inspection')
assert.ok(!/nativeApplyBtn\.(?:click|dispatchEvent)\s*\(/.test(coordinator), 'Old native activation path is absent')
checks++
console.log(`PASS: ${checks} native Apply/Register checks; inspection never activates controlled forms, valid navigation preserved.`)
