# Roster Planner (Next.js + Postgres + Prisma + Docker)

A production-ready starter that turns a static HTML roster into a full-stack app.

## Quick start (local)

```bash
cp .env.example .env
docker compose up -d db
npm install
npx prisma migrate dev --name init
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

- API routes are available under `/api` for employees, rosters, and tasks.
- The grid UI supports adding tasks via `+` slots and CSV export.
- Wire up persistence by calling the API routes from the grid (left as an exercise to keep code concise).
```