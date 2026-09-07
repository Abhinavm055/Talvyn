import { isLikelyJobListing, isValidJobCard } from '../src/content/jobEvidenceDetector'
import { GenericAdapter } from '../src/content/adapters/generic'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`PASS: ${message}`)
}

type Node = {
  tagName: string
  textContent: string
  href?: string
  className?: string
  parentElement?: Node | null
  children: Node[]
  querySelector: (selector: string) => Node | null
  querySelectorAll: (selector: string) => Node[]
  getAttribute: (name: string) => string | null
}

function matches(node: Node, selector: string): boolean {
  const s = selector.trim()
  if (s === 'a[href]') return node.tagName === 'A' && Boolean(node.href)
  if (s === 'a') return node.tagName === 'A'
  if (s === 'h1' || s === 'h2' || s === 'h3' || s === 'h4') return node.tagName === s.toUpperCase()
  if (s === '[class*="company" i]') return /company/i.test(node.className || '')
  if (s === '[class*="location" i]') return /location/i.test(node.className || '')
  if (s === '[class*="salary" i]') return /salary/i.test(node.className || '')
  if (s === '[class*="job-type" i]') return /job-type/i.test(node.className || '')
  if (s === '[class*="description" i]') return /description/i.test(node.className || '')
  if (s === '[class*="title" i]') return /title/i.test(node.className || '')
  if (s === '[class*="role" i]') return /role/i.test(node.className || '')
  return false
}

function makeNode(tagName: string, textContent = '', opts: Partial<Node> = {}): Node {
  const node: Node = {
    tagName: tagName.toUpperCase(), textContent, children: opts.children || [], href: opts.href,
    className: opts.className || '', parentElement: null,
    querySelector(selector) {
      const all = this.querySelectorAll(selector)
      return all[0] || null
    },
    querySelectorAll(selector) {
      const out: Node[] = []
      const walk = (n: Node) => {
        for (const child of n.children) {
          if (matches(child, selector)) out.push(child)
          walk(child)
        }
      }
      walk(this)
      return out
    },
    getAttribute(name) {
      if (name === 'href') return this.href || null
      if (name === 'class') return this.className || null
      return null
    },
  }
  for (const child of node.children) child.parentElement = node
  return node
}

function makeDoc(body: Node): any {
  return {
    body,
    querySelector(selector: string) { return body.querySelector(selector) },
    querySelectorAll(selector: string) { return body.querySelectorAll(selector) },
  }
}

const jobLink = makeNode('A', 'Senior Software Engineer', { href: 'https://example.com/careers/senior-software-engineer' })
const company = makeNode('DIV', 'Acme Technologies', { className: 'company-name' })
const location = makeNode('SPAN', 'Bangalore', { className: 'location' })
const experience = makeNode('SPAN', '3+ years experience')
const card = makeNode('DIV', '', { children: [jobLink, company, location, experience] })
const body = makeNode('BODY', '', { children: [card] })
const doc = makeDoc(body)

assert(isValidJobCard(card as any).isValid, 'semantic card with job link + company + location is valid')
assert(isLikelyJobListing(doc as any, 'https://example.com/careers'), 'custom listing is detected without a job-card CSS class')

const generic = new GenericAdapter()
const jobs = generic.extractJobList(doc as any)
assert(jobs.length === 1, 'generic adapter extracts the custom semantic job link')
assert(jobs[0]?.title === 'Senior Software Engineer', 'fallback extraction preserves the job title')
assert(jobs[0]?.company === 'Acme Technologies', 'fallback extraction preserves the company')

const nonJob = makeNode('BODY', '', { children: [makeNode('A', 'Watch latest video', { href: 'https://example.com/videos/latest' })] })
assert(!isLikelyJobListing(makeDoc(nonJob) as any, 'https://example.com/about'), 'ordinary content is not classified as a job listing')

console.log('\nUniversal anchor fallback verification passed.')
