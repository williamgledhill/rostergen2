// Seeding writes sample people, templates and rosters into the database, so it
// only runs when explicitly requested. Keying it off NODE_ENV meant a local
// `npm run dev` pointed at the production database would write into it.
export const runtimeSeedEnabled = process.env.APP_RUNTIME_SEED === "true";
