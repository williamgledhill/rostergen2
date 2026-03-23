import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccountById, getEditor } from "@/lib/auth";
import { enforceSameOrigin, getSessionContext } from "@/lib/apiAuth";
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/sessionToken";

const sessionRequestSchema = z.object({
  accountId: z.string().trim().min(1).max(120),
  editorId: z.string().trim().min(1).max(120),
});

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ session: null });
  }
  return NextResponse.json({
    session: {
      account: { id: session.account.id, name: session.account.name, company: session.account.company },
      editor: session.editor,
    },
  });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const parsed = sessionRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { accountId, editorId } = parsed.data;
    const account = getAccountById(accountId);
    const editor = account ? getEditor(account.id, editorId) : null;
    if (!account || !editor) {
      return NextResponse.json({ error: "Invalid account or editor" }, { status: 400 });
    }
    const res = NextResponse.json({
      session: {
        account: { id: account.id, name: account.name, company: account.company },
        editor,
      },
    });
    const cookieValue = createSessionToken(accountId, editorId);
    res.cookies.set(SESSION_COOKIE_NAME, cookieValue, getSessionCookieOptions());
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create session" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(), maxAge: 0 });
  return res;
}
