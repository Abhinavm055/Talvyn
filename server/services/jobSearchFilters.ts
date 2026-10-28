import type { Prisma, SavedSearch as StoredSavedSearch } from '@prisma/client'
import { z } from 'zod'
import { JOB_SEARCH_STATUSES, JOB_SEARCH_TYPES, type JobSearchFilters, type SavedSearch } from '../contracts/jobSearch'

const storedFilterShape = {
  search: z.string().trim().max(200).refine((value) => !value.includes('\0'), 'Null characters are not supported'),
  company: z.string().trim().max(120).refine((value) => !value.includes('\0'), 'Null characters are not supported'),
  location: z.string().trim().max(120).refine((value) => !value.includes('\0'), 'Null characters are not supported'),
  status: z.enum(JOB_SEARCH_STATUSES),
  jobType: z.enum(JOB_SEARCH_TYPES),
}
const filterShape = {
  search: storedFilterShape.search.default(''),
  company: storedFilterShape.company.default(''),
  location: storedFilterShape.location.default(''),
  status: storedFilterShape.status.default('ALL'),
  jobType: storedFilterShape.jobType.default('ALL'),
}

export const jobSearchFiltersSchema = z.object(filterShape).strict()
const storedFiltersSchema = z.object({ version: z.literal(1), ...storedFilterShape }).strict()
const positiveInteger = (max: number, fallback: string) => z.string().regex(/^[1-9]\d*$/).default(fallback)
  .transform(Number).refine((value) => Number.isSafeInteger(value) && value <= max, `Must be between 1 and ${max}`)

export const jobSearchQuerySchema = z.object({
  ...filterShape,
  page: positiveInteger(100_000, '1'),
  // Preserve the existing Tracker's 200-record request and Dashboard's 100.
  limit: positiveInteger(200, '50'),
}).strict()

export const savedSearchNameSchema = z.string().transform((value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' '))
  .pipe(z.string().min(1).max(80))
  .refine((value) => !value.includes('\0'), 'Null characters are not supported')
  .refine((value) => value.toLowerCase().length <= 160, 'Normalized name is too long')

export const createSavedSearchSchema = z.object({ name: savedSearchNameSchema, filters: jobSearchFiltersSchema }).strict()
export const updateSavedSearchSchema = createSavedSearchSchema.partial().strict()
  .refine((value) => value.name !== undefined || value.filters !== undefined, 'Provide name or filters')

export function savedSearchNameKey(name: string): string { return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase() }

/** Prisma contains uses PostgreSQL LIKE patterns. Escape metacharacters for literal search. */
export function literalContains(value: string): string { return value.replace(/[\\%_]/g, '\\$&') }

export function buildJobSearchWhere(userId: string, filters: JobSearchFilters): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = { userId }
  const contains = (text: string) => ({ contains: literalContains(text), mode: 'insensitive' as const })
  if (filters.search) where.OR = [{ title: contains(filters.search) }, { company: contains(filters.search) }, { location: contains(filters.search) }]
  if (filters.company) where.company = contains(filters.company)
  if (filters.location) where.location = contains(filters.location)
  if (filters.status !== 'ALL') where.status = filters.status
  if (filters.jobType !== 'ALL') where.jobType = filters.jobType
  return where
}

export function storedJobSearchFilters(filters: JobSearchFilters): Prisma.InputJsonObject { return { version: 1, ...filters } }

/** Unknown persisted versions fail closed rather than silently broadening a search. */
export function savedSearchDto(row: StoredSavedSearch): SavedSearch {
  const { version: _version, ...filters } = storedFiltersSchema.parse(row.filters)
  return { id: row.id, name: row.name, filters, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}
