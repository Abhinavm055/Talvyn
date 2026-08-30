/**
 * Talvyn Curated States & Provinces Taxonomy
 * Supports filtering by country and full-text search.
 */

export interface StateItem {
  name: string
  country: string
  code?: string
  aliases?: string[]
}

export const STATES: StateItem[] = [
  // ─── India States & UTs ─────────────────────────────────────────────────────
  { name: 'Kerala', country: 'India', code: 'KL', aliases: ['ker', 'keralam'] },
  { name: 'Karnataka', country: 'India', code: 'KA', aliases: ['kar', 'karnataka'] },
  { name: 'Tamil Nadu', country: 'India', code: 'TN', aliases: ['tn', 'tamilnadu'] },
  { name: 'Maharashtra', country: 'India', code: 'MH', aliases: ['mh', 'maharashtra'] },
  { name: 'Telangana', country: 'India', code: 'TG', aliases: ['tg', 'telangana'] },
  { name: 'Andhra Pradesh', country: 'India', code: 'AP', aliases: ['ap'] },
  { name: 'Delhi (NCT)', country: 'India', code: 'DL', aliases: ['delhi', 'ncr', 'new delhi'] },
  { name: 'Uttar Pradesh', country: 'India', code: 'UP', aliases: ['up'] },
  { name: 'Gujarat', country: 'India', code: 'GJ', aliases: ['gujarat'] },
  { name: 'West Bengal', country: 'India', code: 'WB', aliases: ['wb', 'bengal'] },
  { name: 'Rajasthan', country: 'India', code: 'RJ', aliases: ['rajasthan'] },
  { name: 'Haryana', country: 'India', code: 'HR', aliases: ['haryana'] },
  { name: 'Punjab', country: 'India', code: 'PB', aliases: ['punjab'] },
  { name: 'Madhya Pradesh', country: 'India', code: 'MP', aliases: ['mp'] },
  { name: 'Bihar', country: 'India', code: 'BR', aliases: ['bihar'] },
  { name: 'Odisha', country: 'India', code: 'OD', aliases: ['odisha', 'orissa'] },
  { name: 'Goa', country: 'India', code: 'GA', aliases: ['goa'] },
  { name: 'Assam', country: 'India', code: 'AS', aliases: ['assam'] },
  { name: 'Himachal Pradesh', country: 'India', code: 'HP', aliases: ['hp'] },
  { name: 'Uttarakhand', country: 'India', code: 'UK', aliases: ['uttarakhand'] },
  { name: 'Jharkhand', country: 'India', code: 'JH', aliases: ['jharkhand'] },
  { name: 'Chhattisgarh', country: 'India', code: 'CG', aliases: ['chhattisgarh'] },
  { name: 'Chandigarh', country: 'India', code: 'CH', aliases: ['chandigarh'] },
  { name: 'Puducherry', country: 'India', code: 'PY', aliases: ['pondicherry'] },

  // ─── United States States ───────────────────────────────────────────────────
  { name: 'California', country: 'United States', code: 'CA', aliases: ['cal', 'cali'] },
  { name: 'New York', country: 'United States', code: 'NY', aliases: ['ny', 'new york'] },
  { name: 'Texas', country: 'United States', code: 'TX', aliases: ['tx', 'texas'] },
  { name: 'Washington', country: 'United States', code: 'WA', aliases: ['wa', 'seattle'] },
  { name: 'Massachusetts', country: 'United States', code: 'MA', aliases: ['ma', 'boston'] },
  { name: 'Illinois', country: 'United States', code: 'IL', aliases: ['il', 'chicago'] },
  { name: 'Florida', country: 'United States', code: 'FL', aliases: ['fl'] },
  { name: 'New Jersey', country: 'United States', code: 'NJ', aliases: ['nj'] },
  { name: 'Georgia', country: 'United States', code: 'GA', aliases: ['ga', 'atlanta'] },
  { name: 'North Carolina', country: 'United States', code: 'NC', aliases: ['nc'] },
  { name: 'Virginia', country: 'United States', code: 'VA', aliases: ['va'] },
  { name: 'Colorado', country: 'United States', code: 'CO', aliases: ['co', 'denver'] },
  { name: 'Pennsylvania', country: 'United States', code: 'PA', aliases: ['pa'] },
  { name: 'Ohio', country: 'United States', code: 'OH', aliases: ['oh'] },

  // ─── Canada Provinces ───────────────────────────────────────────────────────
  { name: 'Ontario', country: 'Canada', code: 'ON', aliases: ['toronto'] },
  { name: 'British Columbia', country: 'Canada', code: 'BC', aliases: ['vancouver', 'bc'] },
  { name: 'Quebec', country: 'Canada', code: 'QC', aliases: ['montreal'] },
  { name: 'Alberta', country: 'Canada', code: 'AB', aliases: ['calgary', 'edmonton'] },

  // ─── United Kingdom Regions ─────────────────────────────────────────────────
  { name: 'Greater London', country: 'United Kingdom', aliases: ['london'] },
  { name: 'South East', country: 'United Kingdom', aliases: ['oxford', 'brighton'] },
  { name: 'North West', country: 'United Kingdom', aliases: ['manchester', 'liverpool'] },
  { name: 'Scotland', country: 'United Kingdom', aliases: ['edinburgh', 'glasgow'] },
  { name: 'Wales', country: 'United Kingdom', aliases: ['cardiff'] },

  // ─── Australia States ───────────────────────────────────────────────────────
  { name: 'New South Wales', country: 'Australia', code: 'NSW', aliases: ['sydney', 'nsw'] },
  { name: 'Victoria', country: 'Australia', code: 'VIC', aliases: ['melbourne', 'vic'] },
  { name: 'Queensland', country: 'Australia', code: 'QLD', aliases: ['brisbane', 'qld'] },
  { name: 'Western Australia', country: 'Australia', code: 'WA', aliases: ['perth'] },

  // ─── Germany States ─────────────────────────────────────────────────────────
  { name: 'Bavaria', country: 'Germany', aliases: ['bayern', 'munich'] },
  { name: 'Berlin', country: 'Germany', aliases: ['berlin'] },
  { name: 'North Rhine-Westphalia', country: 'Germany', aliases: ['nrw', 'cologne', 'dusseldorf'] },
  { name: 'Baden-Württemberg', country: 'Germany', aliases: ['stuttgart'] },
  { name: 'Hesse', country: 'Germany', aliases: ['frankfurt'] },
]

export function searchStates(query: string, country?: string, maxResults = 10): string[] {
  const q = query.trim().toLowerCase()
  let pool = STATES

  if (country) {
    const cLower = country.trim().toLowerCase()
    const matchingCountry = STATES.filter(
      (s) => s.country.toLowerCase() === cLower || s.country.toLowerCase().includes(cLower)
    )
    if (matchingCountry.length > 0) {
      pool = matchingCountry
    }
  }

  if (!q) return pool.slice(0, maxResults).map((s) => s.name)

  const exact: string[] = []
  const startsWith: string[] = []
  const contains: string[] = []

  for (const s of pool) {
    const lowerName = s.name.toLowerCase()
    const lowerCode = s.code?.toLowerCase() || ''
    const aliasMatch = s.aliases?.some((a) => a.toLowerCase().includes(q))

    if (lowerName === q || lowerCode === q) {
      exact.push(s.name)
    } else if (lowerName.startsWith(q) || lowerCode.startsWith(q) || s.aliases?.some((a) => a.toLowerCase().startsWith(q))) {
      startsWith.push(s.name)
    } else if (lowerName.includes(q) || aliasMatch) {
      contains.push(s.name)
    }
  }

  return Array.from(new Set([...exact, ...startsWith, ...contains])).slice(0, maxResults)
}
