# Talvyn – From Potential to Offer.

Talvyn is a universal job application and career management platform that helps users organize opportunities, track applications, analyze job postings, and autofill application forms across career fields (Software, Data, Design, Marketing, HR, Finance, Operations, Sales, and more).

---

## Project Structure

```
Talvyn/
│
├── src/                          # React 18 + TypeScript Web Dashboard Frontend
│   ├── api/                      # REST API client services
│   ├── components/               # Reusable UI components (Sidebar, TopNav, Kanban, Forms)
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities & helpers
│   ├── pages/                    # Application pages (Dashboard, Jobs, Resumes, Profile, etc.)
│   ├── services/                 # Service layer re-exports
│   ├── store/                    # Zustand state management (authStore)
│   ├── types/                    # Frontend TypeScript interfaces
│   ├── App.tsx                   # App root
│   ├── main.tsx                  # React DOM entry
│   └── router.tsx                # React Router v6 configuration
│
├── server/                       # Express + Prisma + SQLite Backend
│   ├── lib/                      # Prisma client instance
│   ├── middleware/               # Auth middleware (JWT bearer token)
│   ├── routes/                   # REST API routes (auth, jobs, notes, profile, resumes)
│   ├── services/                 # Backend service helpers
│   ├── config.ts                 # Environment configuration
│   ├── index.ts                  # Express server entry point
│   └── tsconfig.json             # Server TypeScript config
│
├── prisma/                       # Database schema & SQLite database
│   ├── schema.prisma             # Universal user, profile, job, note, and resume models
│   ├── migrations/               # Prisma migrations history
│   └── talvyn.db                 # SQLite database file
│
├── extension/                    # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── background/           # Background service worker
│   │   ├── content/              # Content scripts (Scanner, Discovery Panel, Autofill Panel)
│   │   │   ├── adapters/         # Job listing & single job site adapters
│   │   │   └── autofill/         # Universal autofill detector, matcher, engine, & adapters
│   │   ├── popup/                # Extension popup UI (Auth status, Quick actions)
│   │   ├── services/             # Extension API client services (Jobs, Profile, Resumes)
│   │   ├── types/                # Extension TypeScript types
│   │   └── utils/                # Chrome storage & config utilities
│   ├── icons/                    # Extension action icons
│   ├── test/                     # Mock pages & automated verification tests
│   ├── package.json              # Extension build dependencies
│   ├── tsconfig.json             # Extension TypeScript config
│   └── vite.config.ts            # Vite + CRXJS plugin configuration
│
├── public/                       # Static public assets for web app
├── index.html                    # Web app HTML entry point
├── package.json                  # Unified root package.json
├── tsconfig.json                 # Web frontend TypeScript config
├── tsconfig.node.json            # Vite config TypeScript config
├── vite.config.ts                # Vite frontend bundler config
├── tailwind.config.js            # Tailwind CSS configuration
└── .env                          # Root environment variables
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
npm --prefix extension install
```

### 2. Database Setup
```bash
npm run db:generate
npm run db:migrate
```

### 3. Run Development Servers
Start both the Express backend (`http://localhost:3001`) and React frontend (`http://localhost:5173`):
```bash
npm run dev
```

Or run them individually:
```bash
npm run dev:server   # Starts backend API on port 3001
npm run dev:web      # Starts frontend Vite server on port 5173
```

---

## Chrome Extension Setup

### 1. Build the Extension
```bash
npm run build:extension
```
The compiled extension is output to `Talvyn/extension/dist/`.

### 2. Load into Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn on **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `Talvyn/extension/dist` folder.
4. Open any job board (LinkedIn, Indeed, Greenhouse, Lever, Workday) or the mock testing pages in `extension/test/` to see the Talvyn panel in action.

---

## Verification & Automated Tests

Run the complete test suites from the root directory:
```bash
npm run test:scoring    # Runs 15/15 Smart Job List Analyzer tests
npm run test:autofill   # Runs 12/12 Universal Application Autofill tests
```

---

## Production Build

Build both the backend server and frontend client for production:
```bash
npm run build
```
