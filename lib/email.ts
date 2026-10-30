import { Resend } from "resend";

/**
 * Sends account emails through Resend. Configure with:
 *   RESEND_API_KEY – from resend.com → API Keys
 *   EMAIL_FROM     – a sender on a domain verified in Resend,
 *                    e.g. "Roster Generator <no-reply@yourdomain.com>"
 * Without them, email is off and administrators copy links by hand instead.
 */

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export class EmailError extends Error {}

let client: Resend | null = null;

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }) {
  if (!isEmailConfigured()) throw new EmailError("Email isn't set up.");
  client ??= new Resend(process.env.RESEND_API_KEY!.trim());

  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM!.trim(),
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) {
    console.error("Resend could not send email", error);
    throw new EmailError("The email couldn't be sent. Try again, or copy the link instead.");
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout({ heading, paragraphs, buttonLabel, url, footer }: {
  heading: string;
  paragraphs: string[];
  buttonLabel: string;
  url: string;
  footer: string;
}) {
  const safeUrl = escapeHtml(url);
  const html = `<!DOCTYPE html>
<html><body style="margin:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e6ec;border-radius:12px">
        <tr><td style="padding:28px 28px 8px;font-size:15px;font-weight:600;color:#344de8">Roster Generator</td></tr>
        <tr><td style="padding:8px 28px 0">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#111827">${escapeHtml(heading)}</h1>
          ${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#374151">${escapeHtml(p)}</p>`).join("")}
        </td></tr>
        <tr><td style="padding:12px 28px 8px">
          <a href="${safeUrl}" style="display:inline-block;background:#344de8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:10px">${escapeHtml(buttonLabel)}</a>
        </td></tr>
        <tr><td style="padding:12px 28px 28px;font-size:13px;line-height:1.6;color:#6b7280">
          ${escapeHtml(footer)}<br><br>If the button doesn't work, copy this link into your browser:<br>
          <a href="${safeUrl}" style="color:#344de8;word-break:break-all">${safeUrl}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [heading, "", ...paragraphs, "", `${buttonLabel}: ${url}`, "", footer].join("\n");
  return { html, text };
}

export function invitationEmail(input: { name: string; invitedBy: string; url: string }) {
  return {
    subject: "You're invited to Roster Generator",
    ...layout({
      heading: `Hi ${input.name}, you've been invited`,
      paragraphs: [
        `${input.invitedBy} has created a Roster Generator account for you.`,
        "Choose a password to finish setting it up. You'll also set up an authenticator app when you first sign in.",
      ],
      buttonLabel: "Set up your account",
      url: input.url,
      footer: "This link works once and expires in 7 days. If you weren't expecting it, you can ignore this email.",
    }),
  };
}

export function passwordResetEmail(input: { name: string; url: string; requestedByUser: boolean }) {
  return {
    subject: "Reset your Roster Generator password",
    ...layout({
      heading: "Reset your password",
      paragraphs: [
        `Hi ${input.name},`,
        input.requestedByUser
          ? "Someone (hopefully you) asked to reset the password for your Roster Generator account."
          : "An administrator has sent you a link to reset your Roster Generator password.",
        "Your current password keeps working until you choose a new one.",
      ],
      buttonLabel: "Choose a new password",
      url: input.url,
      footer: "This link works once and expires in 24 hours. If you didn't ask for it, you can ignore this email.",
    }),
  };
}
