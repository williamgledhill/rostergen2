import SettingsClient from "./SettingsClient";
import { requirePageSession } from "@/lib/apiAuth";
import { getSettings } from "@/lib/settings";
import { getMfaStatus } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await requirePageSession();
  const [settings, mfaStatus] = await Promise.all([
    getSettings(),
    getMfaStatus(session.user.id),
  ]);

  return (
    <SettingsClient
      initialSettings={settings}
      initialSessionUser={session.user}
      initialMfaStatus={{
        enabled: mfaStatus.enabled,
        setupPending: mfaStatus.setupPending,
        setupExpiresAt: mfaStatus.setupExpiresAt ? mfaStatus.setupExpiresAt.toISOString() : null,
      }}
    />
  );
}
