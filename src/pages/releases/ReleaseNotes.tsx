import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Puzzle } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { useExtensionStatus } from '../../hooks/useExtensionStatus'
import { releaseClient } from '../../api/extensionRelease'
import type { ReleaseAvailability } from '../../types/release'
import { releaseVersionMessage } from '../extensions/Extensions'

export default function ReleaseNotes() {
  const [availability, setAvailability] = useState<ReleaseAvailability | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { status } = useExtensionStatus()
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoadFailed(false)
    setAvailability(null)
    releaseClient.load({ signal: controller.signal })
      .then((metadata) => { if (!cancelled) setAvailability(metadata) })
      .catch(() => { if (!cancelled) setLoadFailed(true) })
    return () => { cancelled = true; controller.abort() }
  }, [attempt])
  const release = availability?.status === 'published' ? availability.release : null
  return (
    <div className="min-h-screen bg-[#F7F8FC] dark:bg-[#080A12] px-5 py-10 sm:px-8"><div className="mx-auto max-w-3xl space-y-6">
      <Link to="/extensions" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"><ArrowLeft className="h-4 w-4" /> Extension setup</Link>
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">Talvyn changes</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F5F7FF]">Extension release notes</h1><p className="mt-2 text-sm text-slate-600 dark:text-[#A8B0C2]">Published releases come from the configured GitHub repository. Installed versions come from your browser extension. Refreshing this website does not install an extension update.</p></div>
      <Card padding="lg" className="space-y-5 border-[#E2E5EC] dark:border-[#252B3A]">
        <div className="space-y-1 text-xs text-slate-500 dark:text-[#A8B0C2]"><p>Website’s local extension build: v{releaseClient.localBuildVersion}. A prepared build is not proof of publication.</p><p>{status.version ? `Installed in this browser: v${status.version}` : 'Installed version unavailable in this browser.'}</p></div>
        {release && <>
          <div><p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Latest published GitHub release · v{release.version}</p><h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-[#F5F7FF]">{release.title}</h2><p className="mt-1 text-xs text-slate-500 dark:text-[#A8B0C2]">Published: {release.publishedAt}</p><p role="status" className="mt-3 text-sm text-slate-600 dark:text-[#A8B0C2]">{releaseVersionMessage(status.version, release.version)}</p></div>
          <section><h3 className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FF]">What changed</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-[#A8B0C2]">{release.changes.map((change, index) => <li key={`${index}-${change}`}>{change}</li>)}</ul></section>
          <a href={release.releaseNotesUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"><ExternalLink className="h-4 w-4" /> GitHub release and assets</a>
        </>}
        {availability?.status === 'not-published' && <p role="status" className="text-sm text-slate-600 dark:text-[#A8B0C2]">No GitHub release has been published yet. The project owner can build locally with npm run package:extension and load extension/dist unpacked using trusted connection configuration.</p>}
        {!availability && <div className="space-y-3 text-sm text-slate-600 dark:text-[#A8B0C2]" role={loadFailed ? 'alert' : 'status'}><p>{loadFailed ? 'Release metadata unavailable. A published version, date or download cannot currently be verified.' : 'Loading release information…'}</p>{loadFailed && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Retry release check</button>}</div>}
        <section><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[#F5F7FF]"><Puzzle className="h-4 w-4 text-indigo-600" /> Installation and updates</h3><p className="mt-2 text-sm text-slate-600 dark:text-[#A8B0C2]">Download and verify the ZIP before installing it. For updates, back up and replace the contents at the original extension folder path, then Reload the existing extension card. Do not remove Talvyn or load a second copy. Installation and updates are manual.</p><Link to="/extensions#manual-update" className="mt-3 inline-block text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Download, checksum, installation and update instructions</Link></section>
        {releaseClient.releasesUrl && <a href={releaseClient.releasesUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Previous GitHub releases and compatibility notes</a>}
      </Card>
    </div></div>
  )
}
