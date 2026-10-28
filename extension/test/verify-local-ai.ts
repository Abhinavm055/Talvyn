import assert from 'node:assert/strict'
import { analyzeLocalJob, DEFAULT_LOCAL_AI_SETTINGS, detectLocalAi, LocalAiSettings, validateLocalAiEndpoint, validateLocalAiSettings } from '../src/services/localAi'

async function main(): Promise<void> {
  const settings: LocalAiSettings = { enabled: true, consent: true, endpoint: 'http://127.0.0.1:11434', model: 'test-local:latest' }
  let requests: { url: string; init?: RequestInit }[] = []
  const model = { name: settings.model, size: 3000000000, details: { format: 'gguf' } }
  const makeFetch = (output: unknown = { summary: 'Develop APIs with Python.', preparation: ['Review the explicit API requirements.'] }): typeof fetch => async (input, init) => {
    requests.push({ url: String(input), init })
    return new Response(JSON.stringify(String(input).endsWith('/api/tags') ? { models: [model] } : { done: true, response: JSON.stringify(output) }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const noNetwork: typeof fetch = async () => { throw new Error('A disabled service must never fetch') }
  const disabled = await analyzeLocalJob({ description: 'A job description' }, DEFAULT_LOCAL_AI_SETTINGS, { fetch: noNetwork })
  assert.equal(disabled.success, false)
  assert.match(disabled.reason!, /disabled/)
  assert.equal((await detectLocalAi({ ...settings, consent: false }, { fetch: noNetwork })).available, false)
  for (const endpoint of ['https://api.x.ai', 'https://ollama.com', 'http://localhost.evil.test:11434', 'http://127.0.0.2:11434', 'http://localhost:11434/api', 'http://user:password@localhost:11434', 'http://localhost:11434/?key=private', 'http://localhost:11434/#fragment', 'file:///tmp/ollama']) assert.equal(validateLocalAiEndpoint(endpoint), null, endpoint)
  assert.equal(validateLocalAiEndpoint(settings.endpoint), settings.endpoint)
  assert.equal(validateLocalAiSettings({ ...settings, model: 'gpt:cloud' }), null)
  assert.equal(validateLocalAiSettings({ ...settings, model: '../anything?token=secret' }), null)
  assert.equal(validateLocalAiSettings({ ...settings, enabled: true, consent: false }), null)

  const result = await analyzeLocalJob({ title: 'API Engineer', company: 'Example', description: 'Python API development is required.', requirements: ['Python is required'], profile: { email: 'private-profile@example.test' }, token: 'never-send-this-token', pageHtml: '<input value="private">' } as Parameters<typeof analyzeLocalJob>[0], settings, { fetch: makeFetch() })
  assert.equal(result.success, true)
  assert.equal(result.source, 'local-ai')
  assert.deepEqual(result.preparation, ['Review the explicit API requirements.'])
  assert.equal(requests.length, 2)
  assert.equal(requests[0].url, `${settings.endpoint}/api/tags`)
  assert.equal(requests[1].url, `${settings.endpoint}/api/generate`)
  const body = JSON.parse(String(requests[1].init?.body))
  assert.equal(body.model, settings.model)
  assert.equal(body.stream, false)
  assert.equal(body.format, 'json')
  assert.equal(body.options.temperature, 0)
  assert.equal(requests[1].init?.redirect, 'error')
  assert.equal(requests[1].init?.credentials, 'omit')
  assert.ok(!String(requests[1].init?.body).includes('private-profile') && !String(requests[1].init?.body).includes('never-send-this-token') && !String(requests[1].init?.body).includes('pageHtml'))

  for (const output of [{ summary: 'An invented score', preparation: [], score: 100 }, { summary: '', preparation: [] }, { summary: 'x'.repeat(1201), preparation: [] }, { summary: 'Text', preparation: Array(6).fill('Advice') }, { summary: 'Text', preparation: [false] }, { summary: 'Text', preparation: ['x'.repeat(241)] }]) {
    const invalid = await analyzeLocalJob({ description: 'Explicit job details' }, settings, { fetch: makeFetch(output) })
    assert.equal(invalid.success, false)
    assert.match(invalid.reason!, /Deterministic analysis remains available/)
  }
  const absent = await detectLocalAi(settings, { fetch: async () => new Response(JSON.stringify({ models: [] })) })
  assert.equal(absent.available, false)
  assert.match(absent.reason!, /not downloaded/)
  const remoteModel = await detectLocalAi(settings, { fetch: async () => new Response(JSON.stringify({ models: [{ ...model, remote_host: 'ollama.com' }] })) })
  assert.equal(remoteModel.available, false)
  const stubModel = await detectLocalAi(settings, { fetch: async () => new Response(JSON.stringify({ models: [{ ...model, size: 500 }] })) })
  assert.equal(stubModel.available, false)
  const timedOut = await detectLocalAi(settings, { timeoutMs: 10, fetch: async (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))) })
  assert.equal(timedOut.available, false)
  assert.match(timedOut.reason!, /timed out/)
  const tooLarge = await detectLocalAi(settings, { fetch: async () => new Response(' '.repeat(262145)) })
  assert.equal(tooLarge.available, false)
  assert.match(tooLarge.reason!, /too large/)
  requests = []
  const missingText = await analyzeLocalJob({ title: 'Developer' }, settings, { fetch: makeFetch() })
  assert.equal(missingText.success, false)
  assert.equal(requests.length, 0)
  console.log('PASS: local AI consent, loopback privacy, downloaded-model detection, JSON validation, timeout, size limits, and deterministic fallback.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
