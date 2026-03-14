# Schedley Backend

NestJS API for the Schedley scheduling app. Matches the frontend API contract (auth, event types, availability, meetings, integrations, public booking).

## Stack

- **Runtime:** Node 18+
- **Framework:** NestJS 10
- **ORM:** TypeORM (PostgreSQL or SQLite)
- **Auth:** JWT + optional Google OAuth (Passport)
- **Validation:** class-validator, class-transformer

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env (see below)
npm run build
npm run start
```

## Environment

Copy `.env.example` to `.env` and set:

- **PORT** – API port (default `5000`)
- **FRONTEND_ORIGIN** – Frontend URL for CORS and OAuth redirect (e.g. `http://localhost:3000`)
- **Database:** either:
  - `USE_SQLITE=true` for SQLite via sql.js (file at `data/sqlite.db`; no native build), or
  - PostgreSQL: `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- **JWT_SECRET** – Secret for JWT (use a long random string in production)
- **JWT_EXPIRES_IN** – e.g. `7d`
- **Google OAuth (optional):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (default `http://localhost:5000/api/auth/google/callback`)

## Scripts

- `npm run build` – compile TypeScript to `dist/`
- `npm run start` – run compiled app
- `npm run start:dev` – run with watch mode
- `npm run start:prod` – run with `node dist/main`

## API base

All routes are under `/api` (e.g. `http://localhost:5000/api`).

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/delete-account`, `GET /api/auth/google`, `GET /api/auth/google/callback`
- **Events:** `POST /api/event/create`, `GET /api/event/all`, `PUT /api/event/toggle-privacy`, `DELETE /api/event/:eventId` (JWT)
- **Public events:** `GET /api/event/public/:username`, `GET /api/event/public/:username/:slug`
- **Availability:** `GET /api/availability/me`, `PUT /api/availability/update` (JWT); `GET /api/availability/public/:eventId?timezone=&from=&to=`
- **Meetings:** `GET /api/meeting/user/all?filter=`, `PUT /api/meeting/cancel/:meetingId` (JWT); `POST /api/meeting/public/create`
- **Integrations:** `GET /api/integration/all`, `GET /api/integration/check/:appType`, `GET /api/integration/connect/:appType` (JWT)

## Project structure

- `src/config` – configuration and env
- `src/common` – decorators (e.g. `ReqUser`), timezone util
- `src/auth` – JWT + Google strategies, login/register, guards
- `src/users` – user entity and service
- `src/event-types` – event types CRUD and public by username/slug
- `src/availability` – user availability and public slots
- `src/meetings` – create (public), list, cancel
- `src/integrations` – list/check/connect (OAuth placeholders)
- `src/public` – public routes (events by username, single event, availability, create meeting)
