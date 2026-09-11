/**
 * Talvyn Job Description (JD) Parser Service
 *
 * Extracts structured job opportunity fields from raw job description text.
 * Strictly adheres to data safety: never hallucinates missing information.
 */

export interface ExtractedJobData {
  title: string | null
  company: string | null
  location: string | null
  jobType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP' | 'TEMPORARY' | 'OTHER' | null
  salary: string | null
  experience: string | null
  skills: string[]
  responsibilities: string[]
  requirements: string[]
  qualifications: string[]
  education: string | null
  benefits: string[]
  jobUrl: string | null
  sourceWebsite: string | null
  description: string
}

export interface JDExtractResult {
  extractedJob: ExtractedJobData
  extractedFields: string[]
}

const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'Dart', 'SQL',
  'React', 'React.js', 'React Native', 'Next.js', 'Vue', 'Vue.js', 'Nuxt.js', 'Angular', 'Svelte', 'Node.js', 'Express.js', 'NestJS', 'Django', 'FastAPI', 'Flask', 'Spring Boot', 'Ruby on Rails', 'ASP.NET', 'ASP.NET Core',
  'HTML', 'HTML5', 'CSS', 'CSS3', 'Tailwind CSS', 'Tailwind', 'Bootstrap', 'Redux', 'GraphQL', 'REST APIs', 'RESTful APIs', 'WebSockets', 'TRPC',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Microsoft SQL Server', 'MSSQL', 'Cassandra', 'DynamoDB', 'Supabase', 'Firebase', 'Prisma',
  'Docker', 'Kubernetes', 'AWS', 'Amazon Web Services', 'Google Cloud Platform', 'GCP', 'Microsoft Azure', 'Azure', 'Linux', 'Terraform', 'CI/CD', 'GitHub Actions', 'Jenkins',
  'Git', 'GitHub', 'GitLab', 'Jira', 'Figma', 'Postman', 'Webpack', 'Vite', 'Jest', 'Mocha', 'Cypress', 'Playwright', 'Selenium',
  'Machine Learning', 'Deep Learning', 'Artificial Intelligence', 'Natural Language Processing', 'Computer Vision', 'PyTorch', 'TensorFlow', 'Scikit-Learn', 'Pandas', 'NumPy', 'Large Language Models', 'LLM',
  'Agile', 'Scrum', 'Microservices', 'System Design', 'OOP', 'Data Structures', 'Algorithms',
]

const SKILL_SYNONYMS: Record<string, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  py: 'Python',
  golang: 'Go',
  node: 'Node.js',
  nodejs: 'Node.js',
  reactjs: 'React',
  reactnative: 'React Native',
  vuejs: 'Vue.js',
  angularjs: 'Angular',
  next: 'Next.js',
  nextjs: 'Next.js',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  spring: 'Spring Boot',
  springboot: 'Spring Boot',
  expressjs: 'Express.js',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  k8s: 'Kubernetes',
  kube: 'Kubernetes',
  gcp: 'Google Cloud Platform',
  aws: 'Amazon Web Services',
  tf: 'Terraform',
  gql: 'GraphQL',
  rest: 'REST APIs',
  ml: 'Machine Learning',
  ai: 'Artificial Intelligence',
  llm: 'Large Language Models',
}

const COMMON_CITIES = [
  'Bengaluru', 'Bangalore', 'Hyderabad', 'Mumbai', 'Pune', 'Chennai', 'Delhi', 'New Delhi', 'Noida', 'Gurugram', 'Gurgaon', 'Kochi', 'Trivandrum',
  'San Francisco', 'New York', 'Seattle', 'Austin', 'Boston', 'Chicago', 'Los Angeles', 'London', 'Berlin', 'Toronto', 'Vancouver', 'Singapore', 'Sydney',
]

export class JDParserService {
  extractJobFromDescription(text: string, providedUrl?: string): JDExtractResult {
    const trimmed = (text || '').trim()
    if (!trimmed || trimmed.length < 15) {
      throw new Error('Job description text cannot be empty or too short.')
    }

    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const extractedFields: string[] = []

    // 1. Job Title Extraction
    let title: string | null = null

    // Explicit title prefix
    const titlePrefixMatch = trimmed.match(
      /(?:Job\s+Title|Position(?:\s+Title)?|Role(?:\s+Title)?|Title)\s*[:\-–]\s*([^\n\r,]+)/i
    )
    if (titlePrefixMatch && titlePrefixMatch[1].trim().length >= 3) {
      title = titlePrefixMatch[1].trim()
      extractedFields.push('title')
    } else {
      // Look at top 5 lines for a clean title line
      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i]
        if (
          /^(about|company|overview|location|requirements|responsibilities|who we are)/i.test(line) ||
          line.length > 70 ||
          line.length < 4
        ) {
          continue
        }
        if (
          /\b(Engineer|Developer|Manager|Designer|Architect|Lead|Analyst|Consultant|Scientist|Specialist|Intern|Associate|Director|VP|Officer|Head)\b/i.test(
            line
          )
        ) {
          title = line.replace(/^[#*\-•\s]+/, '').trim()
          extractedFields.push('title')
          break
        }
      }
    }

    // 2. Company Name Extraction
    let company: string | null = null

    const compPrefixMatch = trimmed.match(
      /(?:Company(?:\s+Name)?|Organization|Employer)\s*[:\-–]\s*([^\n\r,]+)/i
    )
    if (compPrefixMatch && compPrefixMatch[1].trim().length >= 2) {
      company = compPrefixMatch[1].trim()
      extractedFields.push('company')
    } else {
      const aboutMatch = trimmed.match(
        /(?:About\s+|Join\s+|At\s+)([A-Z][a-zA-Z0-9\s&.'-]+?)(?:,|\.|\n|!|is\s+a\b|we\s+are\b)/
      )
      if (aboutMatch) {
        const candidate = aboutMatch[1].trim()
        if (
          candidate.length >= 2 &&
          candidate.length <= 40 &&
          !/^(Us|Our|The|This|Talvyn|You|We)/i.test(candidate)
        ) {
          company = candidate
          extractedFields.push('company')
        }
      }
    }

    // Fallback company from URL domain if available
    if (!company && providedUrl) {
      try {
        const host = new URL(providedUrl).hostname.replace(/^www\./, '')
        const domainParts = host.split('.')
        if (domainParts.length >= 2 && !['linkedin', 'indeed', 'glassdoor', 'greenhouse', 'lever', 'workday'].includes(domainParts[0].toLowerCase())) {
          company = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1)
          extractedFields.push('company')
        }
      } catch {}
    }

    // 3. Location Extraction
    let location: string | null = null

    const locPrefixMatch = trimmed.match(
      /(?:Location|Workplace(?:\s+Type)?|Work\s+Location)\s*[:\-–]\s*([^\n\r]+)/i
    )
    if (locPrefixMatch) {
      location = locPrefixMatch[1].trim().slice(0, 80)
      extractedFields.push('location')
    } else {
      const isRemote = /\b(Remote|Work from Home|WFH)\b/i.test(trimmed)
      const isHybrid = /\b(Hybrid)\b/i.test(trimmed)
      const isWorkOnsite = /\b(On-site|Onsite)\b/i.test(trimmed)

      // Check cities
      let foundCity: string | null = null
      for (const c of COMMON_CITIES) {
        const regex = new RegExp(`\\b${c}\\b`, 'i')
        if (regex.test(trimmed)) {
          foundCity = c
          break
        }
      }

      if (isRemote && foundCity) {
        location = `${foundCity} (Remote)`
        extractedFields.push('location')
      } else if (isRemote) {
        location = 'Remote'
        extractedFields.push('location')
      } else if (isHybrid && foundCity) {
        location = `${foundCity} (Hybrid)`
        extractedFields.push('location')
      } else if (isHybrid) {
        location = 'Hybrid'
        extractedFields.push('location')
      } else if (foundCity) {
        location = isWorkOnsite ? `${foundCity} (On-site)` : foundCity
        extractedFields.push('location')
      }
    }

    // 4. Job Type Extraction
    let jobType: ExtractedJobData['jobType'] = null

    if (/\b(Internship|Intern)\b/i.test(trimmed)) {
      jobType = 'INTERNSHIP'
      extractedFields.push('jobType')
    } else if (/\b(Contract(?:or)?|C2C|W2)\b/i.test(trimmed)) {
      jobType = 'CONTRACT'
      extractedFields.push('jobType')
    } else if (/\b(Part[- ]Time)\b/i.test(trimmed)) {
      jobType = 'PART_TIME'
      extractedFields.push('jobType')
    } else if (/\b(Freelance)\b/i.test(trimmed)) {
      jobType = 'FREELANCE'
      extractedFields.push('jobType')
    } else if (/\b(Full[- ]Time|Permanent)\b/i.test(trimmed)) {
      jobType = 'FULL_TIME'
      extractedFields.push('jobType')
    }

    // 5. Salary Extraction
    let salary: string | null = null

    const salaryPrefixMatch = trimmed.match(
      /(?:Salary|Compensation|Pay(?:\s+Range)?|Package)\s*[:\-–]\s*([^\n\r]+)/i
    )
    if (salaryPrefixMatch) {
      salary = salaryPrefixMatch[1].trim().slice(0, 80)
      extractedFields.push('salary')
    } else {
      // Regex for $XX,XXX - $YY,YYY or XX - YY LPA or similar compensation mentions
      const compensationMatch = trimmed.match(
        /(?:(?:\$|€|£|₹)\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*[kKmM])?\s*(?:-|–|to)\s*(?:\$|€|£|₹)?\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*[kKmM])?(?:\s*(?:per|\/)\s*(?:year|yr|hour|hr|month|mo|annum))?|\b\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?\s*(?:LPA|Lakhs?(?:\s+per\s+annum)?)\b)/i
      )
      if (compensationMatch) {
        salary = compensationMatch[0].trim()
        extractedFields.push('salary')
      }
    }

    // 6. Experience Extraction
    let experience: string | null = null
    const expMatch = trimmed.match(
      /(?:(?:Experience|Years\s+of\s+experience)\s*[:\-–]?\s*)?(\d+(?:\s*(?:-|–|to)\s*\d+)?\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:hands[- ]on|relevant|professional)?\s+experience)?)/i
    )
    if (expMatch) {
      experience = expMatch[1].trim()
      extractedFields.push('experience')
    }

    // 7. Skills Extraction
    const detectedSkills = new Set<string>()
    for (const s of KNOWN_SKILLS) {
      const escaped = s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
      const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, 'i')
      if (regex.test(trimmed)) {
        detectedSkills.add(s)
      }
    }
    for (const [synonym, standard] of Object.entries(SKILL_SYNONYMS)) {
      const regex = new RegExp(`\\b${synonym}\\b`, 'i')
      if (regex.test(trimmed)) {
        detectedSkills.add(standard)
      }
    }
    const skills = Array.from(detectedSkills)
    if (skills.length > 0) extractedFields.push('skills')

    // 8. Responsibilities & Requirements Bullet Points Extraction
    const responsibilities: string[] = []
    const requirements: string[] = []
    const benefits: string[] = []

    const respMatch = trimmed.match(
      /(?:Responsibilities|What\s+you(?:'ll|\s+will)\s+do|Duties|Your\s+Role)\s*[:\-–]?\s*\n+([\s\S]*?)(?=(?:\n\s*(?:Requirements|Qualifications|What\s+we(?:'re|\s+are)\s+looking\s+for|Benefits|Perks|Nice\s+to\s+have|About\s+us))|$)/i
    )
    if (respMatch) {
      const respLines = respMatch[1]
        .split(/\n/)
        .map((l) => l.replace(/^[-*•–\d.)\s]+/, '').trim())
        .filter((l) => l.length >= 8 && l.length <= 250)
      responsibilities.push(...respLines.slice(0, 10))
      if (responsibilities.length > 0) extractedFields.push('responsibilities')
    }

    const reqMatch = trimmed.match(
      /(?:Requirements|Qualifications|What\s+we(?:'re|\s+are)\s+looking\s+for|Basic\s+Qualifications|Must\s+Have)\s*[:\-–]?\s*\n+([\s\S]*?)(?=(?:\n\s*(?:Responsibilities|Benefits|Perks|Nice\s+to\s+have|What\s+we\s+offer|About\s+us))|$)/i
    )
    if (reqMatch) {
      const reqLines = reqMatch[1]
        .split(/\n/)
        .map((l) => l.replace(/^[-*•–\d.)\s]+/, '').trim())
        .filter((l) => l.length >= 8 && l.length <= 250)
      requirements.push(...reqLines.slice(0, 10))
      if (requirements.length > 0) extractedFields.push('requirements')
    }

    const benMatch = trimmed.match(
      /(?:Benefits|Perks|What\s+we\s+offer)\s*[:\-–]?\s*\n+([\s\S]*?)(?=(?:\n\s*(?:Responsibilities|Requirements|Qualifications|About\s+us))|$)/i
    )
    if (benMatch) {
      const benLines = benMatch[1]
        .split(/\n/)
        .map((l) => l.replace(/^[-*•–\d.)\s]+/, '').trim())
        .filter((l) => l.length >= 6 && l.length <= 180)
      benefits.push(...benLines.slice(0, 8))
      if (benefits.length > 0) extractedFields.push('benefits')
    }

    // 9. Education Requirement
    let education: string | null = null
    const eduMatch = trimmed.match(
      /\b((?:Bachelor|Master|B\.?Tech|B\.?E\.?|B\.?S\.?|M\.?S\.?|Ph\.?D\.?|Degree)\s*(?:'s)?(?:\s+in\s+[a-zA-Z\s]+)?)\b/i
    )
    if (eduMatch) {
      education = eduMatch[1].trim()
      extractedFields.push('education')
    }

    // 10. URL & Source
    let jobUrl: string | null = providedUrl || null
    if (!jobUrl) {
      const urlMatch = trimmed.match(/https?:\/\/[^\s<>"]+/)
      if (urlMatch) {
        jobUrl = urlMatch[0].replace(/[.,;)]+$/, '')
      }
    }

    let sourceWebsite: string | null = null
    if (jobUrl) {
      try {
        sourceWebsite = new URL(jobUrl).hostname.replace(/^www\./, '')
      } catch {
        sourceWebsite = 'web'
      }
    }

    return {
      extractedJob: {
        title,
        company,
        location,
        jobType,
        salary,
        experience,
        skills,
        responsibilities,
        requirements,
        qualifications: requirements,
        education,
        benefits,
        jobUrl,
        sourceWebsite,
        description: trimmed,
      },
      extractedFields,
    }
  }
}

export const jdParserService = new JDParserService()
