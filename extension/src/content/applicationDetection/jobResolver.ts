import { ExtractedJob, ApplicationSession } from './types'
import { detectJob } from '../detector'

export class JobResolver {
  /**
   * Resolves the applied job's metadata from page DOM and active session cache.
   */
  resolveAppliedJob(doc: Document, session: ApplicationSession | null = null): ExtractedJob {
    // 1. Check if page detector can extract job details directly
    const extracted = detectJob()

    // 2. Check document title and headings for title & company patterns
    const pageHeading = this.extractHeadingJobInfo(doc)

    // 3. Fallback to active application session
    const title =
      extracted?.title ||
      pageHeading.title ||
      session?.jobTitle ||
      this.extractFallbackTitle(doc) ||
      'Applied Role'

    const company =
      extracted?.company ||
      pageHeading.company ||
      session?.company ||
      this.extractFallbackCompany(doc) ||
      'Company'

    const currentHref = typeof window !== 'undefined' ? window.location.href : 'https://careers.example.com/apply'
    const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'careers.example.com'

    const jobUrl =
      extracted?.jobUrl ||
      session?.jobUrl ||
      session?.pageUrl ||
      currentHref

    const location =
      extracted?.location ||
      session?.location ||
      pageHeading.location ||
      undefined

    const sourceWebsite =
      extracted?.sourceWebsite ||
      (currentHostname ? currentHostname.replace(/^www\./, '') : 'Direct Application')

    return {
      title,
      company,
      jobUrl,
      sourceWebsite,
      location,
      salary: extracted?.salary,
      description: extracted?.description,
      confidence: 'HIGH',
    }
  }

  private extractHeadingJobInfo(doc: Document): { title?: string; company?: string; location?: string } {
    const h1 = doc.querySelector('h1')?.textContent?.trim()
    const h2 = doc.querySelector('h2')?.textContent?.trim()

    // Check for "Position: [Title]" or "[Title] at [Company]"
    if (h1) {
      if (h1.includes(' at ')) {
        const parts = h1.split(' at ')
        return { title: parts[0].trim(), company: parts[1].trim() }
      }
      if (h1.includes(' - ')) {
        const parts = h1.split(' - ')
        return { title: parts[0].trim(), company: parts[1].trim() }
      }
    }

    if (h2) {
      if (h2.includes(' at ')) {
        const parts = h2.split(' at ')
        return { title: parts[0].trim(), company: parts[1].trim() }
      }
    }

    return { title: h1 || undefined }
  }

  private extractFallbackTitle(doc: Document): string | null {
    const docTitle = doc.title || ''
    // e.g. "Application for Backend Developer - Acme Corp"
    const match = docTitle.match(/(?:application for|applied for|applying for)\s+([^|\-–]+)/i)
    if (match) return match[1].trim()

    const parts = docTitle.split(/[-–|]/)
    if (parts.length > 0 && parts[0].trim().length > 2) {
      return parts[0].trim()
    }
    return null
  }

  private extractFallbackCompany(doc: Document): string | null {
    const host = window.location.hostname.toLowerCase()
    // e.g. boards.greenhouse.io/airbnb -> airbnb
    if (host.includes('greenhouse.io') || host.includes('lever.co')) {
      const segments = window.location.pathname.split('/').filter(Boolean)
      if (segments.length > 0) {
        return segments[0].replace(/[-_]/g, ' ')
      }
    }
    return null
  }
}

export const jobResolver = new JobResolver()
