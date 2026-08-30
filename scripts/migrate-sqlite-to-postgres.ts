/**
 * Talvyn SQLite -> Neon PostgreSQL Data Migration Script
 *
 * Safely migrates existing records from local SQLite (prisma/talvyn.db)
 * to Neon PostgreSQL (process.env.DATABASE_URL) in strict dependency order:
 *
 * 1. User
 * 2. UserProfile
 * 3. Job
 * 4. Note
 * 5. Resume
 *
 * CRITICAL SAFETY RULES:
 * - Preserves original primary keys (id) and foreign key relationships.
 * - Preserves exact password hashes and auth providers.
 * - Preserves exact onboardingCompleted boolean flags.
 * - Non-destructive and idempotent: skips existing equivalent records.
 * - Supports --dry-run mode to inspect diffs with ZERO writes.
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const isDryRun = process.argv.includes('--dry-run')
const sqlitePath = path.resolve(process.cwd(), 'prisma', 'talvyn.db')

interface MigrationStats {
  source: number
  created: number
  skipped: number
  conflicts: number
}

function toDate(val: any): Date {
  if (!val) return new Date()
  if (typeof val === 'number') return new Date(val)
  if (typeof val === 'string') {
    const num = Number(val)
    if (!isNaN(num) && num > 100000000000) return new Date(num)
    return new Date(val)
  }
  return new Date(val)
}

function toBool(val: any): boolean {
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val === 1
  if (typeof val === 'string') return val === 'true' || val === '1'
  return false
}

async function runMigration() {
  console.log('===========================================================')
  console.log('TALVYN: SQLITE -> NEON POSTGRESQL DATA MIGRATION')
  console.log('===========================================================')
  console.log(`Source:      SQLite (${sqlitePath})`)
  console.log(`Destination: PostgreSQL (${process.env.DATABASE_URL ? 'Configured from DATABASE_URL' : 'MISSING DATABASE_URL'})`)
  console.log(`Mode:        ${isDryRun ? '🔍 DRY RUN (Simulation - Zero Writes)' : '⚡ LIVE MIGRATION'}`)
  console.log('===========================================================\n')

  if (!fs.existsSync(sqlitePath)) {
    console.error(`Error: Source SQLite database not found at ${sqlitePath}`)
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required.')
    process.exit(1)
  }

  const sqlite = new DatabaseSync(sqlitePath)
  const postgres = new PrismaClient()

  try {
    // ─── Step 1: Users ──────────────────────────────────────────────────────────
    console.log('--- Step 1: Migrating Users ---')
    const sqliteUsers = sqlite.prepare('SELECT * FROM User').all() as any[]
    const userStats: MigrationStats = { source: sqliteUsers.length, created: 0, skipped: 0, conflicts: 0 }

    for (const u of sqliteUsers) {
      const existingById = await postgres.user.findUnique({ where: { id: u.id } })
      const existingByEmail = await postgres.user.findUnique({ where: { email: u.email } })

      if (existingById) {
        userStats.skipped++
        continue
      }

      if (existingByEmail) {
        console.warn(`  ⚠️ Conflict: User with email ${u.email} exists with different ID (${existingByEmail.id} vs ${u.id}).`)
        userStats.conflicts++
        continue
      }

      userStats.created++
      if (!isDryRun) {
        await postgres.user.create({
          data: {
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash ?? null,
            googleId: u.googleId ?? null,
            authProvider: u.authProvider ?? 'EMAIL',
            avatarUrl: u.avatarUrl ?? null,
            createdAt: toDate(u.createdAt),
            updatedAt: toDate(u.updatedAt),
          },
        })
      }
    }

    console.log(`Users: Source: ${userStats.source} | ${isDryRun ? 'Would Create' : 'Created'}: ${userStats.created} | Skipped: ${userStats.skipped} | Conflicts: ${userStats.conflicts}`)

    // ─── Step 2: User Profiles ──────────────────────────────────────────────────
    console.log('\n--- Step 2: Migrating User Profiles ---')
    const sqliteProfiles = sqlite.prepare('SELECT * FROM UserProfile').all() as any[]
    const profileStats: MigrationStats = { source: sqliteProfiles.length, created: 0, skipped: 0, conflicts: 0 }

    for (const p of sqliteProfiles) {
      const existing = await postgres.userProfile.findUnique({ where: { id: p.id } })
      const existingByUserId = await postgres.userProfile.findUnique({ where: { userId: p.userId } })

      if (existing || existingByUserId) {
        profileStats.skipped++
        continue
      }

      profileStats.created++
      if (!isDryRun) {
        await postgres.userProfile.create({
          data: {
            id: p.id,
            userId: p.userId,
            legalFullName: p.legalFullName ?? null,
            givenName: p.givenName ?? null,
            middleName: p.middleName ?? null,
            familyName: p.familyName ?? null,
            prefix: p.prefix ?? null,
            preferredName: p.preferredName ?? null,
            email: p.email ?? null,
            phone: p.phone ?? null,
            country: p.country ?? null,
            state: p.state ?? null,
            city: p.city ?? null,
            address: p.address ?? null,
            postalCode: p.postalCode ?? null,
            preferredRoles: typeof p.preferredRoles === 'string' ? p.preferredRoles : JSON.stringify(p.preferredRoles || []),
            skills: typeof p.skills === 'string' ? p.skills : JSON.stringify(p.skills || []),
            experienceYears: p.experienceYears != null ? Number(p.experienceYears) : null,
            linkedinUrl: p.linkedinUrl ?? null,
            githubUrl: p.githubUrl ?? null,
            portfolioUrl: p.portfolioUrl ?? null,
            otherLinks: typeof p.otherLinks === 'string' ? p.otherLinks : JSON.stringify(p.otherLinks || []),
            languages: typeof p.languages === 'string' ? p.languages : JSON.stringify(p.languages || []),
            institution: p.institution ?? null,
            degree: p.degree ?? null,
            specialization: p.specialization ?? null,
            cgpa: p.cgpa ?? null,
            graduationYear: p.graduationYear != null ? Number(p.graduationYear) : null,
            workAuthorization: p.workAuthorization ?? null,
            expectedSalary: p.expectedSalary ?? null,
            noticePeriod: p.noticePeriod ?? null,
            preferredLocations: typeof p.preferredLocations === 'string' ? p.preferredLocations : JSON.stringify(p.preferredLocations || []),
            preferredJobTypes: typeof p.preferredJobTypes === 'string' ? p.preferredJobTypes : JSON.stringify(p.preferredJobTypes || []),
            workStyle: p.workStyle || 'ANY',
            onboardingCompleted: toBool(p.onboardingCompleted),
            createdAt: toDate(p.createdAt),
            updatedAt: toDate(p.updatedAt),
          },
        })
      }
    }

    console.log(`Profiles: Source: ${profileStats.source} | ${isDryRun ? 'Would Create' : 'Created'}: ${profileStats.created} | Skipped: ${profileStats.skipped} | Conflicts: ${profileStats.conflicts}`)

    // ─── Step 3: Jobs ───────────────────────────────────────────────────────────
    console.log('\n--- Step 3: Migrating Jobs ---')
    const sqliteJobs = sqlite.prepare('SELECT * FROM Job').all() as any[]
    const jobStats: MigrationStats = { source: sqliteJobs.length, created: 0, skipped: 0, conflicts: 0 }

    for (const j of sqliteJobs) {
      const existing = await postgres.job.findUnique({ where: { id: j.id } })

      if (existing) {
        jobStats.skipped++
        continue
      }

      jobStats.created++
      if (!isDryRun) {
        await postgres.job.create({
          data: {
            id: j.id,
            userId: j.userId,
            title: j.title,
            company: j.company,
            jobUrl: j.jobUrl ?? null,
            sourceWebsite: j.sourceWebsite ?? null,
            location: j.location ?? null,
            jobType: j.jobType ?? null,
            salary: j.salary ?? null,
            description: j.description ?? null,
            status: j.status ?? 'SAVED',
            dateSaved: toDate(j.dateSaved),
            dateApplied: j.dateApplied ? toDate(j.dateApplied) : null,
            createdAt: toDate(j.createdAt),
            updatedAt: toDate(j.updatedAt),
          },
        })
      }
    }

    console.log(`Jobs: Source: ${jobStats.source} | ${isDryRun ? 'Would Create' : 'Created'}: ${jobStats.created} | Skipped: ${jobStats.skipped} | Conflicts: ${jobStats.conflicts}`)

    // ─── Step 4: Notes ──────────────────────────────────────────────────────────
    console.log('\n--- Step 4: Migrating Notes ---')
    const sqliteNotes = sqlite.prepare('SELECT * FROM Note').all() as any[]
    const noteStats: MigrationStats = { source: sqliteNotes.length, created: 0, skipped: 0, conflicts: 0 }

    for (const n of sqliteNotes) {
      const existing = await postgres.note.findUnique({ where: { id: n.id } })

      if (existing) {
        noteStats.skipped++
        continue
      }

      noteStats.created++
      if (!isDryRun) {
        await postgres.note.create({
          data: {
            id: n.id,
            jobId: n.jobId,
            userId: n.userId,
            content: n.content,
            createdAt: toDate(n.createdAt),
            updatedAt: toDate(n.updatedAt),
          },
        })
      }
    }

    console.log(`Notes: Source: ${noteStats.source} | ${isDryRun ? 'Would Create' : 'Created'}: ${noteStats.created} | Skipped: ${noteStats.skipped} | Conflicts: ${noteStats.conflicts}`)

    // ─── Step 5: Resumes ────────────────────────────────────────────────────────
    console.log('\n--- Step 5: Migrating Resumes ---')
    const sqliteResumes = sqlite.prepare('SELECT * FROM Resume').all() as any[]
    const resumeStats: MigrationStats = { source: sqliteResumes.length, created: 0, skipped: 0, conflicts: 0 }

    for (const r of sqliteResumes) {
      const existing = await postgres.resume.findUnique({ where: { id: r.id } })

      if (existing) {
        resumeStats.skipped++
        continue
      }

      resumeStats.created++
      if (!isDryRun) {
        await postgres.resume.create({
          data: {
            id: r.id,
            userId: r.userId,
            name: r.name,
            description: r.description ?? null,
            isDefault: toBool(r.isDefault),
            fileUrl: r.fileUrl ?? null,
            fileName: r.fileName ?? null,
            fileSize: r.fileSize != null ? Number(r.fileSize) : null,
            mimeType: r.mimeType ?? null,
            storagePath: r.storagePath ?? null,
            createdAt: toDate(r.createdAt),
            updatedAt: toDate(r.updatedAt),
          },
        })
      }
    }

    console.log(`Resumes: Source: ${resumeStats.source} | ${isDryRun ? 'Would Create' : 'Created'}: ${resumeStats.created} | Skipped: ${resumeStats.skipped} | Conflicts: ${resumeStats.conflicts}`)

    console.log('\n===========================================================')
    if (isDryRun) {
      console.log('✅ DRY RUN COMPLETED SUCCESSFULLY — ZERO WRITES PERFORMED')
      console.log('Review the above numbers. When ready, run "npm run db:migrate:data" for live migration.')
    } else {
      console.log('✅ LIVE DATA MIGRATION COMPLETED SUCCESSFULLY')
      console.log('Run "npm run db:verify:data" to verify integrity.')
    }
    console.log('===========================================================')
  } catch (err: any) {
    if (err.name === 'PrismaClientInitializationError') {
      console.error('\n❌ Could not connect to PostgreSQL destination.')
      console.error('  Please check your DATABASE_URL in .env and ensure internet connectivity to Neon.')
    } else {
      console.error('\n❌ Migration failed with error:', err)
    }
    process.exit(1)
  } finally {
    await postgres.$disconnect()
  }
}

runMigration()
