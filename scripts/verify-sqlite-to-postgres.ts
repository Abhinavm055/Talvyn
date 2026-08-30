/**
 * Talvyn SQLite -> Neon PostgreSQL Data Verification Script
 *
 * Compares data counts, record matches, and foreign-key integrity between
 * local SQLite (prisma/talvyn.db) and Neon PostgreSQL (DATABASE_URL).
 *
 * CRITICAL: Zero secrets or password hashes are printed in output.
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const sqlitePath = path.resolve(process.cwd(), 'prisma', 'talvyn.db')

async function runVerification() {
  console.log('===========================================================')
  console.log('TALVYN: SQLITE -> NEON DATA VERIFICATION')
  console.log('===========================================================')

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

  let allChecksPassed = true

  try {
    // ─── 1. Users ─────────────────────────────────────────────────────────────
    const sqliteUsers = sqlite.prepare('SELECT * FROM User').all() as any[]
    const pgUsers = await postgres.user.findMany()
    const usersMatch = pgUsers.length >= sqliteUsers.length

    console.log('\nUsers:')
    console.log(`  SQLite:     ${sqliteUsers.length}`)
    console.log(`  PostgreSQL: ${pgUsers.length}`)
    console.log(`  Status:     ${usersMatch ? '✓ PASS' : '✗ FAIL (Missing users in PostgreSQL)'}`)
    if (!usersMatch) allChecksPassed = false

    // Check auth fields safely without exposing hashes
    console.log('\nUser Authentication Integrity:')
    for (const su of sqliteUsers) {
      const pu = pgUsers.find((u) => u.id === su.id || u.email === su.email)
      if (!pu) {
        console.log(`  ✗ User ${su.email}: NOT FOUND in PostgreSQL`)
        allChecksPassed = false
      } else {
        const hashStatus = pu.passwordHash ? 'present' : 'missing'
        console.log(`  ✓ User ${pu.email} [ID: ${pu.id}]: passwordHash: ${hashStatus}, authProvider: ${pu.authProvider}`)
      }
    }

    // ─── 2. User Profiles & Onboarding ────────────────────────────────────────
    const sqliteProfiles = sqlite.prepare('SELECT * FROM UserProfile').all() as any[]
    const pgProfiles = await postgres.userProfile.findMany()
    const profilesMatch = pgProfiles.length >= sqliteProfiles.length

    console.log('\nProfiles:')
    console.log(`  SQLite:     ${sqliteProfiles.length}`)
    console.log(`  PostgreSQL: ${pgProfiles.length}`)
    console.log(`  Status:     ${profilesMatch ? '✓ PASS' : '✗ FAIL (Missing profiles in PostgreSQL)'}`)
    if (!profilesMatch) allChecksPassed = false

    // Verify Onboarding flags
    const sqliteOnboardingDone = sqliteProfiles.filter((p) => p.onboardingCompleted === 1 || p.onboardingCompleted === true).length
    const pgOnboardingDone = pgProfiles.filter((p) => p.onboardingCompleted === true).length

    console.log('\nOnboarding Completed Count:')
    console.log(`  SQLite:     ${sqliteOnboardingDone}`)
    console.log(`  PostgreSQL: ${pgOnboardingDone}`)
    console.log(`  Status:     ${pgOnboardingDone >= sqliteOnboardingDone ? '✓ PASS' : '✗ FAIL (Mismatch in onboardingCompleted)'}`)
    if (pgOnboardingDone < sqliteOnboardingDone) allChecksPassed = false

    // ─── 3. Jobs ──────────────────────────────────────────────────────────────
    const sqliteJobs = sqlite.prepare('SELECT * FROM Job').all() as any[]
    const pgJobs = await postgres.job.findMany()
    const jobsMatch = pgJobs.length >= sqliteJobs.length

    console.log('\nJobs:')
    console.log(`  SQLite:     ${sqliteJobs.length}`)
    console.log(`  PostgreSQL: ${pgJobs.length}`)
    console.log(`  Status:     ${jobsMatch ? '✓ PASS' : '✗ FAIL (Missing jobs in PostgreSQL)'}`)
    if (!jobsMatch) allChecksPassed = false

    // ─── 4. Notes ─────────────────────────────────────────────────────────────
    const sqliteNotes = sqlite.prepare('SELECT * FROM Note').all() as any[]
    const pgNotes = await postgres.note.findMany()
    const notesMatch = pgNotes.length >= sqliteNotes.length

    console.log('\nNotes:')
    console.log(`  SQLite:     ${sqliteNotes.length}`)
    console.log(`  PostgreSQL: ${pgNotes.length}`)
    console.log(`  Status:     ${notesMatch ? '✓ PASS' : '✗ FAIL (Missing notes in PostgreSQL)'}`)
    if (!notesMatch) allChecksPassed = false

    // ─── 5. Resumes ───────────────────────────────────────────────────────────
    const sqliteResumes = sqlite.prepare('SELECT * FROM Resume').all() as any[]
    const pgResumes = await postgres.resume.findMany()
    const resumesMatch = pgResumes.length >= sqliteResumes.length

    console.log('\nResumes:')
    console.log(`  SQLite:     ${sqliteResumes.length}`)
    console.log(`  PostgreSQL: ${pgResumes.length}`)
    console.log(`  Status:     ${resumesMatch ? '✓ PASS' : '✗ FAIL (Missing resumes in PostgreSQL)'}`)
    if (!resumesMatch) allChecksPassed = false

    // ─── 6. Foreign Key Integrity ─────────────────────────────────────────────
    console.log('\nForeign Key & Relational Integrity:')
    let fksValid = true
    const userIds = new Set(pgUsers.map((u) => u.id))
    const jobIds = new Set(pgJobs.map((j) => j.id))

    for (const p of pgProfiles) {
      if (!userIds.has(p.userId)) {
        console.error(`  ✗ Orphan Profile: userId ${p.userId} does not exist in User table`)
        fksValid = false
      }
    }

    for (const j of pgJobs) {
      if (!userIds.has(j.userId)) {
        console.error(`  ✗ Orphan Job: userId ${j.userId} does not exist in User table`)
        fksValid = false
      }
    }

    for (const n of pgNotes) {
      if (!userIds.has(n.userId)) {
        console.error(`  ✗ Orphan Note: userId ${n.userId} does not exist in User table`)
        fksValid = false
      }
      if (!jobIds.has(n.jobId)) {
        console.error(`  ✗ Orphan Note: jobId ${n.jobId} does not exist in Job table`)
        fksValid = false
      }
    }

    for (const r of pgResumes) {
      if (!userIds.has(r.userId)) {
        console.error(`  ✗ Orphan Resume: userId ${r.userId} does not exist in User table`)
        fksValid = false
      }
    }

    if (fksValid) {
      console.log('  ✓ PASS: All foreign keys, cascade relations, and parent references are intact')
    } else {
      allChecksPassed = false
    }

    console.log('\n===========================================================')
    if (allChecksPassed) {
      console.log('RESULT: DATA MIGRATION VERIFIED — ALL CHECKS PASSED ✅')
    } else {
      console.log('RESULT: DATA MIGRATION NOT YET COMPLETED OR HAS DISCREPANCIES ⚠️')
    }
    console.log('===========================================================')

    if (!allChecksPassed) {
      process.exit(1)
    }
  } catch (err: any) {
    if (err.name === 'PrismaClientInitializationError') {
      console.error('\n❌ Could not connect to PostgreSQL destination.')
      console.error('  Please check your DATABASE_URL in .env and ensure internet connectivity to Neon.')
    } else {
      console.error('\nVerification encountered error:', err)
    }
    process.exit(1)
  } finally {
    await postgres.$disconnect()
  }
}

runVerification()
