import fs from 'node:fs'
import path from 'node:path'
import { normalizeRepository, validatePublishedRelease, type ReleaseAvailability } from '../contracts/extensionRelease'

export function configuredReleaseRepository(): string | null {
  if (process.env.TALVYN_GITHUB_REPOSITORY) return normalizeRepository(process.env.TALVYN_GITHUB_REPOSITORY)
  try {
    const project = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))
    return normalizeRepository(typeof project.repository === 'string' ? project.repository : project.repository?.url)
  } catch { return null }
}

const DOWNLOAD_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'])

function checkLocalUnpublishedState(repository: string): boolean {
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'public/extension-release.json'),
      path.resolve(process.cwd(), 'dist/extension-release.json'),
    ]
    for (const file of candidatePaths) {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'))
        if (data.publicationStatus === 'not-published' && normalizeRepository(data.repository) === repository) {
          return true
        }
      }
    }
  } catch { /* ignore filesystem errors */ }
  return false
}

/** Public metadata only. No client-controlled URL, credentials or executable code. */
export class ExtensionReleaseService {
  private cached: { value: ReleaseAvailability; expires: number } | null = null
  private failedUntil = 0
  private pending: Promise<ReleaseAvailability> | null = null
  readonly repository: string
  private readonly fetcher: typeof fetch
  private readonly now: () => number
  private readonly ttlMs: number
  private readonly allowLocalFallback: boolean

  constructor(repository: string, options: { fetcher?: typeof fetch; now?: () => number; ttlMs?: number; allowLocalFallback?: boolean } = {}) {
    const normalized = normalizeRepository(repository)
    if (!normalized) throw new Error('Invalid release repository configuration.')
    this.repository = normalized
    this.fetcher = options.fetcher || fetch
    this.now = options.now || Date.now
    this.ttlMs = options.ttlMs ?? 300_000
    this.allowLocalFallback = options.allowLocalFallback ?? !options.fetcher
  }

  async get(): Promise<ReleaseAvailability> {
    if (this.cached && this.cached.expires > this.now()) return this.cached.value
    if (this.pending) return this.pending
    if (this.failedUntil > this.now()) throw new Error('Release metadata is temporarily unavailable.')
    this.pending = this.read().then((value) => {
      this.cached = { value, expires: this.now() + this.ttlMs }
      this.failedUntil = 0
      return value
    }).catch(() => {
      this.cached = null
      this.failedUntil = this.now() + 15_000
      throw new Error('Release metadata could not be verified. Please retry later.')
    }).finally(() => { this.pending = null })
    return this.pending
  }

  private async request(url: string, signal: AbortSignal, api = false): Promise<Response> {
    let current = url
    for (let redirects = 0; redirects <= 3; redirects++) {
      const parsed = new URL(current)
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !(api ? parsed.hostname === 'api.github.com' : DOWNLOAD_HOSTS.has(parsed.hostname))) throw new Error('Untrusted metadata redirect.')
      const response = await this.fetcher(current, { signal, redirect: 'manual', credentials: 'omit', headers: { Accept: 'application/json', 'User-Agent': 'Talvyn-release-metadata' } })
      if (![301, 302, 303, 307, 308].includes(response.status)) return response
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('Invalid metadata redirect.')
      current = new URL(location, current).toString()
    }
    throw new Error('Too many metadata redirects.')
  }

  private async json(response: Response): Promise<unknown> {
    const declared = Number(response.headers.get('content-length'))
    if (declared > 65536 || !response.body) throw new Error('Invalid metadata size.')
    const reader = response.body.getReader(), chunks: Uint8Array[] = []
    let length = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        length += part.value.length
        if (length > 65536) { await reader.cancel(); throw new Error('Metadata is too large.') }
        chunks.push(part.value)
      }
    } finally { reader.releaseLock() }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }

  private async read(): Promise<ReleaseAvailability> {
    const signal = AbortSignal.timeout(3000)
    let response: Response
    try {
      response = await this.request(`https://github.com/${this.repository}/releases/latest/download/extension-release.json`, signal)
    } catch (err) {
      if (this.allowLocalFallback && checkLocalUnpublishedState(this.repository)) {
        return { status: 'not-published', repository: this.repository }
      }
      throw err
    }

    if (response.status === 404) {
      await response.body?.cancel()
      // A missing asset is not proof that no release exists.
      // Check the GitHub releases API.
      try {
        const latest = await this.request(`https://api.github.com/repos/${this.repository}/releases/latest`, signal, true)
        if (latest.status === 404) {
          await latest.body?.cancel()
          return { status: 'not-published', repository: this.repository }
        }
        if (latest.status === 200) {
          await latest.body?.cancel()
          throw new Error('A release exists but its metadata is unavailable.')
        }
        await latest.body?.cancel()
        throw new Error('API status not definitive')
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'A release exists but its metadata is unavailable.') {
          throw err
        }
        // If api.github.com is rate-limited, blocked, or unreachable, inspect the releases/latest redirect on github.com
        try {
          const directCheck = await this.fetcher(`https://github.com/${this.repository}/releases/latest`, {
            signal,
            redirect: 'manual',
            credentials: 'omit',
            headers: { 'User-Agent': 'Talvyn-release-metadata' },
          })
          const loc = directCheck.headers.get('location') || ''
          await directCheck.body?.cancel()
          if (directCheck.status === 404 || loc.endsWith(`/${this.repository}/releases`) || loc.endsWith('/releases')) {
            return { status: 'not-published', repository: this.repository }
          }
        } catch {
          // Network completely unreachable
        }
      }

      // If remote checks could not reach GitHub and local fallback is permitted,
      // check if local build metadata honestly declares not-published
      if (this.allowLocalFallback && checkLocalUnpublishedState(this.repository)) {
        return { status: 'not-published', repository: this.repository }
      }

      throw new Error('A release may exist but its metadata is unavailable.')
    }

    if (!response.ok) { await response.body?.cancel(); throw new Error('Release metadata unavailable.') }
    const release = validatePublishedRelease(await this.json(response), this.repository)
    if (!release) throw new Error('Invalid published release metadata.')
    return { status: 'published', release }
  }
}
