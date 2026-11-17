# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Birdiary frontend: a Next.js 15 (App Router, React 18) app for logging bird sightings. It talks to a separate NestJS/Prisma backend over REST. Core features work **without an account**: signed-out users' data lives in `localStorage`.

## Commands

- `npm run dev`: dev server
- `npm run build`: production build (this is also the type check; there is no separate `tsc` script)
- `npm run lint`: `next lint` (eslint `next/core-web-vitals` + `next/typescript`)
- Formatting: Prettier with `prettier-plugin-tailwindcss` (sorts Tailwind classes)

There is no test suite.

## Environment

Env vars are read only through `constants/config.constants.ts` (`CONFIG`). Note that `CONFIG.BASE_URL` (`NEXT_PUBLIC_BASE_URL`) is the **backend API base URL** used by `serverApiRequest`. Also needed: `SESSION_KEY` (JWT signing secret), Google Maps keys, Sentry vars and the Turnstile site key. `.env` lists Cloudflare's test Turnstile keys for local development.

## Architecture

### Data access: two paths
1. **Server-side** (`actions/api.actions.ts`): `serverApiRequest` is a server action that wraps `fetch` to the backend. It attaches the `session` cookie as `Authorization: Bearer`. GETs use `force-cache` with Next cache `tags` (`"location" | "sighting" | "user"`, see `types/api.types.ts`). Mutations take `revalidateTags`, and those tags are revalidated when the response is OK. Server components (pages) call it directly.
2. **Client-side** (`context/ApiContext.tsx`): the `useApi()` hooks `useQuery` and `useMutation` branch on whether a session cookie exists:
   - Signed in: they call `serverApiRequest`. A 401 response triggers sign-out and a redirect to `/signin`.
   - Signed out: they call `queryStorage` / `mutateStorage` in `helpers/storage.helpers.ts`. These emulate the backend's routes, pagination and sorting against the `localStorage` keys `sightings` and `diary` by **parsing the route string** (e.g. `groupBy=date`, `dateId=`, `page=`, `sortBy=`). If you change a route's query-string shape, update the storage parser too. Bird data for storage comes from the static list in `db/birdNames.ts` (`BIRD.BIRD_COUNT` = 824).

Backend responses follow the `ApiResponse<T>` discriminated union (`error: true/false`, `data`, `count`, `message`, `statusCode`).

Lists in the UI are usually rendered by `components/pages/shared/CsrList.tsx`. The server page validates the `page`/`sortBy` search params, redirecting to defaults when they are missing, and passes a `route` string to it.

### Auth
- `lib/session.ts` (server-only) signs and verifies an HS256 JWT `{ id }` with `jose` and stores it in an httpOnly `session` cookie that lasts 7 days. `actions/auth.actions.ts` creates the session after the backend's `/users/signin` or `/users/signup` call succeeds.
- `getCookie()` (raw JWT) lives in `lib/session.ts` and is server-only. `helpers/auth.helpers.ts` is a `"use server"` file, so every export is browser-callable: it exposes only `checkSession`, `hasSessionCookie` and `getUserProfileOrNull`. Never return the token from a server action; browser code must not call the backend directly with it (e.g. CSV export goes through `exportSightingsCsv`).
- `middleware.ts`: `/lifelist`, `/locations` and `/profile` require auth. Auth pages (`/signin*`, `/signup`, `/verify*`) redirect signed-in users to `/`. `/sightings`, `/diary` and `/newsighting` are deliberately public because they fall back to localStorage.
- `context/AuthContext.tsx` holds client `isSignedIn` state and rechecks it on every pathname change.
- `components/pages/profile/TransferStorageData.tsx` moves localStorage data into an account.

### Conventions
- Import alias `@/*` maps to the repo root.
- `components/ui/` is shadcn/ui (`components.json`). `components/pages/<feature>/` holds feature components and `components/pages/shared/` holds shared view pieces (`ViewWrapper`, `ViewHeader`, `ErrorDisplay`, `Pending`).
- Forms use react-hook-form + zod. The schemas are in `schemas/`.
- User-facing error strings live in the `ErrorMessages` enum in `types/error-messages.enum.ts`.
- Errors are logged with `Sentry.logger.error`. Sentry is configured in `instrumentation*.ts`, `sentry.*.config.ts` and `next.config.ts` (tunnel route `/monitoring`).
- Each page sets SEO through `metadata` / `generateMetadata`. Private, user-specific and auth pages set `robots: "noindex"`.
- Remote images come only from `res.cloudinary.com` (`next.config.ts`).
