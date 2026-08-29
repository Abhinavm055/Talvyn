import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'

export class GreenhouseAdapter implements SiteAdapter {
  name = 'Greenhouse'

  canHandle(url: string): boolean {
    return url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    return (
      /\/jobs\/\d+/i.test(url) ||
      !!doc.querySelector('.app-title, #app_body, form#application_form')
    )
  }

  isJobListingPage(url: string, doc: Document): boolean {
    return (
      !this.isJobDetailPage(url, doc) &&
      doc.querySelectorAll('.opening, tr.job, div.level-0').length >= 1
    )
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const seen = new Set<string>()
    const company =
      doc.querySelector('.company-name, #header .logo span, h1')?.textContent?.trim() ||
      'Greenhouse Employer'

    const openings = Array.from(doc.querySelectorAll('.opening, tr.job, div[class*="opening"]'))

    for (const opening of openings) {
      const linkEl = opening.querySelector('a') as HTMLAnchorElement | null
      const title = linkEl?.textContent?.trim()
      const locationEl = opening.querySelector('.location')
      const jobUrl = linkEl?.href || window.location.href

      if (title && title.length > 2 && !seen.has(jobUrl)) {
        seen.add(jobUrl)
        jobs.push({
          title,
          company,
          location: locationEl?.textContent?.trim(),
          jobUrl,
          sourceWebsite: 'Greenhouse',
          confidence: 'HIGH',
        })
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const title = doc.querySelector('.app-title, h1.heading')?.textContent?.trim()
    if (!title) return null

    const company =
      doc.querySelector('.company-name, .logo span')?.textContent?.trim() ||
      'Greenhouse Employer'

    const location = doc.querySelector('.location')?.textContent?.trim()
    const description = doc.querySelector('#content')?.textContent?.trim()

    return {
      title,
      company,
      location,
      description,
      jobUrl: window.location.href,
      sourceWebsite: 'Greenhouse',
      confidence: 'HIGH',
    }
  }
}
