import { normalizeRepository, validateReleaseAvailability } from '../../server/contracts/extensionRelease'
import type { ReleaseAvailability } from '../../server/contracts/extensionRelease'

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>
const repository = normalizeRepository(env.VITE_TALVYN_GITHUB_REPOSITORY || env.TALVYN_GITHUB_REPOSITORY)
export const releaseClient = {
  repository,
  releasesUrl: repository ? `https://github.com/${repository}/releases` : null,
  localBuildVersion: env.VITE_TALVYN_LOCAL_EXTENSION_VERSION || env.TALVYN_LOCAL_EXTENSION_VERSION || '',
  async load(options: { signal?: AbortSignal } = {}): Promise<ReleaseAvailability> {
    const repo = this.repository || repository
    if (!repo) throw new Error('The release repository is not configured.')
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (options.signal?.aborted) controller.abort()
    else options.signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 12000)
    try {
      const response = await fetch('/api/releases/extension', { signal: controller.signal, credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!response.ok) {
        let reason = 'Release metadata is unavailable. Please retry.'
        try {
          const body = await response.json()
          if (typeof body?.error === 'string' && body.error.trim()) reason = body.error.trim()
        } catch { /* ignore parsing error and keep default reason */ }
        throw new Error(reason)
      }
      const text = await response.text()
      if (text.length > 65536) throw new Error('Release metadata is invalid.')
      let parsed: unknown
      try { parsed = JSON.parse(text) } catch { throw new Error('Release metadata is invalid.') }
      const metadata = validateReleaseAvailability(parsed, repo)
      if (!metadata) throw new Error('Release metadata could not be verified. Do not use an unverified download link.')
      return metadata
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abort)
    }
  },
}
