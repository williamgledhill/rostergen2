import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAccountById, getEditor, type Account, type AccountEditor } from "@/lib/auth";
import { getConfiguredAllowedOrigins, isAllowedRequestOrigin } from "@/lib/requestOrigin";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/sessionToken";

export type SessionContext = {
  account: Account;
  editor: AccountEditor;
};

type AuthOk = { ok: true; session: SessionContext };
type AuthFail = { ok: false; response: NextResponse };
type AuthResult = AuthOk | AuthFail;

export async function getSessionContext(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const claims = verifySessionToken(rawToken);
  if (!claims) return null;

  const account = getAccountById(claims.accountId);
  if (!account) return null;
  const editor = getEditor(account.id, claims.editorId);
  if (!editor) return null;
  return { account, editor };
}

export async function requireSession(options?: { adminOnly?: boolean }): Promise<AuthResult> {
  const session = await getSessionContext();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (options?.adminOnly && !session.editor.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}

export function enforceSameOrigin(request: Request) {
  const allowedOrigins = getConfiguredAllowedOrigins();
  const isAllowed = isAllowedRequestOrigin(request.url, request.headers.get("origin"), allowedOrigins);
  if (isAllowed) return null;
  return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
}
