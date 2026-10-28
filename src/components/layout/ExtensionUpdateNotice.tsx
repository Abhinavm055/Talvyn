import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { compareExtensionVersions } from '../../utils/compareVersions'
import { extensionBridge } from '../../utils/extensionBridge'
import { releaseClient } from '../../api/extensionRelease'

const DISMISSED_RELEASE_KEY = 'talvyn_extension_update_dismissed_release'
interface Notice { installedVersion: string; publishedVersion: string; downloadUrl: string; releaseKey: string }

export function ExtensionUpdateNotice() {
  const [notice, setNotice] = useState<Notice | null>(null)
  const dismissedThisMount = useRef(new Set<string>())
  useEffect(() => {
    let mounted = true
    let sequence = 0
    let controller: AbortController | undefined
    const check = async () => {
      const current = ++sequence
      controller?.abort()
      controller = new AbortController()
      // A newer check must not retain a notice based on stale release metadata.
      setNotice(null)
      try {
        const [availability, installed] = await Promise.all([
          releaseClient.load({ signal: controller.signal }),
          extensionBridge.detect(),
        ])
        if (!mounted || current !== sequence || availability.status !== 'published' || !installed.installed || !installed.version) return
        const release = availability.release
        if (compareExtensionVersions(installed.version, release.version) !== -1) return
        const releaseKey = `${release.repository}@${release.version}:${release.sha256}`
        let dismissed: string | null = null
        try { dismissed = window.localStorage.getItem(DISMISSED_RELEASE_KEY) } catch { /* Optional browser preference. */ }
        if (dismissed !== releaseKey && !dismissedThisMount.current.has(releaseKey)) setNotice({ installedVersion: installed.version, publishedVersion: release.version, downloadUrl: release.downloadUrl, releaseKey })
      } catch { /* Optional update information must not interrupt the dashboard. */ }
    }
    void check()
    const onFocus = () => { void check() }
    window.addEventListener('focus', onFocus)
    return () => { mounted = false; sequence++; controller?.abort(); window.removeEventListener('focus', onFocus) }
  }, [])
  if (!notice) return null
  return (
    <div className="mx-6 md:mx-8 mt-4 rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 flex flex-wrap items-center gap-3 text-xs text-amber-900 dark:text-amber-100" role="status">
      <span className="font-semibold">Extension update available</span>
      <span>Installed v{notice.installedVersion}; published v{notice.publishedVersion}. Download and verify the ZIP, replace the contents of your existing extension folder, then click Reload on its existing browser card.</span>
      <a href={notice.downloadUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">Download update</a>
      <Link to="/extensions#manual-update" className="font-semibold underline underline-offset-2">Update and verification steps</Link>
      <Link to="/releases" className="font-semibold underline underline-offset-2">View changes</Link>
      <button type="button" className="ml-auto hover:underline" onClick={() => { dismissedThisMount.current.add(notice.releaseKey); try { window.localStorage.setItem(DISMISSED_RELEASE_KEY, notice.releaseKey) } catch { /* Optional browser preference. */ } setNotice(null) }}>Dismiss</button>
    </div>
  )
}
