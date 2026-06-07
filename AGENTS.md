# AGENTS.md

This file serves as the unified source of truth for all AI agents (Claude Code, Gemini CLI, etc.) working on the Rayuela project.

## Project Overview

Rayuela is a full-stack citizen science platform with adaptive gamification for crowdsourced data collection. It is a monorepo with two main packages:

- `rayuela-NodeBackend/` — NestJS + TypeScript REST API (MongoDB + Garage S3)
- `rayuela-frontend/` — Vue 3 + Vite SPA (Vuetify + Vuex)

**GitHub Project:** [Rayuela Workspace Board](https://github.com/orgs/Rayuela-v2/projects/1/views/1)

## Mandatory Development Rules
- **ORG REPOSITORIES:** ALWAYS work exclusively in the repositories under the `Rayuela-v2` organization. NEVER perform actions in `cientopolis` source repositories.
- **ISSUE TRACKING:** All issues are tracked in: [Rayuela-v2/rayuela-NodeBackend](https://github.com/Rayuela-v2/rayuela-NodeBackend)
- **NO AI SIGNATURES:** Do not include agent signatures or attribution lines in PR descriptions or commits.

## Development Commands

### Backend (`rayuela-NodeBackend/`)
- `npm run start:dev` — Development with watch mode
- `npm run build` — Compile TypeScript to dist/
- `npm run test` — Jest unit tests
- `npm run test:e2e` — End-to-end tests
- `npm run lint` — ESLint with auto-fix
- `npm run format` — Prettier formatting
- **Infrastructure:** `docker-compose up -d mongodb garage` (then `bash ../init-garage.sh` if first time)

### Frontend (`rayuela-frontend/`)
- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm run build` — Production build
- `npm run test:unit` — Vitest unit tests
- `npm run test:e2e` — Playwright e2e tests
- `npm run lint` — ESLint with auto-fix

## Architecture

### Backend (NestJS)
- API Prefix: `/v1`
- Swagger Docs: `/docs`
- Pattern: `controller → service → DAO/schema (persistence/) → entities/ + dto/`
- **Gamification Engine:** Pluggable strategy-pattern engine in `src/module/gamification/entities/engine/`.

### Frontend (Vue 3)
- UI Library: Vuetify 3
- State: Vuex
- API Layer: `src/services/`
- i18n: `src/locales/` (ES primary, EN secondary)

## Environment Variables
- Backend uses `.env.development` or `.env.production`.
- Frontend uses `.env` with `VITE_` prefix.
- Key secrets: `DB_CONNECTION`, `JWT_SECRET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
