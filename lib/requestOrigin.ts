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

export function isAllowedRequestOrigin(requestUrl: string, originHeader: string | null, extraAllowedOrigins: string[] = []) {
  if (!originHeader) return false;
  const requestOrigin = normalizeOrigin(requestUrl);
  const sourceOrigin = normalizeOrigin(originHeader);
  if (!requestOrigin || !sourceOrigin) return false;

  const allowed = new Set<string>([requestOrigin, ...extraAllowedOrigins]);
  return allowed.has(sourceOrigin);
}
