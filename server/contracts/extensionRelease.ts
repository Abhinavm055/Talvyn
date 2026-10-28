/** Public release data only. Safe for browser imports; no environment/Node imports. */
export interface PublishedExtensionRelease {
  schemaVersion: 1
  distribution: 'github'
  repository: string
  version: string
  publishedAt: string
  downloadUrl: string
  sha256: string
  releaseNotesUrl: string
  title: string
  changes: string[]
  extensionId: string
}

export type ReleaseAvailability =
  | { status: 'published'; release: PublishedExtensionRelease }
  | { status: 'not-published'; repository: string }

export function isExtensionVersion(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,3}$/.test(value)) return false
  const parts = value.split('.').map(Number)
  return parts.every((part) => Number.isInteger(part) && part <= 65535) && parts.some((part) => part > 0)
}

export function compareExtensionVersions(left: string, right: string): number | null {
  if (!isExtensionVersion(left) || !isExtensionVersion(right)) return null
  const a = left.split('.').map(Number), b = right.split('.').map(Number)
  for (let index = 0; index < 4; index++) {
    const difference = (a[index] || 0) - (b[index] || 0)
    if (difference) return difference > 0 ? 1 : -1
  }
  return 0
}

export function normalizeRepository(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  let candidate = value.trim()
  if (candidate.startsWith('git@github.com:')) candidate = candidate.slice('git@github.com:'.length)
  else if (candidate.includes('://')) {
    try {
      const url = new URL(candidate.replace(/^git\+/, ''))
      if (!['https:', 'ssh:'].includes(url.protocol) || url.hostname !== 'github.com' || url.port || url.search || url.hash || url.password) return null
      candidate = url.pathname.replace(/^\//, '')
    } catch { return null }
  }
  candidate = candidate.replace(/\.git\/?$/, '').replace(/\/$/, '')
  const parts = candidate.split('/')
  if (parts.length !== 2 || !/^[a-z\d][a-z\d-]{0,38}$/i.test(parts[0]) || !/^[a-z\d_.-]{1,100}$/i.test(parts[1]) || ['.', '..'].includes(parts[1])) return null
  return candidate
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validatePublishedRelease(value: unknown, expectedRepository: string): PublishedExtensionRelease | null {
  if (!isRecord(value)) return null
  const repository = normalizeRepository(expectedRepository)
  if (!repository || value.schemaVersion !== 1 || value.distribution !== 'github' || value.repository !== repository || !isExtensionVersion(value.version)) return null
  if (typeof value.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.publishedAt) || !Number.isFinite(Date.parse(value.publishedAt))) return null
  if (new Date(value.publishedAt).toISOString() !== (value.publishedAt.includes('.') ? value.publishedAt : value.publishedAt.replace(/Z$/, '.000Z'))) return null
  const base = `https://github.com/${repository}/releases`
  if (value.downloadUrl !== `${base}/download/v${value.version}/talvyn-extension.zip` || value.releaseNotesUrl !== `${base}/tag/v${value.version}`) return null
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256) || typeof value.extensionId !== 'string' || !/^[a-p]{32}$/.test(value.extensionId)) return null
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 160 || !Array.isArray(value.changes) || value.changes.length > 20 || !value.changes.every((change) => typeof change === 'string' && change.trim().length > 0 && change.length <= 400)) return null
  return {
    schemaVersion: 1, distribution: 'github', repository, version: value.version,
    publishedAt: value.publishedAt, downloadUrl: value.downloadUrl, sha256: value.sha256,
    releaseNotesUrl: value.releaseNotesUrl, title: value.title, changes: value.changes as string[], extensionId: value.extensionId,
  }
}

export function validateReleaseAvailability(value: unknown, expectedRepository: string): ReleaseAvailability | null {
  const repository = normalizeRepository(expectedRepository)
  if (!repository || !isRecord(value)) return null
  if (value.status === 'not-published' && value.repository === repository) return { status: 'not-published', repository }
  if (value.status !== 'published') return null
  const release = validatePublishedRelease(value.release, expectedRepository)
  return release ? { status: 'published', release } : null
}
