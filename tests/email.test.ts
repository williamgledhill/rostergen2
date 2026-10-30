import { describe, expect, it } from "vitest";
import { invitationEmail, isEmailConfigured, passwordResetEmail } from "@/lib/email";

describe("account emails", () => {
  it("puts the link in both the HTML and the plain-text versions", () => {
    const url = "https://rostergenerator.vercel.app/signup/reset?token=abc&x=1";
    const email = passwordResetEmail({ name: "Sam", url, requestedByUser: true });
    expect(email.subject).toContain("Reset");
    expect(email.text).toContain(url);
    expect(email.html).toContain("token=abc&amp;x=1");
  });

  it("escapes names so they can't inject HTML", () => {
    const email = invitationEmail({ name: "<script>x</script>", invitedBy: "A & B", url: "https://example.com" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("A &amp; B");
  });

  it("is off until both settings are present", () => {
    const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = "Roster Generator <no-reply@example.com>";
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "re_test";
    expect(isEmailConfigured()).toBe(true);
    process.env.RESEND_API_KEY = saved.key;
    process.env.EMAIL_FROM = saved.from;
    if (saved.key === undefined) delete process.env.RESEND_API_KEY;
    if (saved.from === undefined) delete process.env.EMAIL_FROM;
  });
});
