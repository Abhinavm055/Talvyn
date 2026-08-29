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
  { value: 'B.Tech', label: 'B.Tech - Bachelor of Technology', category: 'Engineering & Technology', aliases: ['btech', 'b tech', 'b.tech.'] },
  { value: 'B.E.', label: 'B.E. - Bachelor of Engineering', category: 'Engineering & Technology', aliases: ['be', 'b e', 'b.e.'] },
  { value: 'M.Tech', label: 'M.Tech - Master of Technology', category: 'Engineering & Technology', aliases: ['mtech', 'm tech', 'm.tech.'] },
  { value: 'M.E.', label: 'M.E. - Master of Engineering', category: 'Engineering & Technology', aliases: ['me', 'm e', 'm.e.'] },
  { value: 'Diploma in Engineering', label: 'Diploma in Engineering', category: 'Engineering & Technology', aliases: ['polytechnic', 'diploma'] },
  { value: 'PhD Engineering', label: 'PhD - Doctor of Philosophy (Engineering)', category: 'Engineering & Technology', aliases: ['doctorate', 'phd'] },

  // Computer & IT
  { value: 'BCA', label: 'BCA - Bachelor of Computer Applications', category: 'Computer & IT', aliases: ['bca', 'computer applications'] },
  { value: 'MCA', label: 'MCA - Master of Computer Applications', category: 'Computer & IT', aliases: ['mca'] },
  { value: 'B.Sc Computer Science', label: 'B.Sc Computer Science / IT', category: 'Computer & IT', aliases: ['bsc cs', 'bsc it', 'b.sc cs'] },
  { value: 'M.Sc Computer Science', label: 'M.Sc Computer Science / IT', category: 'Computer & IT', aliases: ['msc cs', 'msc it', 'm.sc cs'] },
  { value: 'B.Tech Computer Science', label: 'B.Tech in Computer Science & Engineering (CSE)', category: 'Computer & IT', aliases: ['cse', 'btech cse'] },
  { value: 'B.Tech Information Technology', label: 'B.Tech in Information Technology (IT)', category: 'Computer & IT', aliases: ['btech it', 'information technology'] },
  { value: 'B.Tech Artificial Intelligence', label: 'B.Tech in AI & Machine Learning', category: 'Computer & IT', aliases: ['btech ai', 'aiml', 'ai ml'] },
  { value: 'B.Tech Data Science', label: 'B.Tech in Data Science', category: 'Computer & IT', aliases: ['btech ds', 'data science'] },

  // Business & Management
  { value: 'BBA', label: 'BBA - Bachelor of Business Administration', category: 'Business & Management', aliases: ['bba', 'business administration'] },
  { value: 'MBA', label: 'MBA - Master of Business Administration', category: 'Business & Management', aliases: ['mba', 'management'] },
  { value: 'BMS', label: 'BMS - Bachelor of Management Studies', category: 'Business & Management', aliases: ['bms'] },
  { value: 'PGDM', label: 'PGDM - Post Graduate Diploma in Management', category: 'Business & Management', aliases: ['pgdm'] },

  // Commerce & Finance
  { value: 'B.Com', label: 'B.Com - Bachelor of Commerce', category: 'Commerce & Finance', aliases: ['bcom', 'b.com.'] },
  { value: 'B.Com (Hons)', label: 'B.Com (Honours)', category: 'Commerce & Finance', aliases: ['bcom hons', 'bcom honours'] },
  { value: 'M.Com', label: 'M.Com - Master of Commerce', category: 'Commerce & Finance', aliases: ['mcom'] },
  { value: 'CA', label: 'Chartered Accountancy (CA)', category: 'Commerce & Finance', aliases: ['ca', 'chartered accountant'] },

  // Science
  { value: 'B.Sc', label: 'B.Sc - Bachelor of Science', category: 'Science', aliases: ['bsc', 'b.sc.'] },
  { value: 'M.Sc', label: 'M.Sc - Master of Science', category: 'Science', aliases: ['msc', 'm.sc.'] },
  { value: 'PhD Science', label: 'PhD - Doctor of Philosophy (Science)', category: 'Science', aliases: ['phd science'] },

  // Arts & Humanities
  { value: 'BA', label: 'BA - Bachelor of Arts', category: 'Arts & Humanities', aliases: ['ba', 'b.a.'] },
  { value: 'MA', label: 'MA - Master of Arts', category: 'Arts & Humanities', aliases: ['ma', 'm.a.'] },
  { value: 'BSW', label: 'BSW - Bachelor of Social Work', category: 'Arts & Humanities', aliases: ['bsw'] },
  { value: 'MSW', label: 'MSW - Master of Social Work', category: 'Arts & Humanities', aliases: ['msw'] },

  // Design & Architecture
  { value: 'B.Des', label: 'B.Des - Bachelor of Design', category: 'Design & Architecture', aliases: ['bdes', 'b.des', 'design'] },
  { value: 'M.Des', label: 'M.Des - Master of Design', category: 'Design & Architecture', aliases: ['mdes', 'm.des'] },
  { value: 'B.Arch', label: 'B.Arch - Bachelor of Architecture', category: 'Design & Architecture', aliases: ['barch', 'architecture'] },

  // Law & Legal
  { value: 'LLB', label: 'LLB - Bachelor of Laws', category: 'Law & Legal', aliases: ['llb', 'law'] },
  { value: 'BA LLB', label: 'BA LLB - Integrated Law', category: 'Law & Legal', aliases: ['ba llb', 'ballb'] },
  { value: 'BBA LLB', label: 'BBA LLB - Integrated Business Law', category: 'Law & Legal', aliases: ['bba llb'] },
  { value: 'LLM', label: 'LLM - Master of Laws', category: 'Law & Legal', aliases: ['llm'] },

  // Medicine & Healthcare
  { value: 'MBBS', label: 'MBBS - Bachelor of Medicine & Surgery', category: 'Medicine & Healthcare', aliases: ['mbbs', 'medical'] },
  { value: 'BDS', label: 'BDS - Bachelor of Dental Surgery', category: 'Medicine & Healthcare', aliases: ['bds', 'dental'] },
  { value: 'B.Pharm', label: 'B.Pharm - Bachelor of Pharmacy', category: 'Medicine & Healthcare', aliases: ['bpharm', 'pharmacy'] },
  { value: 'M.Pharm', label: 'M.Pharm - Master of Pharmacy', category: 'Medicine & Healthcare', aliases: ['mpharm'] },
  { value: 'B.Sc Nursing', label: 'B.Sc Nursing', category: 'Medicine & Healthcare', aliases: ['nursing'] },

  // Education
  { value: 'B.Ed', label: 'B.Ed - Bachelor of Education', category: 'Other', aliases: ['bed', 'teaching'] },
  { value: 'M.Ed', label: 'M.Ed - Master of Education', category: 'Other', aliases: ['med'] },
  { value: 'Other', label: 'Other Degree / Certification', category: 'Other', aliases: ['other', 'custom'] },
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
    if (d.aliases?.some((a) => a.includes(q))) return true
    return false
  })
}
