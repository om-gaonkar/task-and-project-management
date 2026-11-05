# Daybook

A personal workspace that combines tasks, projects, a private diary, habits, a unified calendar and personal finance. "Daybook" is a working name: change `APP_NAME` in `client/src/lib/constants.ts` and the `<title>` in `client/index.html`.

This repository currently contains **Phase 1: Foundation** and **Phase 2: Authentication** (see [Build status](#build-status)).

## Requirements

- Node.js 20.11 or newer and npm
- A reachable MongoDB (local install, Atlas free tier, or the optional Docker Compose file)

No paid services are needed. Google sign-in is optional and Cloudinary arrives in a later phase.

## Quick start

```bash
npm install                                  # installs both workspaces
cp server/.env.example server/.env           # then set the two token secrets (see below)
cp client/.env.example client/.env
npm run dev                                  # API on :5000, client on :5173
```

The API refuses to start without `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` (two different values, 32+ characters each). Generate them with `openssl rand -base64 48`.

Optional MongoDB through Docker (single-node replica set, so transactions work in later phases):

```bash
docker compose up -d mongo
# in server/.env:
# MONGODB_URI=mongodb://127.0.0.1:27017/productivity_workspace?replicaSet=rs0&directConnection=true
```

## Scripts (run from the repository root)

| Command                           | What it does                                                                |
| --------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                     | Starts the API (`tsx watch`) and the Vite client together                   |
| `npm run build`                   | Compiles the server to `server/dist` and builds the client to `client/dist` |
| `npm run typecheck`               | Strict TypeScript check of both packages                                    |
| `npm run lint`                    | ESLint for both packages                                                    |
| `npm test`                        | Vitest for both packages                                                    |
| `npm run format` / `format:check` | Prettier                                                                    |

Run a single package with `npm run <script> -w server` or `-w client`.

## Structure

```text
server/src/
  app.ts, server.ts, routes.ts   app factory, process entry point, route registry
  config/                        env validation, logger, database, CORS
  middleware/                    validate, csrf, error-handler, not-found, rate-limiter, request-logger
  modules/                       one folder per feature (`health`, `auth`)
  shared/                        AppError helpers, response envelope, pagination
  tests/                         unit/ and integration/
client/src/
  app/                           router, providers, layout, navigation config
  components/ui/                 custom component library (no shadcn)
  components/layout/             sidebar, top bar, command palette, breadcrumbs
  components/shared/             PageHeader, ComingSoonPage
  features/                      one folder per feature (auth, dashboard, settings/appearance so far)
  lib/                           api-client, query-client, utils
  styles/index.css               design tokens and Tailwind setup
```

### Conventions that later phases build on

**Response envelope.** Success is `{ "success": true, "data": ..., "meta"?: ... }`. Failure is `{ "success": false, "error": { "code", "message", "details"?, "requestId" } }`. The client's `api-client.ts` unwraps the first and throws `ApiError` for the second, so features never parse envelopes themselves.

**Errors.** Services throw `AppError` helpers (`notFound()`, `conflict()`, ...). The central handler also maps Zod, Mongoose and body-parser errors, and never leaks the message of an unexpected error. Return `notFound()` (not `forbidden()`) for records that belong to someone else, so ids cannot be probed.

**Validation.** Wrap every route in `validate({ params, query, body })` and read the parsed values with `getValidated(res)`. Parsed values live on `res.locals` because `req.query` is read-only in Express 5.

**Async handlers.** Express 5 forwards rejected promises to the error handler, so no `asyncHandler` wrapper is needed.

**Database.** `connectDatabase()` is called once in `server.ts`. `createApp()` never connects, so tests import the app freely. `GET /api/v1/health` is liveness (always 200 while the process is up); `GET /api/v1/health/ready` returns 503 until MongoDB is connected.

**Logging.** Pino with redaction of cookies and auth headers. Request logs contain only method, path (no query string) and status. Never log tokens, passwords or diary text.

**Design tokens.** Colours live as CSS variables in `styles/index.css` for light and dark, and Tailwind utilities (`bg-surface`, `text-fg-muted`, `border-border`, `bg-accent`, ...) point at them. Components contain no raw theme colours, so a new theme is a new block of variables. An inline script in `index.html` applies the saved theme before first paint.

**Adding a page.** Add an entry to `client/src/app/navigation.ts` (it feeds the sidebar, drawer, palette and routes), then replace its `ComingSoonPage` element in `app/routes.tsx` with the real page.

## Authentication (Phase 2)

Email and password, plus optional Google sign-in. Built for a frontend and an API that are deployed separately.

### How it works

| Piece               | Where it lives                                          | Lifetime                                     |
| ------------------- | ------------------------------------------------------- | -------------------------------------------- |
| Access token (JWT)  | **Memory only** in the browser, sent as `Authorization` | 15 minutes (`ACCESS_TOKEN_TTL_MINUTES`)      |
| Refresh token       | `httpOnly` cookie scoped to `/api/v1/auth`              | 7 days, replaced on every use (sliding)      |
| Session (the login) | A family of refresh tokens in MongoDB (`RefreshToken`)  | Hard cap of 30 days (`SESSION_MAX_AGE_DAYS`) |

- **A page load starts with no token.** The client calls `POST /auth/refresh`; the cookie answers with a new access token and the user. Until that call settles the app shows "Checking your session", and if the server cannot be reached it shows a retry screen rather than a sign-in page (being offline is not being signed out).
- **Refresh tokens are single-use.** Each refresh retires the old token and issues a new one in the same session. If a retired token is ever presented again, someone has a copy, so that whole session is revoked. Other devices are not affected.
- **Only a keyed hash of the refresh token is stored** (HMAC-SHA256 with `REFRESH_TOKEN_SECRET`), and the token is 256 random bits, so a leaked database cannot be replayed.
- **Sign-out and "remove this device" take effect immediately.** The access-token check also confirms the session still exists (one indexed lookup), so a revoked session does not stay usable for up to 15 minutes.
- **Two tabs cannot trip the reuse detection.** Refreshes are serialised across tabs with the Web Locks API and shared within a tab. Browsers without Web Locks fall back to per-tab sharing.
- **On a 401 the API client refreshes once and replays the request.** A second 401 is returned as an error. Cached query data is cleared whenever the user changes.

### Endpoints (`/api/v1/auth`)

| Method and path                   | Auth    | Purpose                                                               |
| --------------------------------- | ------- | --------------------------------------------------------------------- |
| `POST /register`                  | none    | Create an account and sign in (201)                                   |
| `POST /login`                     | none    | Sign in. Throttled per IP and email                                   |
| `POST /refresh`                   | cookie  | Rotate the refresh token, return a new access token                   |
| `POST /logout`                    | cookie  | Revoke this session and clear the cookie (204, always succeeds)       |
| `GET /me`                         | bearer  | The signed-in user                                                    |
| `GET /sessions`                   | bearer  | Active sessions (device, IP, dates, `isCurrent`)                      |
| `DELETE /sessions/:sessionId`     | bearer  | Remove one device                                                     |
| `POST /logout-all`                | bearer  | Revoke every session                                                  |
| `GET /providers`                  | none    | `{ google: boolean }`, so the client knows whether to show the button |
| `GET /google`, `/google/callback` | browser | Google redirect flow (see below)                                      |

Login, register and refresh return `{ user, accessToken, expiresIn }`. The refresh token only ever travels in the cookie.

### CSRF

Cookie-authenticated requests are protected by two checks in `middleware/csrf.ts`: an `Origin` header, when present, must be on the `CLIENT_URL` allowlist, and every state-changing request must carry a custom `X-CSRF-Token` header. A page on another origin cannot add a custom header without a CORS preflight, and the preflight is refused for origins outside the allowlist. A synchronizer token would not work here: with the API on another domain the page cannot read the API's cookies, and a token would need an extra round trip before the first refresh on every page load. Bearer-authenticated routes are not exposed to CSRF because browsers do not attach that header on their own.

### Google sign-in (optional)

Set all three of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (or none; the button then does not appear). Create a **Web application** OAuth client in Google Cloud Console and add the callback as an authorized redirect URI. **The callback is served by the API**, for example `https://api.example.com/api/v1/auth/google/callback`, not by the client.

The flow is authorization code with PKCE and a random `state`, both held in a short-lived `httpOnly` cookie. The identity comes from Google's signed ID token, verified against your client id. On success the API sets the refresh cookie and redirects to `CLIENT_URL` (the first origin listed), where the normal page-load refresh picks the session up. Failures redirect to `/login?error=...`.

**Linking rule.** Registering with a password does not prove ownership of the address, so anyone could register an account with someone else's email and wait. If a Google sign-in arrives for an email that has an _unverified password account_, that password is removed and all of that account's sessions are revoked before Google is linked. The person keeps their data and signs in with Google from then on. When email verification is added, a verified password account will keep its password.

### Deploying the frontend and backend separately

How the refresh cookie travels decides whether sign-in survives a reload, so choose the topology first.

**Recommended: one parent domain** (for example `app.example.com` and `api.example.com`). Browsers treat these as the same site, so the cookie is first-party.

```text
# server
CLIENT_URL=https://app.example.com
COOKIE_SAME_SITE=lax          # COOKIE_SECURE defaults to true in production
TRUST_PROXY=1                 # hops between the internet and Express, so req.ip is the real address
GOOGLE_CALLBACK_URL=https://api.example.com/api/v1/auth/google/callback

# client (build time)
VITE_API_URL=https://api.example.com/api/v1
```

**Also works: proxy the API through the frontend host.** Add a rewrite from `/api/*` on the frontend host to the backend and build the client with `VITE_API_URL=/api/v1`. The cookie is then first-party to the frontend, and `CLIENT_URL` is the frontend origin.

**Last resort: different registrable domains** (for example `myapp.vercel.app` and `myapi.onrender.com`). Set `COOKIE_SAME_SITE=none` (the API requires `COOKIE_SECURE=true` with it). The cookie is now a third-party cookie, which Safari blocks by default and other browsers are restricting. Expect sign-in not to persist across reloads for some visitors. If you can add a custom domain to either side, do that instead.

Other things to know when deploying:

- **Rate limit counters are per process.** With more than one API instance, each counts alone. Move to a shared store (for example Redis) when you scale out.
- **The reuse rule has one cost.** If a refresh succeeds on the server but the response never reaches the browser (a connection dropped at that moment), the retry presents an already-used token and ends the session. The person signs in again. This is the usual trade-off of rotation.
- **Indexes.** Mongoose builds them on start in development. For production, check that the `RefreshToken` TTL index on `expiresAt` and the unique indexes on `User` exist.

### Where this differs from `auth-kit-backend`

| Reference                                                 | Here                                                                             | Why                                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `googleId: { default: null, unique: true, sparse: true }` | Partial unique index on string values only, no default                           | A sparse index still indexes explicit nulls, so a second password-only user would hit a duplicate-key error    |
| Google link by email automatically                        | Password removed and sessions revoked if the password account was never verified | Closes the pre-hijacking route described above                                                                 |
| Reuse revokes **all** the user's tokens                   | Revokes that session only                                                        | One stolen token on one device should not sign out the person's other devices                                  |
| Client IP read from `X-Forwarded-For`                     | `req.ip` with `TRUST_PROXY`                                                      | The header is spoofable unless a trusted proxy sets it                                                         |
| Refresh token is a JWT with `jti`                         | Opaque random token, keyed hash stored                                           | Nothing to forge or decode, one fewer secret-bearing format                                                    |
| Access token trusted until it expires                     | Also checks the session still exists                                             | Revocation is immediate                                                                                        |
| bcrypt, composition rules (upper, lower, digit, symbol)   | scrypt from `node:crypto`, 10 to 128 characters, no composition rules            | No native build to break on a host; length protects more than symbol rules; also avoids bcrypt's 72-byte limit |
| Names limited to `[a-zA-Z ]`                              | Any name up to 80 characters                                                     | Rejected real names such as "José" and "李"                                                                    |
| `googleapis` and a userinfo call                          | `google-auth-library`, PKCE, verified ID token                                   | Much smaller dependency, and the identity is cryptographically verified                                        |
| `ua-parser-js` v2                                         | A 40-line parser                                                                 | v2 is AGPL-licensed, and the result is only a label in a device list                                           |

## Build status

| Phase | Scope                                                                                         | Status                      |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------- |
| 1     | Foundation: project setup, modular backend, error handling, logging, UI kit, responsive shell | **Done in this repository** |
| 2     | Authentication (sessions, refresh rotation, CSRF, Google OAuth)                               | **Done in this repository** |
| 3     | Theme persistence in MongoDB, Settings → Appearance and Security                              | Next                        |
| 4     | Tasks, projects, subtasks, tags                                                               |                             |
| 5     | Mentions and linking                                                                          |                             |
| 6     | Cloudinary media                                                                              |                             |
| 7     | Diary                                                                                         |                             |
| 8     | Habits and calendar                                                                           |                             |
| 9     | Finance and analytics                                                                         |                             |
| 10    | Final verification, Playwright end-to-end tests, documentation                                |                             |

### What exists in Phase 1

- Express 5 + TypeScript API with validated environment, security headers, explicit CORS allowlist, JSON body limit, rate limiting, request ids, structured logs, graceful shutdown, and health endpoints.
- React 19 + Vite + Tailwind 4 client with a collapsible sidebar, tablet rail, mobile drawer, top bar, command palette (Ctrl/Cmd+K), quick-create menu, light/dark/system theme without a startup flash, and a typed API client with TanStack Query.
- Custom components: Button, IconButton, Input, Field, Badge, Skeleton, Spinner, EmptyState, ErrorState, Dialog, Drawer, ConfirmDialog, Menu, Toast, Breadcrumbs, PageHeader.
- The Overview page shows live data from `/health`, which exercises the client, query layer and error states end to end.

### What exists in Phase 2

- Registration, sign-in, sign-out, refresh rotation with reuse detection, an absolute session lifetime, "sign out everywhere" and per-device removal (API), CSRF protection for cookie routes, per-email sign-in throttling, and optional Google sign-in with PKCE.
- Client: sign-in and registration pages, a sign-in gate around the whole app that returns people to the page they asked for, a profile menu with sign-out, a refresh-and-retry API client, and cross-tab-safe session restore.

### What is deliberately not there yet

- No email verification and no password reset (both need an email provider). Until verification exists, every password account is treated as unverified for Google linking.
- No sessions list in the UI. The endpoints exist (`GET /sessions`, `DELETE /sessions/:id`, `POST /logout-all`); the Security screen arrives with Settings in phase 3.
- No multi-factor authentication and no admin or role system.
- Quick-create items and the palette's "Create" commands are listed but disabled until their modules exist. Palette search covers pages only for now.
- Every other sidebar page is a placeholder stating which phase delivers it.
- Playwright and `react-hook-form`/`zod` on the client are added when the first form and the first end-to-end flow need them.

## Verification status

Phase 1's checks were never run when it was written. For Phase 2 they were run, in a sandbox with registry access:

| Check                                | Result                                    |
| ------------------------------------ | ----------------------------------------- |
| `npm install`                        | Succeeds                                  |
| `npm run typecheck` (both packages)  | Clean                                     |
| `npm run lint` (both packages)       | Clean                                     |
| `npm test`                           | Server 108 tests and client 79 tests pass |
| `npm run build`                      | Server compiles; client builds            |
| API refuses to start without secrets | Confirmed                                 |

Key security tests were also checked by breaking the code they guard (reuse detection, the CSRF header check, the pre-hijacking guard, JWT algorithm pinning, the open-redirect guard, single-flight refresh) and confirming each one fails.

**Not verified, so check these first on your machine:**

1. **Against a real MongoDB.** The Mongoose models and repositories (`user.repository.ts`, `session.repository.ts`) were not run; the rotation logic was tested against in-memory fakes that follow the same interface. A manual smoke test with `docker compose up -d mongo`:

   ```bash
   BASE=http://localhost:5000/api/v1
   H=(-H "Origin: http://localhost:5173" -H "X-CSRF-Token: 1" -H "Content-Type: application/json")

   curl -s -c jar.txt "${H[@]}" -d '{"name":"Ada","email":"ada@example.com","password":"a long enough password"}' $BASE/auth/register
   cp jar.txt stale.txt                                               # a copy of the first refresh token
   curl -s -b jar.txt -c jar.txt -X POST "${H[@]}" $BASE/auth/refresh  # rotates: 200 and a new cookie
   curl -s -b stale.txt -X POST "${H[@]}" $BASE/auth/refresh           # reuse: 401
   curl -s -b jar.txt -X POST "${H[@]}" $BASE/auth/refresh             # session revoked too: 401
   ```

2. **Google sign-in end to end.** The provider code is typed against `google-auth-library` and the callback logic is covered, but a real consent screen was not exercised.
3. **In a real browser.** The sign-in screens were built and tested with Testing Library, not looked at. Check the ruled day-page layout at desktop and phone widths, in light and dark.
4. **Your hosting topology.** Cookie behaviour depends on whether the two origins are the same site (see [Deploying the frontend and backend separately](#deploying-the-frontend-and-backend-separately)).
