import { compareExtensionVersions, isExtensionVersion } from '../../../server/contracts/extensionRelease'

export function isGenuineUpgrade(
  reason: string,
  previousVersion: string | undefined,
  currentVersion: string
): boolean {
  return reason === 'update' && typeof previousVersion === 'string' && compareExtensionVersions(currentVersion, previousVersion) === 1
}

export function shouldShowReleaseNotice(
  pendingVersion: string | undefined,
  runningVersion: string,
  dismissedVersion: string | undefined
): boolean {
  return isExtensionVersion(pendingVersion) && isExtensionVersion(runningVersion) && pendingVersion === runningVersion && dismissedVersion !== runningVersion
}
