import { DashboardSettings } from "@/components/dashboard/DashboardSettings";
import { execAccess } from "@/lib/membership/exec-auth";
import { folderUrl } from "@/lib/membership/google/drive";
import { canSendEmail, clubConnection, clubEmail } from "@/lib/membership/google/oauth";
import { walletEnabled, walletLog, walletPausedUntil, walletUsage } from "@/lib/membership/wallet";

export default async function DashboardSettingsPage() {
  const [connection, access, usage, pausedUntil, log] = await Promise.all([
    clubConnection(), execAccess().catch(() => null), walletUsage(), walletPausedUntil().catch(() => null), walletLog().catch(() => []),
  ]);
  return (
    <DashboardSettings
      folder={access?.folderId ? folderUrl(access.folderId) : null}
      people={access?.people || []}
      accessCheckedAt={access?.checkedAt || null}
      club={{
        email: connection?.email || clubEmail(),
        state: !connection ? "missing" : connection.brokenAt ? "broken" : canSendEmail(connection) ? "connected" : "no-email",
      }}
      wallet={walletEnabled() ? { usage, pausedUntil, log } : null}
    />
  );
}
