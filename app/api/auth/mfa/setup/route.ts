import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { beginTotpSetup } from "@/lib/auth";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const setup = await beginTotpSetup(auth.session.user.id, auth.session.user.email);
  // Scanning the code gives the authenticator app the name "Roster Generator"
  // and the account email; a key typed in by hand carries neither.
  const qrCodeDataUrl = await QRCode.toDataURL(setup.otpauthUri, { margin: 1, width: 200, errorCorrectionLevel: "M" });
  return NextResponse.json({ ...setup, qrCodeDataUrl });
}
