/**
 * Talvyn Preferred Roles Taxonomy & Search (Phase 2E.1)
 * Covers all major industry domains with synonym matching.
 */

export interface RoleOption {
  title: string
  domain: string
  aliases?: string[]
}

export const ROLE_SYNONYMS: Record<string, string> = {
  sde: 'Software Engineer',
  swe: 'Software Engineer',
  frontend: 'Frontend Developer',
  fe: 'Frontend Developer',
  backend: 'Backend Developer',
  be: 'Backend Developer',
  fullstack: 'Full Stack Developer',
  fs: 'Full Stack Developer',
  devops: 'DevOps Engineer',
  sre: 'Site Reliability Engineer',
  ml: 'Machine Learning Engineer',
  mle: 'Machine Learning Engineer',
  ds: 'Data Scientist',
  da: 'Data Analyst',
  de: 'Data Engineer',
  pm: 'Product Manager',
  apm: 'Associate Product Manager',
  tpm: 'Technical Product Manager',
  em: 'Engineering Manager',
  uiux: 'UI/UX Designer',
  ux: 'UX Designer',
  qa: 'QA Engineer',
  sdet: 'SDET (Software Development Engineer in Test)',
}

export const ROLES_TAXONOMY: RoleOption[] = [
  // ─── 1. Software & Engineering ─────────────────────────────────────────────
  { title: 'Software Engineer', domain: 'Software Engineering', aliases: ['sde', 'swe', 'software developer', 'programmer'] },
  { title: 'Frontend Developer', domain: 'Software Engineering', aliases: ['frontend engineer', 'ui developer', 'web developer'] },
  { title: 'Backend Developer', domain: 'Software Engineering', aliases: ['backend engineer', 'server-side developer', 'api engineer'] },
  { title: 'Full Stack Developer', domain: 'Software Engineering', aliases: ['full stack engineer', 'fullstack developer'] },
  { title: 'Mobile App Developer', domain: 'Software Engineering', aliases: ['ios developer', 'android developer', 'react native developer', 'flutter developer'] },
  { title: 'Java Developer', domain: 'Software Engineering', aliases: ['java backend engineer', 'spring boot developer'] },
  { title: 'Python Developer', domain: 'Software Engineering', aliases: ['python backend developer', 'django developer'] },
  { title: 'Node.js Developer', domain: 'Software Engineering', aliases: ['javascript developer', 'express developer'] },
  { title: 'C++ / Systems Engineer', domain: 'Software Engineering', aliases: ['embedded systems', 'c++ developer', 'firmware engineer'] },
  { title: 'Engineering Manager', domain: 'Software Engineering', aliases: ['tech lead', 'team lead', 'engineering director'] },

  // ─── 2. Data & Analytics ──────────────────────────────────────────────────
  { title: 'Data Analyst', domain: 'Data & Analytics', aliases: ['business intelligence analyst', 'bi analyst', 'analytics consultant'] },
  { title: 'Data Scientist', domain: 'Data & Analytics', aliases: ['data science specialist', 'quantitative analyst'] },
  { title: 'Data Engineer', domain: 'Data & Analytics', aliases: ['big data engineer', 'etl developer', 'data platform engineer'] },
  { title: 'Business Analyst', domain: 'Data & Analytics', aliases: ['functional analyst', 'business systems analyst'] },

  // ─── 3. AI / Machine Learning ─────────────────────────────────────────────
  { title: 'Machine Learning Engineer', domain: 'AI & Machine Learning', aliases: ['mle', 'ml engineer', 'applied scientist'] },
  { title: 'AI Research Scientist', domain: 'AI & Machine Learning', aliases: ['deep learning researcher', 'ai engineer'] },
  { title: 'NLP / Computer Vision Engineer', domain: 'AI & Machine Learning', aliases: ['nlp engineer', 'cv engineer'] },
  { title: 'GenAI / Prompt Engineer', domain: 'AI & Machine Learning', aliases: ['llm engineer', 'ai application developer'] },

  // ─── 4. Cloud & DevOps ────────────────────────────────────────────────────
  { title: 'DevOps Engineer', domain: 'Cloud & Infrastructure', aliases: ['cloud engineer', 'infrastructure engineer'] },
  { title: 'Site Reliability Engineer (SRE)', domain: 'Cloud & Infrastructure', aliases: ['sre', 'reliability engineer', 'production engineer'] },
  { title: 'Cloud Solutions Architect', domain: 'Cloud & Infrastructure', aliases: ['aws architect', 'cloud consultant', 'azure architect'] },

  // ─── 5. QA & Testing ──────────────────────────────────────────────────────
  { title: 'QA Automation Engineer', domain: 'Quality Assurance', aliases: ['test automation engineer', 'qa analyst', 'test lead'] },
  { title: 'SDET (Software Development Engineer in Test)', domain: 'Quality Assurance', aliases: ['sdet', 'test automation developer'] },

  // ─── 6. Cybersecurity ─────────────────────────────────────────────────────
  { title: 'Cybersecurity Analyst', domain: 'Security', aliases: ['infosec analyst', 'soc analyst', 'security engineer'] },
  { title: 'Penetration Tester / Ethical Hacker', domain: 'Security', aliases: ['pen tester', 'vulnerability analyst', 'red team'] },

  // ─── 7. Product & Design ──────────────────────────────────────────────────
  { title: 'Product Manager', domain: 'Product & Design', aliases: ['pm', 'product owner', 'group product manager'] },
  { title: 'Associate Product Manager', domain: 'Product & Design', aliases: ['apm', 'junior product manager'] },
  { title: 'Technical Product Manager', domain: 'Product & Design', aliases: ['tpm', 'technical pm'] },
  { title: 'UI/UX Designer', domain: 'Product & Design', aliases: ['product designer', 'ux designer', 'ui designer'] },
  { title: 'Graphic / Visual Designer', domain: 'Product & Design', aliases: ['visual designer', 'brand designer', 'illustrator'] },

  // ─── 8. Marketing & Sales ─────────────────────────────────────────────────
  { title: 'Digital Marketing Specialist', domain: 'Marketing & Sales', aliases: ['growth marketer', 'performance marketer', 'seo specialist'] },
  { title: 'Content Strategist / Copywriter', domain: 'Marketing & Sales', aliases: ['content writer', 'technical writer', 'copywriter'] },
  { title: 'Business Development Executive', domain: 'Marketing & Sales', aliases: ['bde', 'b2b sales', 'account executive'] },
  { title: 'Sales Account Manager', domain: 'Marketing & Sales', aliases: ['client relationship manager', 'customer success manager'] },

  // ─── 9. Finance & HR & Operations ─────────────────────────────────────────
  { title: 'Financial Analyst', domain: 'Finance & Operations', aliases: ['investment analyst', 'fp&a analyst', 'accountant'] },
  { title: 'HR Generalist / Recruiter', domain: 'Human Resources', aliases: ['talent acquisition specialist', 'technical recruiter', 'hr manager'] },
  { title: 'Operations Manager', domain: 'Finance & Operations', aliases: ['operations analyst', 'supply chain manager', 'project coordinator'] },
]

export function searchRoles(query: string, maxResults = 15): RoleOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return ROLES_TAXONOMY.slice(0, maxResults)

  // Check synonym first
  const synonymTarget = ROLE_SYNONYMS[q] || ROLE_SYNONYMS[q.replace(/[\s._-]/g, '')]
  if (synonymTarget) {
    const directMatch = ROLES_TAXONOMY.find(
      (r) => r.title.toLowerCase() === synonymTarget.toLowerCase()
    )
    if (directMatch) {
      const rest = ROLES_TAXONOMY.filter((r) => r.title !== directMatch.title && r.domain === directMatch.domain)
      return [directMatch, ...rest].slice(0, maxResults)
    }
  }

  const exact: RoleOption[] = []
  const prefix: RoleOption[] = []
  const contains: RoleOption[] = []

  for (const r of ROLES_TAXONOMY) {
    const lowerTitle = r.title.toLowerCase()
    const matchAlias = r.aliases?.some((a) => a.includes(q))

    if (lowerTitle === q) {
      exact.push(r)
    } else if (lowerTitle.startsWith(q) || r.aliases?.some((a) => a.startsWith(q))) {
      prefix.push(r)
    } else if (lowerTitle.includes(q) || r.domain.toLowerCase().includes(q) || matchAlias) {
      contains.push(r)
    }
  }

  const results = [...exact, ...prefix, ...contains]
  return results.slice(0, maxResults)
}
