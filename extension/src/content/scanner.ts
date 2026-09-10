import { ExtractedJob, UserProfile, AnalyzedJob, JobListAnalysisSummary } from '../types'
import { adapterRegistry } from './adapters/registry'
import { GenericAdapter } from './adapters/generic'
import { analyzeJobRelevance } from '../services/relevanceScorer'
import { isExplicitlyNonJobSite, isLikelyJobPage, isLikelyJobListing, isInvalidJobTitle } from './jobEvidenceDetector'

export type PageClassification = 'SINGLE_JOB' | 'JOB_LIST' | 'OTHER'

export interface PageScanResult {
  classification: PageClassification
  adapterName: string
  singleJob?: ExtractedJob
  listSummary?: JobListAnalysisSummary
}

export class JobScanner {
  private scannedJobUrls = new Set<string>()
  private cachedAnalyzedJobs: Map<string, { job: AnalyzedJob; cachedAt: number }> = new Map()
  private readonly CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes
  private readonly genericAdapter = new GenericAdapter()

  /**
   * A small final validator for adapter output. It prevents a site adapter from
   * turning an arbitrary card (competition, article, promotion, etc.) into a job.
   * This is deliberately independent of site-specific CSS.
   */
  private isPlausibleExtractedJob(job: ExtractedJob, currentUrl: string): boolean {
    const title = (job.title || '').replace(/\s+/g, ' ').trim()
    const company = (job.company || '').replace(/\s+/g, ' ').trim()
    if (title.length < 3 || title.length > 180) return false

    if (isInvalidJobTitle(title)) return false

    const nonJobPattern = /\b(competition|competitions|hackathon|hackathons|workshop|workshops|webinar|quiz|quizzes|contest|contests|leaderboard|challenge|challenges|register now|sponsored|advertisement|advert|promoted)\b/i
    if (nonJobPattern.test(title)) return false

    const evidenceText = [
      title,
      job.jobType || '',
      job.location || '',
      job.salary || '',
      job.experience || '',
      job.description || '',
    ].join(' ')

    const hasJobSignal = /\b(job|role|position|engineer|developer|designer|analyst|scientist|manager|executive|intern|internship|trainee|architect|consultant|specialist|coordinator|lead|director|recruiter|associate|assistant|operator|accountant|marketing|sales|product|software|data|cloud|devops|full[ -]?stack|front[ -]?end|back[ -]?end|mobile|qa|tester|security|ai|ml|administrator|technician|officer|representative|expert|writer|editor|teacher|instructor|tutor|counselor|recruit|hiring|full[ -]?time|part[ -]?time|contract|permanent|remote|hybrid|on[ -]?site|in[ -]?office|in[ -]?person|work from home|years?(\s+(of\s+)?exp(erience)?)?|experience required|no prior experience|salary|stipend|compensation|lpa)\b/i.test(evidenceText)
    const hasDestination = Boolean(job.jobUrl && job.jobUrl !== currentUrl)
    const hasSupportingField = Boolean(job.location || job.salary || job.jobType || job.experience || job.description || hasDestination || (company && company !== 'Unknown Company'))

    return hasJobSignal && hasSupportingField
  }

  /**
   * Extract from a site adapter first, then fall back to the universal adapter
   * when a site-specific adapter cannot produce valid job data. This keeps
   * dedicated adapters as an optimization rather than a hard dependency.
   */
  private extractSingleJobUniversal(url: string, doc: Document, adapter: any): ExtractedJob | null {
    const specific = adapter.extractSingleJob(doc)
    if (specific && this.isPlausibleExtractedJob(specific, url)) return specific

    const generic = this.genericAdapter.extractSingleJob(doc)
    if (generic && this.isPlausibleExtractedJob(generic, url)) return generic

    return null
  }

  private extractJobListUniversal(url: string, doc: Document, adapter: any): ExtractedJob[] {
    const primary = adapter.extractJobList(doc).filter((job: ExtractedJob) => this.isPlausibleExtractedJob(job, url))
    const generic = (adapter.name !== 'Generic' && primary.length === 0)
      ? this.genericAdapter.extractJobList(doc).filter((job: ExtractedJob) => this.isPlausibleExtractedJob(job, url))
      : []

    const merged: ExtractedJob[] = []
    const seenTitles = new Set<string>()
    const seenUrls = new Set<string>()

    for (const job of [...primary, ...generic]) {
      const normTitle = job.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      const normComp = job.company.toLowerCase().replace(/[^a-z0-9]/g, '')
      const fullKey = `${normTitle}|${normComp}`

      if (job.jobUrl && seenUrls.has(job.jobUrl)) continue
      if (seenTitles.has(fullKey)) continue
      if (normComp === 'unknowncompany' && Array.from(seenTitles).some((k) => k.startsWith(normTitle + '|'))) continue

      seenTitles.add(fullKey)
      if (job.jobUrl) seenUrls.add(job.jobUrl)
      merged.push(job)
    }

    return merged
  }

  /**
   * Classifies current page as SINGLE_JOB, JOB_LIST, or OTHER.
   * The universal evidence gate is mandatory: adapter URL patterns alone can
   * never classify a page as a job.
   */
  classifyPage(url: string, doc: Document): { classification: PageClassification; adapterName: string } {
    try {
      if (isExplicitlyNonJobSite(url)) {
        return { classification: 'OTHER', adapterName: 'None' }
      }

      const adapter = adapterRegistry.getAdapter(url, doc)
      const pageJobEvidence = isLikelyJobPage(doc, url)
      const pageListingEvidence = isLikelyJobListing(doc, url)
      const hasListingParam = /selectedItem=|currentJobId=|oppstatus=|usertype=|domain=|course=|specialization=|\b(search|results|q=|keywords=)\b/i.test(url)

      // Check if multiple legitimate jobs can be extracted from the listing DOM
      const rawJobs = adapter.extractJobList(doc)
      if (adapter.name !== 'Generic' && rawJobs.length === 0) {
        rawJobs.push(...this.genericAdapter.extractJobList(doc))
      }
      const seen = new Set<string>()
      const listingJobs = rawJobs.filter((job: ExtractedJob) => {
        if (!this.isPlausibleExtractedJob(job, url)) return false
        const key = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // If page has listing search parameters and valid listing evidence or extracted jobs
      if (hasListingParam && (pageListingEvidence || listingJobs.length >= 1 || adapter.isJobListingPage(url, doc))) {
        return { classification: 'JOB_LIST', adapterName: adapter.name }
      }

      // A single job requires the universal job evidence gate, even when a
      // site-specific adapter recognizes a detail URL.
      // If not on a listing search param and the page exhibits single job evidence,
      // prioritize SINGLE_JOB over sidebar recommendation cards.
      if (pageJobEvidence && adapter.isJobDetailPage(url, doc) && !hasListingParam) {
        return { classification: 'SINGLE_JOB', adapterName: adapter.name }
      }

      // Multiple validated jobs always means a job listing page, even if previewing one
      if (listingJobs.length >= 2) {
        return { classification: 'JOB_LIST', adapterName: adapter.name }
      }

      // A listing requires actual listing evidence, not merely /jobs or ?q= in URL.
      if (pageListingEvidence && adapter.isJobListingPage(url, doc)) {
        return { classification: 'JOB_LIST', adapterName: adapter.name }
      }

      // Universal fallback classification. This is intentionally evidence-based.
      if (pageListingEvidence) {
        return { classification: 'JOB_LIST', adapterName: adapter.name }
      }

      // If the universal card gate cannot recognize a site's custom DOM but its
      // adapter produced genuine job-shaped records, accept the listing only when
      // at least one real job record exists. URL patterns are never sufficient.
      if (adapter.isJobListingPage(url, doc)) {
        const adapterJobs = adapter.extractJobList(doc).filter((job: ExtractedJob) => this.isPlausibleExtractedJob(job, url))
        if (adapterJobs.length > 0) {
          return { classification: 'JOB_LIST', adapterName: adapter.name }
        }
      }

      if (pageJobEvidence) {
        return { classification: 'SINGLE_JOB', adapterName: adapter.name }
      }

      return { classification: 'OTHER', adapterName: adapter.name }
    } catch (err) {
      console.warn('[Talvyn] classifyPage encountered an unexpected error; falling back to OTHER:', err)
      return { classification: 'OTHER', adapterName: 'None' }
    }
  }

  /**
   * Scans a single job detail page through the site adapter and then the
   * universal fallback, while preserving the mandatory evidence gate.
   */
  scanSingleJob(url: string, doc: Document): ExtractedJob | null {
    if (isExplicitlyNonJobSite(url) || !isLikelyJobPage(doc, url)) return null
    const adapter = adapterRegistry.getAdapter(url, doc)
    return this.extractSingleJobUniversal(url, doc, adapter)
  }

  /**
   * Scans a job listing page, scores all jobs against user profile,
   * and returns structured analysis summary.
   */
  scanJobListing(
    url: string,
    doc: Document,
    userProfile: UserProfile,
    existingSavedUrls: Set<string> = new Set()
  ): JobListAnalysisSummary {
    if (isExplicitlyNonJobSite(url)) {
      return {
        totalDetected: 0,
        excellentCount: 0,
        highlyRelevantCount: 0,
        relevantCount: 0,
        lowRelevanceCount: 0,
        analyzedJobs: [],
        pageUrl: url,
        scannedAt: new Date().toISOString(),
      }
    }

    const adapter = adapterRegistry.getAdapter(url, doc)
    const rawJobs = this.extractJobListUniversal(url, doc, adapter)
    const analyzedJobs: AnalyzedJob[] = []
    const now = Date.now()

    for (const rawJob of rawJobs) {
      const urlKey = rawJob.jobUrl || `${rawJob.title}-${rawJob.company}`

      const cached = this.cachedAnalyzedJobs.get(urlKey)
      let analyzed: AnalyzedJob

      if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
        analyzed = cached.job
      } else {
        analyzed = analyzeJobRelevance(rawJob, userProfile)
        this.cachedAnalyzedJobs.set(urlKey, { job: analyzed, cachedAt: now })
        this.scannedJobUrls.add(urlKey)
      }

      analyzed.isSaved = existingSavedUrls.has(rawJob.jobUrl)
      analyzedJobs.push(analyzed)
    }

    analyzedJobs.sort((a, b) => b.relevanceScore - a.relevanceScore)

    let excellentCount = 0
    let highlyRelevantCount = 0
    let relevantCount = 0
    let lowRelevanceCount = 0

    for (const j of analyzedJobs) {
      if (j.category === 'EXCELLENT') excellentCount++
      else if (j.category === 'HIGHLY_RELEVANT') highlyRelevantCount++
      else if (j.category === 'RELEVANT') relevantCount++
      else lowRelevanceCount++
    }

    return {
      totalDetected: analyzedJobs.length,
      excellentCount,
      highlyRelevantCount,
      relevantCount,
      lowRelevanceCount,
      analyzedJobs,
      pageUrl: url,
      scannedAt: new Date().toISOString(),
    }
  }

  clearCache(): void {
    this.scannedJobUrls.clear()
    this.cachedAnalyzedJobs.clear()
  }
}

export const jobScanner = new JobScanner()
