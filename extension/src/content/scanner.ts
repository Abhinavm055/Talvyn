import { ExtractedJob, UserProfile, AnalyzedJob, JobListAnalysisSummary } from '../types'
import { adapterRegistry } from './adapters/registry'
import { analyzeJobRelevance } from '../services/relevanceScorer'

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

  /**
   * Classifies current page as SINGLE_JOB, JOB_LIST, or OTHER
   */
  classifyPage(url: string, doc: Document): { classification: PageClassification; adapterName: string } {
    const adapter = adapterRegistry.getAdapter(url, doc)

    // Check detail page first
    if (adapter.isJobDetailPage(url, doc)) {
      return { classification: 'SINGLE_JOB', adapterName: adapter.name }
    }

    // Check listing page
    if (adapter.isJobListingPage(url, doc)) {
      return { classification: 'JOB_LIST', adapterName: adapter.name }
    }

    return { classification: 'OTHER', adapterName: adapter.name }
  }

  /**
   * Scans a single job detail page
   */
  scanSingleJob(url: string, doc: Document): ExtractedJob | null {
    const adapter = adapterRegistry.getAdapter(url, doc)
    return adapter.extractSingleJob(doc)
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
    const adapter = adapterRegistry.getAdapter(url, doc)
    const rawJobs = adapter.extractJobList(doc)

    const analyzedJobs: AnalyzedJob[] = []

    const now = Date.now()

    for (const rawJob of rawJobs) {
      const urlKey = rawJob.jobUrl || `${rawJob.title}-${rawJob.company}`

      // Check cache or compute fresh
      const cached = this.cachedAnalyzedJobs.get(urlKey)
      let analyzed: AnalyzedJob

      if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
        analyzed = cached.job
      } else {
        analyzed = analyzeJobRelevance(rawJob, userProfile)
        this.cachedAnalyzedJobs.set(urlKey, { job: analyzed, cachedAt: now })
        this.scannedJobUrls.add(urlKey)
      }

      // Mark saved status
      analyzed.isSaved = existingSavedUrls.has(rawJob.jobUrl)

      analyzedJobs.push(analyzed)
    }

    // Sort by relevance score descending (highest match first)
    analyzedJobs.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Calculate count breakdown
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

  /**
   * Clears the scan cache (e.g. on full navigation)
   */
  clearCache(): void {
    this.scannedJobUrls.clear()
    this.cachedAnalyzedJobs.clear()
  }
}

export const jobScanner = new JobScanner()
