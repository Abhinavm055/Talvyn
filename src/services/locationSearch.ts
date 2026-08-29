/**
 * Talvyn Location Search Service (Phase 2E.1)
 * Provider abstraction supporting local curated datasets, caching, and future remote providers.
 */

export interface LocationItem {
  name: string
  category: 'Remote' | 'India City' | 'Global City' | 'Country'
  aliases?: string[]
}

export interface LocationSearchProvider {
  searchLocations(query: string, maxResults?: number): Promise<string[]>
}

export const CURATED_LOCATIONS: LocationItem[] = [
  // ─── Remote Variations ──────────────────────────────────────────────────────
  { name: 'Remote', category: 'Remote', aliases: ['work from home', 'wfh', 'telecommute', 'anywhere'] },
  { name: 'Remote — India', category: 'Remote', aliases: ['remote in india', 'india remote', 'wfh india'] },
  { name: 'Remote — Worldwide', category: 'Remote', aliases: ['global remote', 'worldwide remote', 'remote global'] },
  { name: 'Remote — US / Americas', category: 'Remote', aliases: ['us remote', 'north america remote'] },
  { name: 'Remote — Europe / UK', category: 'Remote', aliases: ['eu remote', 'europe remote', 'uk remote'] },
  { name: 'Remote — APAC / Asia', category: 'Remote', aliases: ['apac remote', 'asia remote'] },

  // ─── Indian Tech Hubs & Metro Cities ────────────────────────────────────────
  { name: 'Bengaluru, Karnataka, India', category: 'India City', aliases: ['bangalore', 'blr', 'bengaluru', 'whitefield', 'koramangala', 'electronic city'] },
  { name: 'Hyderabad, Telangana, India', category: 'India City', aliases: ['hyderabad', 'hyd', 'cyberabad', 'hitec city', 'gachibowli'] },
  { name: 'Chennai, Tamil Nadu, India', category: 'India City', aliases: ['chennai', 'madras', 'omr', 'tidel park'] },
  { name: 'Pune, Maharashtra, India', category: 'India City', aliases: ['pune', 'hinjewadi', 'magarpatta', 'viman nagar'] },
  { name: 'Mumbai, Maharashtra, India', category: 'India City', aliases: ['mumbai', 'bombay', 'bkc', 'navi mumbai', 'thane'] },
  { name: 'Delhi NCR (Delhi, Noida, Gurgaon), India', category: 'India City', aliases: ['delhi', 'ncr', 'new delhi', 'national capital region'] },
  { name: 'Gurgaon / Gurugram, Haryana, India', category: 'India City', aliases: ['gurgaon', 'gurugram', 'cyber city', 'dlf'] },
  { name: 'Noida, Uttar Pradesh, India', category: 'India City', aliases: ['noida', 'greater noida'] },
  { name: 'Kolkata, West Bengal, India', category: 'India City', aliases: ['kolkata', 'calcutta', 'salt lake', 'new town'] },
  { name: 'Ahmedabad, Gujarat, India', category: 'India City', aliases: ['ahmedabad', 'gandhinagar', 'gift city'] },
  { name: 'Kochi / Cochin, Kerala, India', category: 'India City', aliases: ['kochi', 'cochin', 'infopark', 'kakkanad'] },
  { name: 'Thiruvananthapuram, Kerala, India', category: 'India City', aliases: ['trivandrum', 'thiruvananthapuram', 'technopark'] },
  { name: 'Coimbatore, Tamil Nadu, India', category: 'India City', aliases: ['coimbatore', 'kovai', 'tidel park coimbatore'] },
  { name: 'Chandigarh / Mohali, India', category: 'India City', aliases: ['chandigarh', 'mohali', 'panchkula', 'tricity'] },
  { name: 'Indore, Madhya Pradesh, India', category: 'India City', aliases: ['indore'] },
  { name: 'Jaipur, Rajasthan, India', category: 'India City', aliases: ['jaipur'] },
  { name: 'Bhubaneswar, Odisha, India', category: 'India City', aliases: ['bhubaneswar', 'bbsr'] },

  // ─── Global Tech Hubs ───────────────────────────────────────────────────────
  { name: 'San Francisco Bay Area, CA, United States', category: 'Global City', aliases: ['sf', 'san francisco', 'silicon valley', 'bay area', 'palo alto', 'san jose'] },
  { name: 'New York, NY, United States', category: 'Global City', aliases: ['nyc', 'new york', 'manhattan', 'brooklyn'] },
  { name: 'Seattle, WA, United States', category: 'Global City', aliases: ['seattle', 'bellevue', 'redmond'] },
  { name: 'Austin, TX, United States', category: 'Global City', aliases: ['austin', 'texas'] },
  { name: 'Boston, MA, United States', category: 'Global City', aliases: ['boston', 'cambridge'] },
  { name: 'London, United Kingdom', category: 'Global City', aliases: ['london', 'uk', 'england'] },
  { name: 'Berlin, Germany', category: 'Global City', aliases: ['berlin', 'germany'] },
  { name: 'Amsterdam, Netherlands', category: 'Global City', aliases: ['amsterdam', 'holland'] },
  { name: 'Dublin, Ireland', category: 'Global City', aliases: ['dublin', 'ireland'] },
  { name: 'Toronto, Ontario, Canada', category: 'Global City', aliases: ['toronto', 'gta', 'ontario'] },
  { name: 'Vancouver, BC, Canada', category: 'Global City', aliases: ['vancouver', 'british columbia'] },
  { name: 'Singapore', category: 'Global City', aliases: ['sg', 'singapore'] },
  { name: 'Sydney, NSW, Australia', category: 'Global City', aliases: ['sydney', 'australia'] },
  { name: 'Melbourne, VIC, Australia', category: 'Global City', aliases: ['melbourne', 'australia'] },
  { name: 'Dubai, United Arab Emirates', category: 'Global City', aliases: ['dubai', 'uae'] },
  { name: 'Tokyo, Japan', category: 'Global City', aliases: ['tokyo', 'japan'] },
  { name: 'Zurich, Switzerland', category: 'Global City', aliases: ['zurich', 'switzerland'] },

  // ─── Major Countries ────────────────────────────────────────────────────────
  { name: 'India', category: 'Country', aliases: ['in', 'bharat'] },
  { name: 'United States', category: 'Country', aliases: ['us', 'usa', 'america'] },
  { name: 'United Kingdom', category: 'Country', aliases: ['uk', 'britain', 'england'] },
  { name: 'Canada', category: 'Country', aliases: ['ca'] },
  { name: 'Germany', category: 'Country', aliases: ['de', 'deutschland'] },
  { name: 'Australia', category: 'Country', aliases: ['au'] },
  { name: 'Singapore', category: 'Country', aliases: ['sg'] },
  { name: 'United Arab Emirates', category: 'Country', aliases: ['uae'] },
]

export class LocalLocationProvider implements LocationSearchProvider {
  private cache = new Map<string, string[]>()

  async searchLocations(query: string, maxResults = 12): Promise<string[]> {
    const q = query.trim().toLowerCase()
    if (!q) {
      return CURATED_LOCATIONS.slice(0, maxResults).map((l) => l.name)
    }

    if (this.cache.has(q)) {
      return this.cache.get(q)!.slice(0, maxResults)
    }

    const exact: string[] = []
    const prefix: string[] = []
    const contains: string[] = []

    for (const item of CURATED_LOCATIONS) {
      const lowerName = item.name.toLowerCase()
      const matchAlias = item.aliases?.some((a) => a.toLowerCase().includes(q))

      if (lowerName === q) {
        exact.push(item.name)
      } else if (lowerName.startsWith(q) || item.aliases?.some((a) => a.toLowerCase().startsWith(q))) {
        prefix.push(item.name)
      } else if (lowerName.includes(q) || item.category.toLowerCase().includes(q) || matchAlias) {
        contains.push(item.name)
      }
    }

    const combined = Array.from(new Set([...exact, ...prefix, ...contains]))
    this.cache.set(q, combined)

    return combined.slice(0, maxResults)
  }
}

export const locationSearchService = new LocalLocationProvider()
