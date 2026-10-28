/** Actual assistant coordinator/panel/DOM engine; only API/session boundaries are stubbed. */
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { AssistantCoordinator } from '../src/content/applicationAssistant/assistantCoordinator'
import { resumesService } from '../src/services/resumesService'
import { applicationSessionManager } from '../src/content/applicationDetection/applicationSession'
import type { UserProfile } from '../src/types'
import { assistantPanelManager } from '../src/content/applicationAssistant/assistantPanel'
import { AutofillCoordinator } from '../src/content/autofill/autofillCoordinator'
import { autofillPanelManager } from '../src/content/autofill/autofillPanel'
import type { AutofillPanelCallbacks } from '../src/content/autofill/autofillPanel'
import { fieldDetector } from '../src/content/autofill/fieldDetector'
import { fieldMatcher } from '../src/content/autofill/fieldMatcher'

const profile: UserProfile = {
  id: 'fixture-profile', userId: 'fixture-user', legalFullName: 'Candidate Name', givenName: 'Candidate', familyName: 'Name',
  email: 'candidate@example.test', phone: '5550101000', skills: ['SQL'], preferredRoles: [], preferredLocations: [],
  preferredJobTypes: [], workStyle: 'REMOTE', onboardingCompleted: true, createdAt: '', updatedAt: '',
}

let checks = 0
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++ }
const field = (id: string, label: string, attributes = '') => `<div><label for="${id}">${label}</label><input id="${id}" ${attributes}></div>`
const email = field('email', 'Email', 'name="email" type="email"')
const panel = '<div id="talvyn-panel" data-talvyn="true"><div id="talvyn-panel-body"></div></div>'
const wait = async (condition: () => boolean, message: string) => {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise<void>((resolve) => setTimeout(resolve, 10))
  assert.ok(condition(), message)
}

async function fixture(markup: string, run: (context: {
  coordinator: AssistantCoordinator; currentProfile: UserProfile; value: (id: string) => string;
  click: () => Promise<void>; review: () => Promise<void>; status: () => string; setAccount: (kind: 'other' | 'disconnected' | 'unavailable' | 'changedProfile') => void;
  delayAuth: () => () => void; submissions: () => number;
}) => Promise<void>, url = 'https://boards.greenhouse.io/acme/jobs/1', panelInForm = false) {
  const dom = new JSDOM(`<form id="application_form">${markup}<button type="submit">Submit application</button>${panelInForm ? panel : ''}</form>${panelInForm ? '' : panel}`, { url })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Event: dom.window.Event, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, HTMLTextAreaElement: dom.window.HTMLTextAreaElement, HTMLSelectElement: dom.window.HTMLSelectElement, MutationObserver: dom.window.MutationObserver, CSS: { escape: (value: string) => value } })
  const previousList = resumesService.list
  const previousSession = applicationSessionManager.createOrUpdateSession
  const currentProfile = structuredClone(profile)
  let user: { id: string; email: string; profile: UserProfile } | null = { id: profile.userId, email: profile.email!, profile: structuredClone(profile) }
  let unavailable = false
  let authDelay: Promise<void> | null = null
  Object.assign(globalThis, { chrome: { runtime: { id: 'a'.repeat(32), sendMessage: async (message: { type: string }) => {
    assert.equal(message.type, 'GET_AUTH', 'Only the existing identity/status message is needed')
    if (authDelay) await authDelay
    if (unavailable) throw new Error('Synthetic worker unavailable')
    return { success: true, authenticated: Boolean(user), user }
  } } } })
  resumesService.list = async () => []
  applicationSessionManager.createOrUpdateSession = async () => ({ id: 'synthetic-session' } as never)
  const coordinator = new AssistantCoordinator()
  let submissions = 0
  document.querySelector('form')!.addEventListener('submit', (event) => { event.preventDefault(); submissions++ })
  try {
    assert.equal(await coordinator.activate(window.location.href, document, currentProfile), true, 'Real coordinator detects fields and renders its real panel')
    await run({
      coordinator, currentProfile, value: (id) => document.getElementById(id) ? (document.getElementById(id) as HTMLInputElement).value : '',
      status: () => document.getElementById('talvyn-assistant-fill-result')?.textContent || '',
      submissions: () => submissions,
      click: async () => {
        const button = document.querySelector<HTMLButtonElement>('#talvyn-assistant-autofill')!
        assert.ok(button && !button.disabled, 'Reviewed safe fields enable the real assistant action')
        button.click()
        await wait(() => Boolean(document.getElementById('talvyn-assistant-fill-result')?.textContent) && document.getElementById('talvyn-assistant-autofill')?.textContent !== 'Checking reviewed fields…', 'Fill action settles with visible result')
      },
      review: async () => {
        document.querySelector<HTMLButtonElement>('#talvyn-assistant-rescan')!.click()
        await wait(() => Boolean(document.querySelector<HTMLDetailsElement>('#talvyn-application-assistant-root details')?.open) && !document.querySelector<HTMLButtonElement>('#talvyn-assistant-rescan')?.disabled, 'Updated preview is ready for review')
      },
      setAccount: (kind) => {
        if (kind === 'other') user = { id: 'other-user', email: 'other@example.test', profile: { ...profile, userId: 'other-user' } }
        else if (kind === 'disconnected') user = null
        else if (kind === 'unavailable') unavailable = true
        else user!.profile = { ...profile, email: 'changed@example.test' }
      },
      delayAuth: () => { let finish!: () => void; authDelay = new Promise<void>((resolve) => { finish = resolve }); return () => { authDelay = null; finish() } },
    })
    check(submissions === 0, 'No assistant action submits the controlled form')
  } finally {
    coordinator.dismiss()
    resumesService.list = previousList
    applicationSessionManager.createOrUpdateSession = previousSession
    dom.window.close()
  }
}

async function main() {
  await fixture(email + field('legal', 'I certify that this full name is accurate and complete', 'name="full_name"'), async ({ value, click, status }) => {
    check(document.getElementById('talvyn-application-assistant-root')!.textContent?.includes('Manual review required'), 'Preview explains the legal manual-review requirement')
    await click()
    check(value('email') === profile.email, 'Safe email fills through actual assistant button')
    check(value('legal') === '', 'Manual-review legal declaration never receives a bulk profile value')
    check(status().includes('1 filled'), 'Result reports actual filled count')
  })
  await fixture(email + field('given', 'First name', 'name="given_name" aria-label="I certify that this is my full name" autocomplete="given-name"') + field('salary', 'Salary expectation', 'name="full_name"') + '<div><label for="essay">Tell us why we should hire you</label><textarea id="essay" name="full_name"></textarea></div>' + field('unknown', 'Favourite book', 'name="book"'), async ({ value, click }) => {
    check(document.querySelectorAll('#talvyn-application-assistant-root li').length === 5, 'Risk fixtures pass through the actual detector into preview')
    await click()
    check(['given', 'salary', 'essay', 'unknown'].every((id) => value(id) === ''), 'Aria-only legal risk, sensitive, open-ended and unknown controls stay manual despite misleading name/autocomplete')
  })
  await fixture(email + field('signature', 'Electronic signature (full name)', 'name="full_name" autocomplete="name"') + field('agree', 'I agree that this information is true', 'name="full_name" type="checkbox"') + field('resume', 'Resume upload', 'name="resume" type="file"'), async ({ value, click }) => {
    await click()
    check(value('signature') === '' && !document.querySelector<HTMLInputElement>('#agree')!.checked && value('resume') === '', 'Signatures, agreements and file controls remain direct user actions')
  })
  await fixture(email, async ({ click, review, value, status }) => {
    document.querySelector('form')!.insertAdjacentHTML('beforeend', field('added', 'First name', 'name="first_name"'))
    await click()
    check(value('added') === '', 'New field is not silently added to the reviewed fill')
    check(status().includes('new fields were not filled'), 'Result explains newly unreviewed controls')
    await review()
    check(document.querySelector<HTMLDetailsElement>('#talvyn-application-assistant-root details')!.open, 'Explicit re-review opens the updated preview')
    await click()
    check(value('added') === profile.givenName, 'New control fills only after updated preview')
  })
  await fixture(email + field('name', 'Full name', 'name="full_name"'), async ({ click, value, status }) => {
    document.querySelector('label[for="name"]')!.textContent = 'I certify that this full name is accurate and complete'
    await click()
    check(value('name') === '', 'Label changed to legal declaration is skipped before write')
    check(status().includes('changed since review'), 'Changed control is reported for renewed review')
  })
  await fixture(email + field('name', 'Full name', 'name="full_name"'), async ({ click, value }) => {
    document.getElementById('name')!.replaceWith(document.getElementById('name')!.cloneNode())
    await click()
    check(value('name') === '', 'Same-ID replacement cannot inherit prior review')
  })
  await fixture(email + field('name', 'Full name', 'name="full_name"'), async ({ click, value }) => {
    document.getElementById('email')!.addEventListener('input', () => { document.querySelector('label[for="name"]')!.textContent = 'I certify that this full name is accurate and complete' })
    await click()
    check(value('email') === profile.email && value('name') === '', 'Live guard catches a later field retargeted synchronously by another fill')
  })
  await fixture(email, async ({ click, value }) => {
    document.getElementById('email')!.addEventListener('focus', () => { (document.getElementById('email') as HTMLInputElement).value = 'user-choice@example.test' })
    await click()
    check(value('email') === 'user-choice@example.test', 'An answer populated by a focus handler is preserved before the native setter')
  })
  await fixture(email + field('name', 'Full name', 'name="full_name"'), async ({ click, value }) => {
    document.getElementById('name')!.addEventListener('focus', () => { document.querySelector('label[for="name"]')!.textContent = 'Electronic signature (full name)' })
    await click()
    check(value('name') === '', 'A declaration introduced by focus is checked at the actual write boundary')
  })
  for (const kind of ['other', 'disconnected', 'unavailable', 'changedProfile'] as const) await fixture(email, async ({ setAccount, click, value, status }) => {
    setAccount(kind); await click()
    check(value('email') === '', `Account/profile boundary blocks ${kind} session state`)
    check(status().includes('0 filled'), `Blocked ${kind} state has visible outcome`)
  })
  await fixture(email, async ({ coordinator, delayAuth, value }) => {
    const finish = delayAuth()
    document.querySelector<HTMLButtonElement>('#talvyn-assistant-autofill')!.click()
    check(document.querySelector<HTMLButtonElement>('#talvyn-assistant-autofill')!.disabled, 'Button prevents duplicate action while identity check is pending')
    coordinator.dismiss(); finish()
    await new Promise<void>((resolve) => setTimeout(resolve, 10))
    check(value('email') === '', 'Dismissed preview cannot authorize a pending fill')
  })
  await fixture(email, async ({ coordinator, currentProfile, setAccount, delayAuth, value }) => {
    const finish = delayAuth()
    document.querySelector<HTMLButtonElement>('#talvyn-assistant-autofill')!.click()
    setAccount('other')
    await coordinator.activate(window.location.href, document, { ...currentProfile, userId: 'other-user' })
    finish()
    await new Promise<void>((resolve) => setTimeout(resolve, 10))
    check(value('email') === '', 'A pending fill cannot cross a new account preview on the same page')
    check(document.getElementById('talvyn-assistant-autofill')?.textContent === 'Fill reviewed profile fields', 'Old completion does not leave the new account action busy')
  })
  await fixture(email, async ({ click, review, value }) => {
    await click()
    const input = document.getElementById('email') as HTMLInputElement
    input.value = 'user-edited@example.test'; input.dispatchEvent(new Event('input', { bubbles: true }))
    await review()
    check(value('email') === 'user-edited@example.test', 'User correction survives re-review')
    input.value = ''; input.dispatchEvent(new Event('change', { bubbles: true }))
    await review()
    await click()
    check(value('email') === '', 'Engine preserves user clear after renewed review and repeated fill')
  }, undefined, true)
  for (const dispatch of [true, false]) await fixture(email.replace('type="email"', 'type="email" value="initial-user-answer@example.test"') + field('name', 'Full name', 'name="full_name"'), async ({ click, review, value }) => {
    const input = document.getElementById('email') as HTMLInputElement
    input.value = ''
    if (dispatch) input.dispatchEvent(new Event('input', { bubbles: true }))
    await review(); await click()
    check(value('email') === '', `Clearing an initially answered field is preserved ${dispatch ? 'with an input event' : 'without an event'}`)
    check(value('name') === profile.legalFullName, 'Another safe reviewed control still fills')
  })
  await fixture(Array.from({ length: 45 }, (_, index) => field(`email${index}`, `Email ${index}`, 'name="email" type="email"')).join(''), async ({ click }) => {
    check(document.querySelectorAll('#talvyn-application-assistant-root li').length === 45, 'Preview lists every field instead of truncating after forty')
    await click()
    check(document.querySelectorAll<HTMLInputElement>('form input').length === 45 && Array.from(document.querySelectorAll<HTMLInputElement>('form input')).every((input) => input.value === profile.email), 'All forty-five filled controls were represented in preview')
  })
  for (const url of ['https://jobs.lever.co/acme/fixture/apply', 'https://acme.myworkdayjobs.com/en-US/job/fixture/apply']) await fixture(email, async ({ click, value }) => {
    await click(); check(value('email') === profile.email, 'Representative ATS adapter fixture fills reviewed safe contact field')
  }, url)
  await fixture(email + field('legal', 'Electronic signature (full name)', 'name="full_name"'), async ({ currentProfile, value }) => {
    const fallback = new AutofillCoordinator()
    const previousRender = autofillPanelManager.render
    let callbacks: AutofillPanelCallbacks | undefined
    // The legacy fallback currently mounts status only. Exercise its real callable
    // coordinator actions by capturing its renderer contract, not by inventing UI.
    autofillPanelManager.render = (_summary, actions) => { callbacks = actions }
    try {
      check(await fallback.activateAutofill(window.location.href, document, currentProfile), 'Fallback coordinator builds its actual reviewed plan')
      await callbacks!.onAutofillAllEligible()
      check(value('email') === profile.email && value('legal') === '', 'Callable fallback all-fields action respects the same risk gate')
      check(fallback.getLastResult()?.filledCount === 1, 'Fallback exposes actual fill result')
      const input = document.getElementById('email') as HTMLInputElement
      input.value = ''; input.dispatchEvent(new Event('change'))
      await callbacks!.onAutofillSingleField(fieldMatcher.matchField(fieldDetector.extractField(input)!, currentProfile))
      check(value('email') === '', 'Callable fallback single-field action never forces a user-cleared answer')
      document.querySelector('form')!.insertAdjacentHTML('beforeend', field('added', 'Full name', 'name="full_name"'))
      const added = document.getElementById('added') as HTMLInputElement
      await callbacks!.onAutofillSingleField(fieldMatcher.matchField(fieldDetector.extractField(added)!, currentProfile))
      check(value('added') === '', 'Fallback single-field argument cannot expand the reviewed plan')
      fallback.dismiss()
      await callbacks!.onAutofillAllEligible()
      check(Boolean(fallback.getLastResult()?.blockedReason), 'Dismissed fallback plan cannot fill from retained callback')
    } finally { fallback.dismiss(); autofillPanelManager.render = previousRender }
  })
  await fixture(email, async () => {
    let renders = 0
    const previous = assistantPanelManager.render
    assistantPanelManager.render = function (...args: Parameters<typeof previous>) { renders++; return previous.apply(this, args) }
    try {
      document.querySelector<HTMLButtonElement>('#talvyn-assistant-rescan')!.click()
      await new Promise<void>((resolve) => setTimeout(resolve, 700))
      check(renders === 1, 'Talvyn panel mutations do not cause a repeated preview refresh loop')
    } finally { assistantPanelManager.render = previous }
  })
  console.log(`PASS: ${checks} actual assistant coordinator/panel/engine checks; API/session and worker identity boundaries stubbed, no live ATS/browser claims.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
