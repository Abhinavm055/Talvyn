/**
 * Talvyn Curated Degree Taxonomy
 * Supports common Engineering, Computer Science, Business, Science, Arts, and Professional degrees.
 */

export interface DegreeOption {
  value: string
  label: string
  category: string
  aliases?: string[]
}

export const DEGREE_CATEGORIES = [
  'Engineering & Technology',
  'Computer & IT',
  'Business & Management',
  'Science',
  'Commerce & Finance',
  'Arts & Humanities',
  'Design & Architecture',
  'Law & Legal',
  'Medicine & Healthcare',
  'Other',
] as const

export const DEGREES: DegreeOption[] = [
  // Engineering & Technology
  { value: 'B.Tech', label: 'B.Tech - Bachelor of Technology', category: 'Engineering & Technology', aliases: ['btech', 'b tech', 'b.tech.', 'b.tech'] },
  { value: 'B.E.', label: 'B.E. - Bachelor of Engineering', category: 'Engineering & Technology', aliases: ['be', 'b e', 'b.e.', 'b.e'] },
  { value: 'M.Tech', label: 'M.Tech - Master of Technology', category: 'Engineering & Technology', aliases: ['mtech', 'm tech', 'm.tech.', 'm.tech'] },
  { value: 'M.E.', label: 'M.E. - Master of Engineering', category: 'Engineering & Technology', aliases: ['me', 'm e', 'm.e.', 'm.e'] },
  { value: 'Diploma', label: 'Diploma in Engineering', category: 'Engineering & Technology', aliases: ['polytechnic', 'diploma'] },
  { value: 'PhD', label: 'Doctor of Philosophy (PhD)', category: 'Engineering & Technology', aliases: ['doctorate', 'phd', 'ph.d.'] },

  // Computer & IT
  { value: 'BCA', label: 'BCA - Bachelor of Computer Applications', category: 'Computer & IT', aliases: ['bca', 'computer applications'] },
  { value: 'MCA', label: 'MCA - Master of Computer Applications', category: 'Computer & IT', aliases: ['mca'] },
  { value: 'B.Sc CS', label: 'B.Sc in Computer Science / IT', category: 'Computer & IT', aliases: ['bsc cs', 'bsc it', 'b.sc cs'] },
  { value: 'M.Sc CS', label: 'M.Sc in Computer Science / IT', category: 'Computer & IT', aliases: ['msc cs', 'msc it', 'm.sc cs'] },

  // Business & Management
  { value: 'BBA', label: 'BBA - Bachelor of Business Administration', category: 'Business & Management', aliases: ['bba', 'business administration'] },
  { value: 'MBA', label: 'MBA - Master of Business Administration', category: 'Business & Management', aliases: ['mba', 'management'] },
  { value: 'BMS', label: 'BMS - Bachelor of Management Studies', category: 'Business & Management', aliases: ['bms'] },
  { value: 'PGDM', label: 'PGDM - Post Graduate Diploma in Management', category: 'Business & Management', aliases: ['pgdm'] },

  // Commerce & Finance
  { value: 'Bachelor of Commerce (B.Com)', label: 'Bachelor of Commerce (B.Com)', category: 'Commerce & Finance', aliases: ['bcom', 'b.com.', 'b.com'] },
  { value: 'Bachelor of Commerce Honours (B.Com Hons)', label: 'Bachelor of Commerce Honours (B.Com Hons)', category: 'Commerce & Finance', aliases: ['bcom hons', 'bcom honours'] },
  { value: 'Master of Commerce (M.Com)', label: 'Master of Commerce (M.Com)', category: 'Commerce & Finance', aliases: ['mcom', 'm.com'] },
  { value: 'Chartered Accountancy (CA)', label: 'Chartered Accountancy (CA)', category: 'Commerce & Finance', aliases: ['ca', 'chartered accountant'] },

  // Science
  { value: 'Bachelor of Science (B.Sc)', label: 'Bachelor of Science (B.Sc)', category: 'Science', aliases: ['bsc', 'b.sc.', 'b.sc'] },
  { value: 'Master of Science (M.Sc)', label: 'Master of Science (M.Sc)', category: 'Science', aliases: ['msc', 'm.sc.', 'm.sc'] },

  // Arts & Humanities
  { value: 'Bachelor of Arts (B.A.)', label: 'Bachelor of Arts (B.A.)', category: 'Arts & Humanities', aliases: ['ba', 'b.a.', 'b.a'] },
  { value: 'Master of Arts (M.A.)', label: 'Master of Arts (M.A.)', category: 'Arts & Humanities', aliases: ['ma', 'm.a.', 'm.a'] },

  // Design & Architecture
  { value: 'Bachelor of Design (B.Des)', label: 'Bachelor of Design (B.Des)', category: 'Design & Architecture', aliases: ['bdes', 'b.des', 'design'] },
  { value: 'Bachelor of Architecture (B.Arch)', label: 'Bachelor of Architecture (B.Arch)', category: 'Design & Architecture', aliases: ['barch', 'architecture'] },

  // Law
  { value: 'Bachelor of Laws (LLB)', label: 'Bachelor of Laws (LLB)', category: 'Law & Legal', aliases: ['llb', 'law'] },
  { value: 'Integrated Law (BA LLB)', label: 'Integrated Law (BA LLB)', category: 'Law & Legal', aliases: ['ba llb', 'ballb'] },
  { value: 'Master of Laws (LLM)', label: 'Master of Laws (LLM)', category: 'Law & Legal', aliases: ['llm'] },

  // General / Other
  { value: 'Diploma', label: 'Diploma', category: 'Other', aliases: ['diploma'] },
  { value: 'Associate Degree', label: 'Associate Degree', category: 'Other', aliases: ['associate', 'associate degree'] },
  { value: 'Other', label: 'Other', category: 'Other', aliases: ['other', 'custom'] },
]

/**
 * Searches degrees using prefix, contains, and alias matching.
 */
export function searchDegrees(query: string): DegreeOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return DEGREES

  return DEGREES.filter((d) => {
    if (d.value.toLowerCase().includes(q)) return true
    if (d.label.toLowerCase().includes(q)) return true
    if (d.category.toLowerCase().includes(q)) return true
    if (d.aliases?.some((a) => a.toLowerCase().includes(q))) return true
    return false
  })
}
