import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAccountById, getEditor } from "@/lib/auth";

const COOKIE_NAME = "roster_session";

type SessionPayload = {
  accountId: string;
  editorId: string;
};

function parseSession(value?: string) {
  if (!value) return null;
  const raw = decodeURIComponent(value);
  try {
    const parsed = JSON.parse(raw) as SessionPayload;
    if (parsed?.accountId && parsed?.editorId) return parsed;
  } catch {
    // fall through
  }
  const parts = raw.split("|");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { accountId: parts[0], editorId: parts[1] };
  }
  return null;
}

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  const session = parseSession(raw);
  if (!session) {
    return NextResponse.json({ session: null });
  }
  const account = getAccountById(session.accountId);
  const editor = account ? getEditor(account.id, session.editorId) : null;
  if (!account || !editor) {
    return NextResponse.json({ session: null });
  }
  return NextResponse.json({
    session: {
      account: { id: account.id, name: account.name, company: account.company },
      editor,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    const editorId = typeof body?.editorId === "string" ? body.editorId : "";
    if (!accountId || !editorId) {
      return NextResponse.json({ error: "accountId and editorId required" }, { status: 400 });
    }
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
    const cookieValue = `${accountId}|${editorId}`;
    res.cookies.set(COOKIE_NAME, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create session" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
