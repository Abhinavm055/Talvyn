import { ExtractedJob } from '../../types'
import { SiteAdapter } from './types'

export class LinkedInAdapter implements SiteAdapter {
  name = 'LinkedIn'

  canHandle(url: string): boolean {
    return url.includes('linkedin.com')
  }

  isJobDetailPage(url: string, doc: Document): boolean {
    return (
      /\/jobs\/view\//i.test(url) ||
      /\/jobs\/collections\//i.test(url) ||
      !!doc.querySelector('.job-details-jobs-unified-top-card__job-title')
    )
  }

  isJobListingPage(url: string, doc: Document): boolean {
    return (
      /\/jobs\/search/i.test(url) ||
      /\/jobs\/collections/i.test(url) ||
      doc.querySelectorAll('.jobs-search__results-list li, .job-card-container, .base-card').length >= 2
    )
  }

  extractJobList(doc: Document): ExtractedJob[] {
    const jobs: ExtractedJob[] = []
    const seen = new Set<string>()

    const cardElements = Array.from(
      doc.querySelectorAll(
        '.jobs-search__results-list li, .job-card-container, .base-card, div[data-job-id]'
      )
    )

    for (const card of cardElements) {
      const titleEl = card.querySelector(
        '.job-card-list__title, .base-search-card__title, .job-card-container__link, h3'
      )
      const linkEl = card.querySelector('a') as HTMLAnchorElement | null
      const companyEl = card.querySelector(
        '.job-card-container__primary-description, .base-search-card__subtitle, .job-card-container__company-name'
      )
      const locationEl = card.querySelector(
        '.job-card-container__metadata-item, .job-search-card__location, .job-card-container__metadata-wrapper'
      )

      const title = titleEl?.textContent?.trim()
      const jobUrl = linkEl?.href || (typeof window !== 'undefined' ? window.location.href : '')

      if (title && title.length > 2 && !seen.has(jobUrl)) {
        seen.add(jobUrl)
        jobs.push({
          title,
          company: companyEl?.textContent?.trim() || 'LinkedIn Poster',
          location: locationEl?.textContent?.trim(),
          jobUrl,
          sourceWebsite: 'LinkedIn',
          confidence: 'HIGH',
        })
      }
    }

    return jobs
  }

  extractSingleJob(doc: Document): ExtractedJob | null {
    const title = doc.querySelector(
      '.job-details-jobs-unified-top-card__job-title, h1.topcard__title'
    )?.textContent?.trim()

    if (!title) return null

    const company = doc.querySelector(
      '.job-details-jobs-unified-top-card__company-name, .topcard__org-name-link'
    )?.textContent?.trim() || 'LinkedIn Poster'

    const location = doc.querySelector(
      '.job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet'
    )?.textContent?.trim()

    const description = doc.querySelector(
      '.jobs-description__content, #job-details'
    )?.textContent?.trim()

    return {
      title,
      company,
      location,
      description,
      jobUrl: typeof window !== 'undefined' ? window.location.href : '',
      sourceWebsite: 'LinkedIn',
      confidence: 'HIGH',
    }
  }
}
