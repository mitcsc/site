import { DashboardSettings } from "@/components/dashboard/DashboardSettings";
import { execAccess } from "@/lib/membership/exec-auth";
import { folderUrl } from "@/lib/membership/google/drive";
import { canSendEmail, clubConnection, clubEmail } from "@/lib/membership/google/oauth";
import { currentYear, listMembers } from "@/lib/membership/store";
import { cancelledCards, walletCards, walletEnabled, walletPausedUntil, walletUsage } from "@/lib/membership/wallet";

export default async function DashboardSettingsPage() {
  const [connection, access, usage, pausedUntil, cards, cancelled, members] = await Promise.all([
    clubConnection(), execAccess().catch(() => null), walletUsage(), walletPausedUntil().catch(() => null),
    walletCards(), cancelledCards().catch(() => []), currentYear().then((config) => (config ? listMembers(config.year) : [])).catch(() => []),
  ]);
  // A card names its member only by name, so the kerb comes from the member who holds that card.
  const kerbs = new Map(members.flatMap((m) => (m.wallet ? [[m.wallet.serial, m.kerb] as const] : [])));
  return (
    <DashboardSettings
      folder={access?.folderId ? folderUrl(access.folderId) : null}
      people={access?.people || []}
      accessCheckedAt={access?.checkedAt || null}
      club={{
        email: connection?.email || clubEmail(),
        state: !connection ? "missing" : connection.brokenAt ? "broken" : canSendEmail(connection) ? "connected" : "no-email",
      }}
      wallet={walletEnabled() ? { usage, pausedUntil, cards: cards && cards.map((c) => ({ ...c, kerb: kerbs.get(c.serial) ?? null })), cancelled } : null}
    />
  );
}
