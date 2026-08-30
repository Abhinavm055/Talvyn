/**
 * Talvyn Institution Search Service (Phase 2E.1)
 * Provider abstraction supporting local curated datasets, token normalization, caching, and future remote providers.
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
  // ─── Kerala Universities & Colleges ─────────────────────────────────────────
  { name: 'Mahatma Gandhi University (MG University)', location: 'Kottayam, Kerala', country: 'India', type: 'University', aliases: ['mg', 'm g', 'mgu', 'mg university', 'mahatma gandhi university', 'mgu kerala'] },
  { name: 'APJ Abdul Kalam Technological University (KTU)', location: 'Thiruvananthapuram, Kerala', country: 'India', type: 'University', aliases: ['ktu', 'kerala technological university', 'kalam technological university'] },
  { name: 'University of Calicut (Calicut University)', location: 'Malappuram / Kozhikode, Kerala', country: 'India', type: 'University', aliases: ['calicut university', 'uoc', 'calicut'] },
  { name: 'University of Kerala (Kerala University)', location: 'Thiruvananthapuram, Kerala', country: 'India', type: 'University', aliases: ['kerala university', 'uok'] },
  { name: 'Cochin University of Science and Technology (CUSAT)', location: 'Kochi, Kerala', country: 'India', type: 'University', aliases: ['cusat', 'cochin university'] },
  { name: 'National Institute of Technology Calicut (NIT Calicut)', location: 'Kozhikode, Kerala', country: 'India', type: 'Institute of Technology', aliases: ['nitc', 'nit calicut'] },
  { name: 'Indian Institute of Management Kozhikode (IIM Kozhikode)', location: 'Kozhikode, Kerala', country: 'India', type: 'Business School', aliases: ['iimk', 'iim kozhikode', 'iim calicut'] },
  { name: 'College of Engineering Trivandrum (CET)', location: 'Thiruvananthapuram, Kerala', country: 'India', type: 'College', aliases: ['cet', 'cet trivandrum'] },
  { name: 'Government Engineering College Thrissur (GECT)', location: 'Thrissur, Kerala', country: 'India', type: 'College', aliases: ['gec thrissur', 'gect'] },
  { name: 'Model Engineering College, Kochi (MEC)', location: 'Kochi, Kerala', country: 'India', type: 'College', aliases: ['mec', 'mec kochi', 'model engineering college'] },
  { name: 'TKM College of Engineering, Kollam', location: 'Kollam, Kerala', country: 'India', type: 'College', aliases: ['tkm', 'tkmce'] },

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
  { name: 'College of Engineering, Guindy (CEG Anna University)', location: 'Chennai, Tamil Nadu', country: 'India', type: 'College', aliases: ['ceg', 'ceg anna university'] },
  { name: 'University of Delhi (Delhi University / DU)', location: 'New Delhi, Delhi', country: 'India', type: 'University', aliases: ['du', 'delhi university'] },
  { name: 'University of Mumbai (Mumbai University)', location: 'Mumbai, Maharashtra', country: 'India', type: 'University', aliases: ['mu', 'mumbai university'] },
  { name: 'Savitribai Phule Pune University (Pune University)', location: 'Pune, Maharashtra', country: 'India', type: 'University', aliases: ['sppu', 'pune university'] },
  { name: 'Visvesvaraya Technological University (VTU)', location: 'Belagavi, Karnataka', country: 'India', type: 'University', aliases: ['vtu', 'vtu belgaum'] },
  { name: 'Jawaharlal Nehru Technological University (JNTU Hyderabad)', location: 'Hyderabad, Telangana', country: 'India', type: 'University', aliases: ['jntuh', 'jntu hyderabad'] },
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
  { name: 'Amity University', location: 'Noida, Uttar Pradesh', country: 'India', type: 'University', aliases: ['amity', 'amity noida'] },
  { name: 'Christ University', location: 'Bengaluru, Karnataka', country: 'India', type: 'University', aliases: ['christ', 'christ bangalore'] },
  { name: 'Loyola College, Chennai', location: 'Chennai, Tamil Nadu', country: 'India', type: 'College', aliases: ['loyola chennai'] },
  { name: 'St. Stephen\'s College, Delhi', location: 'New Delhi, Delhi', country: 'India', type: 'College', aliases: ['st stephens'] },
  { name: 'St. Xavier\'s College, Mumbai', location: 'Mumbai, Maharashtra', country: 'India', type: 'College', aliases: ['st xaviers mumbai'] },

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
  { name: 'University of Toronto', location: 'Toronto, Ontario', country: 'Canada', type: 'University', aliases: ['uoft', 'u of t'] },
  { name: 'ETH Zurich', location: 'Zurich', country: 'Switzerland', type: 'University', aliases: ['eth'] },
  { name: 'Georgia Institute of Technology (Georgia Tech)', location: 'Atlanta, GA', country: 'United States', type: 'University', aliases: ['gatech', 'georgia tech'] },
  { name: 'University of Washington', location: 'Seattle, WA', country: 'United States', type: 'University', aliases: ['uw', 'udub'] },
]

export class LocalInstitutionProvider implements InstitutionSearchProvider {
  private cache = new Map<string, string[]>()

  async searchInstitutions(query: string, maxResults = 10): Promise<string[]> {
    const rawQ = query.trim().toLowerCase()
    if (!rawQ) {
      return CURATED_INSTITUTIONS.slice(0, maxResults).map((i) => i.name)
    }

    if (this.cache.has(rawQ)) {
      return this.cache.get(rawQ)!.slice(0, maxResults)
    }

    // Also support tokenized query (e.g. "m g" -> "mg")
    const collapsedQ = rawQ.replace(/\s+/g, '')

    const exact: string[] = []
    const prefix: string[] = []
    const contains: string[] = []

    for (const item of CURATED_INSTITUTIONS) {
      const lowerName = item.name.toLowerCase()
      const matchAlias = item.aliases?.some((a) => {
        const aLower = a.toLowerCase()
        return aLower.includes(rawQ) || aLower.replace(/\s+/g, '').includes(collapsedQ)
      })

      if (lowerName === rawQ || (item.aliases && item.aliases.includes(rawQ))) {
        exact.push(item.name)
      } else if (
        lowerName.startsWith(rawQ) ||
        item.aliases?.some((a) => a.toLowerCase().startsWith(rawQ) || a.toLowerCase().replace(/\s+/g, '').startsWith(collapsedQ))
      ) {
        prefix.push(item.name)
      } else if (lowerName.includes(rawQ) || item.location.toLowerCase().includes(rawQ) || matchAlias) {
        contains.push(item.name)
      }
    }

    const combined = Array.from(new Set([...exact, ...prefix, ...contains]))
    this.cache.set(rawQ, combined)

    return combined.slice(0, maxResults)
  }
}

export const institutionSearchService = new LocalInstitutionProvider()
