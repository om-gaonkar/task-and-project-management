# Daybook

A personal workspace that combines tasks, projects, a private diary, habits, a unified calendar and personal finance. "Daybook" is a working name: change `APP_NAME` in `client/src/lib/constants.ts` and the `<title>` in `client/index.html`.

This repository currently contains **Phase 1: Foundation** (see [Build status](#build-status)).

## Requirements

- Node.js 20.11 or newer and npm
- A reachable MongoDB (local install, Atlas free tier, or the optional Docker Compose file)

No paid services are needed. Cloudinary and Google OAuth arrive in later phases and will stay optional.

## Quick start

```bash
npm install                                  # installs both workspaces
cp server/.env.example server/.env           # then edit MONGODB_URI if needed
cp client/.env.example client/.env
npm run dev                                  # API on :5000, client on :5173
```

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
  middleware/                    validate, error-handler, not-found, rate-limiter, request-logger
  modules/                       one folder per feature (only `health` exists so far)
  shared/                        AppError helpers, response envelope, pagination
  tests/                         unit/ and integration/
client/src/
  app/                           router, providers, layout, navigation config
  components/ui/                 custom component library (no shadcn)
  components/layout/             sidebar, top bar, command palette, breadcrumbs
  components/shared/             PageHeader, ComingSoonPage
  features/                      one folder per feature (dashboard, settings/appearance so far)
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

## Build status

| Phase | Scope                                                                                         | Status                              |
| ----- | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1     | Foundation: project setup, modular backend, error handling, logging, UI kit, responsive shell | **Done in this repository**         |
| 2     | Authentication (sessions, refresh rotation, CSRF, Google OAuth)                               | Next                                |
| 3     | Theme persistence in MongoDB, Settings → Appearance                                           | Local theme switching already works |
| 4     | Tasks, projects, subtasks, tags                                                               |                                     |
| 5     | Mentions and linking                                                                          |                                     |
| 6     | Cloudinary media                                                                              |                                     |
| 7     | Diary                                                                                         |                                     |
| 8     | Habits and calendar                                                                           |                                     |
| 9     | Finance and analytics                                                                         |                                     |
| 10    | Final verification, Playwright end-to-end tests, documentation                                |                                     |

### What exists in Phase 1

- Express 5 + TypeScript API with validated environment, security headers, explicit CORS allowlist, JSON body limit, rate limiting, request ids, structured logs, graceful shutdown, and health endpoints.
- React 19 + Vite + Tailwind 4 client with a collapsible sidebar, tablet rail, mobile drawer, top bar, command palette (Ctrl/Cmd+K), quick-create menu, light/dark/system theme without a startup flash, and a typed API client with TanStack Query.
- Custom components: Button, IconButton, Input, Field, Badge, Skeleton, Spinner, EmptyState, ErrorState, Dialog, Drawer, ConfirmDialog, Menu, Toast, Breadcrumbs, PageHeader.
- The Overview page shows live data from `/health`, which exercises the client, query layer and error states end to end.

### What is deliberately not there yet

- No authentication, so routes are public and there is no profile menu. Phase 2 adds protected routes and the single `/auth/me` bootstrap.
- Quick-create items and the palette's "Create" commands are listed but disabled until their modules exist. Palette search covers pages only for now.
- Every other sidebar page is a placeholder stating which phase delivers it.
- Playwright and `react-hook-form`/`zod` on the client are added when the first form and the first end-to-end flow need them.

## Verification status

The code was written without network access, so `npm install` and the toolchain could not be run while building it. Nothing here has been installed, type-checked against real packages, linted or executed by the test suites. The only check that ran was a syntax and unused-symbol pass with a bare TypeScript compiler, which found nothing; type errors cannot be ruled out without the packages. `npm run format` is included because the files were hand-formatted and Prettier may adjust some of them. The first thing to run on your machine:

```bash
npm install && npm run format && npm run typecheck && npm run lint && npm test && npm run build
```

Dependency versions were chosen from memory of mutually compatible releases (Express 5, Mongoose 8, Zod 3.25, Vite 6, Vitest 3, React 19, Tailwind 4, TypeScript 5.8). If `npm install` reports a version conflict or a typecheck error, fix that first; it is most likely a small adjustment.
