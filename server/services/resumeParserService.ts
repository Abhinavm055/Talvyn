/**
 * Talvyn Resume Parser Service
 *
 * Extracts text from PDF, DOCX, and text resume files, then performs
 * deterministic NLP extraction to map candidate information into the
 * Talvyn UserProfile model without hallucinating missing fields.
 */

import mammoth from 'mammoth'

// Support both modern class and legacy function exports of pdf-parse
const pdfLib: any = require('pdf-parse')

export interface ExtractedEducation {
  institution?: string | null
  degree?: string | null
  specialization?: string | null
  graduationYear?: number | null
  cgpa?: string | null
}

export interface ExtractedExperience {
  company?: string | null
  title?: string | null
  duration?: string | null
  years?: number | null
  description?: string | null
}

export interface ExtractedResumeData {
  legalFullName: string | null
  givenName: string | null
  middleName: string | null
  familyName: string | null
  preferredName: string | null
  email: string | null
  phone: string | null
  country: string | null
  state: string | null
  city: string | null
  address: string | null
  postalCode: string | null
  preferredRoles: string[]
  skills: string[]
  experienceYears: number | null
  linkedinUrl: string | null
  githubUrl: string | null
  portfolioUrl: string | null
  otherLinks: string[]
  languages: string[]
  institution: string | null
  degree: string | null
  specialization: string | null
  cgpa: string | null
  graduationYear: number | null
  education: ExtractedEducation[]
  workExperience: ExtractedExperience[]
  certifications: string[]
  projects: string[]
  professionalSummary: string | null
  rawTextLength: number
}

export interface ResumeParseResult {
  extracted: ExtractedResumeData
  extractedFields: string[]
  rawText: string
}

// ─── Curated Taxonomies for Deterministic Extraction ─────────────────────────

const KNOWN_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'Dart', 'SQL',
  'React', 'React.js', 'React Native', 'Next.js', 'Vue', 'Vue.js', 'Nuxt.js', 'Angular', 'Svelte', 'Node.js', 'Express.js', 'NestJS', 'Django', 'FastAPI', 'Flask', 'Spring Boot', 'Ruby on Rails', 'ASP.NET', 'ASP.NET Core',
  'HTML', 'HTML5', 'CSS', 'CSS3', 'Tailwind CSS', 'Tailwind', 'Bootstrap', 'Sass', 'SCSS', 'Redux', 'GraphQL', 'REST APIs', 'WebSockets', 'TRPC',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Microsoft SQL Server', 'MSSQL', 'Cassandra', 'DynamoDB', 'Supabase', 'Firebase', 'Prisma', 'TypeORM', 'Mongoose',
  'Docker', 'Kubernetes', 'AWS', 'Amazon Web Services', 'Google Cloud Platform', 'GCP', 'Microsoft Azure', 'Azure', 'Linux', 'Terraform', 'CI/CD', 'GitHub Actions', 'Jenkins', 'Nginx',
  'Git', 'GitHub', 'GitLab', 'Jira', 'Figma', 'Postman', 'Webpack', 'Vite', 'Babel', 'Jest', 'Mocha', 'Cypress', 'Playwright', 'Selenium',
  'Machine Learning', 'Deep Learning', 'Artificial Intelligence', 'Natural Language Processing', 'Computer Vision', 'PyTorch', 'TensorFlow', 'Scikit-Learn', 'Pandas', 'NumPy', 'OpenCV', 'Hugging Face', 'Large Language Models', 'LLM',
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
  nuxt: 'Nuxt.js',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  spring: 'Spring Boot',
  springboot: 'Spring Boot',
  expressjs: 'Express.js',
  nest: 'NestJS',
  nestjs: 'NestJS',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  mssql: 'Microsoft SQL Server',
  k8s: 'Kubernetes',
  kube: 'Kubernetes',
  gcp: 'Google Cloud Platform',
  aws: 'Amazon Web Services',
  tf: 'Terraform',
  gql: 'GraphQL',
  rest: 'REST APIs',
  restful: 'REST APIs',
  ml: 'Machine Learning',
  ai: 'Artificial Intelligence',
  dl: 'Deep Learning',
  nlp: 'Natural Language Processing',
  cv: 'Computer Vision',
  llm: 'Large Language Models',
  figma: 'Figma',
}

const KNOWN_ROLES = [
  'Software Engineer', 'Frontend Developer', 'Frontend Engineer', 'Backend Developer', 'Backend Engineer',
  'Full Stack Developer', 'Full Stack Engineer', 'Software Developer', 'Web Developer', 'Mobile Developer',
  'iOS Developer', 'Android Developer', 'DevOps Engineer', 'Cloud Engineer', 'Site Reliability Engineer',
  'Data Engineer', 'Data Scientist', 'Data Analyst', 'Machine Learning Engineer', 'AI Engineer',
  'Product Manager', 'Project Manager', 'Technical Program Manager', 'UI/UX Designer', 'Product Designer',
  'QA Engineer', 'Automation Engineer', 'Security Engineer', 'Solutions Architect', 'Systems Engineer',
]

const KNOWN_DEGREES = [
  { match: /\b(B\.?Tech(?:nology)?|Bachelor of Technology)\b/i, value: 'B.Tech' },
  { match: /\b(B\.?E\.?|Bachelor of Engineering)\b/i, value: 'B.E.' },
  { match: /\b(M\.?Tech(?:nology)?|Master of Technology)\b/i, value: 'M.Tech' },
  { match: /\b(M\.?E\.?|Master of Engineering)\b/i, value: 'M.E.' },
  { match: /\b(BCA|Bachelor of Computer Applications)\b/i, value: 'BCA' },
  { match: /\b(MCA|Master of Computer Applications)\b/i, value: 'MCA' },
  { match: /\b(B\.?Sc(?:ience)?|Bachelor of Science)\b/i, value: 'B.Sc' },
  { match: /\b(M\.?Sc(?:ience)?|Master of Science)\b/i, value: 'M.Sc' },
  { match: /\b(BBA|Bachelor of Business Administration)\b/i, value: 'BBA' },
  { match: /\b(MBA|Master of Business Administration)\b/i, value: 'MBA' },
  { match: /\b(B\.?Com(?:merce)?|Bachelor of Commerce)\b/i, value: 'B.Com' },
  { match: /\b(M\.?Com(?:merce)?|Master of Commerce)\b/i, value: 'M.Com' },
  { match: /\b(B\.?A\.?|Bachelor of Arts)\b/i, value: 'B.A.' },
  { match: /\b(M\.?A\.?|Master of Arts)\b/i, value: 'M.A.' },
  { match: /\b(Ph\.?D\.?|Doctor of Philosophy|Doctorate)\b/i, value: 'PhD' },
  { match: /\b(Diploma)\b/i, value: 'Diploma' },
]

const KNOWN_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Mandarin', 'Chinese', 'Japanese', 'Hindi', 'Arabic',
  'Portuguese', 'Russian', 'Italian', 'Korean', 'Bengali', 'Tamil', 'Telugu', 'Malayalam', 'Marathi',
  'Kannada', 'Gujarati', 'Punjabi', 'Urdu', 'Dutch', 'Swedish', 'Polish',
]

const COMMON_CITIES = [
  { city: 'Bengaluru', state: 'Karnataka', country: 'India', aliases: ['Bangalore', 'Bengaluru'] },
  { city: 'Hyderabad', state: 'Telangana', country: 'India', aliases: ['Hyderabad'] },
  { city: 'Mumbai', state: 'Maharashtra', country: 'India', aliases: ['Mumbai', 'Bombay'] },
  { city: 'Pune', state: 'Maharashtra', country: 'India', aliases: ['Pune'] },
  { city: 'Chennai', state: 'Tamil Nadu', country: 'India', aliases: ['Chennai', 'Madras'] },
  { city: 'Delhi', state: 'Delhi', country: 'India', aliases: ['Delhi', 'New Delhi'] },
  { city: 'Noida', state: 'Uttar Pradesh', country: 'India', aliases: ['Noida'] },
  { city: 'Gurugram', state: 'Haryana', country: 'India', aliases: ['Gurugram', 'Gurgaon'] },
  { city: 'Kochi', state: 'Kerala', country: 'India', aliases: ['Kochi', 'Cochin'] },
  { city: 'Trivandrum', state: 'Kerala', country: 'India', aliases: ['Trivandrum', 'Thiruvananthapuram'] },
  { city: 'San Francisco', state: 'California', country: 'United States', aliases: ['San Francisco', 'SF'] },
  { city: 'New York', state: 'New York', country: 'United States', aliases: ['New York', 'NYC'] },
  { city: 'Seattle', state: 'Washington', country: 'United States', aliases: ['Seattle'] },
  { city: 'Austin', state: 'Texas', country: 'United States', aliases: ['Austin'] },
  { city: 'Boston', state: 'Massachusetts', country: 'United States', aliases: ['Boston'] },
  { city: 'London', state: 'England', country: 'United Kingdom', aliases: ['London'] },
  { city: 'Berlin', state: 'Berlin', country: 'Germany', aliases: ['Berlin'] },
  { city: 'Toronto', state: 'Ontario', country: 'Canada', aliases: ['Toronto'] },
  { city: 'Singapore', state: 'Singapore', country: 'Singapore', aliases: ['Singapore'] },
]

export class ResumeParserService {
  /**
   * Extracts raw text from an uploaded resume buffer.
   */
  async extractTextFromBuffer(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))

    let rawText = ''

    if (ext === '.pdf' || mimeType === 'application/pdf') {
      try {
        if (pdfLib && typeof pdfLib.PDFParse === 'function') {
          const parser = new pdfLib.PDFParse({ data: buffer })
          try {
            const parsed = await parser.getText()
            rawText = parsed?.text || ''
          } finally {
            if (typeof parser.destroy === 'function') {
              await parser.destroy().catch(() => {})
            }
          }
        } else if (typeof pdfLib === 'function') {
          const parsed = await pdfLib(buffer)
          rawText = parsed?.text || ''
        } else if (pdfLib && typeof pdfLib.default === 'function') {
          const parsed = await pdfLib.default(buffer)
          rawText = parsed?.text || ''
        }
      } catch (err: any) {
        throw new Error(`Failed to parse PDF document: ${err?.message || 'File may be password protected or corrupted.'}`)
      }
    } else if (
      ext === '.docx' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer })
        rawText = result.value || ''
      } catch (err: any) {
        throw new Error(`Failed to parse DOCX document: ${err?.message || 'File may be corrupted.'}`)
      }
    } else if (ext === '.doc' || mimeType === 'application/msword') {
      // Legacy binary DOC: attempt text extraction from ASCII/UTF-8 streams or fail with clear instruction
      const textCandidate = buffer.toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      const cleaned = textCandidate.replace(/\s+/g, ' ').trim()
      if (cleaned.length > 80 && /[a-zA-Z]{3,}/.test(cleaned)) {
        rawText = cleaned
      } else {
        throw new Error('Legacy .DOC binary format is not supported. Please save or export your resume as PDF or DOCX.')
      }
    } else if (ext === '.txt' || mimeType === 'text/plain') {
      rawText = buffer.toString('utf8')
    } else {
      throw new Error(`Unsupported resume format: ${ext}. Please upload a PDF, DOC, or DOCX document.`)
    }

    const trimmed = rawText.trim()
    if (!trimmed || trimmed.length < 20) {
      throw new Error('Uploaded resume contains no readable text. Please ensure it is not a scanned image without OCR.')
    }

    return trimmed
  }

  /**
   * Deterministically parses candidate information from raw resume text.
   */
  extractProfileFromText(
    text: string,
    existingContext?: { email?: string; givenName?: string }
  ): ResumeParseResult {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const extractedFields: string[] = []

    // 1. Email Extraction
    let email: string | null = null
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    if (emailMatch) {
      email = emailMatch[0].toLowerCase()
      extractedFields.push('email')
    } else if (existingContext?.email) {
      email = existingContext.email
    }

    // 2. Phone Extraction
    let phone: string | null = null
    const phoneMatch = text.match(
      /(?:(?:\+|00)\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}/
    )
    if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10) {
      phone = phoneMatch[0].trim()
      extractedFields.push('phone')
    }

    // 3. Name Extraction
    let fullName: string | null = null
    let givenName: string | null = null
    let middleName: string | null = null
    let familyName: string | null = null

    // Look at the top 8 lines for candidate name
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i]
      // Skip if line contains email, url, phone, or section headers
      if (
        /@/.test(line) ||
        /https?:\/\//i.test(line) ||
        /\.com/i.test(line) ||
        /\d{5,}/.test(line) ||
        /^(curriculum vitae|resume|profile|summary|objective|contact|experience|education)/i.test(line)
      ) {
        continue
      }

      // Check if candidate line looks like a valid name (2 to 4 words, letters/spaces/periods)
      const cleaned = line.replace(/[^a-zA-Z\s.'-]/g, '').trim()
      const words = cleaned.split(/\s+/).filter(Boolean)
      if (words.length >= 2 && words.length <= 4 && cleaned.length >= 4 && cleaned.length <= 40) {
        // Must start with capitalized letters
        if (words.every((w) => /^[A-Z]/.test(w) || w.length <= 3)) {
          fullName = words.join(' ')
          givenName = words[0]
          if (words.length === 2) {
            familyName = words[1]
          } else if (words.length === 3) {
            middleName = words[1]
            familyName = words[2]
          } else {
            middleName = words.slice(1, -1).join(' ')
            familyName = words[words.length - 1]
          }
          extractedFields.push('legalFullName', 'givenName')
          if (familyName) extractedFields.push('familyName')
          break
        }
      }
    }

    // Fallback name from existing given name if not detected
    if (!fullName && existingContext?.givenName) {
      givenName = existingContext.givenName
      fullName = givenName
      extractedFields.push('givenName')
    }

    // 4. Links Extraction
    let linkedinUrl: string | null = null
    const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-\.]+)/i)
    if (linkedinMatch) {
      linkedinUrl = linkedinMatch[0].startsWith('http') ? linkedinMatch[0] : `https://${linkedinMatch[0]}`
      extractedFields.push('linkedinUrl')
    }

    let githubUrl: string | null = null
    const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-\.]+)/i)
    if (githubMatch) {
      githubUrl = githubMatch[0].startsWith('http') ? githubMatch[0] : `https://${githubMatch[0]}`
      extractedFields.push('githubUrl')
    }

    let portfolioUrl: string | null = null
    const otherLinks: string[] = []
    const urlMatches = text.matchAll(/https?:\/\/[^\s<>"]+/gi)
    for (const match of urlMatches) {
      const u = match[0].replace(/[.,;)]+$/, '')
      if (u.includes('linkedin.com') || u.includes('github.com')) continue
      if (!portfolioUrl && /(portfolio|me\.|dev\.|io\.|site|personal)/i.test(u)) {
        portfolioUrl = u
        extractedFields.push('portfolioUrl')
      } else if (!otherLinks.includes(u)) {
        otherLinks.push(u)
      }
    }
    if (otherLinks.length > 0) extractedFields.push('otherLinks')

    // 5. Location Extraction (City, State, Country)
    let city: string | null = null
    let state: string | null = null
    let country: string | null = null
    let postalCode: string | null = null

    for (const item of COMMON_CITIES) {
      for (const alias of item.aliases) {
        const regex = new RegExp(`\\b${alias}\\b`, 'i')
        if (regex.test(text)) {
          city = item.city
          state = item.state
          country = item.country
          extractedFields.push('city', 'state', 'country')
          break
        }
      }
      if (city) break
    }

    const postalMatch = text.match(/\b\d{5,6}\b/)
    if (postalMatch && !phone?.includes(postalMatch[0])) {
      postalCode = postalMatch[0]
      extractedFields.push('postalCode')
    }

    // 6. Skills Extraction
    const detectedSkills = new Set<string>()

    // Check curated skills
    for (const skill of KNOWN_SKILLS) {
      const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
      const regex = new RegExp(`(^|[^a-zA-Z0-9_#+])${escaped}([^a-zA-Z0-9_#+]|$)`, 'i')
      if (regex.test(text)) {
        detectedSkills.add(skill)
      }
    }

    // Check synonyms
    for (const [synonym, standard] of Object.entries(SKILL_SYNONYMS)) {
      const regex = new RegExp(`\\b${synonym}\\b`, 'i')
      if (regex.test(text)) {
        detectedSkills.add(standard)
      }
    }

    const skills = Array.from(detectedSkills)
    if (skills.length > 0) extractedFields.push('skills')

    // 7. Preferred Roles Extraction
    const detectedRoles = new Set<string>()
    for (const role of KNOWN_ROLES) {
      const regex = new RegExp(`\\b${role.replace('/', '\\/')}\\b`, 'i')
      if (regex.test(text)) {
        detectedRoles.add(role)
      }
    }
    const preferredRoles = Array.from(detectedRoles).slice(0, 4)
    if (preferredRoles.length > 0) extractedFields.push('preferredRoles')

    // 8. Education Extraction
    let degree: string | null = null
    for (const d of KNOWN_DEGREES) {
      if (d.match.test(text)) {
        degree = d.value
        extractedFields.push('degree')
        break
      }
    }

    // Detect Institution / University
    let institution: string | null = null
    for (const line of lines) {
      const cleanLine = line.replace(/^[#*\-•\s]+/, '').trim()
      if (/^(education|degree|cgpa|gpa|score|percentage|graduation|year)/i.test(cleanLine)) continue
      if (/\b(University|Institute|College|Academy|IIT|NIT|BITS|Polytechnic)\b/i.test(cleanLine)) {
        if (cleanLine.length >= 4 && cleanLine.length <= 80 && !/\b(Bachelor|Master|B\.?Tech|B\.?E)\b/i.test(cleanLine)) {
          institution = cleanLine
          extractedFields.push('institution')
          break
        }
      }
    }

    // Detect Graduation Year (e.g. 2018 - 2030)
    let graduationYear: number | null = null
    const explicitYearMatch = text.match(/(?:Graduation\s*Year|Graduated|Class\s*of|Batch)\s*[:\-–]?\s*(20\d{2})/i)
    if (explicitYearMatch) {
      graduationYear = parseInt(explicitYearMatch[1], 10)
      extractedFields.push('graduationYear')
    } else {
      const eduSectionMatch = text.match(/(?:EDUCATION|ACADEMICS)([\s\S]*?)(?:SKILLS|EXPERIENCE|PROJECTS|CERTIFICATIONS|$)/i)
      const searchScope = eduSectionMatch ? eduSectionMatch[1] : text
      const yearMatches = Array.from(searchScope.matchAll(/\b(20(?:1[5-9]|2[0-9]|3[0-2]))\b/g))
      if (yearMatches.length > 0) {
        const years = yearMatches.map((m) => parseInt(m[1], 10))
        graduationYear = Math.max(...years)
        extractedFields.push('graduationYear')
      }
    }

    // Specialization / Major
    let specialization: string | null = null
    const specMatch = text.match(
      /(?:in|of)\s+([A-Z][a-zA-Z\s]+(?:Computer Science|Information Technology|Engineering|Data Science|Artificial Intelligence|Cybersecurity|Mechanical|Electrical|Civil|Electronics|Business|Economics|Finance))/i
    )
    if (specMatch) {
      specialization = specMatch[1].trim()
      extractedFields.push('specialization')
    }

    // CGPA / GPA
    let cgpa: string | null = null
    const cgpaMatch = text.match(/(?:CGPA|GPA|Score|Percentage):\s*([0-9.]+(?:\s*(?:\/|out of)\s*10|\s*(?:\/|out of)\s*4|%?))/i)
    if (cgpaMatch) {
      cgpa = cgpaMatch[1].trim()
      extractedFields.push('cgpa')
    }

    const education: ExtractedEducation[] = []
    if (degree || institution || graduationYear) {
      education.push({
        institution,
        degree,
        specialization,
        graduationYear,
        cgpa,
      })
      extractedFields.push('education')
    }

    // 9. Work Experience & Years
    let experienceYears: number | null = null
    const expYearMatch = text.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/i)
    if (expYearMatch) {
      experienceYears = Math.round(parseFloat(expYearMatch[1]))
      extractedFields.push('experienceYears')
    } else {
      const spanMatch = text.match(/\b(201\d|202\d)\s*[-–to]+\s*(201\d|202\d|present|current)\b/i)
      if (spanMatch) {
        const start = parseInt(spanMatch[1], 10)
        const end = /present|current/i.test(spanMatch[2]) ? new Date().getFullYear() : parseInt(spanMatch[2], 10)
        if (end >= start && end - start <= 40) {
          experienceYears = Math.max(1, end - start)
          extractedFields.push('experienceYears')
        }
      }
    }

    const workExperience: ExtractedExperience[] = []
    const expSectionMatch = text.match(/(?:EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE)([\s\S]*?)(?:EDUCATION|PROJECTS|SKILLS|CERTIFICATIONS|$)/i)
    if (expSectionMatch) {
      const expSnippet = expSectionMatch[1].trim()
      const roleMatches = expSnippet.split(/\n\s*\n/)
      for (const block of roleMatches.slice(0, 4)) {
        const blines = block.split(/\n/).map((s) => s.trim()).filter(Boolean)
        if (blines.length >= 2) {
          workExperience.push({
            title: blines[0].slice(0, 60),
            company: blines[1].slice(0, 60),
            description: blines.slice(2).join(' ').slice(0, 250) || null,
          })
        }
      }
      if (workExperience.length > 0) extractedFields.push('workExperience')
    }

    // 10. Languages Extraction
    const detectedLanguages = new Set<string>()
    for (const lang of KNOWN_LANGUAGES) {
      const regex = new RegExp(`\\b${lang}\\b`, 'i')
      if (regex.test(text)) {
        detectedLanguages.add(lang)
      }
    }
    const languages = Array.from(detectedLanguages)
    if (languages.length > 0) extractedFields.push('languages')

    // 11. Professional Summary / Bio Extraction
    let professionalSummary: string | null = null
    const summaryMatch = text.match(/(?:SUMMARY|PROFESSIONAL SUMMARY|ABOUT ME|PROFILE|OBJECTIVE)\s*\n+([\s\S]*?)(?=\n\s*(?:EXPERIENCE|WORK|EDUCATION|SKILLS|PROJECTS|$))/i)
    if (summaryMatch) {
      const summaryClean = summaryMatch[1].replace(/\s+/g, ' ').trim()
      if (summaryClean.length >= 30 && summaryClean.length <= 600) {
        professionalSummary = summaryClean
        extractedFields.push('professionalSummary')
      }
    }

    // 12. Certifications
    const certifications: string[] = []
    const certSection = text.match(/(?:CERTIFICATIONS|LICENSES & CERTIFICATIONS|COURSES)([\s\S]*?)(?=\n\s*(?:EDUCATION|EXPERIENCE|PROJECTS|SKILLS|$))/i)
    if (certSection) {
      const certLines = certSection[1].split(/\n/).map((s) => s.replace(/^[-•*]\s*/, '').trim()).filter((s) => s.length >= 5 && s.length <= 80)
      certifications.push(...certLines.slice(0, 5))
      if (certifications.length > 0) extractedFields.push('certifications')
    }

    // 13. Projects
    const projects: string[] = []
    const projSection = text.match(/(?:PROJECTS|PERSONAL PROJECTS|KEY PROJECTS)([\s\S]*?)(?=\n\s*(?:EDUCATION|EXPERIENCE|CERTIFICATIONS|SKILLS|$))/i)
    if (projSection) {
      const projLines = projSection[1].split(/\n\s*\n/).map((p) => p.split('\n')[0].replace(/^[-•*]\s*/, '').trim()).filter((s) => s.length >= 4 && s.length <= 70)
      projects.push(...projLines.slice(0, 5))
      if (projects.length > 0) extractedFields.push('projects')
    }

    return {
      extracted: {
        legalFullName: fullName,
        givenName,
        middleName,
        familyName,
        preferredName: givenName,
        email,
        phone,
        country,
        state,
        city,
        address: null,
        postalCode,
        preferredRoles,
        skills,
        experienceYears,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        otherLinks,
        languages,
        institution,
        degree,
        specialization,
        cgpa,
        graduationYear,
        education,
        workExperience,
        certifications,
        projects,
        professionalSummary,
        rawTextLength: text.length,
      },
      extractedFields,
      rawText: text,
    }
  }
}

export const resumeParserService = new ResumeParserService()
