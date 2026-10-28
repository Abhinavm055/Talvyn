# Talvyn production deployment

No deployment, store publication, commit or push is performed by the implementation task. The local build requires coordinated API and website configuration before an authorized deployment.

## Architecture and environment

The website is a Vite static application hosted on Vercel. Express/Prisma runs on Render against PostgreSQL. The extension talks directly to the configured API; the website uses a same-origin `/api` proxy so HttpOnly authentication cookies work without third-party cookies.

Backend environment: `DATABASE_URL`, distinct strong `JWT_SECRET` and `JWT_REFRESH_SECRET`, `CLIENT_URL`, `NODE_ENV=production`, and real `TALVYN_EXTENSION_IDS`. Google sign-in also requires the existing Google client configuration. The backend refuses new extension pairings if the trusted ID list is empty. CORS permits exact configured website and extension origins; authentication/proof checks still apply.

Website build variables: real `VITE_TALVYN_EXTENSION_ID`, `VITE_TALVYN_GITHUB_REPOSITORY`, Google public client ID as appropriate, and optional `TALVYN_PUBLISHED_EXTENSION_VERSION` only after that version is actually published. No browser API secret belongs in VITE variables. Website API requests use `/api`; the Vercel API proxy currently targets `https://talvyn-backend-7ucf.onrender.com`. The extension production API/website origins are configured in its config/manifest. Change matching origins together for another host.

## Authorized rollout order

1. Back up the intended database using its provider controls. Confirm its migration history; do not run development resets or blindly baseline an existing production database.
2. Apply pending migrations with `npm run db:deploy`, including `20261013000000_extension_sessions`, `20261013010000_extension_pairing` and `20261022000000_saved_searches`. They add session/pairing state, auth-version binding and account-owned named filters; they do not delete jobs, profiles or tracker records. Prisma's migration lock/checksums remain authoritative.
3. Generate the Prisma client and build/deploy the API using the existing Render commands. The repository does not automatically run migrations during free-tier Render builds; arrange the authorized migration step separately.
4. Build the website with `npm run build:web`, deploy its `dist` output and verify the same-origin proxy forwards Cookie, Set-Cookie, Origin and request bodies correctly.
5. Verify email and Google sign-in, cookie session restoration, website logout, explicit global sign-out and real extension pairing before making the new extension available.
6. Follow GitHub release distribution instructions in [EXTENSION_SETUP.md](EXTENSION_SETUP.md). Publish the tagged release with `talvyn-extension.zip` and its SHA-256 checksum only after authorization.

## Authentication compatibility

Website responses no longer return bearer tokens to JavaScript. The cookie is HttpOnly, SameSite=Lax, scoped to `/api`, and Secure in production. Mutation requests require an allowed website Origin. Proxying on the website origin avoids Brave's cross-site cookie restrictions.

Existing website logins must sign in again; the client removes the legacy persisted bearer state. Previous extension token-copy connection messages and direct website credential issuance are retired. Supported extension API requests still use independent short-lived bearer tokens. This is an authentication compatibility change, not a silent data migration.

Saved-search UI needs the new table and compatible `/api/saved-searches` routes before exposure. It filters existing saved jobs only; no scheduler/feed/notification provider is added. Search names/criteria are server-side account preferences until explicitly deleted, unaffected by normal logout/disconnect. Update operator privacy/retention disclosures accordingly. Roll back application exposure without dropping user search data. See [saved-search contract, limits and manual checks](docs/SAVED-SEARCHES.md). No production migration/deployment has been performed by this local increment.

A five-minute, single-use, proof-bound connection request is created by the extension. The website verifies worker ownership, displays the account, and approves with explicit persistence consent and expected user ID. Only the worker redeems the verifier. Access tokens last 15 minutes and rotating refresh sessions expire after 30 days of inactivity. Server auth-version checks prevent global-sign-out races from resurrecting refresh sessions.

Website logout clears only its cookie. Extension disconnect revokes its session before reporting success. Global sign-out invalidates website cookies, extension sessions and pending approvals. Server outages must show retry/reconnecting states rather than confirmed success.

## Builds and release metadata

- `npm run build:server`: server TypeScript compilation.
- `npm run build:web`: generate release metadata, website TypeScript check and Vite build. It does not build/distribute extension ZIPs.
- `npm run build:extension`: extension TypeScript check and production Vite build.
- `npm run build:extension:dev`: development-origin unpacked build.
- `npm run package:extension`: production build plus publisher artifact at `extension/dist-package/talvyn-extension.zip`.
- `npm run verify:extension-package`: archive/runtime-reference/version and checked bundle-pattern verification; no claim of store approval.
- `npm test`: focused new regressions plus existing project suites. The runner never inherits the application database. Persistence checks require an explicitly configured, disposable migrated `TALVYN_TEST_DATABASE_URL`; otherwise they report skips/fixture mode. Passing fixtures do not verify PostgreSQL persistence or production transactions.
- `npm run test:postgres`: create a fresh temporary loopback PostgreSQL cluster, apply/check migrations, run real HTTP/database integration and the suites, then stop and remove that cluster. Requires installed PostgreSQL tools; see [validation details](docs/POSTGRES-VALIDATION.md).
- `npm run test:integration`: run real HTTP/PostgreSQL checks against an explicitly configured disposable migrated `TALVYN_TEST_DATABASE_URL`. A configured database failure fails instead of silently switching to fixtures.

The built/runtime manifest is the installed version source. Live release availability is served by `/api/releases/extension` which checks GitHub release metadata assets and GitHub API status dynamically with SSRF protection and caching. When no release has been published yet, the API reports `not-published`. Once a verified release is published via GitHub Actions, the website dynamically exposes the verified download URL and SHA-256 checksum. Browser unpacked Reload updates the extension; a website refresh does not.

## AI, privacy and operational limits

No paid AI provider is implemented or required. Grok is absent/disabled and no XAI key is used. Optional Ollama stays in the extension, requires local configuration/consent and uses loopback with optional host access; see [local setup](docs/LOCAL-AI.md).

Before publishing, complete the privacy page's real operator contact/retention/deletion details and ensure statements match deployment practices. The API's process-local rate limiter is suitable for this deployment shape; multiple replicas need a shared limiter at the API gateway or shared store. Production database integration, actual cookie proxy behavior, live ATS behavior and store updates require the manual checks in the implementation report.
