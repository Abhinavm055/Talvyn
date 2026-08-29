/**
 * Talvyn Curated Fields of Study / Specializations
 */

export interface FieldOfStudyOption {
  value: string
  label: string
  category: string
  aliases?: string[]
}

export const FIELDS_OF_STUDY: FieldOfStudyOption[] = [
  // Computer Science & IT
  { value: 'Computer Science & Engineering', label: 'Computer Science & Engineering (CSE)', category: 'Technology', aliases: ['cse', 'cs', 'comp sci'] },
  { value: 'Information Technology', label: 'Information Technology (IT)', category: 'Technology', aliases: ['it', 'info tech'] },
  { value: 'Artificial Intelligence & Machine Learning', label: 'Artificial Intelligence & Machine Learning (AI/ML)', category: 'Technology', aliases: ['ai', 'ml', 'aiml', 'data intelligence'] },
  { value: 'Data Science & Analytics', label: 'Data Science & Analytics', category: 'Technology', aliases: ['ds', 'data analytics', 'big data'] },
  { value: 'Cybersecurity & Ethical Hacking', label: 'Cybersecurity & Ethical Hacking', category: 'Technology', aliases: ['infosec', 'cyber security', 'network security'] },
  { value: 'Cloud Computing & DevOps', label: 'Cloud Computing & DevOps', category: 'Technology', aliases: ['cloud', 'devops', 'aws', 'azure'] },
  { value: 'Software Engineering', label: 'Software Engineering', category: 'Technology', aliases: ['se', 'software development'] },
  { value: 'Information Systems', label: 'Information Systems & Management', category: 'Technology', aliases: ['mis', 'is'] },

  // Core Engineering
  { value: 'Electronics & Communication', label: 'Electronics & Communication Engineering (ECE)', category: 'Engineering', aliases: ['ece', 'electronics', 'telecommunication'] },
  { value: 'Electrical & Electronics', label: 'Electrical & Electronics Engineering (EEE)', category: 'Engineering', aliases: ['eee', 'electrical'] },
  { value: 'Mechanical Engineering', label: 'Mechanical Engineering', category: 'Engineering', aliases: ['mech', 'mechanical'] },
  { value: 'Civil Engineering', label: 'Civil Engineering', category: 'Engineering', aliases: ['civil'] },
  { value: 'Chemical Engineering', label: 'Chemical Engineering', category: 'Engineering', aliases: ['chem', 'chemical'] },
  { value: 'Biotechnology & Biomedical', label: 'Biotechnology & Biomedical Engineering', category: 'Engineering', aliases: ['biotech', 'biomedical'] },
  { value: 'Aerospace & Aeronautical', label: 'Aerospace & Aeronautical Engineering', category: 'Engineering', aliases: ['aero', 'aerospace'] },
  { value: 'Robotics & Automation', label: 'Robotics & Automation', category: 'Engineering', aliases: ['robotics', 'mechatronics'] },

  // Business & Management
  { value: 'Finance & Banking', label: 'Finance & Banking', category: 'Business', aliases: ['finance', 'banking', 'fin'] },
  { value: 'Marketing & Digital Marketing', label: 'Marketing & Digital Marketing', category: 'Business', aliases: ['marketing', 'digital marketing', 'growth'] },
  { value: 'Human Resource Management', label: 'Human Resource Management (HR)', category: 'Business', aliases: ['hr', 'hrm', 'talent'] },
  { value: 'Business Analytics & Intelligence', label: 'Business Analytics & Intelligence', category: 'Business', aliases: ['business analytics', 'bi'] },
  { value: 'Operations & Supply Chain', label: 'Operations & Supply Chain Management', category: 'Business', aliases: ['supply chain', 'operations', 'logistics'] },
  { value: 'International Business', label: 'International Business', category: 'Business', aliases: ['ib', 'global trade'] },
  { value: 'Product Management', label: 'Product Management & Innovation', category: 'Business', aliases: ['product', 'pm'] },
  { value: 'Entrepreneurship', label: 'Entrepreneurship & Strategy', category: 'Business', aliases: ['startup', 'strategy'] },

  // Science & Mathematics
  { value: 'Mathematics & Statistics', label: 'Mathematics & Statistics', category: 'Science', aliases: ['math', 'stats', 'statistics'] },
  { value: 'Physics', label: 'Physics', category: 'Science', aliases: ['physics'] },
  { value: 'Chemistry', label: 'Chemistry & Biochemistry', category: 'Science', aliases: ['chemistry', 'biochem'] },
  { value: 'Economics & Econometrics', label: 'Economics & Econometrics', category: 'Science', aliases: ['econ', 'economics'] },

  // Design & Media
  { value: 'UI/UX Design & Interaction', label: 'UI/UX Design & Interaction Design', category: 'Design', aliases: ['ui', 'ux', 'product design', 'interaction design'] },
  { value: 'Graphic Design & Visual Communication', label: 'Graphic Design & Visual Communication', category: 'Design', aliases: ['graphic design', 'visual arts'] },
  { value: 'Animation & Game Design', label: 'Animation & Game Design', category: 'Design', aliases: ['gaming', 'vfx', 'animation'] },
  { value: 'Journalism & Mass Communication', label: 'Journalism & Mass Communication', category: 'Media', aliases: ['media', 'journalism', 'pr'] },

  // General & Other
  { value: 'General Studies', label: 'General / Interdisciplinary Studies', category: 'Other', aliases: ['general', 'liberal arts'] },
  { value: 'Other', label: 'Other Specialization', category: 'Other', aliases: ['other', 'custom'] },
]

export function searchFieldsOfStudy(query: string): FieldOfStudyOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return FIELDS_OF_STUDY

  return FIELDS_OF_STUDY.filter((f) => {
    if (f.value.toLowerCase().includes(q)) return true
    if (f.label.toLowerCase().includes(q)) return true
    if (f.category.toLowerCase().includes(q)) return true
    if (f.aliases?.some((a) => a.includes(q))) return true
    return false
  })
}
