/**
 * Talvyn Curated Countries Taxonomy
 * Supports search by name, ISO codes, and common aliases.
 */

export interface CountryItem {
  name: string
  code: string
  aliases?: string[]
}

export const COUNTRIES: CountryItem[] = [
  { name: 'India', code: 'IN', aliases: ['in', 'bharat', 'hindustan'] },
  { name: 'Indonesia', code: 'ID', aliases: ['id'] },
  { name: 'United States', code: 'US', aliases: ['us', 'usa', 'america', 'united states of america'] },
  { name: 'United Kingdom', code: 'GB', aliases: ['uk', 'great britain', 'england', 'scotland', 'wales'] },
  { name: 'Canada', code: 'CA', aliases: ['ca'] },
  { name: 'Australia', code: 'AU', aliases: ['au', 'aus'] },
  { name: 'Germany', code: 'DE', aliases: ['de', 'deutschland'] },
  { name: 'France', code: 'FR', aliases: ['fr'] },
  { name: 'Singapore', code: 'SG', aliases: ['sg'] },
  { name: 'United Arab Emirates', code: 'AE', aliases: ['uae', 'dubai', 'abu dhabi'] },
  { name: 'Ireland', code: 'IE', aliases: ['ie'] },
  { name: 'Netherlands', code: 'NL', aliases: ['nl', 'holland'] },
  { name: 'Switzerland', code: 'CH', aliases: ['ch', 'swiss'] },
  { name: 'Sweden', code: 'SE', aliases: ['se'] },
  { name: 'Japan', code: 'JP', aliases: ['jp', 'nippon'] },
  { name: 'South Korea', code: 'KR', aliases: ['kr', 'korea'] },
  { name: 'New Zealand', code: 'NZ', aliases: ['nz'] },
  { name: 'Poland', code: 'PL', aliases: ['pl'] },
  { name: 'Spain', code: 'ES', aliases: ['es', 'espana'] },
  { name: 'Italy', code: 'IT', aliases: ['it', 'italia'] },
  { name: 'Brazil', code: 'BR', aliases: ['br', 'brasil'] },
  { name: 'Mexico', code: 'MX', aliases: ['mx'] },
  { name: 'South Africa', code: 'ZA', aliases: ['za'] },
  { name: 'Israel', code: 'IL', aliases: ['il'] },
  { name: 'Saudi Arabia', code: 'SA', aliases: ['ksa'] },
  { name: 'Malaysia', code: 'MY', aliases: ['my'] },
  { name: 'Philippines', code: 'PH', aliases: ['ph'] },
  { name: 'Vietnam', code: 'VN', aliases: ['vn'] },
  { name: 'Thailand', code: 'TH', aliases: ['th'] },
]

export function searchCountries(query: string, maxResults = 10): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return COUNTRIES.slice(0, maxResults).map((c) => c.name)

  const exact: string[] = []
  const startsWith: string[] = []
  const contains: string[] = []

  for (const c of COUNTRIES) {
    const lowerName = c.name.toLowerCase()
    const lowerCode = c.code.toLowerCase()
    const aliasMatch = c.aliases?.some((a) => a.toLowerCase().includes(q))

    if (lowerName === q || lowerCode === q) {
      exact.push(c.name)
    } else if (lowerName.startsWith(q) || lowerCode.startsWith(q) || c.aliases?.some((a) => a.toLowerCase().startsWith(q))) {
      startsWith.push(c.name)
    } else if (lowerName.includes(q) || aliasMatch) {
      contains.push(c.name)
    }
  }

  return Array.from(new Set([...exact, ...startsWith, ...contains])).slice(0, maxResults)
}
