/**
 * Talvyn Institution Search Service (Phase 2E.1)
 * Provider abstraction supporting local curated datasets, caching, and future remote providers.
 */

export interface Institution {
  name: string
  location: string
  country: string
  type: 'University' | 'Institute of Technology' | 'College' | 'Business School' | 'Other'
  aliases?: string[]
}

export interface InstitutionSearchProvider {
  searchInstitutions(query: string, maxResults?: number): Promise<string[]>
}

export const CURATED_INSTITUTIONS: Institution[] = [
  // ─── IITs (Indian Institutes of Technology) ──────────────────────────────────
  { name: 'Indian Institute of Technology Madras (IIT Madras)', location: 'Chennai, Tamil Nadu', country: 'India', type: 'Institute of Technology', aliases: ['iitm', 'iit madras', 'iit chennai'] },
  { name: 'Indian Institute of Technology Bombay (IIT Bombay)', location: 'Mumbai, Maharashtra', country: 'India', type: 'Institute of Technology', aliases: ['iitb', 'iit bombay', 'iit mumbai'] },
  { name: 'Indian Institute of Technology Delhi (IIT Delhi)', location: 'New Delhi, Delhi', country: 'India', type: 'Institute of Technology', aliases: ['iitd', 'iit delhi'] },
  { name: 'Indian Institute of Technology Kharagpur (IIT Kharagpur)', location: 'Kharagpur, West Bengal', country: 'India', type: 'Institute of Technology', aliases: ['iitkgp', 'iit kharagpur'] },
  { name: 'Indian Institute of Technology Kanpur (IIT Kanpur)', location: 'Kanpur, Uttar Pradesh', country: 'India', type: 'Institute of Technology', aliases: ['iitk', 'iit kanpur'] },
  { name: 'Indian Institute of Technology Roorkee (IIT Roorkee)', location: 'Roorkee, Uttarakhand', country: 'India', type: 'Institute of Technology', aliases: ['iitr', 'iit roorkee'] },
  { name: 'Indian Institute of Technology Guwahati (IIT Guwahati)', location: 'Guwahati, Assam', country: 'India', type: 'Institute of Technology', aliases: ['iitg', 'iit guwahati'] },
  { name: 'Indian Institute of Technology Hyderabad (IIT Hyderabad)', location: 'Hyderabad, Telangana', country: 'India', type: 'Institute of Technology', aliases: ['iith', 'iit hyderabad'] },
  { name: 'Indian Institute of Technology (BHU) Varanasi', location: 'Varanasi, Uttar Pradesh', country: 'India', type: 'Institute of Technology', aliases: ['iit bhu', 'bhu it'] },
  { name: 'Indian Institute of Technology Indore (IIT Indore)', location: 'Indore, Madhya Pradesh', country: 'India', type: 'Institute of Technology', aliases: ['iiti', 'iit indore'] },
  { name: 'Indian Institute of Technology Gandhinagar (IIT Gandhinagar)', location: 'Gandhinagar, Gujarat', country: 'India', type: 'Institute of Technology', aliases: ['iitgn'] },
  { name: 'Indian Institute of Technology Ropar (IIT Ropar)', location: 'Rupnagar, Punjab', country: 'India', type: 'Institute of Technology', aliases: ['iit ropar'] },
  { name: 'Indian Institute of Technology Patna (IIT Patna)', location: 'Patna, Bihar', country: 'India', type: 'Institute of Technology', aliases: ['iit patna'] },
  { name: 'Indian Institute of Technology Bhubaneswar (IIT Bhubaneswar)', location: 'Bhubaneswar, Odisha', country: 'India', type: 'Institute of Technology', aliases: ['iit bbsr'] },
  { name: 'Indian Institute of Technology Tirupati (IIT Tirupati)', location: 'Tirupati, Andhra Pradesh', country: 'India', type: 'Institute of Technology', aliases: ['iit tirupati'] },

  // ─── NITs (National Institutes of Technology) ────────────────────────────────
  { name: 'National Institute of Technology Tiruchirappalli (NIT Trichy)', location: 'Tiruchirappalli, Tamil Nadu', country: 'India', type: 'Institute of Technology', aliases: ['nitt', 'nit trichy'] },
  { name: 'National Institute of Technology Karnataka, Surathkal (NITK)', location: 'Surathkal, Karnataka', country: 'India', type: 'Institute of Technology', aliases: ['nitk', 'nit surathkal'] },
  { name: 'National Institute of Technology Rourkela (NIT Rourkela)', location: 'Rourkela, Odisha', country: 'India', type: 'Institute of Technology', aliases: ['nitr', 'nit rourkela'] },
  { name: 'National Institute of Technology Warangal (NIT Warangal)', location: 'Warangal, Telangana', country: 'India', type: 'Institute of Technology', aliases: ['nitw', 'nit warangal'] },
  { name: 'National Institute of Technology Calicut (NIT Calicut)', location: 'Kozhikode, Kerala', country: 'India', type: 'Institute of Technology', aliases: ['nitc', 'nit calicut'] },
  { name: 'Visvesvaraya National Institute of Technology (VNIT Nagpur)', location: 'Nagpur, Maharashtra', country: 'India', type: 'Institute of Technology', aliases: ['vnit', 'vnit nagpur'] },
  { name: 'Malaviya National Institute of Technology (MNIT Jaipur)', location: 'Jaipur, Rajasthan', country: 'India', type: 'Institute of Technology', aliases: ['mnit', 'mnit jaipur'] },
  { name: 'Motilal Nehru National Institute of Technology (MNNIT Allahabad)', location: 'Prayagraj, Uttar Pradesh', country: 'India', type: 'Institute of Technology', aliases: ['mnnit', 'mnnit allahabad'] },

  // ─── IIITs & Premier Institutes ─────────────────────────────────────────────
  { name: 'International Institute of Information Technology Hyderabad (IIIT Hyderabad)', location: 'Hyderabad, Telangana', country: 'India', type: 'Institute of Technology', aliases: ['iiith', 'iiit hyderabad'] },
  { name: 'International Institute of Information Technology Bangalore (IIIT Bangalore)', location: 'Bengaluru, Karnataka', country: 'India', type: 'Institute of Technology', aliases: ['iiitb', 'iiit bangalore'] },
  { name: 'Indraprastha Institute of Information Technology Delhi (IIIT Delhi)', location: 'New Delhi, Delhi', country: 'India', type: 'Institute of Technology', aliases: ['iiitd', 'iiit delhi'] },
  { name: 'BITS Pilani (Birla Institute of Technology and Science)', location: 'Pilani, Rajasthan', country: 'India', type: 'University', aliases: ['bits', 'bits pilani', 'bits goa', 'bits hyderabad'] },
  { name: 'Delhi Technological University (DTU)', location: 'New Delhi, Delhi', country: 'India', type: 'University', aliases: ['dtu', 'dce', 'delhi college of engineering'] },
  { name: 'Netaji Subhas University of Technology (NSUT)', location: 'New Delhi, Delhi', country: 'India', type: 'University', aliases: ['nsut', 'nsit'] },

  // ─── Major State & Central Universities ─────────────────────────────────────
  { name: 'Anna University, Chennai', location: 'Chennai, Tamil Nadu', country: 'India', type: 'University', aliases: ['anna university', 'au chennai'] },
  { name: 'Anna University Regional Campus, Coimbatore', location: 'Coimbatore, Tamil Nadu', country: 'India', type: 'University', aliases: ['anna university coimbatore'] },
  { name: 'Anna University Regional Campus, Madurai', location: 'Madurai, Tamil Nadu', country: 'India', type: 'University', aliases: ['anna university madurai'] },
  { name: 'College of Engineering, Guindy (CEG Anna University)', location: 'Chennai, Tamil Nadu', country: 'India', type: 'College', aliases: ['ceg', 'ceg anna university'] },
  { name: 'University of Delhi (Delhi University / DU)', location: 'New Delhi, Delhi', country: 'India', type: 'University', aliases: ['du', 'delhi university'] },
  { name: 'University of Mumbai (Mumbai University)', location: 'Mumbai, Maharashtra', country: 'India', type: 'University', aliases: ['mu', 'mumbai university'] },
  { name: 'Savitribai Phule Pune University (Pune University)', location: 'Pune, Maharashtra', country: 'India', type: 'University', aliases: ['sppu', 'pune university'] },
  { name: 'Visvesvaraya Technological University (VTU)', location: 'Belagavi, Karnataka', country: 'India', type: 'University', aliases: ['vtu', 'vtu belgaum'] },
  { name: 'Jawaharlal Nehru Technological University (JNTU Hyderabad)', location: 'Hyderabad, Telangana', country: 'India', type: 'University', aliases: ['jntuh', 'jntu hyderabad'] },
  { name: 'Jawaharlal Nehru Technological University (JNTU Kakinada)', location: 'Kakinada, Andhra Pradesh', country: 'India', type: 'University', aliases: ['jntuk', 'jntu kakinada'] },
  { name: 'Banaras Hindu University (BHU)', location: 'Varanasi, Uttar Pradesh', country: 'India', type: 'University', aliases: ['bhu'] },
  { name: 'Jawaharlal Nehru University (JNU)', location: 'New Delhi, Delhi', country: 'India', type: 'University', aliases: ['jnu'] },
  { name: 'University of Calcutta (Calcutta University)', location: 'Kolkata, West Bengal', country: 'India', type: 'University', aliases: ['calcutta university', 'cu'] },
  { name: 'Osmania University', location: 'Hyderabad, Telangana', country: 'India', type: 'University', aliases: ['osmania'] },
  { name: 'Bangalore University', location: 'Bengaluru, Karnataka', country: 'India', type: 'University', aliases: ['bangalore university'] },

  // ─── Prominent Engineering & Arts/Science Colleges ─────────────────────────
  { name: 'Vellore Institute of Technology (VIT Vellore / Chennai)', location: 'Vellore, Tamil Nadu', country: 'India', type: 'University', aliases: ['vit', 'vit vellore', 'vit chennai'] },
  { name: 'SRM Institute of Science and Technology (SRM IST)', location: 'Chennai, Tamil Nadu', country: 'India', type: 'University', aliases: ['srm', 'srm university', 'srm chennai'] },
  { name: 'Manipal Academy of Higher Education (MAHE)', location: 'Manipal, Karnataka', country: 'India', type: 'University', aliases: ['manipal', 'mit manipal'] },
  { name: 'PSG College of Technology', location: 'Coimbatore, Tamil Nadu', country: 'India', type: 'College', aliases: ['psg tech', 'psg coimbatore'] },
  { name: 'SSN College of Engineering', location: 'Chennai, Tamil Nadu', country: 'India', type: 'College', aliases: ['ssn', 'ssn chennai'] },
  { name: 'Thapar Institute of Engineering and Technology', location: 'Patiala, Punjab', country: 'India', type: 'University', aliases: ['thapar'] },
  { name: 'Amity University', location: 'Noida, Uttar Pradesh', country: 'India', type: 'University', aliases: ['amity', 'amity noida'] },
  { name: 'Christ University', location: 'Bengaluru, Karnataka', country: 'India', type: 'University', aliases: ['christ', 'christ bangalore'] },
  { name: 'Loyola College, Chennai', location: 'Chennai, Tamil Nadu', country: 'India', type: 'College', aliases: ['loyola chennai'] },
  { name: 'Madras Christian College (MCC)', location: 'Chennai, Tamil Nadu', country: 'India', type: 'College', aliases: ['mcc chennai'] },
  { name: 'St. Stephen\'s College, Delhi', location: 'New Delhi, Delhi', country: 'India', type: 'College', aliases: ['st stephens'] },
  { name: 'St. Xavier\'s College, Mumbai', location: 'Mumbai, Maharashtra', country: 'India', type: 'College', aliases: ['st xaviers mumbai'] },
  { name: 'St. Xavier\'s College, Kolkata', location: 'Kolkata, West Bengal', country: 'India', type: 'College', aliases: ['st xaviers kolkata'] },
  { name: 'Symbiosis International University', location: 'Pune, Maharashtra', country: 'India', type: 'University', aliases: ['symbiosis', 'siu pune'] },

  // ─── Business Schools ───────────────────────────────────────────────────────
  { name: 'Indian Institute of Management Ahmedabad (IIM Ahmedabad)', location: 'Ahmedabad, Gujarat', country: 'India', type: 'Business School', aliases: ['iima', 'iim ahmedabad'] },
  { name: 'Indian Institute of Management Bangalore (IIM Bangalore)', location: 'Bengaluru, Karnataka', country: 'India', type: 'Business School', aliases: ['iimb', 'iim bangalore'] },
  { name: 'Indian Institute of Management Calcutta (IIM Calcutta)', location: 'Kolkata, West Bengal', country: 'India', type: 'Business School', aliases: ['iimc', 'iim calcutta'] },
  { name: 'Indian School of Business (ISB)', location: 'Hyderabad, Telangana', country: 'India', type: 'Business School', aliases: ['isb', 'isb hyderabad'] },
  { name: 'XLRI Xavier School of Management', location: 'Jamshedpur, Jharkhand', country: 'India', type: 'Business School', aliases: ['xlri'] },

  // ─── Global Premier Universities ───────────────────────────────────────────
  { name: 'Massachusetts Institute of Technology (MIT)', location: 'Cambridge, MA', country: 'United States', type: 'University', aliases: ['mit', 'massachusetts institute of technology'] },
  { name: 'Stanford University', location: 'Stanford, CA', country: 'United States', type: 'University', aliases: ['stanford'] },
  { name: 'Harvard University', location: 'Cambridge, MA', country: 'United States', type: 'University', aliases: ['harvard'] },
  { name: 'University of California, Berkeley (UC Berkeley)', location: 'Berkeley, CA', country: 'United States', type: 'University', aliases: ['uc berkeley', 'cal', 'berkeley'] },
  { name: 'Carnegie Mellon University (CMU)', location: 'Pittsburgh, PA', country: 'United States', type: 'University', aliases: ['cmu', 'carnegie mellon'] },
  { name: 'University of Oxford', location: 'Oxford', country: 'United Kingdom', type: 'University', aliases: ['oxford', 'oxon'] },
  { name: 'University of Cambridge', location: 'Cambridge', country: 'United Kingdom', type: 'University', aliases: ['cambridge', 'cantab'] },
  { name: 'Imperial College London', location: 'London', country: 'United Kingdom', type: 'University', aliases: ['imperial'] },
  { name: 'National University of Singapore (NUS)', location: 'Singapore', country: 'Singapore', type: 'University', aliases: ['nus', 'national university of singapore'] },
  { name: 'Nanyang Technological University (NTU)', location: 'Singapore', country: 'Singapore', type: 'University', aliases: ['ntu', 'nanyang'] },
  { name: 'University of Toronto', location: 'Toronto, Ontario', country: 'Canada', type: 'University', aliases: ['uoft', 'u of t'] },
  { name: 'University of Waterloo', location: 'Waterloo, Ontario', country: 'Canada', type: 'University', aliases: ['waterloo', 'uwaterloo'] },
  { name: 'ETH Zurich', location: 'Zurich', country: 'Switzerland', type: 'University', aliases: ['eth', 'swiss federal institute of technology'] },
  { name: 'Georgia Institute of Technology (Georgia Tech)', location: 'Atlanta, GA', country: 'United States', type: 'University', aliases: ['gatech', 'georgia tech'] },
  { name: 'University of Washington', location: 'Seattle, WA', country: 'United States', type: 'University', aliases: ['uw', 'udub'] },
  { name: 'University of Illinois Urbana-Champaign (UIUC)', location: 'Urbana, IL', country: 'United States', type: 'University', aliases: ['uiuc'] },
  { name: 'Columbia University', location: 'New York, NY', country: 'United States', type: 'University', aliases: ['columbia'] },
]

export class LocalInstitutionProvider implements InstitutionSearchProvider {
  private cache = new Map<string, string[]>()

  async searchInstitutions(query: string, maxResults = 10): Promise<string[]> {
    const q = query.trim().toLowerCase()
    if (!q) {
      return CURATED_INSTITUTIONS.slice(0, maxResults).map((i) => i.name)
    }

    if (this.cache.has(q)) {
      return this.cache.get(q)!.slice(0, maxResults)
    }

    const exact: string[] = []
    const prefix: string[] = []
    const contains: string[] = []

    for (const item of CURATED_INSTITUTIONS) {
      const lowerName = item.name.toLowerCase()
      const matchAlias = item.aliases?.some((a) => a.toLowerCase().includes(q))

      if (lowerName === q) {
        exact.push(item.name)
      } else if (lowerName.startsWith(q) || item.aliases?.some((a) => a.toLowerCase().startsWith(q))) {
        prefix.push(item.name)
      } else if (lowerName.includes(q) || item.location.toLowerCase().includes(q) || matchAlias) {
        contains.push(item.name)
      }
    }

    const combined = Array.from(new Set([...exact, ...prefix, ...contains]))
    this.cache.set(q, combined)

    return combined.slice(0, maxResults)
  }
}

export const institutionSearchService = new LocalInstitutionProvider()
