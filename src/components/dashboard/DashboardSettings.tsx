"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { refreshExecAccess } from "@/app/dashboard/actions";
import { CLUB_DRIVE_FOLDER, formatDay, formatDayTime, formatFullStamp } from "@/lib/membership/config";
import type { WalletEvent, WalletUsage } from "@/lib/membership/wallet";
import { Icon } from "@/components/membership/icons";
import { ago, shortEmail } from "./format";
import { Setting } from "./YearSettings";

export function DashboardSettings({ folder, people, accessCheckedAt, club, wallet }: {
  folder: string | null;
  people: { email: string; role: "Owner" | "Editor" }[];
  accessCheckedAt: number | null;
  // "no-email": connected before card emails existed, so it can't send them yet.
  club: { email: string; state: "missing" | "broken" | "no-email" | "connected" };
  // null when WALLETWALLET_API_KEY isn't set. usage is null when WalletWallet can't be reached.
  wallet: { usage: WalletUsage | null; pausedUntil: string | null; log: WalletEvent[] } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"access" | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const connected = club.state === "connected" || club.state === "no-email";
  const query = search.trim().toLowerCase();
  const shownPeople = query ? people.filter((p) => p.email.toLowerCase().includes(query)) : people;

  async function refresh() {
    setBusy("access");
    const result = await refreshExecAccess().catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    setBusy(null);
    setMessage(result.ok ? null : { text: result.error, error: true });
    router.refresh();
  }

  return (
    <main className="d-settings">
      <Setting
        title="Exec access"
        note={`Everyone who can edit the “${CLUB_DRIVE_FOLDER}” folder in ${club.email}’s Google Drive can use this dashboard. Change it in Drive.`}
      >
        {people.length > 0 ? (
          <div className="d-access">
            <input
              className="d-search is-wide" type="search" aria-label="Search people with access"
              placeholder={`Search ${people.length} ${people.length === 1 ? "person" : "people"}`}
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <div className="d-access-list">
              {shownPeople.map((p) => (
                <div key={p.email}><span>{p.email}</span><span className="d-role">{p.role}</span></div>
              ))}
              {shownPeople.length === 0 && <p className="d-empty-row">Nobody matches.</p>}
            </div>
          </div>
        ) : (
          <p className="d-field-note is-large">{!connected ? "Connect the club Google account to see who has access." : folder ? "Nobody yet." : `No “${CLUB_DRIVE_FOLDER}” folder found in this Drive.`} {club.email} can always sign in.</p>
        )}
        <div className="d-inline-actions">
          {folder && <a className="d-quiet-link" href={folder} target="_blank" rel="noreferrer">Open sharing in Drive</a>}
          {connected && folder && (
            <button type="button" className="d-text-btn" onClick={refresh} disabled={busy === "access"} suppressHydrationWarning>
              {busy === "access" ? "Checking…" : `Checked ${accessCheckedAt ? ago(accessCheckedAt) : "never"}. Check again`}
            </button>
          )}
        </div>
        {message && <p className={message.error ? "m-error" : "d-success"} role="status">{message.text}</p>}
      </Setting>

      <Setting title="Club Google account" note="Writes the Google Sheets, reads Venmo emails, and sends card emails." center>
        <div className="d-account-row">
          <span className="d-account-name">
            {club.email}
            {club.state === "connected" && <span className="m-pill is-green">Connected</span>}
            {club.state === "broken" && <span className="m-pill is-yellow">Needs reconnecting</span>}
            {club.state === "no-email" && <span className="m-pill is-yellow">Card emails off</span>}
            {club.state === "missing" && <span className="m-pill is-yellow">Not connected</span>}
          </span>
          <form action="/api/auth/google/connect" method="get">
            <input type="hidden" name="next" value="/dashboard/settings" />
            <button type="submit" className={connected ? "d-chip-btn" : "m-btn is-medium"}>{connected ? "Reconnect" : "Connect"}</button>
          </form>
        </div>
        {!connected && <p className="d-field-note is-large">Sign in as {club.email} on the Google screen and allow every permission.</p>}
      </Setting>

      <Setting title="Wallet cards" note="Apple and Google Wallet membership cards, made by WalletWallet. Making or cancelling a card counts toward the monthly limit.">
        <WalletStatus wallet={wallet} />
      </Setting>
    </main>
  );
}

function WalletStatus({ wallet }: { wallet: { usage: WalletUsage | null; pausedUntil: string | null; log: WalletEvent[] } | null }) {
  if (!wallet) return <p className="d-field-note is-large">Not set up. Add <code>WALLETWALLET_API_KEY</code> in Vercel to turn on Wallet cards.</p>;
  const { usage, pausedUntil } = wallet;
  const full = !!pausedUntil || (!!usage && usage.count >= usage.limit);
  const percent = full ? 100 : usage ? (usage.count / usage.limit) * 100 : 0;
  const level = full ? " is-full" : percent >= 90 ? " is-close" : "";
  const used = full ? "Limit reached" : percent > 0 && percent < 1 ? "Less than 1% used" : `${Math.round(percent)}% used`;
  const resets = pausedUntil || usage?.resetDate;
  return (
    <div className={`d-usage${level}`}>
      <div className="d-usage-row">
        <span>Cards this month</span>
        <span className="d-usage-count">{usage ? `${usage.count.toLocaleString()} of ${usage.limit.toLocaleString()}` : "Count unavailable"}</span>
      </div>
      <div
        className="d-usage-bar" role="progressbar" aria-label="Wallet cards made this month"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={used}
      >
        {percent > 0 && <span style={{ width: `${percent}%` }} />}
      </div>
      <div className="d-usage-row is-small">
        <span className="d-usage-used">{used}</span>
        {resets && <span>Resets {formatDay(resets)}</span>}
      </div>
      {full && <p className="d-field-note is-large">Members don’t see the Wallet option until it resets. Cards they already have still work, and check-in by name or kerb works as usual.</p>}
      <WalletLog log={wallet.log} />
    </div>
  );
}

const PLATFORMS = { apple: "Apple Wallet", google: "Google Wallet" };

// What happened to a card, like "Made for Apple Wallet" or "Cancelled by achen".
function walletAction(event: WalletEvent) {
  const where = event.platform ? ` for ${PLATFORMS[event.platform]}` : "";
  if (event.action === "made") return `Made${where}`;
  if (event.action === "remade") return `Made again${where}, old card cancelled`;
  return `Cancelled${event.by ? ` by ${shortEmail(event.by)}` : ""}, signup removed`;
}

const LOG_OPEN_KEY = "csc-wallet-log-open";

// The latest card changes, newest first. Each one counts toward the monthly limit.
// It starts closed, and this device remembers an opened list.
function WalletLog({ log }: { log: WalletEvent[] }) {
  const [open, setOpen] = useState(false);
  const [moved, setMoved] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    try { if (localStorage.getItem(LOG_OPEN_KEY) === "1") setOpen(true); } catch {}
  }, []);
  function toggle() {
    setMoved(true);
    setOpen(!open);
    try { localStorage.setItem(LOG_OPEN_KEY, open ? "0" : "1"); } catch {}
  }
  const query = search.trim().toLowerCase();
  const shown = query ? log.filter((e) => `${e.name} ${e.kerb} ${e.by || ""}`.toLowerCase().includes(query)) : log;
  return (
    <div className="d-wallet-log">
      <button type="button" className="d-collapse d-wallet-log-toggle" aria-expanded={open} aria-controls="wallet-log" onClick={toggle}>
        Recent cards {log.length > 0 && <span className="d-count">{log.length}</span>}
        <Icon name="chevron" size={16} className="d-collapse-icon" />
      </button>
      <div id="wallet-log" className={`d-collapsible${open ? " is-open" : ""}${moved ? " is-animated" : ""}`} inert={!open}>
        <div className="d-collapsible-inner d-access">
          {log.length > 0 ? (
            <>
              {log.length > 8 && (
                <input
                  className="d-search is-wide" type="search" aria-label="Search recent cards"
                  placeholder={`Search ${log.length} card changes`} value={search} onChange={(e) => setSearch(e.target.value)}
                />
              )}
              <div className="d-access-list">
                {shown.map((e) => (
                  <div key={`${e.at}-${e.kerb}-${e.action}`}>
                    <span className="d-log-who">
                      <span>{e.name} <span className="d-role">{e.kerb}</span></span>
                      <span className="d-role">{walletAction(e)}</span>
                    </span>
                    <time className="d-role" dateTime={new Date(e.at).toISOString()} data-tip={formatFullStamp(e.at)}>{formatDayTime(e.at)}</time>
                  </div>
                ))}
                {shown.length === 0 && <p className="d-empty-row">Nobody matches.</p>}
              </div>
            </>
          ) : (
            <p className="d-field-note is-large">No card changes yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
