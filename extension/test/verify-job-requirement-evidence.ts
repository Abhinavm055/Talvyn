import assert from 'node:assert/strict'
import { enrichJobFacts } from '../src/content/jobIntelligence'
import type { ExtractedJob } from '../src/types'

const base: ExtractedJob = { title: 'Developer', company: 'Synthetic', jobUrl: 'https://example.test/job', sourceWebsite: 'Fixture', confidence: 'HIGH' }
const cases: { description: string; required: string[]; preferred?: string[] }[] = [
  { description: 'Required skills:\nPython is not required.\nSQL is mandatory.', required: ['SQL'] },
  { description: 'Required skills:\nNo prior Python experience is needed.\nTypeScript is required.', required: ['TypeScript'] },
  { description: 'Required skills:\nSQL is required; Docker is not required.', required: ['SQL'] },
  { description: 'We do not require Python.', required: [] },
  { description: 'Required skills:\nDocker is not mandatory.', required: [] },
  { description: 'Python is not only required but essential.', required: ['Python'] },
  { description: 'Our teams use Python and React.', required: [] },
  { description: 'Required skills:\nPython\nPreferred skills:\nDocker', required: ['Python'], preferred: ['Docker'] },
  { description: 'Required skills:\nC++ and C#\nResponsibilities:\nUse Python to help the team.', required: ['C++', 'C#'] },
]
for (const item of cases) {
  const result = enrichJobFacts({ ...base, description: item.description })
  assert.deepEqual(result.requiredSkills, item.required, item.description)
  assert.deepEqual(result.preferredSkills, item.preferred || [], item.description)
}
const structured = enrichJobFacts({ ...base, requirements: ['Python is not required', 'SQL required', 'Docker preferred'] })
assert.deepEqual(structured.requiredSkills, ['SQL'])
assert.deepEqual(structured.preferredSkills, ['Docker'])
assert.equal(structured.experience, undefined)
assert.equal(structured.education, undefined)
console.log(`PASS: ${cases.length + 1} requirement-evidence fixtures; explicit nonrequirements excluded, section boundaries and unknowns preserved.`)
