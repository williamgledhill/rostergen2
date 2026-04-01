# Software Design Document

## 1. Document Control
- Project: Roster Planner
- Repository: `roster-planner`
- Version: 1.0
- Last updated: 2026-03-23
- Authors: Engineering

## 2. Purpose
Roster Planner is a web application for creating, editing, and reviewing daily and monthly staff rosters. This document formalizes the current architecture and defines security, testing, and operational standards for ongoing development.

## 3. Scope
- Included:
  - Authentication/session management
  - Multi-factor authentication (TOTP + recovery codes)
  - Roster, people, task template, and settings management
  - API and UI behaviors in the current Next.js application
  - Data persistence in PostgreSQL and JSON-backed stores
- Excluded:
  - Payroll integrations
  - External identity providers (SSO/OIDC)
  - Mobile-native applications

## 4. System Context
- Users:
  - Editor: Can view and update operational roster data.
  - Admin user: Can also modify configuration and master data.
- Runtime components:
  - Next.js application server (UI + API routes)
  - PostgreSQL (Prisma models for employees/tasks/rosters)
  - Filesystem JSON stores (`data/*.json`) for accounts/settings/people/task templates/rosters

## 5. Architecture Overview
- Frontend:
  - Next.js App Router pages and client components (`app/**`, `components/**`)
  - Session-aware shell redirecting unauthenticated users to `/`
- Backend:
  - Route handlers under `app/api/**`
  - Prisma data access for relational tables
  - Filesystem persistence for several domain objects
- Shared libraries:
  - `lib/sessionToken.ts`: Opaque token hashing and cookie controls
  - `lib/auth.ts`: User, session, and MFA lifecycle
  - `lib/apiAuth.ts`: Route guard and same-origin enforcement
  - `lib/requestOrigin.ts`: Origin allow-list handling

## 6. Data Design
### 6.1 Relational (PostgreSQL via Prisma)
- `Employee(id, name, createdAt, updatedAt)`
- `Roster(id, date, createdAt, updatedAt)`
- `Task(id, type, label, start, end, rosterId, employeeId, createdAt, updatedAt)`

### 6.2 JSON-backed Stores
- `settings.json`: Default hours by day
- `people.json`: People profile and default schedules
- `taskTemplates.json`: Task template catalog and generation metadata
- `rosters.json`: Saved roster payloads for planner/editor workflows

### 6.3 Current Tradeoff
The system currently uses hybrid persistence (Postgres + JSON files). This is acceptable for low-scale internal usage but increases consistency risk under concurrent writes. Long-term direction should consolidate mutable business entities into PostgreSQL.

## 7. API Design and Authorization
### 7.1 Authentication
- Session cookie: `roster_session`
- Token format: opaque random token hashed server-side and stored in PostgreSQL
- Cookie controls: `HttpOnly`, `SameSite=Strict`, `Secure` in production, bounded max-age
- MFA: optional TOTP factor with encrypted shared secret and hashed recovery codes

### 7.2 Authorization Matrix
- Public:
  - `GET|POST|DELETE /api/auth/session` (session bootstrap/end)
  - `POST /api/auth/session/verify-2fa` (MFA completion)
- Authenticated editor:
  - Read roster/task/people/settings/template data
  - Modify operational roster/task data
- Admin user:
  - Modify settings
  - Modify people
  - Modify task templates
  - Create employees

### 7.3 Request Safety
- Mutating routes (`POST|PUT|DELETE`) enforce same-origin checks.
- Input payloads are validated with `zod`.
- Invalid payloads return `400`; unauthorized returns `401`; forbidden returns `403`.

## 8. Security Model
### 8.1 Threats Addressed
- Cookie forgery and privilege escalation
- Unauthenticated API access to business data
- Replay-resistant revocable sessions
- CSRF-like cross-origin mutation attempts
- Malformed payload abuse and unsafe implicit coercion
- Known package vulnerabilities in framework/dependency tree

### 8.2 Controls Implemented
- Server-side revocable sessions with opaque tokens
- Centralized route auth guard (`requireSession`)
- Admin-only route enforcement for sensitive writes
- Optional TOTP MFA with encrypted secret storage and recovery codes
- Same-origin checks for all state-changing endpoints
- Strict payload validation in API routes
- Dependency hardening:
  - `next` upgraded to `16.1.7`
  - `vitest` upgraded to `4.1.0`
  - `minimatch` pinned via `overrides` to `9.0.7`

### 8.3 Residual Risks
- Filesystem JSON stores remain susceptible to concurrent write race conditions.
- Bootstrap admin creation is environment-variable driven and should be removed after initial provisioning.
- No formal rate limiting yet on auth/session endpoints.

## 9. Quality and Testing Strategy
### 9.1 Test Pyramid
- Unit tests:
  - Session token and cookie behaviors
  - Password hashing/verification
  - TOTP and recovery-code helpers
  - Origin allow-list behavior
- Integration tests (next phase):
  - API route authorization and role-based access
  - JSON-store persistence edge cases
- End-to-end tests (next phase):
  - Login flow, roster save/load, task template admin lifecycle

### 9.2 Current Test Tooling
- Framework: Vitest
- Config: `vitest.config.ts`
- Commands:
  - `npm test`
  - `npm run test:watch`

## 10. Operational Requirements
- Environment variables:
  - `DATABASE_URL` (required)
  - `SESSION_SECRET` (required in production, >= 32 chars)
  - `APP_ENCRYPTION_KEY` (required in production for MFA secret encryption)
  - `APP_BOOTSTRAP_ADMIN_EMAIL` / `APP_BOOTSTRAP_ADMIN_PASSWORD` (required for initial local bootstrap)
  - Optional allow-list:
    - `APP_ORIGIN`
    - `ALLOWED_ORIGINS` (comma-separated)
- Build/start:
  - `npm run build`
  - `npm run start`

## 11. Logging and Observability
- Current:
  - Console logging for route-level errors
- Planned:
  - Structured request logs with request IDs
  - Error aggregation and alerting (Sentry or equivalent)
  - Basic API metrics (success/error/latency by route)

## 12. Roadmap
- Phase 1 (completed): server-side sessions, MFA support, authz guard, origin checks, payload validation, dependency hardening.
- Phase 2 (recommended): migrate JSON mutable domains to PostgreSQL transactions.
- Phase 3 (recommended): external identity provider integration and fine-grained RBAC.
- Phase 4 (recommended): CI pipeline with lint, test, typecheck, and security scanning gates.
