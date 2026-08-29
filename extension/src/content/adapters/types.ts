import { ExtractedJob } from '../../types'

export interface SiteAdapter {
  name: string
  canHandle(url: string, doc: Document): boolean
  isJobDetailPage(url: string, doc: Document): boolean
  isJobListingPage(url: string, doc: Document): boolean
  extractJobList(doc: Document): ExtractedJob[]
  extractSingleJob(doc: Document): ExtractedJob | null
}
