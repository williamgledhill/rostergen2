import { NextResponse } from "next/server";
import { z } from "zod";

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const dateIdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Logs the real error on the server and returns a generic message, so database
 * and stack details never reach the browser.
 */
export function serverError(err: unknown, message = "Something went wrong. Please try again.") {
  console.error(err);
  return jsonError(message, 500);
}

/** Parses and validates a JSON body. Malformed JSON is a 400, not a crash. */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError("Invalid JSON", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, response: jsonError("Invalid payload", 400) };
  return { ok: true, data: parsed.data };
}
