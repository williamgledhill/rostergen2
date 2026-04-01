import { afterEach, describe, expect, it } from "vitest";
import { getConfiguredAllowedOrigins, isAllowedRequestOrigin } from "../lib/requestOrigin";

afterEach(() => {
  delete process.env.APP_ORIGIN;
  delete process.env.NEXT_PUBLIC_APP_ORIGIN;
  delete process.env.ALLOWED_ORIGINS;
});

describe("origin allow-list checks", () => {
  it("allows same-origin requests", () => {
    const allowed = isAllowedRequestOrigin("https://roster.example.com/api/tasks", "https://roster.example.com");
    expect(allowed).toBe(true);
  });

  it("allows explicitly configured origins", () => {
    const allowed = isAllowedRequestOrigin(
      "https://internal.example.com/api/tasks",
      "https://admin.example.com",
      ["https://admin.example.com"]
    );
    expect(allowed).toBe(true);
  });

  it("rejects missing origin headers", () => {
    const allowed = isAllowedRequestOrigin("https://roster.example.com/api/tasks", null);
    expect(allowed).toBe(false);
  });

  it("allows same-origin referer when origin is missing", () => {
    const allowed = isAllowedRequestOrigin(
      "https://roster.example.com/api/tasks",
      null,
      [],
      "https://roster.example.com/editor?date=2026-04-01"
    );
    expect(allowed).toBe(true);
  });

  it("normalizes env-configured allowed origins", () => {
    process.env.APP_ORIGIN = "https://roster.example.com";
    process.env.ALLOWED_ORIGINS = "https://admin.example.com, https://ops.example.com";
    const origins = getConfiguredAllowedOrigins();
    expect(origins).toEqual([
      "https://roster.example.com",
      "https://admin.example.com",
      "https://ops.example.com",
    ]);
  });
});
