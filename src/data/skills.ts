/**
 * Talvyn Structured Skill Taxonomy & Search Engine (Phase 2E.1)
 *
 * Categorized across 20+ domains with rich synonym dictionary.
 * Deterministic — no AI required.
 */

export interface SkillItem {
  name: string
  category: string
  aliases?: string[]
}

export const SKILL_SYNONYMS: Record<string, string> = {
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
  ms_sql: 'Microsoft SQL Server',
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
  genai: 'Generative AI',
  pm: 'Product Management',
  ux: 'UI/UX Design',
  ui: 'UI/UX Design',
  figma: 'Figma',
  seo: 'Search Engine Optimization',
  sem: 'Search Engine Marketing',
  qa: 'Quality Assurance',
  automation: 'Test Automation',
  solidity: 'Solidity',
  web3: 'Web3 & Blockchain',
}

export const SKILLS_TAXONOMY: SkillItem[] = [
  // ─── 1. Programming Languages ──────────────────────────────────────────────
  { name: 'JavaScript', category: 'Programming Languages', aliases: ['js', 'ecmascript', 'es6'] },
  { name: 'TypeScript', category: 'Programming Languages', aliases: ['ts'] },
  { name: 'Python', category: 'Programming Languages', aliases: ['py'] },
  { name: 'Java', category: 'Programming Languages', aliases: ['core java', 'j2se'] },
  { name: 'C++', category: 'Programming Languages', aliases: ['cpp', 'c plus plus'] },
  { name: 'C#', category: 'Programming Languages', aliases: ['c sharp', 'csharp', '.net'] },
  { name: 'C', category: 'Programming Languages' },
  { name: 'Go', category: 'Programming Languages', aliases: ['golang'] },
  { name: 'Rust', category: 'Programming Languages' },
  { name: 'PHP', category: 'Programming Languages' },
  { name: 'Ruby', category: 'Programming Languages' },
  { name: 'Swift', category: 'Programming Languages', aliases: ['ios swift'] },
  { name: 'Kotlin', category: 'Programming Languages', aliases: ['android kotlin'] },
  { name: 'SQL', category: 'Programming Languages', aliases: ['structured query language'] },
  { name: 'R', category: 'Programming Languages' },
  { name: 'Dart', category: 'Programming Languages' },
  { name: 'Scala', category: 'Programming Languages' },
  { name: 'Shell / Bash', category: 'Programming Languages', aliases: ['bash', 'sh', 'zsh'] },

  // ─── 2. Frontend Development ──────────────────────────────────────────────
  { name: 'React', category: 'Frontend', aliases: ['reactjs', 'react.js'] },
  { name: 'Next.js', category: 'Frontend', aliases: ['next', 'nextjs'] },
  { name: 'Vue.js', category: 'Frontend', aliases: ['vue', 'vuejs', 'vue3'] },
  { name: 'Angular', category: 'Frontend', aliases: ['angularjs', 'angular 2+'] },
  { name: 'HTML5', category: 'Frontend', aliases: ['html'] },
  { name: 'CSS3 / SASS', category: 'Frontend', aliases: ['css', 'sass', 'scss'] },
  { name: 'Tailwind CSS', category: 'Frontend', aliases: ['tailwind', 'tailwindcss'] },
  { name: 'Redux / Zustand', category: 'Frontend', aliases: ['redux', 'zustand', 'state management'] },
  { name: 'Webpack / Vite', category: 'Frontend', aliases: ['vite', 'webpack', 'rollup'] },
  { name: 'React Query / SWR', category: 'Frontend', aliases: ['tanstack query', 'swr'] },
  { name: 'Responsive Web Design', category: 'Frontend', aliases: ['mobile responsive'] },
  { name: 'WebSockets', category: 'Frontend', aliases: ['socket.io', 'realtime'] },

  // ─── 3. Backend Development ───────────────────────────────────────────────
  { name: 'Node.js', category: 'Backend', aliases: ['node', 'nodejs'] },
  { name: 'Express.js', category: 'Backend', aliases: ['express', 'expressjs'] },
  { name: 'NestJS', category: 'Backend', aliases: ['nest', 'nestjs'] },
  { name: 'Spring Boot', category: 'Backend', aliases: ['spring', 'springboot', 'java spring'] },
  { name: 'Django', category: 'Backend', aliases: ['python django'] },
  { name: 'FastAPI', category: 'Backend', aliases: ['python fastapi'] },
  { name: 'Flask', category: 'Backend', aliases: ['python flask'] },
  { name: 'ASP.NET Core', category: 'Backend', aliases: ['.net core', 'dotnet', 'asp.net'] },
  { name: 'Ruby on Rails', category: 'Backend', aliases: ['rails', 'ror'] },
  { name: 'REST APIs', category: 'Backend', aliases: ['rest', 'restful', 'api design'] },
  { name: 'GraphQL', category: 'Backend', aliases: ['gql', 'apollo'] },
  { name: 'gRPC / Microservices', category: 'Backend', aliases: ['grpc', 'protobuf', 'microservices'] },

  // ─── 4. Mobile Development ────────────────────────────────────────────────
  { name: 'React Native', category: 'Mobile', aliases: ['rn', 'reactnative', 'expo'] },
  { name: 'Flutter', category: 'Mobile', aliases: ['flutter dart'] },
  { name: 'iOS Development', category: 'Mobile', aliases: ['swiftui', 'xcode', 'ios'] },
  { name: 'Android Development', category: 'Mobile', aliases: ['jetpack compose', 'android sdk'] },

  // ─── 5. Databases & Storage ───────────────────────────────────────────────
  { name: 'PostgreSQL', category: 'Databases', aliases: ['postgres', 'psql'] },
  { name: 'MySQL', category: 'Databases' },
  { name: 'MongoDB', category: 'Databases', aliases: ['mongo', 'nosql'] },
  { name: 'Redis', category: 'Databases', aliases: ['caching', 'in-memory'] },
  { name: 'SQLite', category: 'Databases' },
  { name: 'Oracle Database', category: 'Databases', aliases: ['oracle', 'pl/sql'] },
  { name: 'Microsoft SQL Server', category: 'Databases', aliases: ['mssql', 'tsql'] },
  { name: 'Elasticsearch', category: 'Databases', aliases: ['elastic', 'elk'] },
  { name: 'DynamoDB', category: 'Databases', aliases: ['aws dynamodb'] },
  { name: 'Prisma / TypeORM', category: 'Databases', aliases: ['prisma', 'typeorm', 'orm', 'hibernate'] },

  // ─── 6. Cloud & DevOps ────────────────────────────────────────────────────
  { name: 'Docker', category: 'Cloud & DevOps', aliases: ['containerization', 'containers'] },
  { name: 'Kubernetes', category: 'Cloud & DevOps', aliases: ['k8s', 'kube', 'k8'] },
  { name: 'Amazon Web Services (AWS)', category: 'Cloud & DevOps', aliases: ['aws', 'ec2', 's3', 'lambda'] },
  { name: 'Google Cloud Platform (GCP)', category: 'Cloud & DevOps', aliases: ['gcp', 'google cloud'] },
  { name: 'Microsoft Azure', category: 'Cloud & DevOps', aliases: ['azure'] },
  { name: 'CI/CD Pipelines', category: 'Cloud & DevOps', aliases: ['github actions', 'gitlab ci', 'jenkins'] },
  { name: 'Terraform', category: 'Cloud & DevOps', aliases: ['iac', 'infrastructure as code'] },
  { name: 'Linux / Unix Administration', category: 'Cloud & DevOps', aliases: ['linux', 'ubuntu', 'sysadmin'] },
  { name: 'Nginx / Apache', category: 'Cloud & DevOps', aliases: ['nginx', 'reverse proxy'] },

  // ─── 7. Data Science & AI / ML ────────────────────────────────────────────
  { name: 'Machine Learning', category: 'Data & AI', aliases: ['ml', 'scikit-learn', 'models'] },
  { name: 'Deep Learning', category: 'Data & AI', aliases: ['dl', 'neural networks'] },
  { name: 'PyTorch', category: 'Data & AI', aliases: ['torch'] },
  { name: 'TensorFlow / Keras', category: 'Data & AI', aliases: ['tensorflow', 'tf', 'keras'] },
  { name: 'Pandas & NumPy', category: 'Data & AI', aliases: ['pandas', 'numpy', 'data wrangling'] },
  { name: 'Large Language Models (LLMs)', category: 'Data & AI', aliases: ['llm', 'genai', 'langchain', 'openai'] },
  { name: 'Natural Language Processing (NLP)', category: 'Data & AI', aliases: ['nlp', 'transformers', 'bert'] },
  { name: 'Computer Vision', category: 'Data & AI', aliases: ['cv', 'opencv'] },
  { name: 'Apache Spark / Hadoop', category: 'Data & AI', aliases: ['spark', 'pyspark', 'big data'] },
  { name: 'Tableau / Power BI', category: 'Data & AI', aliases: ['tableau', 'powerbi', 'power bi', 'data visualization'] },

  // ─── 8. Testing & QA ──────────────────────────────────────────────────────
  { name: 'Jest / Vitest', category: 'Testing & QA', aliases: ['jest', 'vitest', 'unit testing'] },
  { name: 'Cypress / Playwright', category: 'Testing & QA', aliases: ['cypress', 'playwright', 'e2e'] },
  { name: 'Selenium', category: 'Testing & QA', aliases: ['selenium webdriver'] },
  { name: 'Postman / API Testing', category: 'Testing & QA', aliases: ['postman', 'api testing'] },
  { name: 'Test Automation', category: 'Testing & QA', aliases: ['qa automation', 'automation testing'] },

  // ─── 9. Cybersecurity ─────────────────────────────────────────────────────
  { name: 'Ethical Hacking & Penetration Testing', category: 'Cybersecurity', aliases: ['pen testing', 'pentest'] },
  { name: 'OWASP Security Best Practices', category: 'Cybersecurity', aliases: ['owasp', 'appsec'] },
  { name: 'Network Security & Firewalls', category: 'Cybersecurity', aliases: ['network security', 'soc'] },
  { name: 'Cryptography & PKI', category: 'Cybersecurity', aliases: ['crypto', 'ssl', 'tls'] },

  // ─── 10. Design & UX ──────────────────────────────────────────────────────
  { name: 'Figma', category: 'Design', aliases: ['figma design', 'prototyping'] },
  { name: 'UI/UX Design', category: 'Design', aliases: ['ui design', 'ux design', 'user research'] },
  { name: 'Wireframing & Prototyping', category: 'Design', aliases: ['wireframes', 'mockups'] },
  { name: 'Design Systems', category: 'Design', aliases: ['component library'] },
  { name: 'Adobe Creative Suite', category: 'Design', aliases: ['photoshop', 'illustrator', 'after effects'] },

  // ─── 11. Product & Project Management ─────────────────────────────────────
  { name: 'Product Management', category: 'Product & Management', aliases: ['pm', 'product strategy', 'roadmap'] },
  { name: 'Agile & Scrum', category: 'Product & Management', aliases: ['scrum', 'kanban', 'sprint planning'] },
  { name: 'Jira / Confluence', category: 'Product & Management', aliases: ['jira', 'atlassian'] },
  { name: 'User Story Mapping', category: 'Product & Management', aliases: ['prds', 'user stories'] },

  // ─── 12. Marketing & Growth ───────────────────────────────────────────────
  { name: 'Search Engine Optimization (SEO)', category: 'Marketing', aliases: ['seo', 'organic growth'] },
  { name: 'Content Marketing', category: 'Marketing', aliases: ['content writing', 'copywriting'] },
  { name: 'Social Media Marketing', category: 'Marketing', aliases: ['smm', 'social media'] },
  { name: 'Google Analytics & Tag Manager', category: 'Marketing', aliases: ['ga4', 'gtm', 'analytics'] },
  { name: 'Email Marketing & Automation', category: 'Marketing', aliases: ['mailchimp', 'hubspot email'] },

  // ─── 13. Finance & Accounting ─────────────────────────────────────────────
  { name: 'Financial Modeling & Valuation', category: 'Finance', aliases: ['financial analysis', 'dcf'] },
  { name: 'Accounting (GAAP / IFRS)', category: 'Finance', aliases: ['bookkeeping', 'accounting'] },
  { name: 'Excel / Advanced Spreadsheets', category: 'Finance', aliases: ['excel', 'macros', 'vba', 'vlookup'] },
  { name: 'Tally / QuickBooks / SAP', category: 'Finance', aliases: ['tally', 'quickbooks', 'sap erp'] },

  // ─── 14. Human Resources ──────────────────────────────────────────────────
  { name: 'Talent Acquisition & Sourcing', category: 'Human Resources', aliases: ['recruiting', 'tech hiring'] },
  { name: 'Employee Engagement', category: 'Human Resources', aliases: ['people operations', 'hrbp'] },
  { name: 'HRIS & ATS Management', category: 'Human Resources', aliases: ['workday hris', 'greenhouse ats'] },

  // ─── 15. Sales & Business Development ─────────────────────────────────────
  { name: 'B2B Sales & Lead Generation', category: 'Sales', aliases: ['b2b', 'prospecting', 'cold outreach'] },
  { name: 'Salesforce / HubSpot CRM', category: 'Sales', aliases: ['salesforce', 'crm', 'hubspot'] },
  { name: 'Account Management', category: 'Sales', aliases: ['client relationships', 'retention'] },
]

/**
 * Searches skills with prefix, contains, and synonym matching.
 */
export function searchSkills(query: string, maxResults = 15): SkillItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return SKILLS_TAXONOMY.slice(0, maxResults)

  // Check synonym first
  const synonymTarget = SKILL_SYNONYMS[q] || SKILL_SYNONYMS[q.replace(/[\s._-]/g, '')]
  if (synonymTarget) {
    const directMatch = SKILLS_TAXONOMY.find(
      (s) => s.name.toLowerCase() === synonymTarget.toLowerCase()
    )
    if (directMatch) {
      const rest = SKILLS_TAXONOMY.filter((s) => s.name !== directMatch.name && s.category === directMatch.category)
      return [directMatch, ...rest].slice(0, maxResults)
    }
  }

  // Exact & Prefix matches first
  const exact: SkillItem[] = []
  const prefix: SkillItem[] = []
  const contains: SkillItem[] = []

  for (const s of SKILLS_TAXONOMY) {
    const lowerName = s.name.toLowerCase()
    const matchAlias = s.aliases?.some((a) => a.includes(q))

    if (lowerName === q) {
      exact.push(s)
    } else if (lowerName.startsWith(q) || s.aliases?.some((a) => a.startsWith(q))) {
      prefix.push(s)
    } else if (lowerName.includes(q) || s.category.toLowerCase().includes(q) || matchAlias) {
      contains.push(s)
    }
  }

  const results = [...exact, ...prefix, ...contains]
  return results.slice(0, maxResults)
}
