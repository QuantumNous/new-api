import { useEffect, useRef, useState } from "react";
import {
  checkForUpdate,
  clearPendingUpdate,
  downloadUpdate,
  installUpdate,
  isTauri,
  type UpdateInfo,
} from "../tauri";

// Auto-update prompt (desktop shell only — the browser build never renders this).
// Deliberately a PROMPT, not a silent background install: swapping the app under a
// user mid-session would kill their running coworker turn, and quiet self-mutation
// sits badly with the local-first trust posture. "Later" dismisses that VERSION for
// this app run; long-lived instances still hear about the next release because the
// check repeats every 30 minutes (FB-001 — the app can sit open for weeks).
//
// The first check runs shortly after boot settles (the splash and session restore own
// the first seconds). Once a release is offered, the bytes are pre-fetched in the
// background (FB-003) so "Restart to update" is instant instead of a multi-minute
// download; if the pre-fetch fails the button falls back to download-on-click.
// Update integrity is enforced below this layer: the shell verifies the manifest's
// minisign signature against the pubkey compiled into tauri.conf.json.

const FIRST_CHECK_MS = 15_000;
const RECHECK_MS = 30 * 60_000;

// downloading: background pre-fetch in flight (button locked).
// ready: bytes cached in the shell — install is instant.
// fallback: pre-fetch failed — the button does the full download-on-click as before.
type Phase = "downloading" | "ready" | "fallback" | "installing" | "error";

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [phase, setPhase] = useState<Phase>("downloading");
  // Per-run, per-version dismissal — no localStorage, so a restart re-offers, and a
  // NEWER release found by a later check overrides an earlier "Later".
  const dismissed = useRef<string | null>(null);
  // Version the background pre-fetch was kicked off for: keeps periodic re-checks of
  // the same release from re-firing the download or resetting the button state.
  const fetched = useRef<string | null>(null);

  const offer = (u: UpdateInfo) => {
    if (u.version === dismissed.current) return;
    setUpdate((prev) => (prev?.version === u.version ? prev : u));
    if (fetched.current === u.version) return;
    fetched.current = u.version;
    setPhase("downloading");
    const v = u.version; // guard: a newer release may supersede this fetch mid-flight
    downloadUpdate()
      .then(() => fetched.current === v && setPhase("ready"))
      .catch(() => fetched.current === v && setPhase("fallback"));
  };

  useEffect(() => {
    if (!isTauri()) return;
    const check = () => checkForUpdate().then((u) => u && offer(u)).catch(() => {});
    const t = setTimeout(check, FIRST_CHECK_MS);
    const i = setInterval(check, RECHECK_MS);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!update) return null;

  const install = async () => {
    setPhase("installing");
    try {
      await installUpdate(); // success restarts the app — nothing to do after
    } catch {
      setPhase("error");
    }
  };

  const busy = phase === "downloading" || phase === "installing";

  return (
    // Docked over the sidebar column (FB-002, owner call): 264px grid column minus the
    // 12px side margins, bottom offset clearing the ~57px account row so the card sits
    // just above it. z-[35]: above the account menu's click-away backdrop (z-30) so the
    // card stays clickable, but BELOW the menu itself (z-40) — an open menu must never
    // be occluded by a passive status card.
    <div
      className="fixed bottom-[64px] left-3 z-[35] w-[240px] rounded-xl border border-line bg-panel shadow-2xl px-4 py-3.5"
      role="status"
      data-testid="update-banner"
    >
      <div className="text-[13px] font-semibold">Update available</div>
      <div className="text-[12px] text-muted mt-0.5">
        OpenWorker v{update.version} is ready to install.
      </div>
      {phase === "error" && (
        <div className="text-[11.5px] text-warnInk mt-1.5">
          The update couldn't be installed — it will be offered again next launch.
        </div>
      )}
      <div className="flex items-center gap-2 mt-2.5">
        <button
          className="px-3 py-1.5 rounded-full bg-accent text-white text-[12.5px] disabled:opacity-50"
          onClick={install}
          disabled={busy}
          data-testid="update-install"
        >
          {busy ? "Downloading…" : "Restart to update"}
        </button>
        <button
          className="px-2 py-1.5 text-[12.5px] text-faint hover:text-muted"
          onClick={() => {
            dismissed.current = update.version;
            setUpdate(null);
            // Free the pre-fetched bundle (tens of MB) — a dismissed release may sit
            // unused for weeks; it re-downloads if the user changes their mind.
            fetched.current = null;
            clearPendingUpdate().catch(() => {});
          }}
          disabled={phase === "installing"}
          data-testid="update-later"
        >
          Later
        </button>
      </div>
    </div>
  );
}
