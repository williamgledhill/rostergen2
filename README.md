# Roster Planner (Next.js + Postgres + Prisma + Docker)

A production-ready starter that turns a static HTML roster into a full-stack app.

## Quick start (local)

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

Visit http://localhost:3000

## Build & Run in Docker

```bash
docker compose up --build
```

## Deploy to AWS

1. Create an RDS (PostgreSQL) instance and set `DATABASE_URL`.
2. Build & push image to ECR:
   ```bash
   docker build -t roster-planner:latest .
   # tag + push to ECR
   ```
3. Run on ECS Fargate or Elastic Beanstalk. Add env var `DATABASE_URL` via Secrets Manager.

## Notes

- API routes are available under `/api` for auth, employees, rosters, tasks, and settings.
- The grid UI supports adding tasks via `+` slots and CSV export.

## Security & Testing

- Set `SESSION_SECRET` in production with a random value of at least 32 characters.
- Set `APP_ENCRYPTION_KEY` in production to a base64-encoded 32 byte key for MFA secret encryption.
- Set `APP_BOOTSTRAP_ADMIN_EMAIL` and `APP_BOOTSTRAP_ADMIN_PASSWORD` once to create the initial admin account, then remove or rotate them.
- Enforce TLS for the production database connection string, for example `sslmode=require` with PostgreSQL.
- Run tests with:
  ```bash
  npm test
  ```
- The project includes a formal design document at `docs/software-design.md`.
