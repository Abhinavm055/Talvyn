import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { ExtractedJob, UserProfile } from '../src/types'
import { enrichJobFacts, prepareJobGuidance } from '../src/content/jobIntelligence'
import { normalizeJob } from '../src/content/jobNormalizer'
import { fieldDetector } from '../src/content/autofill/fieldDetector'
import { fieldMatcher } from '../src/content/autofill/fieldMatcher'
import { autofillEngine } from '../src/content/autofill/autofillEngine'
import { formAnalyzer } from '../src/content/applicationAssistant/formAnalyzer'
import { assistantPanelManager } from '../src/content/applicationAssistant/assistantPanel'
import { getTalvynElement, injectPanel, removePanel } from '../src/content/panel'
import { ApplicationSessionManager } from '../src/content/applicationDetection/applicationSession'

async function main(): Promise<void> {
  const profile: UserProfile = { id: 'profile', userId: 'user', givenName: 'Verified', familyName: 'Candidate', email: 'verified@example.test', phone: null, preferredRoles: ['Backend Developer'], skills: ['Python'], otherLinks: [], preferredLocations: [], preferredJobTypes: [], experienceYears: null, workStyle: 'ANY', onboardingCompleted: true }
  const job: ExtractedJob = { title: 'Backend Developer', company: 'Example', description: 'Required skills:\nPython and SQL\nPreferred skills:\nDocker\nEligibility criteria:\nMust have a valid work permit\nResponsibilities:\nDevelop APIs.\nApplication deadline: 30 October 2026', sourceWebsite: 'Example', jobUrl: 'https://jobs.example.test/developer', confidence: 'MEDIUM', responsibilities: ['Develop APIs'], extractedAt: '2026-10-14T00:00:00.000Z', extractionMethod: 'Generic' }
  const facts = enrichJobFacts(job)
  assert.deepEqual(facts.requiredSkills, ['Python', 'SQL'])
  assert.deepEqual(facts.preferredSkills, ['Docker'])
  assert.ok(facts.eligibility?.includes('Must have a valid work permit'))
  assert.match(facts.deadline!, /30 October 2026/)
  assert.equal(facts.experience, undefined)
  assert.equal(facts.education, undefined)
  assert.deepEqual(enrichJobFacts({ ...job, description: undefined, requirements: undefined }).requiredSkills, [])
  assert.deepEqual(enrichJobFacts({ ...job, description: 'Our teams use React and Python.', requirements: undefined }).requiredSkills, [])
  const guidance = prepareJobGuidance(facts, profile)
  assert.deepEqual(guidance.matchedRequiredSkills, ['Python'])
  assert.deepEqual(guidance.missingRequiredSkills, ['SQL'])
  assert.deepEqual(guidance.missingPreferredSkills, ['Docker'])
  assert.equal(normalizeJob(job, profile).matchScore, normalizeJob(facts, profile).matchScore, 'Additional guidance leaves the official score unchanged')
  const normalized = normalizeJob(facts, profile).normalized
  assert.equal(normalized.confidence, facts.confidence)
  assert.equal(normalized.extractedAt, facts.extractedAt)
  assert.deepEqual(normalized.responsibilities, facts.responsibilities)
  assert.deepEqual(normalized.requiredSkills, facts.requiredSkills)
  const dom = new JSDOM('<form><label>First name<input name="first_name" autocomplete="given-name" required></label><label>Email<input name="email" type="email" value="already@example.test"></label><label>Current job title<input name="current_job_title"></label><label>Work authorization<input name="work_authorization"></label><label>Expected salary<input name="expected_salary"></label><label>Why should we hire you?<textarea name="why_hire"></textarea></label><select name="ambiguous"><option value="">Select</option><option value="Canada">Canada</option><option value="CA">CA</option></select><button type="submit">Submit</button></form>', { url: job.jobUrl })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, HTMLTextAreaElement: dom.window.HTMLTextAreaElement, HTMLSelectElement: dom.window.HTMLSelectElement, Event: dom.window.Event, CSS: { escape: (value: string) => value }, MutationObserver: dom.window.MutationObserver })
  const form = dom.window.document.querySelector('form')!
  // jsdom has no layout; make fields visibly eligible for the actual detector.
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 100, height: 20, top: 0, left: 0, bottom: 20, right: 100, x: 0, y: 0, toJSON: () => ({}) })
  const fields = fieldDetector.detectFields(form)
  const matched = fields.map((field) => fieldMatcher.matchField(field, profile))
  const firstName = matched.find((field) => field.detectedType === 'firstName')!
  assert.ok(firstName && firstName.canAutofill)
  const title = matched.find((field) => field.detectedType === 'currentJobTitle')!
  assert.equal(title?.valueToFill, null, 'Preferred role is not fabricated as current employment')
  const authorization = matched.find((field) => field.detectedType === 'workAuthorization')!
  assert.equal(authorization?.valueToFill, null)
  assert.equal(authorization?.canAutofill, false)
  assert.equal(authorization?.requiresReview, true)
  const salary = matched.find((field) => field.detectedType === 'expectedSalary')!
  assert.equal(salary?.canAutofill, false)
  assert.equal(salary?.requiresReview, true)
  let submissions = 0
  form.addEventListener('submit', (event) => { event.preventDefault(); submissions++ })
  const result = autofillEngine.autofillFields(matched, false)
  assert.ok(result.filledCount >= 1)
  assert.equal(dom.window.document.querySelector<HTMLInputElement>('[name="first_name"]')?.value, 'Verified')
  assert.equal(dom.window.document.querySelector<HTMLInputElement>('[name="email"]')?.value, 'already@example.test', 'User input is preserved')
  assert.equal(dom.window.document.querySelector<HTMLInputElement>('[name="work_authorization"]')?.value, '')
  assert.equal(dom.window.document.querySelector('textarea')?.value, '')
  assert.equal(submissions, 0)
  const select = dom.window.document.querySelector('select')!
  assert.equal(autofillEngine.fillSingleField(select, 'Can', 'select'), false, 'Partial choice does not invent a dropdown answer')
  assert.equal(select.value, '')
  assert.equal(autofillEngine.fillSingleField(select, 'CA', 'select'), true)
  assert.equal(select.value, 'CA')
  const forgedSensitive = { ...firstName, isSensitive: true, canAutofill: true, valueToFill: 'Unsafe overwrite' }
  assert.equal(autofillEngine.autofillFields([forgedSensitive], true).filledCount, 0, 'Engine itself guards sensitive metadata')
  const analyzed = formAnalyzer.analyzeFields(fields, profile)
  assert.equal(analyzed.find((field) => field.field.name === 'work_authorization')?.riskLevel, 'USER_ACTION_REQUIRED')
  injectPanel(normalized, () => {}, () => {}, () => {}, { userProfile: profile, normalization: normalizeJob(facts, profile) })
  let fillClicks = 0
  const assistantSession = { id: 'assistant', jobTitle: job.title, company: job.company, jobUrl: job.jobUrl, state: 'IN_PROGRESS' as const, startedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), progress: formAnalyzer.calculateProgress(analyzed), fields: analyzed, highRiskQuestions: analyzed.filter((field) => field.riskLevel === 'USER_ACTION_REQUIRED'), missingRequiredCount: 1, selectedResumeId: null }
  // An eligible unfilled mapping proves the control is usable, without automatically filling.
  assistantSession.fields[0] = { ...assistantSession.fields[0], isFilled: false, suggestedValue: 'Verified', riskLevel: 'SAFE_AUTOFILL' }
  assistantPanelManager.render(assistantSession, null, [], { onAutofill: () => { fillClicks++ }, onSelectResume: () => {}, onDismiss: () => {} })
  const mainPanel = getTalvynElement('talvyn-panel')!
  assert.ok(mainPanel.querySelector('#talvyn-application-assistant-root'))
  assert.equal(dom.window.document.querySelector('#talvyn-application-assistant-root'), null, 'Assistant stays inside the existing shadow panel')
  assert.ok(mainPanel.querySelector('#talvyn-assistant-autofill'))
  mainPanel.querySelector<HTMLButtonElement>('#talvyn-assistant-autofill')?.click()
  assert.equal(fillClicks, 1)
  assert.equal(submissions, 0)
  assert.ok(!mainPanel.textContent?.includes('Status: IN_PROGRESS'), 'Form discovery does not fabricate tracker status')
  removePanel()

  let storedSession: object | null = null
  const actions: string[] = []
  Object.assign(globalThis, { chrome: { runtime: { id: 'test-extension', lastError: null, sendMessage: (message: { type: string; action: string; session?: object }, callback: (result: object) => void) => { assert.equal(message.type, 'TALVYN_APPLICATION_SESSION'); actions.push(message.action); if (message.action === 'set') storedSession = message.session || null; if (message.action === 'clear') storedSession = null; callback({ success: true, session: storedSession }) } }, storage: { local: { get: () => { throw new Error('Content must not read credential storage') }, set: () => { throw new Error('Content must not write credential storage') } } } } })
  const manager = new ApplicationSessionManager()
  await manager.createOrUpdateSession({ pageUrl: job.jobUrl, jobTitle: job.title, company: job.company })
  const restored = await new ApplicationSessionManager().getActiveSession()
  assert.equal(restored?.jobTitle, job.title)
  await manager.recordSubmission()
  assert.equal((await new ApplicationSessionManager().getActiveSession())?.submitted, true)
  storedSession = null
  assert.equal(await manager.getActiveSession(), null, 'Account-switch worker cleanup cannot resurrect a cached application')
  await manager.createOrUpdateSession({ pageUrl: job.jobUrl, jobTitle: job.title, company: job.company, submitted: true })
  const nextJobSession = await manager.createOrUpdateSession({ pageUrl: 'https://jobs.example.test/other', jobTitle: 'Different Developer', company: 'Other' })
  assert.equal(nextJobSession.submitted, false, 'A different application cannot inherit the previous submission confirmation')
  await manager.clearSession()
  assert.equal(storedSession, null)
  assert.ok(actions.includes('get') && actions.includes('set') && actions.includes('clear'))
  dom.window.close()
  console.log('PASS: explicit job facts, unknowns, unchanged official score, verified autofill, existing-answer/sensitive guards, single-panel controls, and worker session restoration.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
