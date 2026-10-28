import { isExtensionVersion, normalizeRepository } from '../../server/contracts/extensionRelease'
export type { PublishedExtensionRelease, ReleaseAvailability } from '../../server/contracts/extensionRelease'

/** Local build notes. Published GitHub metadata is validated separately. */
export interface ExtensionRelease {
  extensionVersion: string
  websiteVersion?: string
  releaseDate: string
  title: string
  changes: string[]
  backendCompatibility: string
  installInstructions: string
  distribution: 'github'
  repository: string
  publicationStatus: 'not-published'
  publishedExtensionVersion: null
}

export function parseRelease(value: unknown): ExtensionRelease | null {
  if (!value || typeof value !== 'object') return null
  const metadata = value as Record<string, unknown>
  const repository = normalizeRepository(metadata.repository)
  if (!repository || metadata.distribution !== 'github' || metadata.publicationStatus !== 'not-published' || metadata.publishedExtensionVersion !== null || !isExtensionVersion(metadata.extensionVersion) || typeof metadata.releaseDate !== 'string' || typeof metadata.title !== 'string' || !Array.isArray(metadata.changes) || !metadata.changes.every((change) => typeof change === 'string') || typeof metadata.backendCompatibility !== 'string') return null
  return {
    extensionVersion: metadata.extensionVersion,
    websiteVersion: typeof metadata.websiteVersion === 'string' ? metadata.websiteVersion : undefined,
    releaseDate: metadata.releaseDate,
    title: metadata.title,
    changes: metadata.changes as string[],
    backendCompatibility: metadata.backendCompatibility,
    installInstructions: typeof metadata.installInstructions === 'string' ? metadata.installInstructions : '',
    distribution: 'github', repository,
    publicationStatus: 'not-published', publishedExtensionVersion: null,
  }
}
