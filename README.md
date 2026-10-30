# Roster Generator

Plans daily staff rosters: who is working, which tasks they cover in 15-minute slots,
and an autofill that builds a full day from task templates. Built with Next.js,
PostgreSQL and Prisma, and deployed on Vercel.

## Running locally

```bash
cp .env.example .env        # then fill in DATABASE_URL and the secrets
npm install
npx prisma migrate deploy   # creates the tables in an empty database
npm run dev
```

Visit http://localhost:3000.

To start from sample data, point `DATABASE_URL` at an **empty development database**
and set `APP_RUNTIME_SEED=true`. Never set it against production: it inserts the
built-in task templates and sample people.

The first sign-in account comes from `APP_BOOTSTRAP_ADMIN_EMAIL` and
`APP_BOOTSTRAP_ADMIN_PASSWORD`, created only when there are no users yet.

## Accounts

- Anyone can request access from the sign-in page. The account stays inactive
  until an administrator approves it under Settings → Account requests; approved
  accounts are editors.
- Administrators can also add someone directly under Settings → Users → Add user.
  That creates the account and gives an invitation link (valid 7 days) to send
  them; they choose their own password at `/signup/reset`.
- Administrators manage everyone else under Settings → Users: change role,
  deactivate or reactivate, sign out everywhere, turn off two-factor, and issue a
  password reset link. Administrators never see or set passwords: a reset link
  works once, for 24 hours, and the user chooses the new password at
  `/signup/reset`. Completing a reset signs the user out everywhere.
- The app refuses changes that would leave no active administrator, and an
  administrator can't change their own role or deactivate themselves.
- Every account change is written to `AppAuditLog`, shown under Settings →
  Account activity.
- Locked out? `scripts/account-recovery.ts` lists accounts and prints a reset
  link for any of them (optionally turning off two-factor). Run it with the
  production settings, as described at the top of the script.

## Tests

```bash
npm test
```

## Project layout

- `app/` – the Next.js app. Workspace pages are routed client-side by
  `components/WorkspaceRouter.tsx`; `app/api/` holds the route handlers.
- `components/Grid.tsx` – the roster editor grid (editing, undo, autosave, export).
- `lib/autofill/` – the roster generator. `generateRoster.ts` runs the placement
  passes; `templateMeta.ts` resolves a task template against a day;
  `placementBoard.ts` tracks what has been placed.
- `lib/rosterAutofill.ts` – small scheduling rules shared by the generator, with unit tests.
- `lib/*Store.ts`, `lib/rosters.ts`, `lib/settings.ts` – database access.
- `docs/software-design.md` – architecture and security notes.

## Deployment

Pushing to `main` deploys to production on Vercel. Environment variables are managed
in the Vercel project settings. Vercel's build does not run migrations: apply new
ones with `npx prisma migrate deploy` against the production database.

Set in production:

- `SESSION_SECRET` – random, at least 32 characters.
- `APP_ENCRYPTION_KEY` – base64-encoded 32-byte key used to encrypt MFA secrets.
- `APP_BOOTSTRAP_ADMIN_*` – only until the first admin exists, then remove.
