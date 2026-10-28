/** Actual React controls with stubbed transport in JSDOM; no Chrome install/update is claimed. */
import assert from 'node:assert/strict'
import React, { act } from 'react'
import { JSDOM } from 'jsdom'
import type { ReleaseAvailability, PublishedExtensionRelease } from '../src/types/release'
import type { ExtensionStatus } from '../src/utils/extensionBridge'

async function main() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/extensions' })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
  // Keep the React/provider module condition identical to the repository source under tsx.
  const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
  const { MemoryRouter } = require('react-router-dom') as typeof import('react-router-dom')
  const { releaseClient } = require('../src/api/extensionRelease') as typeof import('../src/api/extensionRelease')
  const { extensionBridge } = require('../src/utils/extensionBridge') as typeof import('../src/utils/extensionBridge')
  const { default: Extensions } = require('../src/pages/extensions/Extensions') as typeof import('../src/pages/extensions/Extensions')
  const { default: ReleaseNotes } = require('../src/pages/releases/ReleaseNotes') as typeof import('../src/pages/releases/ReleaseNotes')
  const { ExtensionUpdateNotice } = require('../src/components/layout/ExtensionUpdateNotice') as typeof import('../src/components/layout/ExtensionUpdateNotice')
  const repository = 'example-owner/talvyn-fixture'
  const published = (version = '1.3.0'): PublishedExtensionRelease => ({
    schemaVersion: 1, distribution: 'github', repository, version, publishedAt: '2026-10-24T00:00:00.000Z',
    downloadUrl: `https://github.com/${repository}/releases/download/v${version}/talvyn-extension.zip`, sha256: 'a'.repeat(64),
    releaseNotesUrl: `https://github.com/${repository}/releases/tag/v${version}`, title: 'Synthetic release for UI tests',
    changes: ['Reviewed autofill fixture', 'Same-folder manual update fixture'], extensionId: 'a'.repeat(32),
  })
  const available = (version = '1.3.0'): ReleaseAvailability => ({ status: 'published', release: published(version) })
  const absent: ReleaseAvailability = { status: 'not-published', repository }
  const notInstalled: ExtensionStatus = { state: 'not-installed', installed: false, message: 'Talvyn is not installed or is disabled in this browser.' }
  const installed = (version: string, connected = false): ExtensionStatus => ({ state: connected ? 'connected' : 'disconnected', installed: true, version, message: connected ? 'Connected to synthetic@example.test.' : 'Talvyn is installed. Connect your account.', ...(connected ? { user: { id: 'synthetic-user', email: 'synthetic@example.test' } } : {}) })
  let load = async (_options?: { signal?: AbortSignal }): Promise<ReleaseAvailability> => available()
  let detect = async (): Promise<ExtensionStatus> => notInstalled
  const originalLoad = releaseClient.load, originalDetect = extensionBridge.detect
  const clientProperties = { releasesUrl: releaseClient.releasesUrl, repository: releaseClient.repository, localBuildVersion: releaseClient.localBuildVersion }
  Object.assign(releaseClient, { releasesUrl: `https://github.com/${repository}/releases`, repository, localBuildVersion: '1.4.0' })
  releaseClient.load = (options) => load(options)
  extensionBridge.detect = () => detect()
  const container = document.getElementById('root')!
  let root = createRoot(container)
  let checks = 0
  const check = (condition: unknown, label: string) => { assert.ok(condition, label); checks++ }
  const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 5))
  const wait = async (condition: () => unknown, label: string) => {
    for (let index = 0; index < 100 && !condition(); index++) await act(async () => { await pause() })
    assert.ok(condition(), label)
  }
  const text = () => container.textContent || ''
  const link = (label: string) => Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find((node) => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)
  const button = (label: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((node) => node.textContent?.trim() === label || node.getAttribute('aria-label') === label)
  const mount = async (element: React.ReactNode) => {
    await act(async () => { root.unmount() })
    root = createRoot(container)
    await act(async () => { root.render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{element}</MemoryRouter>); await pause() })
  }
  const click = async (label: string) => { const node = button(label); assert.ok(node, `${label} button exists`); await act(async () => { node.click(); await pause() }) }
  const focus = async () => { await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); await pause() }) }
  const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done }); return { promise, resolve } }
  try {
    load = async () => absent
    await mount(<Extensions />)
    await wait(() => text().includes('The Talvyn extension download is not available yet.'), 'Clear missing release message displayed')
    check(text().includes('No GitHub release has been published yet'), 'Confirmed missing release detailed explanation present')
    check(!link('Download Talvyn for Chrome') && !link('Download Talvyn Extension') && !text().includes('Store publication pending'), 'No invented download or Chrome Web Store dependency for an unpublished release')
    check(text().includes('npm run package:extension') && text().includes('extension/dist'), 'Owner local-build path is available without pretending it is published')
    check(text().includes('chrome://extensions/') && text().includes('brave://extensions/'), 'First installation gives both browser addresses')
    check(container.querySelectorAll('#manual-update ol > li').length === 8, 'All eight manual update steps are present')
    check(text().includes('Keep the original parent folder path unchanged') && text().includes('do not blindly merge') && text().includes('Do not click Remove or Load unpacked again'), 'Update preserves original path and existing browser card with safe replacement instructions')
    check(text().includes('Do not remove Talvyn, load a different copy, or delete your browser profile'), 'Identity/profile warning is explicit')

    load = async () => { throw new Error('Synthetic release network failure') }
    await mount(<Extensions />)
    await wait(() => Boolean(button('Retry release check')), 'Unavailable metadata permits retry')
    check(text().includes('Release metadata unavailable') && !link('Download Talvyn for Chrome') && !link('Download Talvyn Extension'), 'Unavailable metadata is distinct from a confirmed missing release and has no download')
    check(text().includes('Synthetic release network failure'), 'Unavailable metadata displays exact user-friendly failure reason')
    check(link('View GitHub Releases')?.href === `https://github.com/${repository}/releases`, 'Unavailable state provides direct link to GitHub Releases')
    load = async () => available()
    await click('Retry release check')
    await wait(() => Boolean(link('Download Talvyn for Chrome') || link('Download Talvyn Extension')), 'Metadata retry recovers download')
    const dlLink = link('Download Talvyn for Chrome') || link('Download Talvyn Extension')
    check(dlLink?.href === published().downloadUrl && link('GitHub release notes')?.href === published().releaseNotesUrl, 'Downloads and release notes use the validated shared-client URLs')
    check(text().includes('Version 1.3.0') && text().includes('local extension build: v1.4.0') && text().includes('Published: 2026-10-24T00:00:00.000Z'), 'Published version/date and distinct prepared build are shown truthfully')
    check(text().includes(published().sha256) && text().includes('Get-FileHash') && text().includes('verify before replacing files'), 'Checksum and manual verification command carry accurate guidance')
    check(Boolean(button('Copy Checksum')), 'Copy checksum button is available')
    check(link('Previous GitHub releases')?.href === `https://github.com/${repository}/releases`, 'Previous releases use configured repository')
    
    // Prevent JSDOM navigation; test the actual React handler without making a network request.
    const download = dlLink!
    download.addEventListener('click', (event) => event.preventDefault())
    await act(async () => { download.click(); await pause() })
    check(text().includes('Download opened') && text().includes('cannot confirm completion'), 'Download action shows manual next steps without a fabricated completion')
    await click('Download or verification problem?')
    check(container.querySelector('[role="alert"]')?.textContent?.includes('do not replace your existing files'), 'Download/verification failure guidance preserves existing files')
    check(!text().includes('automatically installs') && !container.querySelector('script'), 'UI neither claims automatic installation nor executes extension assets')

    // ─── Guided Installation Wizard Flow Tests ───
    check(text().includes('Guided Installation Wizard'), 'Installation wizard header rendered')
    check(text().includes('Step 1 of 5: Download'), 'Wizard starts at Step 1')
    await click('Continue to Step 2')
    await wait(() => text().includes('Step 2: Extract to a Permanent Folder'), 'Wizard advances to Step 2: Extract')
    check(text().includes('C:\\Tools\\TalvynExtension') && text().includes('manifest.json'), 'Step 2 shows folder path and manifest at root')
    await click('Back')
    await wait(() => text().includes('Step 1: Download'), 'Wizard navigates back to Step 1')
    await click('Continue to Step 2')
    await click("I've completed this step")
    await wait(() => text().includes('Step 3: Load into Chrome or Brave'), 'Wizard advances to Step 3: Load')
    check(Boolean(button('Copy chrome://extensions/')) && Boolean(button('Copy brave://extensions/')), 'Step 3 provides copy buttons for Chrome and Brave addresses')
    check(text().includes('Load unpacked once') && text().includes('Developer mode'), 'Step 3 explains Developer mode and Load unpacked')
    await click("I've completed this step")
    await wait(() => text().includes('Step 4: Authorize Account Connection'), 'Wizard advances to Step 4: Connect')
    check(Boolean(link('Open Extension Connection Page')), 'Step 4 provides direct link to account connection')
    await click("I've completed this step")
    await wait(() => text().includes('Setup Guide Complete'), 'Wizard advances to Step 5: Complete')
    check(Boolean(link('Go to Application Tracker')) && Boolean(link('Go to Dashboard')), 'Step 5 links to Tracker and Dashboard')
    check(text().includes('does not falsely mark your extension as connected'), 'Step 5 disclaims false installation claims')
    await click('Restart Guide')
    await wait(() => text().includes('Step 1: Download'), 'Wizard restarts back to Step 1')

    for (const [version, expected] of [['1.2.0', 'New version available'], ['1.3.0', 'Latest version already installed'], ['1.4.0', 'No downgrade is recommended'], ['invalid', 'Version comparison is unavailable']] as const) {
      detect = async () => installed(version)
      await mount(<Extensions />)
      await wait(() => text().includes(expected), `Installed version state ${version}`)
      check(Boolean(link('Connect Extension')) && text().includes(expected), `Installed disconnected ${version} keeps connection and correct comparison state`)
    }
    detect = async () => installed('1.3.0', true)
    await mount(<Extensions />)
    await wait(() => Boolean(link('Manage Connection')), 'Connected extension state')
    check(text().includes('synthetic@example.test') && !link('Connect Extension'), 'Connected extension keeps manage-connection flow')

    detect = async () => ({ state: 'configuration-required', installed: false, message: 'Trusted extension identity is not configured. The project owner must configure the public key before account connection is available.' })
    await mount(<Extensions />)
    await wait(() => text().includes('Operator Configuration Required'), 'Configuration required notice is displayed')
    check(text().includes('project owner must configure'), 'Explains operator setup needed')

    detect = async () => notInstalled
    load = async () => absent
    await mount(<ReleaseNotes />)
    await wait(() => text().includes('No GitHub release has been published yet'), 'Release page missing state')
    check(!text().includes('Chrome Web Store') && !text().includes('Published:'), 'Release page does not invent store requirements or a publication date')
    load = async () => { throw new Error('Synthetic invalid metadata') }
    await mount(<ReleaseNotes />)
    await wait(() => Boolean(button('Retry release check')), 'Release page unavailable')
    check(text().includes('A published version, date or download cannot currently be verified'), 'Release page metadata failure is explicit')
    load = async () => available()
    await click('Retry release check')
    await wait(() => text().includes('Latest published GitHub release'), 'Release page retry')
    check(text().includes('Reviewed autofill fixture') && link('GitHub release and assets')?.href === published().releaseNotesUrl, 'Release page renders only published fixture changelog and trusted release link')

    detect = async () => installed('1.2.0')
    load = async () => available()
    await mount(<ExtensionUpdateNotice />)
    await wait(() => Boolean(button('Dismiss')), 'Newer release notice')
    check(link('Download update')?.href === published().downloadUrl && text().includes('click Reload') && !text().includes('automatically'), 'Notice uses manual update model and validated asset')
    await click('Dismiss')
    await focus()
    check(!text().includes('Extension update available'), 'Dismissed release stays dismissed across focus checks')
    await mount(<ExtensionUpdateNotice />)
    check(!text().includes('Extension update available'), 'Dismissal persists across component remount')
    load = async () => available('1.3.1')
    await focus()
    await wait(() => text().includes('published v1.3.1'), 'A different release is eligible after dismissal')
    check(text().includes('Extension update available'), 'Dismissal does not suppress a later published version')
    detect = async () => installed('1.3.1')
    await focus()
    check(!text().includes('Extension update available'), 'Equal installed version clears an existing notice')
    detect = async () => installed('1.4.0')
    await focus()
    check(!text().includes('Extension update available'), 'Newer installed version never offers a downgrade notice')
    detect = async () => installed('1.2.0')
    load = async () => available('1.3.2')
    await focus()
    await wait(() => text().includes('published v1.3.2'), 'Notice restored for next release')
    load = async () => absent
    await focus()
    check(!text().includes('Extension update available'), 'A missing release clears an old notice')
    load = async () => available('1.3.3')
    await focus()
    await wait(() => text().includes('published v1.3.3'), 'Notice visible before metadata outage')
    load = async () => { throw new Error('Synthetic outage') }
    await focus()
    check(!text().includes('Extension update available'), 'Unavailable metadata cannot leave a stale notice')
    load = async () => available('1.3.4')
    detect = async () => notInstalled
    await focus()
    check(!text().includes('Extension update available'), 'No update notice without a detected installed extension')

    // Resolve an older in-flight check after a newer focus check: rollback/current state wins.
    const stale = deferred<ReleaseAvailability>(), latest = deferred<ReleaseAvailability>()
    let loads = 0
    detect = async () => installed('1.3.0')
    load = () => (++loads === 1 ? stale.promise : latest.promise)
    await mount(<ExtensionUpdateNotice />)
    await focus()
    await act(async () => { latest.resolve(available('1.2.0')); await pause() })
    await act(async () => { stale.resolve(available('1.9.0')); await pause() })
    check(!text().includes('Extension update available'), 'Late older requests cannot resurrect a stale notice after a newer rollback check')
    check(loads === 2, 'Concurrent focus race exercised two independent checks')

    console.log(`✓ GitHub extension distribution UI: ${checks} React installation, release, manual-update, dismissal, and race checks passed (JSDOM; transport stubbed).`)
  } finally {
    await act(async () => { root.unmount() })
    releaseClient.load = originalLoad
    extensionBridge.detect = originalDetect
    Object.assign(releaseClient, clientProperties)
    dom.window.close()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
