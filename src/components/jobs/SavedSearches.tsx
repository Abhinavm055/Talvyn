import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { BookmarkPlus } from 'lucide-react'
import { savedSearchesApi } from '../../api/savedSearches'
import { useAuthStore } from '../../store/authStore'
import { filtersToJobQuery } from '../../../server/contracts/jobSearch'
import type { JobSearchFilters, SavedSearch } from '../../../server/contracts/jobSearch'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export function SavedSearches({ filters, onApply }: { filters: JobSearchFilters; onApply: (filters: JobSearchFilters) => void }) {
  const userId = useAuthStore((state) => state.user?.id)
  const sessionRevision = useAuthStore((state) => state.sessionRevision)
  const queryClient = useQueryClient()
  const queryKey = ['saved-searches', userId, sessionRevision] as const
  const [selectedId, setSelectedId] = useState('')
  const [editor, setEditor] = useState<'create' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const query = useQuery({ queryKey, queryFn: ({ signal }) => savedSearchesApi.list(signal), enabled: Boolean(userId) })
  const searches = query.data || []
  const selected = searches.find((search) => search.id === selectedId)
  const differs = Boolean(selected && JSON.stringify(filtersToJobQuery(filters)) !== JSON.stringify(filtersToJobQuery(selected.filters)))
  const isCurrentSession = () => useAuthStore.getState().sessionRevision === sessionRevision && useAuthStore.getState().user?.id === userId

  function apply(search: SavedSearch) {
    onApply({ ...search.filters })
    void queryClient.invalidateQueries({ queryKey: ['jobs', userId, sessionRevision] })
  }

  async function mutate(action: () => Promise<SavedSearch | undefined>, message: string, deletedId?: string) {
    setBusy(true); setError(''); setFeedback('')
    try {
      const result = await action()
      if (!isCurrentSession()) return
      queryClient.setQueryData<SavedSearch[]>(queryKey, (previous = []) => {
        if (deletedId) return previous.filter((search) => search.id !== deletedId)
        return result ? [result, ...previous.filter((search) => search.id !== result.id)] : previous
      })
      if (deletedId) setSelectedId('')
      else if (result) setSelectedId(result.id)
      setEditor(null); setConfirmDelete(false); setFeedback(message)
      void queryClient.invalidateQueries({ queryKey, exact: true })
    } catch (failure) {
      if (!isCurrentSession()) return
      setError(isAxiosError<{ error?: string }>(failure) && typeof failure.response?.data?.error === 'string'
        ? failure.response.data.error : 'The saved search could not be changed. Please try again.')
    } finally {
      if (isCurrentSession()) setBusy(false)
    }
  }

  return (
    <section aria-labelledby="saved-searches-heading" className="mb-6 rounded-xl border border-[#E2E5EC] dark:border-[#252B3A] bg-white dark:bg-[#111522] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="saved-searches-heading" className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FF]">Saved searches</h2>
          <p className="text-xs text-slate-500 dark:text-[#A8B0C2] mt-1">Return to filters for jobs already saved in your account.</p>
        </div>
        <Button type="button" variant="outline" size="sm" icon={<BookmarkPlus />} disabled={busy || !userId} onClick={() => { setEditor('create'); setName(''); setConfirmDelete(false); setError(''); setFeedback('') }}>Save as new search</Button>
      </div>
      {query.isLoading ? <p className="mt-3 text-xs text-slate-500" role="status">Loading saved searches…</p> : null}
      {query.isError ? <div className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">Saved searches could not be loaded. <button type="button" className="underline" onClick={() => void query.refetch()}>Retry saved searches</button></div> : null}
      {!query.isLoading && !query.isError && searches.length === 0 ? <p className="mt-3 text-xs text-slate-500 dark:text-[#A8B0C2]">Choose your filters, then save a search to reuse them later.</p> : null}
      {searches.length > 0 ? <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-slate-600 dark:text-[#A8B0C2]">Choose saved search
          <select aria-label="Choose saved search" value={selected?.id || ''} disabled={busy} className="h-10 rounded-lg border border-[#D9DDE7] dark:border-[#252B3A] bg-white dark:bg-[#111522] px-3 text-sm text-slate-900 dark:text-[#F5F7FF]" onChange={(event) => {
            const search = searches.find((item) => item.id === event.target.value)
            setSelectedId(search?.id || ''); setEditor(null); setConfirmDelete(false); setError(''); setFeedback('')
            if (search) apply(search)
          }}>
            <option value="">Select a saved search</option>
            {searches.map((search) => <option key={search.id} value={search.id}>{search.name}</option>)}
          </select>
        </label>
        {selected ? <>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => apply(selected)}>Apply saved search</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy || !differs} onClick={() => void mutate(() => savedSearchesApi.update(selected.id, { filters }), 'Saved search filters updated.')}>Update filters</Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setEditor('rename'); setName(selected.name); setConfirmDelete(false); setError(''); setFeedback('') }}>Rename</Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setConfirmDelete(true); setEditor(null); setError(''); setFeedback('') }}>Delete search</Button>
        </> : null}
      </div> : null}
      {differs ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Your current filters differ from this saved search.</p> : null}
      {editor ? <form aria-label={editor === 'create' ? 'Save search' : 'Rename saved search'} className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault()
        if (busy || !name.trim()) return
        if (editor === 'create') void mutate(() => savedSearchesApi.create({ name, filters }), 'Search saved.')
        else if (selected) void mutate(() => savedSearchesApi.update(selected.id, { name }), 'Saved search renamed.')
      }}>
        <div className="min-w-48 flex-1"><Input id="saved-search-name" label="Search name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required disabled={busy} autoFocus /></div>
        <Button type="submit" size="sm" loading={busy} disabled={!name.trim()}>{editor === 'create' ? 'Save search' : 'Save name'}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setEditor(null); setError('') }}>Cancel</Button>
      </form> : null}
      {confirmDelete && selected ? <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-[#A8B0C2]">
        <span>Delete “{selected.name}”? Your jobs will stay.</span>
        <Button type="button" variant="danger" size="sm" loading={busy} onClick={() => void mutate(() => savedSearchesApi.delete(selected.id), 'Saved search deleted. Your jobs are unchanged.', selected.id)}>Confirm delete search</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel delete</Button>
      </div> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      {feedback ? <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{feedback}</p> : null}
    </section>
  )
}
