# Talvyn SQLite → Neon PostgreSQL Data Migration Guide

This step-by-step guide walks you through migrating existing user data, profiles, jobs, notes, and resumes from local SQLite (`prisma/talvyn.db`) to your **Neon PostgreSQL** database (`DATABASE_URL`).

---

## 1. Safety & Idempotency Overview

- **Zero Data Loss**: Your local `prisma/talvyn.db` file is read-only during migration and remains completely untouched.
- **ID Preservation**: User IDs, Profile IDs, Job IDs, Note IDs, and Resume IDs are preserved 1-to-1 to maintain foreign-key relationships.
- **Authentication Preservation**: Password hashes (`bcrypt`), Google IDs, and auth providers are preserved without modification. Existing users log in with their existing credentials.
- **Onboarding Status Preservation**: If a user previously completed onboarding (`onboardingCompleted: true`), this flag is migrated directly, taking them straight to the **Dashboard** upon login.
- **Idempotent**: The migration script can be run safely multiple times; existing Neon records are skipped automatically without creating duplicates.

---

## 2. Step 1: Create a Local SQLite Backup

Before running any scripts, create a backup copy of your local SQLite database:

```cmd
copy prisma\talvyn.db prisma\talvyn.db.backup
```

---

## 3. Step 2: Run Migration in Dry-Run Mode (Simulation)

Test the migration against your Neon PostgreSQL database with **zero writes**:

```cmd
npm run db:migrate:data:dry
```

### Expected Output:
```
===========================================================
TALVYN: SQLITE -> NEON POSTGRESQL DATA MIGRATION
===========================================================
Source:      SQLite (.../prisma/talvyn.db)
Destination: PostgreSQL (Configured from DATABASE_URL)
Mode:        🔍 DRY RUN (Simulation - Zero Writes)
===========================================================

--- Step 1: Migrating Users ---
Users: Source: 2 | Would Create: 2 | Skipped: 0 | Conflicts: 0

--- Step 2: Migrating User Profiles ---
Profiles: Source: 2 | Would Create: 2 | Skipped: 0 | Conflicts: 0

--- Step 3: Migrating Jobs ---
Jobs: Source: 2 | Would Create: 2 | Skipped: 0 | Conflicts: 0

--- Step 4: Migrating Notes ---
Notes: Source: 0 | Would Create: 0 | Skipped: 0 | Conflicts: 0

--- Step 5: Migrating Resumes ---
Resumes: Source: 0 | Would Create: 0 | Skipped: 0 | Conflicts: 0

===========================================================
✅ DRY RUN COMPLETED SUCCESSFULLY — ZERO WRITES PERFORMED
===========================================================
```

---

## 4. Step 3: Run Live Data Migration

Once you have verified the dry-run output, execute the live migration:

```cmd
npm run db:migrate:data
```

This writes the SQLite records to Neon PostgreSQL in strict dependency order (`User` → `UserProfile` → `Job` → `Note` → `Resume`).

---

## 5. Step 4: Verify Data Integrity

Run the automated verification suite to confirm that all records and relationships are intact:

```cmd
npm run db:verify:data
```

### Expected Output:
```
===========================================================
TALVYN: SQLITE -> NEON DATA VERIFICATION
===========================================================

Users:
  SQLite:     2
  PostgreSQL: 2
  Status:     ✓ PASS

User Authentication Integrity:
  ✓ User test@talvyn.com: passwordHash: present, authProvider: EMAIL
  ✓ User user@example.com: passwordHash: present, authProvider: EMAIL

Profiles:
  SQLite:     2
  PostgreSQL: 2
  Status:     ✓ PASS

Jobs:
  SQLite:     2
  PostgreSQL: 2
  Status:     ✓ PASS

Foreign Key & Relational Integrity:
  ✓ PASS: All foreign keys, cascade relations, and parent references are intact

===========================================================
RESULT: DATA MIGRATION VERIFIED — ALL CHECKS PASSED ✅
===========================================================
```

---

## 6. Step 5: Start the Application

Start the backend server:
```cmd
npm run dev:server
```

In a separate terminal, start the web application:
```cmd
npm run dev:web
```

---

## 7. Authentication & Google OAuth Notes

- **Email Login**: Log in using your existing email address and password. You will be recognized immediately as the existing user and directed to your dashboard with all your saved jobs and profile details.
- **Google OAuth**: Google Client IDs (`VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID`) are client configuration variables managed in `.env` and are not stored in the database.
- **Resume Files**: Database metadata (`fileName`, `fileSize`, `mimeType`, `storagePath`) is preserved. Local upload files reside in `./uploads/resumes` and `./uploads/avatars`.
