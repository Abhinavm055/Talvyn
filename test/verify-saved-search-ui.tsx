/** Real React controls in JSDOM; API adapters stubbed, no external account/browser. */
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import type { JobSearchFilters, SavedSearch } from '../server/contracts/jobSearch'
import { DEFAULT_JOB_SEARCH_FILTERS } from '../server/contracts/jobSearch'

async function main() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/jobs' })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
  // Match the CJS condition used by tsx for this repository's source imports;
  // mixing ESM/CJS React Query providers would create separate contexts.
  const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
  const { MemoryRouter } = require('react-router-dom') as typeof import('react-router-dom')
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query') as typeof import('@tanstack/react-query')
  const { default: JobList } = require('../src/pages/jobs/JobList') as typeof import('../src/pages/jobs/JobList')
  const { savedSearchesApi } = require('../src/api/savedSearches') as typeof import('../src/api/savedSearches')
  const { jobsApi } = require('../src/api/jobs') as typeof import('../src/api/jobs')
  const { useAuthStore } = require('../src/store/authStore') as typeof import('../src/store/authStore')
  const records = new Map<string, SavedSearch[]>()
  const requests: Record<string, unknown>[] = []
  const writes: { kind: string; data?: unknown }[] = []
  let savedFailure = false, jobFailure = false, delayCreate = false
  let finishCreate: (() => void) | undefined
  const owner = () => useAuthStore.getState().user!.id
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
  const makeRecord = (name: string, filters: JobSearchFilters): SavedSearch => ({ id: `search-${writes.length}`, name: name.trim(), filters: clone(filters), createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z' })
  savedSearchesApi.list = async () => { if (savedFailure) throw new Error('Synthetic saved search outage'); return clone(records.get(owner()) || []) }
  savedSearchesApi.create = async (data) => {
    const userId = owner(), existing = records.get(userId) || []
    writes.push({ kind: 'create', data: clone(data) })
    if (existing.some((item) => item.name.toLowerCase() === data.name.trim().toLowerCase())) throw Object.assign(new Error('Duplicate'), { isAxiosError: true, response: { status: 409, data: { error: 'A saved search with this name already exists.' } } })
    const record = makeRecord(data.name, data.filters)
    if (delayCreate) await new Promise<void>((resolve) => { finishCreate = resolve })
    records.set(userId, [...existing, record]); return clone(record)
  }
  savedSearchesApi.update = async (id, data) => {
    writes.push({ kind: 'update', data: clone(data) })
    const items = records.get(owner()) || [], index = items.findIndex((item) => item.id === id)
    assert.ok(index >= 0)
    items[index] = { ...items[index], ...clone(data) }; records.set(owner(), items)
    return clone(items[index])
  }
  savedSearchesApi.delete = async (id) => { writes.push({ kind: 'delete' }); records.set(owner(), (records.get(owner()) || []).filter((item) => item.id !== id)) }
  jobsApi.list = async (params = {}) => {
    requests.push({ ...params })
    if (jobFailure) throw new Error('Synthetic jobs outage')
    return { jobs: [], total: Object.keys(params).some((key) => !['page', 'limit'].includes(key)) ? 0 : 101, page: params.page || 1, limit: params.limit || 50 }
  }
  let jobDeletes = 0
  jobsApi.delete = async () => { jobDeletes++; throw new Error('Saved-search UI must not delete jobs') }
  useAuthStore.getState().setAuth({ id: 'owner-a', email: 'owner-a@example.test', profile: null })
  const clients: InstanceType<typeof QueryClient>[] = []
  const container = document.getElementById('root')!
  let root = createRoot(container)
  let client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const render = async () => {
    clients.push(client)
    await act(async () => { root.render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><JobList /></MemoryRouter></QueryClientProvider>) })
  }
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 10))
  const wait = async (condition: () => unknown, label: string) => {
    for (let i = 0; i < 100 && !condition(); i++) await act(async () => { await pause() })
    assert.ok(condition(), label)
  }
  let checks = 0
  const check = (value: unknown, label: string) => { assert.ok(value, label); checks++ }
  const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent === text)!
  const click = async (text: string) => { const node = button(text); assert.ok(node, `Button exists: ${text}`); await act(async () => { node.click(); await pause() }) }
  const setValue = async (selector: string, value: string) => {
    const node = container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!
    assert.ok(node, `Control exists: ${selector}`)
    await act(async () => {
      const prototype = node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value)
      node.dispatchEvent(new dom.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
      await pause()
    })
  }
  const submit = async (label: string) => { await act(async () => { container.querySelector<HTMLFormElement>(`form[aria-label="${label}"]`)!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await pause() }) }
  try {
    await render(); await wait(() => Boolean(button('Next page')) && !container.textContent?.includes('Loading saved searches'), 'Initial list loaded')
    check(container.textContent?.includes('Return to filters for jobs already saved'), 'Scope is existing account jobs')
    await click('Next page'); await wait(() => requests.at(-1)?.page === 2, 'Pagination requests page 2'); checks++
    await setValue('#job-filter-company', 'Acme'); await wait(() => requests.at(-1)?.company === 'Acme' && requests.at(-1)?.page === 1, 'Filter resets page'); checks++
    await setValue('#job-filter-location', 'Pune')
    await setValue('[aria-label="Job type"]', 'CONTRACT')
    await setValue('[aria-label="Search saved jobs"]', 'backend')
    await click('Applied')
    await click('Save as new search'); await setValue('#saved-search-name', 'Backend roles'); await submit('Save search')
    await wait(() => container.textContent?.includes('Search saved.'), 'Save feedback')
    const original = records.get('owner-a')![0]
    check(original.filters.company === 'Acme' && original.filters.location === 'Pune' && original.filters.search === 'backend' && original.filters.status === 'APPLIED' && original.filters.jobType === 'CONTRACT', 'All criteria persisted by UI')
    await click('Clear filters'); check(Boolean(button('Update filters')) && !button('Update filters').disabled, 'Unsaved filter changes are visible')
    await click('Apply saved search'); await wait(() => requests.at(-1)?.location === 'Pune' && requests.at(-1)?.status === 'APPLIED', 'Saved criteria applied through jobs API'); checks++
    await setValue('#job-filter-location', 'Remote'); await click('Update filters')
    await wait(() => records.get('owner-a')![0].filters.location === 'Remote', 'Update criteria persisted'); checks++
    await click('Rename'); await setValue('#saved-search-name', 'Remote backend'); await submit('Rename saved search')
    await wait(() => records.get('owner-a')![0].name === 'Remote backend', 'Rename persisted')
    check(records.get('owner-a')![0].filters.location === 'Remote', 'Rename preserves filters')
    await click('Save as new search'); await setValue('#saved-search-name', 'Remote backend'); await submit('Save search')
    await wait(() => container.textContent?.includes('A saved search with this name already exists.'), 'Conflict shown without false success'); checks++
    await click('Cancel')
    await click('Delete search'); await click('Cancel delete'); check(records.get('owner-a')!.length === 1, 'Deletion can be cancelled')
    await click('Delete search'); await click('Confirm delete search')
    await wait(() => container.textContent?.includes('Your jobs are unchanged.'), 'Deletion feedback')
    check(records.get('owner-a')!.length === 0 && jobDeletes === 0, 'Delete search never deletes jobs')
    await click('Save as new search'); await setValue('#saved-search-name', 'Survives refresh'); await submit('Save search')
    await wait(() => records.get('owner-a')!.length === 1, 'Saved before remount')
    await act(async () => { root.unmount() }); client.clear()
    root = createRoot(container); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    await render(); await wait(() => container.textContent?.includes('Survives refresh'), 'Saved searches restored after fresh component/client'); checks++
    savedFailure = true; await act(async () => { await client.invalidateQueries({ queryKey: ['saved-searches'] }) })
    await wait(() => container.textContent?.includes('Saved searches could not be loaded.'), 'Saved-load error shown'); checks++
    savedFailure = false; await click('Retry saved searches'); await wait(() => !container.textContent?.includes('Saved searches could not be loaded.'), 'Retry saved searches succeeds'); checks++
    jobFailure = true; await act(async () => { await client.invalidateQueries({ queryKey: ['jobs'] }) })
    await wait(() => container.textContent?.includes('Your jobs could not be loaded.'), 'Job error not disguised as empty results'); checks++
    jobFailure = false; await click('Retry jobs'); await wait(() => !container.textContent?.includes('Your jobs could not be loaded.'), 'Retry jobs succeeds'); checks++
    delayCreate = true; await click('Save as new search'); await setValue('#saved-search-name', 'Old account pending'); await submit('Save search')
    await wait(() => Boolean(finishCreate), 'In-flight mutation captured')
    await act(async () => { useAuthStore.getState().setAuth({ id: 'owner-b', email: 'owner-b@example.test', profile: null }); await pause() })
    await act(async () => { finishCreate!(); await pause() })
    await wait(() => !container.textContent?.includes('Loading saved searches'), 'New account loaded')
    check(!container.textContent?.includes('Old account pending') && !container.textContent?.includes('Survives refresh'), 'Old account mutation/list cannot appear after account switch')
    check((container.querySelector('#job-filter-location') as HTMLInputElement).value === '', 'Account switch resets preference controls')
    check(!container.textContent?.includes('Search saved.'), 'Stale success cannot appear for new account')
    console.log(`PASS: ${checks} actual React saved-search checks (API adapters stubbed): create/apply/update/rename/delete, filters/pagination, errors/retries, remount and account-switch race.`)
  } finally {
    await act(async () => { root.unmount() })
    clients.forEach((item) => item.clear())
    dom.window.close()
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
