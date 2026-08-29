import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'

export class LeverAdapter implements SiteAdapter {
  name = 'Lever'

  canHandle(url: string): boolean {
    return url.includes('lever.co') || url.includes('jobs.lever.co')
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    return (
      /\/jobs\.lever\.co\/[^/]+\/[a-zA-Z0-9_-]{10,}/i.test(url) ||
      /\/apply\/?$/i.test(url) ||
      !!doc.querySelector('.posting-header h2, .application-page')
    )
  }

  isJobListingPage(url: string, doc: Document): boolean {
    return (
      !this.isJobDetailPage(url, doc) &&
      doc.querySelectorAll('.posting, div[data-qa="posting-category"]').length >= 1
    )
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const seen = new Set<string>()
    const company =
      doc.querySelector('.main-header-logo img')?.getAttribute('alt') ||
      doc.querySelector('.posting-headline .sort-by-team')?.textContent?.trim() ||
      'Lever Employer'

    const postings = Array.from(doc.querySelectorAll('.posting'))

    for (const posting of postings) {
      const linkEl = posting.querySelector('.posting-title, a.posting-btn-submit, a') as HTMLAnchorElement | null
      const titleEl = posting.querySelector('h5[data-qa="posting-name"], .posting-title h5, h5')
      const locationEl = posting.querySelector('.sort-by-location, .posting-categories .location')
      const commitmentEl = posting.querySelector('.sort-by-commitment, .posting-categories .commitment')

      const title = titleEl?.textContent?.trim() || linkEl?.textContent?.trim()
      const jobUrl = linkEl?.href || window.location.href

      if (title && title.length > 2 && !seen.has(jobUrl)) {
        seen.add(jobUrl)
        jobs.push({
          title,
          company,
          location: locationEl?.textContent?.trim(),
          jobType: commitmentEl?.textContent?.trim(),
          jobUrl,
          sourceWebsite: 'Lever',
          confidence: 'HIGH',
        })
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const title = doc.querySelector('.posting-headline h2')?.textContent?.trim()
    if (!title) return null

    const company =
      doc.querySelector('.main-header-logo img')?.getAttribute('alt') ||
      'Lever Employer'

    const location = doc.querySelector('.location, .posting-categories .sort-by-location')?.textContent?.trim()
    const jobType = doc.querySelector('.commitment, .posting-categories .sort-by-commitment')?.textContent?.trim()
    const description = doc.querySelector('.section-wrapper, .posting-page')?.textContent?.trim()

    return {
      title,
      company,
      location,
      jobType,
      description,
      jobUrl: window.location.href,
      sourceWebsite: 'Lever',
      confidence: 'HIGH',
    }
  }
}
