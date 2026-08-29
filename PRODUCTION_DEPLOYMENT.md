# Talvyn Production Deployment Guide

This document outlines the production readiness architecture, environment variables, database migration plan, security protocols, and deployment sequence for Talvyn.

---

## 1. Environment Variables Specification

### A. Backend API Environment Variables (`server`)

| Variable | Description | Example (Production) | Sensitive? |
|---|---|---|---|
| `PORT` | Server listening port | `3001` or provided by host (`process.env.PORT`) | No |
| `NODE_ENV` | Environment mode | `production` | No |
| `CLIENT_URL` | Allowed frontend origin for CORS | `https://app.talvyn.com` | No |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@db.example.com:5432/talvyn?sslmode=require` | **YES (CRITICAL)** |
| `JWT_SECRET` | Secret key for signing access tokens | `64+ char random hex string` | **YES (CRITICAL)** |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | `64+ char random hex string` | **YES (CRITICAL)** |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID | `*.apps.googleusercontent.com` | Public Identifier |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Web Client Secret | `GOCSPX-...` | **YES (CRITICAL)** |
| `GOOGLE_ALLOWED_ORIGIN` | Allowed Google auth redirect origin | `https://app.talvyn.com` | No |

> 🔒 **Security Rule**: Never commit `.env` or paste backend secrets into frontend client code, repository commits, or extension bundles.

---

### B. Frontend Environment Variables (`Vite SPA`)

| Variable | Description | Example (Production) | Sensitive? |
|---|---|---|---|
| `VITE_API_URL` | Production Backend API Base URL | `https://api.talvyn.com` | No (Public) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web Client ID for Sign-In | `*.apps.googleusercontent.com` | No (Public) |

---

### C. Chrome Extension Configuration

The extension communicates with the Talvyn API via `extension/src/utils/config.ts`:

```ts
export const CONFIG = {
  API_BASE: process.env.NODE_ENV === 'production' ? 'https://api.talvyn.com' : 'http://localhost:3001',
  DASHBOARD_URL: process.env.NODE_ENV === 'production' ? 'https://app.talvyn.com' : 'http://localhost:5173',
  STORAGE_KEY_TOKEN: 'talvyn_token',
  STORAGE_KEY_USER: 'talvyn_user',
  STORAGE_KEY_LAST_JOB: 'talvyn_last_job',
} as const
```

---

## 2. Database Migration Plan: SQLite → PostgreSQL

Talvyn currently uses local SQLite with Prisma for local development. For production:

### Step 1: Update Prisma Datasource Provider
In `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 2: Set Production `DATABASE_URL`
Configure a managed PostgreSQL instance (e.g. Supabase, Neon, AWS RDS, Railway, or PlanetScale):
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/talvyn?sslmode=require"
```

### Step 3: Run Database Migrations
```bash
# Push schema directly to managed PostgreSQL
npx prisma db push

# Generate updated Prisma Client
npx prisma generate
```

### Data Migration Compatibility:
All JSON string arrays (`skills`, `preferredRoles`, `languages`, `preferredLocations`, `preferredJobTypes`, `otherLinks`) stored in SQLite strings map 1-to-1 seamlessly into PostgreSQL `Text` or native `Json` columns without breaking code changes.

---

## 3. Storage Layer Architecture: Local → Cloud Storage

- Current: `LocalStorageProvider` writes avatars and resumes to `uploads/avatars` and `uploads/resumes`.
- Production: The storage abstraction layer (`server/services/storageService.ts`) allows swapping `LocalStorageProvider` for a cloud bucket provider (e.g. `SupabaseStorageProvider` or `S3StorageProvider`) by implementing the `StorageProvider` interface.

---

## 4. Deployment Order & Execution Sequence

```mermaid
flowchart TD
    A[1. Provision Managed PostgreSQL Database] --> B[2. Run Prisma Migrations & Generate Client]
    B --> C[3. Deploy Express Backend API]
    C --> D[4. Deploy React Web SPA on Vercel / Netlify / Cloudflare]
    C --> E[5. Package Chrome Extension: npm run package:extension]
    E --> F[6. Publish ZIP to Chrome Web Store Developer Dashboard]
```

1. **Database Deployment**: Provision managed PostgreSQL and run `npx prisma db push`.
2. **Backend API Deployment**:
   - Host on Render, Railway, Fly.io, or AWS Elastic Beanstalk / ECS.
   - Configure all backend environment variables (`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `CLIENT_URL`).
   - Run health check: `GET https://api.talvyn.com/api/health`.
3. **Frontend Web App Deployment**:
   - Host on Vercel, Cloudflare Pages, Netlify, or AWS S3 + CloudFront.
   - Set `VITE_API_URL=https://api.talvyn.com` and `VITE_GOOGLE_CLIENT_ID`.
   - Run `npm run build:web`.
4. **Chrome Extension Distribution**:
   - Run `npm run package:extension`.
   - Upload `extension/dist-package/talvyn-chrome-extension.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devcenter).

---

## 5. Pre-Deployment Verification Checklist

- [x] All 11 automated test suites passing (`npm run test:onboarding`, `npm run test:google-auth`, etc.)
- [x] Zero build errors across `build:server`, `build:web`, and `build:extension`
- [x] PostCSS & Tailwind configurations using `.cjs` to eliminate Node typeless warnings
- [x] Code splitting & route lazy-loading active (reduced vendor bundles)
- [x] `.gitignore` verified to exclude `.env`, `*.db`, `uploads/`, `dist/`, `dist-package/`
- [x] Zero API keys or secrets exposed in frontend or extension builds
