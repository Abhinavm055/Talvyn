# Talvyn Database Migration Guide: SQLite → Neon PostgreSQL

This guide explains the database architecture, schema migration, local setup, and production deployment procedures for Talvyn using **Neon Serverless PostgreSQL** and **Prisma ORM**.

---

## 1. Architecture Overview

- **ORM**: Prisma Client (`@prisma/client` v5.22.0)
- **Datasource Provider**: `postgresql`
- **Database Engine**: Neon Serverless PostgreSQL (Production) / PostgreSQL (Local Dev)
- **Schema**: `prisma/schema.prisma`
- **Migrations Directory**: `prisma/migrations/`

---

## 2. PostgreSQL Schema & Model Compatibility

All Talvyn models have been verified for full PostgreSQL compatibility:

| Model | Key Features & Compatibility |
|---|---|
| **`User`** | Unique `email`, unique `googleId`, cascade deletes to `UserProfile`, `Job`, `Note`, `Resume`. Indexed on `email` and `googleId`. |
| **`UserProfile`** | Unique `userId` foreign key. Serialized array fields (`skills`, `preferredRoles`, `languages`, `preferredLocations`, `preferredJobTypes`, `otherLinks`) stored as text for 100% backward-compatible parsing. Indexed on `userId`. |
| **`Job`** | Foreign key `userId` (`onDelete: Cascade`). Standard `DateTime` timestamps with `CURRENT_TIMESTAMP`. Indexed on `userId`, `status`, and compound `[userId, status]`. |
| **`Note`** | Foreign keys `jobId` and `userId` (`onDelete: Cascade`). Indexed on `jobId` and `userId`. |
| **`Resume`** | Foreign key `userId` (`onDelete: Cascade`). Tracks file metadata (`fileName`, `fileSize`, `mimeType`, `storagePath`). Indexed on `userId`. |

---

## 3. Environment Configuration

The database connection is **strictly** loaded from the `DATABASE_URL` environment variable.

### Production (Neon PostgreSQL):
In your production environment (e.g. Render, Railway, Vercel, AWS ECS):
```env
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[ENDPOINT].neon.tech/talvyn?sslmode=require"
```

> 💡 **Neon Connection Pooling Tip**: For serverless environments, Neon provides a pooled connection endpoint (`-pooler` subdomain). Use the pooled string for runtime queries (`DATABASE_URL`) and direct connection for migrations if needed.

### Local Development:
Option A: Use a local PostgreSQL instance (Docker or local service):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/talvyn?schema=public"
```
Option B: Use a Neon Development Branch (created via Neon Console).

---

## 4. Migration Commands & Workflow

Talvyn provides safe npm scripts configured in `package.json`:

### 1. Generating Prisma Client
Regenerates the TypeScript client from the schema:
```bash
npm run db:generate
# (or npx prisma generate)
```

### 2. Creating New Migrations (Development Only)
When making changes to `prisma/schema.prisma` in development:
```bash
npm run db:migrate
# (or npx prisma migrate dev --name <migration_name>)
```

### 3. Deploying Migrations to Production (Neon)
To apply pending migrations to your production Neon database:
```bash
npm run db:deploy
# (or npx prisma migrate deploy)
```
> ⚠️ **IMPORTANT**: `prisma migrate deploy` is non-destructive. It only executes unapplied SQL migration files without resetting or dropping tables.

### 4. Viewing Data (Prisma Studio)
```bash
npm run db:studio
```

---

## 5. Deployment Step-by-Step for Neon Production

When you are ready to connect and deploy to your Neon database:

1. **Set `DATABASE_URL`** in your `.env` (or production host environment variables) to your Neon connection string.
2. **Run the migration deployment**:
   ```bash
   npm run db:deploy
   ```
3. **Verify database connection**:
   The output should confirm: `1 migration applied.` (`20260830000000_init_postgresql`).
4. **Start the backend server**:
   ```bash
   npm run dev:server
   ```
   Health check: `http://localhost:3001/api/health`

---

## 6. Rollback & Disaster Recovery Considerations

1. **Neon Point-in-Time Restore**: Neon provides instant branching and Point-in-Time Recovery (PITR). Before major structural updates, you can create a zero-copy branch in Neon with 1 click.
2. **Prisma Migrations**: Every migration is tracked in the `_prisma_migrations` table with exact checksums and timestamps.
3. **Foreign Key Integrity**: All relation deletes enforce `CASCADE` on child records, preventing orphaned jobs, notes, or profile rows.
