/**
 * Talvyn Curated Cities Taxonomy
 * Supports cascade filtering by country and state, and full-text search.
 */

export interface CityItem {
  name: string
  state?: string
  country: string
  aliases?: string[]
}

export const CITIES: CityItem[] = [
  // ─── Kerala, India ──────────────────────────────────────────────────────────
  { name: 'Kochi / Cochin', state: 'Kerala', country: 'India', aliases: ['koc', 'kochi', 'cochin', 'kakkanad', 'infopark', 'ernakulam'] },
  { name: 'Thiruvananthapuram (Trivandrum)', state: 'Kerala', country: 'India', aliases: ['tri', 'trivandrum', 'thiruvananthapuram', 'technopark'] },
  { name: 'Kozhikode (Calicut)', state: 'Kerala', country: 'India', aliases: ['calicut', 'kozhikode', 'cyberpark'] },
  { name: 'Thrissur', state: 'Kerala', country: 'India', aliases: ['trichur', 'thrissur'] },
  { name: 'Kollam', state: 'Kerala', country: 'India', aliases: ['quilon', 'kollam'] },
  { name: 'Kannur', state: 'Kerala', country: 'India', aliases: ['cannanore', 'kannur'] },
  { name: 'Kottayam', state: 'Kerala', country: 'India', aliases: ['kottayam'] },
  { name: 'Palakkad', state: 'Kerala', country: 'India', aliases: ['palghat', 'palakkad'] },
  { name: 'Alappuzha', state: 'Kerala', country: 'India', aliases: ['alleppey', 'alappuzha'] },
  { name: 'Malappuram', state: 'Kerala', country: 'India', aliases: ['malappuram', 'manjeri'] },
  { name: 'Kasaragod', state: 'Kerala', country: 'India', aliases: ['kasaragod'] },

  // ─── Karnataka, India ───────────────────────────────────────────────────────
  { name: 'Bengaluru (Bangalore)', state: 'Karnataka', country: 'India', aliases: ['bangalore', 'blr', 'bengaluru', 'whitefield', 'koramangala', 'electronic city'] },
  { name: 'Mysuru (Mysore)', state: 'Karnataka', country: 'India', aliases: ['mysore', 'mysuru'] },
  { name: 'Mangaluru (Mangalore)', state: 'Karnataka', country: 'India', aliases: ['mangalore', 'mangaluru'] },
  { name: 'Hubballi-Dharwad', state: 'Karnataka', country: 'India', aliases: ['hubli', 'dharwad'] },
  { name: 'Belagavi (Belgaum)', state: 'Karnataka', country: 'India', aliases: ['belgaum', 'belagavi'] },

  // ─── Tamil Nadu, India ──────────────────────────────────────────────────────
  { name: 'Chennai', state: 'Tamil Nadu', country: 'India', aliases: ['chennai', 'madras', 'omr', 'guindy', 'tidel park'] },
  { name: 'Coimbatore', state: 'Tamil Nadu', country: 'India', aliases: ['coimbatore', 'kovai'] },
  { name: 'Madurai', state: 'Tamil Nadu', country: 'India', aliases: ['madurai'] },
  { name: 'Tiruchirappalli (Trichy)', state: 'Tamil Nadu', country: 'India', aliases: ['trichy', 'tiruchirappalli'] },
  { name: 'Salem', state: 'Tamil Nadu', country: 'India', aliases: ['salem'] },

  // ─── Maharashtra, India ─────────────────────────────────────────────────────
  { name: 'Mumbai', state: 'Maharashtra', country: 'India', aliases: ['mumbai', 'bombay', 'bkc', 'andheri', 'powai'] },
  { name: 'Pune', state: 'Maharashtra', country: 'India', aliases: ['pune', 'hinjewadi', 'magarpatta', 'viman nagar', 'kharadi'] },
  { name: 'Navi Mumbai', state: 'Maharashtra', country: 'India', aliases: ['navi mumbai', 'vashi', 'airoli'] },
  { name: 'Thane', state: 'Maharashtra', country: 'India', aliases: ['thane'] },
  { name: 'Nagpur', state: 'Maharashtra', country: 'India', aliases: ['nagpur', 'mihan'] },
  { name: 'Nashik', state: 'Maharashtra', country: 'India', aliases: ['nashik'] },

  // ─── Telangana & Andhra Pradesh, India ──────────────────────────────────────
  { name: 'Hyderabad', state: 'Telangana', country: 'India', aliases: ['hyderabad', 'hyd', 'cyberabad', 'hitec city', 'gachibowli', 'madhapur'] },
  { name: 'Warangal', state: 'Telangana', country: 'India', aliases: ['warangal'] },
  { name: 'Visakhapatnam (Vizag)', state: 'Andhra Pradesh', country: 'India', aliases: ['vizag', 'visakhapatnam'] },
  { name: 'Vijayawada', state: 'Andhra Pradesh', country: 'India', aliases: ['vijayawada'] },

  // ─── Delhi NCR, India ───────────────────────────────────────────────────────
  { name: 'New Delhi', state: 'Delhi (NCT)', country: 'India', aliases: ['delhi', 'new delhi', 'ncr', 'connaught place'] },
  { name: 'Gurugram (Gurgaon)', state: 'Haryana', country: 'India', aliases: ['gurgaon', 'gurugram', 'cyber city', 'dlf'] },
  { name: 'Noida', state: 'Uttar Pradesh', country: 'India', aliases: ['noida', 'greater noida', 'sector 62'] },
  { name: 'Faridabad', state: 'Haryana', country: 'India', aliases: ['faridabad'] },

  // ─── Gujarat & West Bengal & Others, India ──────────────────────────────────
  { name: 'Ahmedabad', state: 'Gujarat', country: 'India', aliases: ['ahmedabad'] },
  { name: 'Gandhinagar', state: 'Gujarat', country: 'India', aliases: ['gandhinagar', 'gift city'] },
  { name: 'Surat', state: 'Gujarat', country: 'India', aliases: ['surat'] },
  { name: 'Vadodara (Baroda)', state: 'Gujarat', country: 'India', aliases: ['baroda', 'vadodara'] },
  { name: 'Kolkata', state: 'West Bengal', country: 'India', aliases: ['kolkata', 'calcutta', 'salt lake', 'new town'] },
  { name: 'Jaipur', state: 'Rajasthan', country: 'India', aliases: ['jaipur'] },
  { name: 'Indore', state: 'Madhya Pradesh', country: 'India', aliases: ['indore'] },
  { name: 'Bhopal', state: 'Madhya Pradesh', country: 'India', aliases: ['bhopal'] },
  { name: 'Chandigarh', state: 'Chandigarh', country: 'India', aliases: ['chandigarh', 'mohali'] },
  { name: 'Bhubaneswar', state: 'Odisha', country: 'India', aliases: ['bhubaneswar', 'bbsr'] },
  { name: 'Lucknow', state: 'Uttar Pradesh', country: 'India', aliases: ['lucknow'] },

  // ─── United States Cities ───────────────────────────────────────────────────
  { name: 'San Francisco', state: 'California', country: 'United States', aliases: ['sf', 'san francisco', 'bay area', 'silicon valley'] },
  { name: 'San Jose', state: 'California', country: 'United States', aliases: ['san jose', 'silicon valley'] },
  { name: 'Los Angeles', state: 'California', country: 'United States', aliases: ['la', 'los angeles'] },
  { name: 'San Diego', state: 'California', country: 'United States', aliases: ['san diego'] },
  { name: 'New York City', state: 'New York', country: 'United States', aliases: ['nyc', 'new york', 'manhattan', 'brooklyn'] },
  { name: 'Seattle', state: 'Washington', country: 'United States', aliases: ['seattle', 'bellevue', 'redmond'] },
  { name: 'Austin', state: 'Texas', country: 'United States', aliases: ['austin'] },
  { name: 'Dallas', state: 'Texas', country: 'United States', aliases: ['dallas', 'dfw'] },
  { name: 'Houston', state: 'Texas', country: 'United States', aliases: ['houston'] },
  { name: 'Boston', state: 'Massachusetts', country: 'United States', aliases: ['boston', 'cambridge'] },
  { name: 'Chicago', state: 'Illinois', country: 'United States', aliases: ['chicago'] },
  { name: 'Atlanta', state: 'Georgia', country: 'United States', aliases: ['atlanta'] },

  // ─── Global Cities ──────────────────────────────────────────────────────────
  { name: 'London', state: 'Greater London', country: 'United Kingdom', aliases: ['london', 'uk'] },
  { name: 'Manchester', state: 'North West', country: 'United Kingdom', aliases: ['manchester'] },
  { name: 'Toronto', state: 'Ontario', country: 'Canada', aliases: ['toronto', 'gta'] },
  { name: 'Vancouver', state: 'British Columbia', country: 'Canada', aliases: ['vancouver'] },
  { name: 'Berlin', state: 'Berlin', country: 'Germany', aliases: ['berlin'] },
  { name: 'Munich', state: 'Bavaria', country: 'Germany', aliases: ['munich', 'bayern'] },
  { name: 'Amsterdam', country: 'Netherlands', aliases: ['amsterdam'] },
  { name: 'Dublin', country: 'Ireland', aliases: ['dublin'] },
  { name: 'Singapore', country: 'Singapore', aliases: ['sg', 'singapore'] },
  { name: 'Sydney', state: 'New South Wales', country: 'Australia', aliases: ['sydney'] },
  { name: 'Melbourne', state: 'Victoria', country: 'Australia', aliases: ['melbourne'] },
  { name: 'Dubai', country: 'United Arab Emirates', aliases: ['dubai', 'uae'] },
  { name: 'Abu Dhabi', country: 'United Arab Emirates', aliases: ['abu dhabi'] },
  { name: 'Tokyo', country: 'Japan', aliases: ['tokyo'] },
]

export function searchCities(query: string, country?: string, state?: string, maxResults = 10): string[] {
  const q = query.trim().toLowerCase()
  let pool = CITIES

  // Filter by state first if provided
  if (state) {
    const sLower = state.trim().toLowerCase()
    const stateMatches = CITIES.filter(
      (c) => c.state?.toLowerCase() === sLower || c.state?.toLowerCase().includes(sLower)
    )
    if (stateMatches.length > 0) {
      pool = stateMatches
    }
  } else if (country) {
    const cLower = country.trim().toLowerCase()
    const countryMatches = CITIES.filter(
      (c) => c.country.toLowerCase() === cLower || c.country.toLowerCase().includes(cLower)
    )
    if (countryMatches.length > 0) {
      pool = countryMatches
    }
  }

  if (!q) return pool.slice(0, maxResults).map((c) => c.name)

  const exact: string[] = []
  const startsWith: string[] = []
  const contains: string[] = []

  for (const c of pool) {
    const lowerName = c.name.toLowerCase()
    const aliasMatch = c.aliases?.some((a) => a.toLowerCase().includes(q))

    if (lowerName === q) {
      exact.push(c.name)
    } else if (lowerName.startsWith(q) || c.aliases?.some((a) => a.toLowerCase().startsWith(q))) {
      startsWith.push(c.name)
    } else if (lowerName.includes(q) || aliasMatch) {
      contains.push(c.name)
    }
  }

  // If filtered pool produced no results for query, fallback to searching all cities
  if (exact.length === 0 && startsWith.length === 0 && contains.length === 0 && pool !== CITIES) {
    for (const c of CITIES) {
      const lowerName = c.name.toLowerCase()
      const aliasMatch = c.aliases?.some((a) => a.toLowerCase().includes(q))
      if (lowerName.startsWith(q) || c.aliases?.some((a) => a.toLowerCase().startsWith(q))) {
        startsWith.push(c.name)
      } else if (lowerName.includes(q) || aliasMatch) {
        contains.push(c.name)
      }
    }
  }

  return Array.from(new Set([...exact, ...startsWith, ...contains])).slice(0, maxResults)
}
