# Talvyn Production Deployment Guide

This document provides the complete, step-by-step instructions for deploying Talvyn to production:
- **Backend**: Render (Node.js/Express)
- **Frontend**: Vercel (React/Vite SPA)
- **Database**: Neon PostgreSQL
- **Extension**: Chrome Extension Distribution

---

## 1. Environment Variables Specification

### A. Backend API Environment Variables (Render Dashboard)

| Variable | Description | Example (Production) | Sensitive? |
|---|---|---|---|
| `PORT` | Server listening port | Automatically assigned by Render (e.g. `10000`) | No |
| `NODE_ENV` | Environment mode | `production` | No |
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/talvyn?sslmode=require` | **YES (CRITICAL)** |
| `CLIENT_URL` | Allowed frontend origin for CORS (Vercel domain) | `https://talvyn.vercel.app` | No |
| `JWT_SECRET` | Secret key for signing access tokens | `64+ character random secret` | **YES (CRITICAL)** |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | `64+ character random secret` | **YES (CRITICAL)** |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID | `*.apps.googleusercontent.com` | Public Identifier |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Web Client Secret | `GOCSPX-...` | **YES (CRITICAL)** |
| `GOOGLE_ALLOWED_ORIGIN` | Allowed Google auth origin (Vercel domain) | `https://talvyn.vercel.app` | No |

> 🔒 **Security Rule**: Never commit `.env` or paste backend secrets into frontend client code, repository commits, or extension bundles.

---

### B. Frontend Environment Variables (Vercel Project Settings)

| Variable | Description | Example (Production) | Sensitive? |
|---|---|---|---|
| `VITE_API_URL` | Render Backend API Base URL | `https://talvyn-api.onrender.com` | No (Public) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web Client ID for Sign-In | `*.apps.googleusercontent.com` | No (Public) |

---

## 2. Deployment Sequence

```mermaid
flowchart TD
    A[1. Neon Database Ready] --> B[2. Deploy Backend on Render]
    B --> C[3. Run prisma migrate deploy]
    B --> D[4. Deploy Frontend on Vercel]
    D --> E[5. Update Google Cloud Console Authorized Origins]
    B --> F[6. Package Chrome Extension with Production API URL]
```

---

## 3. Manual Deployment Steps

### Step 1: Database Migration (Neon PostgreSQL)
1. Verify `DATABASE_URL` in Neon Console.
2. In Render build step (or via local terminal with production `DATABASE_URL`):
   ```bash
   npm run db:deploy
   ```
   *(Uses `prisma migrate deploy` which applies existing migrations without deleting any data).*

### Step 2: Deploy Backend to Render
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\to$ **Web Service** $\to$ Connect repository `Abhinavm055/Talvyn`.
3. Configure settings:
   - **Name**: `talvyn-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run prisma:generate && npm run build:server`
   - **Start Command**: `npm run start:server`
   - **Health Check Path**: `/api/health`
4. Add the Backend Environment Variables listed in Section 1A.
5. Deploy and verify health check at `https://your-backend.onrender.com/api/health`.

### Step 3: Deploy Frontend to Vercel
1. Go to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** $\to$ **Project** $\to$ Import repository `Abhinavm055/Talvyn`.
3. Configure settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build:web`
   - **Output Directory**: `dist`
4. Add the Frontend Environment Variables listed in Section 1B:
   - `VITE_API_URL`: Your Render backend URL (e.g. `https://talvyn-api.onrender.com`)
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth Web Client ID
5. Deploy! Vercel will use `vercel.json` for client-side SPA routing.

### Step 4: Update Google Cloud Console OAuth Credentials
1. Open [Google Cloud Console](https://console.cloud.google.com/) $\to$ **APIs & Services** $\to$ **Credentials**.
2. Edit your Web Client ID:
   - **Authorized JavaScript origins**:
     - `https://your-frontend.vercel.app`
     - `http://localhost:5173`
   - **Authorized redirect URIs**:
     - `https://your-frontend.vercel.app`
     - `https://your-frontend.vercel.app/login`
3. Save changes.

### Step 5: Package Chrome Extension for Production
1. In `extension/src/utils/config.ts`, update `API_BASE` to your Render API URL and `DASHBOARD_URL` to your Vercel URL (or use environment override).
2. Run packaging command:
   ```bash
   npm run package:extension
   ```
3. The production package is created at `extension/dist-package/talvyn-chrome-extension.zip`.
4. Distribute `.zip` or upload to the Chrome Web Store Developer Dashboard.
