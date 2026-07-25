import { useEffect, useRef, useState } from "react";
import { announceCloudChanged, cloudLogin, waitForCloudSignIn } from "../../api";

// The signed-out state of every one-click pane: a REAL sign-in button, not a
// hint pointing at another page. Sign-in completes in the system browser; this
// component then polls until the status flips and broadcasts CLOUD_CHANGED, so
// even poll-less hosts (the Sources rail's inline pane) re-render signed in —
// relying on "some other section's 5s poll" left the rail stuck on the prompt
// (FB-013).
export function CloudSignInInline({ blurb }: { blurb?: string }) {
  const [waiting, setWaiting] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelRef.current?.(), []);
  return (
    <div className="space-y-1.5">
      <button
        className="w-full px-3 py-2 rounded-lg border border-accent text-accent text-[13px] font-medium hover:bg-accentSoft/40"
        data-testid="inline-cloud-sign-in"
        onClick={async () => {
          setWaiting(true);
          await cloudLogin();
          cancelRef.current?.();
          cancelRef.current = waitForCloudSignIn((s) => {
            setWaiting(false);
            if (s?.signed_in) announceCloudChanged();
          });
        }}
      >
        {waiting ? "Check your browser…" : "Sign in to OpenWorker Cloud"}
      </button>
      <div className="text-[11.5px] text-faint">
        {blurb || "Sign-in unlocks one-click connects — or switch to Manual, which works without it."}
      </div>
    </div>
  );
}

// The UNKNOWN state: the status fetch hasn't resolved (or is being retried).
// Rendering the sign-in prompt here told signed-in users they weren't (FB-013) —
// pending must look like pending.
export function CloudStatusPending() {
  return (
    <div
      className="text-[12px] text-faint py-2 text-center"
      data-testid="cloud-status-pending"
    >
      Checking OpenWorker Cloud sign-in…
    </div>
  );
}
