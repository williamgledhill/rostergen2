function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getConfiguredAllowedOrigins() {
  const configured = [
    process.env.APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_ORIGIN,
    process.env.ALLOWED_ORIGINS,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .flatMap((v) => v.split(","))
    .map((v) => normalizeOrigin(v.trim()))
    .filter((v): v is string => typeof v === "string");

  return Array.from(new Set(configured));
}

export function isAllowedRequestOrigin(
  requestUrl: string,
  originHeader: string | null,
  extraAllowedOrigins: string[] = [],
  refererHeader?: string | null
) {
  const requestOrigin = normalizeOrigin(requestUrl);
  if (!requestOrigin) return false;

  const candidateOrigins = [originHeader, refererHeader]
    .map((value) => (typeof value === "string" ? normalizeOrigin(value) : null))
    .filter((value): value is string => typeof value === "string");

  if (candidateOrigins.length === 0) return false;

  const allowed = new Set<string>([requestOrigin, ...extraAllowedOrigins]);
  return candidateOrigins.some((sourceOrigin) => allowed.has(sourceOrigin));
}
