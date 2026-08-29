/**
 * Talvyn Universal Role Taxonomy & Normalization Engine (Phase 2B)
 *
 * Designed for all career domains (Software, Data, Design, Marketing, HR, Finance,
 * Operations, Sales, Customer Success, Product, Business, etc.).
 *
 * Deterministic rules only — no AI.
 */

// ─── Seniority Prefixes and Suffixes ─────────────────────────────────────────

export interface SeniorityInfo {
  level: 'INTERN' | 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'STAFF_PLUS' | 'DIRECTOR_PLUS' | 'UNSPECIFIED'
  yearsMin: number
  yearsMax?: number
  matchedTerm?: string
}

const SENIORITY_MAP: Record<string, SeniorityInfo> = {
  // Intern / Trainee (0 yrs)
  intern: { level: 'INTERN', yearsMin: 0, yearsMax: 1, matchedTerm: 'intern' },
  internship: { level: 'INTERN', yearsMin: 0, yearsMax: 1, matchedTerm: 'internship' },
  trainee: { level: 'INTERN', yearsMin: 0, yearsMax: 1, matchedTerm: 'trainee' },
  apprentice: { level: 'INTERN', yearsMin: 0, yearsMax: 1, matchedTerm: 'apprentice' },
  fellow: { level: 'INTERN', yearsMin: 0, yearsMax: 1, matchedTerm: 'fellow' },

  // Entry / Junior (0 - 2 yrs)
  junior: { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'junior' },
  'jr.': { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'jr.' },
  jr: { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'jr' },
  'entry level': { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'entry level' },
  'entry-level': { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'entry-level' },
  associate: { level: 'ENTRY', yearsMin: 0, yearsMax: 3, matchedTerm: 'associate' },
  graduate: { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'graduate' },
  level1: { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'level 1' },
  'level 1': { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'level 1' },
  'level i': { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'level i' },
  ' i': { level: 'ENTRY', yearsMin: 0, yearsMax: 2, matchedTerm: 'i' },

  // Mid (2 - 5 yrs)
  mid: { level: 'MID', yearsMin: 2, yearsMax: 5, matchedTerm: 'mid' },
  'mid-level': { level: 'MID', yearsMin: 2, yearsMax: 5, matchedTerm: 'mid-level' },
  'intermediate': { level: 'MID', yearsMin: 2, yearsMax: 5, matchedTerm: 'intermediate' },
  level2: { level: 'MID', yearsMin: 2, yearsMax: 5, matchedTerm: 'level 2' },
  'level 2': { level: 'MID', yearsMin: 2, yearsMax: 5, matchedTerm: 'level 2' },
  'level ii': { level: 'MID', yearsMin: 2, yearsMax: 5, matchedTerm: 'level ii' },
  ' ii': { level: 'MID', yearsMin: 2, yearsMax: 5, matchedTerm: 'ii' },

  // Senior (5 - 8 yrs)
  senior: { level: 'SENIOR', yearsMin: 5, yearsMax: 8, matchedTerm: 'senior' },
  'sr.': { level: 'SENIOR', yearsMin: 5, yearsMax: 8, matchedTerm: 'sr.' },
  sr: { level: 'SENIOR', yearsMin: 5, yearsMax: 8, matchedTerm: 'sr' },
  level3: { level: 'SENIOR', yearsMin: 5, yearsMax: 8, matchedTerm: 'level 3' },
  'level 3': { level: 'SENIOR', yearsMin: 5, yearsMax: 8, matchedTerm: 'level 3' },
  'level iii': { level: 'SENIOR', yearsMin: 5, yearsMax: 8, matchedTerm: 'level iii' },
  ' iii': { level: 'SENIOR', yearsMin: 5, yearsMax: 8, matchedTerm: 'iii' },
  experienced: { level: 'SENIOR', yearsMin: 4, yearsMax: 8, matchedTerm: 'experienced' },

  // Lead (6 - 10 yrs)
  lead: { level: 'LEAD', yearsMin: 6, yearsMax: 10, matchedTerm: 'lead' },
  'team lead': { level: 'LEAD', yearsMin: 6, yearsMax: 10, matchedTerm: 'team lead' },
  'tech lead': { level: 'LEAD', yearsMin: 6, yearsMax: 10, matchedTerm: 'tech lead' },
  principal: { level: 'STAFF_PLUS', yearsMin: 8, matchedTerm: 'principal' },
  staff: { level: 'STAFF_PLUS', yearsMin: 8, matchedTerm: 'staff' },
  distinguished: { level: 'STAFF_PLUS', yearsMin: 12, matchedTerm: 'distinguished' },
  fellow2: { level: 'STAFF_PLUS', yearsMin: 15, matchedTerm: 'fellow' },

  // Management / Director / Executive
  'executive director': { level: 'DIRECTOR_PLUS', yearsMin: 10, matchedTerm: 'executive director' },
  'vice president': { level: 'DIRECTOR_PLUS', yearsMin: 10, matchedTerm: 'vice president' },
  vp: { level: 'DIRECTOR_PLUS', yearsMin: 10, matchedTerm: 'vp' },
  director: { level: 'DIRECTOR_PLUS', yearsMin: 8, matchedTerm: 'director' },
  'head of': { level: 'DIRECTOR_PLUS', yearsMin: 8, matchedTerm: 'head of' },
  chief: { level: 'DIRECTOR_PLUS', yearsMin: 12, matchedTerm: 'chief' },
}

// Words that are purely seniority modifiers to strip when deriving core role
const SENIORITY_MODIFIERS = [
  'senior',
  'sr.',
  'sr',
  'junior',
  'jr.',
  'jr',
  'entry-level',
  'entry level',
  'lead',
  'principal',
  'staff',
  'intern',
  'internship',
  'trainee',
  'apprentice',
  'graduate',
  'experienced',
  'mid-level',
  'level 1',
  'level 2',
  'level 3',
  'level i',
  'level ii',
  'level iii',
]

// ─── Noise and Fluff Words to Strip During Normalization ───────────────────────

const FLUFF_PATTERNS = [
  /\b(urgent|urgently hiring|immediate hiring|hiring now|we're hiring|apply now|remote|hybrid|onsite|on-site|full-time|part-time|contract|temporary|wfh|work from home|multiple openings|100% remote)\b/gi,
  /\b(\[.*?\]|\(.*?\))\b/g, // Bracketed notes like "(Remote)", "[NYC]"
  /\s+[-–|•#]\s+.*$/g, // Cut off trailing metadata like " - Acme Corp" or " | Remote"
  /[^\w\s/]/g, // Non-alphanumeric punctuation except slash
  /\//g, // Convert slash (UX/UI) to space
  /\s+/g, // Extra whitespace
]

// ─── Universal Role Taxonomy & Synonym Clusters ───────────────────────────────
// Grouped into canonical keys and their synonyms/related variations.

export interface RoleSynonymCluster {
  canonical: string
  domain: string
  synonyms: string[] // Strong related (0.8 score)
  broaderRelated: string[] // Related (0.6 score)
}

export const ROLE_TAXONOMY: RoleSynonymCluster[] = [
  // ── DATA & AI ─────────────────────────────────────────────────────────────
  {
    canonical: 'data analyst',
    domain: 'Data',
    synonyms: [
      'analytics associate',
      'reporting analyst',
      'bi analyst',
      'business intelligence analyst',
      'data analytics specialist',
      'product analyst',
      'operations data analyst',
      'sql data analyst',
      'insights analyst',
      'metrics analyst',
    ],
    broaderRelated: [
      'data scientist',
      'business analyst',
      'data engineer',
      'analytics engineer',
      'quantitative analyst',
    ],
  },
  {
    canonical: 'data scientist',
    domain: 'Data',
    synonyms: [
      'machine learning scientist',
      'applied scientist',
      'ai scientist',
      'decision scientist',
      'ml researcher',
      'statistical modeler',
      'data science specialist',
    ],
    broaderRelated: [
      'data analyst',
      'machine learning engineer',
      'ai engineer',
      'quantitative researcher',
      'statistician',
    ],
  },
  {
    canonical: 'data engineer',
    domain: 'Data',
    synonyms: [
      'big data engineer',
      'etl developer',
      'data platform engineer',
      'data warehouse engineer',
      'analytics engineer',
      'data pipeline engineer',
      'sql developer',
    ],
    broaderRelated: [
      'data analyst',
      'data scientist',
      'backend engineer',
      'database administrator',
      'cloud data architect',
    ],
  },
  {
    canonical: 'machine learning engineer',
    domain: 'Data',
    synonyms: [
      'ml engineer',
      'ai engineer',
      'mlops engineer',
      'deep learning engineer',
      'nlp engineer',
      'computer vision engineer',
      'ai developer',
    ],
    broaderRelated: [
      'data scientist',
      'data engineer',
      'software engineer',
      'backend engineer',
    ],
  },
  {
    canonical: 'business intelligence analyst',
    domain: 'Data',
    synonyms: [
      'bi analyst',
      'bi developer',
      'power bi developer',
      'tableau developer',
      'bi specialist',
      'reporting specialist',
    ],
    broaderRelated: [
      'data analyst',
      'business analyst',
      'data engineer',
    ],
  },

  // ── SOFTWARE & ENGINEERING ────────────────────────────────────────────────
  {
    canonical: 'software engineer',
    domain: 'Software',
    synonyms: [
      'software developer',
      'programmer',
      'application developer',
      'systems developer',
      'software architect',
      'sde',
      'swe',
    ],
    broaderRelated: [
      'fullstack developer',
      'frontend developer',
      'backend developer',
      'devops engineer',
      'mobile developer',
    ],
  },
  {
    canonical: 'frontend developer',
    domain: 'Software',
    synonyms: [
      'frontend engineer',
      'front end developer',
      'front-end engineer',
      'ui developer',
      'ui engineer',
      'web developer',
      'react developer',
      'javascript developer',
      'client side engineer',
    ],
    broaderRelated: [
      'software engineer',
      'fullstack developer',
      'ui designer',
      'product designer',
    ],
  },
  {
    canonical: 'backend developer',
    domain: 'Software',
    synonyms: [
      'backend engineer',
      'back end developer',
      'back-end engineer',
      'server side developer',
      'api developer',
      'node developer',
      'python developer',
      'java developer',
      'golang developer',
    ],
    broaderRelated: [
      'software engineer',
      'fullstack developer',
      'data engineer',
      'devops engineer',
      'cloud engineer',
    ],
  },
  {
    canonical: 'fullstack developer',
    domain: 'Software',
    synonyms: [
      'fullstack engineer',
      'full stack developer',
      'full-stack engineer',
      'web application engineer',
    ],
    broaderRelated: [
      'software engineer',
      'frontend developer',
      'backend developer',
      'mobile developer',
    ],
  },
  {
    canonical: 'mobile developer',
    domain: 'Software',
    synonyms: [
      'mobile engineer',
      'ios developer',
      'android developer',
      'ios engineer',
      'android engineer',
      'flutter developer',
      'react native developer',
      'mobile app developer',
    ],
    broaderRelated: [
      'software engineer',
      'frontend developer',
    ],
  },
  {
    canonical: 'devops engineer',
    domain: 'Software',
    synonyms: [
      'site reliability engineer',
      'sre',
      'cloud engineer',
      'platform engineer',
      'infrastructure engineer',
      'cloud architect',
      'systems engineer',
      'sysadmin',
    ],
    broaderRelated: [
      'backend developer',
      'software engineer',
      'security engineer',
      'network engineer',
    ],
  },
  {
    canonical: 'qa engineer',
    domain: 'Software',
    synonyms: [
      'quality assurance engineer',
      'sdet',
      'software development engineer in test',
      'automation test engineer',
      'test engineer',
      'qa automation engineer',
      'tester',
    ],
    broaderRelated: [
      'software engineer',
      'devops engineer',
    ],
  },
  {
    canonical: 'cybersecurity analyst',
    domain: 'Security',
    synonyms: [
      'security analyst',
      'information security analyst',
      'infosec engineer',
      'security engineer',
      'soc analyst',
      'penetration tester',
      'threat analyst',
    ],
    broaderRelated: [
      'devops engineer',
      'systems engineer',
      'network engineer',
    ],
  },

  // ── PRODUCT & PROJECT MANAGEMENT ──────────────────────────────────────────
  {
    canonical: 'product manager',
    domain: 'Product',
    synonyms: [
      'technical product manager',
      'tpm',
      'associate product manager',
      'apm',
      'group product manager',
      'product lead',
      'product owner',
      'digital product manager',
    ],
    broaderRelated: [
      'project manager',
      'program manager',
      'business analyst',
      'scrum master',
      'product marketing manager',
    ],
  },
  {
    canonical: 'project manager',
    domain: 'Project Management',
    synonyms: [
      'technical project manager',
      'it project manager',
      'scrum master',
      'agile coach',
      'delivery manager',
      'project coordinator',
      'pmo analyst',
    ],
    broaderRelated: [
      'program manager',
      'product manager',
      'operations manager',
    ],
  },
  {
    canonical: 'program manager',
    domain: 'Project Management',
    synonyms: [
      'technical program manager',
      'tpm',
      'strategic program manager',
      'transformation manager',
    ],
    broaderRelated: [
      'project manager',
      'product manager',
      'operations director',
    ],
  },
  {
    canonical: 'business analyst',
    domain: 'Business',
    synonyms: [
      'business systems analyst',
      'it business analyst',
      'requirements analyst',
      'functional analyst',
      'strategy analyst',
      'process analyst',
    ],
    broaderRelated: [
      'product manager',
      'data analyst',
      'project manager',
      'operations analyst',
    ],
  },

  // ── DESIGN & CREATIVE ─────────────────────────────────────────────────────
  {
    canonical: 'product designer',
    domain: 'Design',
    synonyms: [
      'ux designer',
      'ui designer',
      'ui ux designer',
      'ui/ux designer',
      'user experience designer',
      'interaction designer',
      'digital designer',
      'experience designer',
    ],
    broaderRelated: [
      'ux researcher',
      'visual designer',
      'graphic designer',
      'frontend developer',
      'design system engineer',
    ],
  },
  {
    canonical: 'ux researcher',
    domain: 'Design',
    synonyms: [
      'user researcher',
      'design researcher',
      'user experience researcher',
      'usability analyst',
      'cx researcher',
    ],
    broaderRelated: [
      'product designer',
      'data analyst',
      'product manager',
    ],
  },
  {
    canonical: 'graphic designer',
    domain: 'Design',
    synonyms: [
      'visual designer',
      'brand designer',
      'creative designer',
      'marketing designer',
      'illustrator',
      'motion designer',
    ],
    broaderRelated: [
      'product designer',
      'content creator',
      'art director',
    ],
  },

  // ── MARKETING & COMMUNICATIONS ───────────────────────────────────────────
  {
    canonical: 'digital marketer',
    domain: 'Marketing',
    synonyms: [
      'marketing specialist',
      'growth marketer',
      'performance marketer',
      'online marketing specialist',
      'demand generation specialist',
      'paid media specialist',
      'sem specialist',
      'media buyer',
    ],
    broaderRelated: [
      'content marketer',
      'seo specialist',
      'social media manager',
      'product marketing manager',
      'brand manager',
    ],
  },
  {
    canonical: 'product marketing manager',
    domain: 'Marketing',
    synonyms: [
      'pmm',
      'product marketer',
      'go-to-market specialist',
      'gtm manager',
      'solution marketing manager',
    ],
    broaderRelated: [
      'product manager',
      'digital marketer',
      'content marketer',
      'brand manager',
    ],
  },
  {
    canonical: 'content marketer',
    domain: 'Marketing',
    synonyms: [
      'content strategist',
      'copywriter',
      'content writer',
      'technical writer',
      'editorial specialist',
      'blog writer',
      'communications specialist',
    ],
    broaderRelated: [
      'social media manager',
      'seo specialist',
      'digital marketer',
      'pr specialist',
    ],
  },
  {
    canonical: 'seo specialist',
    domain: 'Marketing',
    synonyms: [
      'seo manager',
      'search engine optimization analyst',
      'organic growth specialist',
      'seo strategist',
    ],
    broaderRelated: [
      'content marketer',
      'digital marketer',
      'web analyst',
    ],
  },
  {
    canonical: 'social media manager',
    domain: 'Marketing',
    synonyms: [
      'community manager',
      'social media strategist',
      'social media specialist',
      'influencer marketing manager',
    ],
    broaderRelated: [
      'content marketer',
      'digital marketer',
      'brand manager',
    ],
  },

  // ── HUMAN RESOURCES & TALENT ──────────────────────────────────────────────
  {
    canonical: 'recruiter',
    domain: 'HR',
    synonyms: [
      'technical recruiter',
      'talent acquisition specialist',
      'talent acquisition partner',
      'headhunter',
      'talent sourcer',
      'recruiting specialist',
      'staffing consultant',
    ],
    broaderRelated: [
      'hr generalist',
      'hr business partner',
      'people operations specialist',
    ],
  },
  {
    canonical: 'hr generalist',
    domain: 'HR',
    synonyms: [
      'hr specialist',
      'human resources coordinator',
      'people operations specialist',
      'hr officer',
      'human resources manager',
      'hr administrator',
    ],
    broaderRelated: [
      'recruiter',
      'hr business partner',
      'compensation analyst',
      'payroll specialist',
    ],
  },
  {
    canonical: 'hr business partner',
    domain: 'HR',
    synonyms: [
      'hrbp',
      'people partner',
      'strategic hr partner',
      'senior hr consultant',
    ],
    broaderRelated: [
      'hr generalist',
      'recruiter',
      'operations manager',
    ],
  },

  // ── FINANCE, ACCOUNTING & LEGAL ───────────────────────────────────────────
  {
    canonical: 'financial analyst',
    domain: 'Finance',
    synonyms: [
      'fpa analyst',
      'fp&a analyst',
      'finance associate',
      'investment analyst',
      'budget analyst',
      'financial planning analyst',
      'commercial finance analyst',
      'treasury analyst',
    ],
    broaderRelated: [
      'accountant',
      'business analyst',
      'risk analyst',
      'data analyst',
      'portfolio manager',
    ],
  },
  {
    canonical: 'accountant',
    domain: 'Finance',
    synonyms: [
      'staff accountant',
      'senior accountant',
      'certified public accountant',
      'cpa',
      'bookkeeper',
      'tax accountant',
      'audit associate',
      'financial accountant',
      'cost accountant',
    ],
    broaderRelated: [
      'financial analyst',
      'controller',
      'finance manager',
    ],
  },
  {
    canonical: 'controller',
    domain: 'Finance',
    synonyms: [
      'financial controller',
      'comptroller',
      'accounting director',
      'head of finance',
    ],
    broaderRelated: [
      'accountant',
      'financial analyst',
      'cfo',
    ],
  },

  // ── SALES & BUSINESS DEVELOPMENT ──────────────────────────────────────────
  {
    canonical: 'account executive',
    domain: 'Sales',
    synonyms: [
      'ae',
      'sales executive',
      'enterprise account executive',
      'sales representative',
      'commercial sales representative',
      'sales manager',
      'closing rep',
    ],
    broaderRelated: [
      'sales development representative',
      'business development manager',
      'account manager',
      'partnerships manager',
    ],
  },
  {
    canonical: 'sales development representative',
    domain: 'Sales',
    synonyms: [
      'sdr',
      'bdr',
      'business development representative',
      'inside sales representative',
      'outbound sales specialist',
      'lead generation specialist',
    ],
    broaderRelated: [
      'account executive',
      'business development manager',
      'sales specialist',
    ],
  },
  {
    canonical: 'account manager',
    domain: 'Sales',
    synonyms: [
      'client manager',
      'key account manager',
      'client relationship manager',
      'strategic account manager',
      'client partner',
    ],
    broaderRelated: [
      'customer success manager',
      'account executive',
      'customer support specialist',
    ],
  },
  {
    canonical: 'business development manager',
    domain: 'Sales',
    synonyms: [
      'bdm',
      'partnerships manager',
      'strategic partnerships lead',
      'alliance manager',
      'channel sales manager',
    ],
    broaderRelated: [
      'account executive',
      'sales development representative',
      'product manager',
    ],
  },

  // ── CUSTOMER SUCCESS & SUPPORT ───────────────────────────────────────────
  {
    canonical: 'customer success manager',
    domain: 'Customer Success',
    synonyms: [
      'csm',
      'client success specialist',
      'customer success specialist',
      'client relationship specialist',
      'customer onboarding specialist',
      'implementation consultant',
    ],
    broaderRelated: [
      'account manager',
      'customer support specialist',
      'project manager',
      'sales engineer',
    ],
  },
  {
    canonical: 'customer support specialist',
    domain: 'Customer Support',
    synonyms: [
      'support engineer',
      'technical support specialist',
      'help desk analyst',
      'customer service representative',
      'client support specialist',
      'service desk analyst',
    ],
    broaderRelated: [
      'customer success manager',
      'operations specialist',
      'qa engineer',
    ],
  },

  // ── OPERATIONS & SUPPLY CHAIN ─────────────────────────────────────────────
  {
    canonical: 'operations manager',
    domain: 'Operations',
    synonyms: [
      'business operations manager',
      'bizops manager',
      'operations lead',
      'chief of staff',
      'general manager',
      'operations supervisor',
    ],
    broaderRelated: [
      'project manager',
      'program manager',
      'supply chain analyst',
      'business analyst',
    ],
  },
  {
    canonical: 'supply chain analyst',
    domain: 'Operations',
    synonyms: [
      'logistics analyst',
      'procurement specialist',
      'inventory analyst',
      'demand planning analyst',
      'operations analyst',
    ],
    broaderRelated: [
      'operations manager',
      'data analyst',
      'financial analyst',
    ],
  },
]

// ─── Text Normalization Helper ────────────────────────────────────────────────

export interface NormalizedRole {
  raw: string
  normalized: string
  seniority: SeniorityInfo
  tokens: string[]
}

/**
 * Normalizes a raw job title or preferred role:
 * 1. Lowercases and trims
 * 2. Extracts and strips seniority indicators
 * 3. Removes brackets, fluff words, and punctuation
 * 4. Tokenizes into clean keyword array
 */
export function normalizeRole(rawRole: string): NormalizedRole {
  if (!rawRole) {
    return {
      raw: '',
      normalized: '',
      seniority: { level: 'UNSPECIFIED', yearsMin: 0 },
      tokens: [],
    }
  }

  let cleaned = rawRole.toLowerCase().trim()

  // Step 1: Detect seniority before stripping
  let detectedSeniority: SeniorityInfo = { level: 'UNSPECIFIED', yearsMin: 0 }
  for (const [term, info] of Object.entries(SENIORITY_MAP)) {
    const termRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i')
    if (termRegex.test(cleaned)) {
      detectedSeniority = info
      break
    }
  }

  // Step 2: Strip fluff and brackets
  for (const pattern of FLUFF_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ')
  }

  // Step 3: Strip seniority modifier words to get core role
  for (const term of SENIORITY_MODIFIERS) {
    const termRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi')
    cleaned = cleaned.replace(termRegex, ' ')
  }

  // Step 4: Final cleanup & tokenization
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  const tokens = cleaned.split(' ').filter((t) => t.length > 1)

  return {
    raw: rawRole,
    normalized: cleaned,
    seniority: detectedSeniority,
    tokens,
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
