import { useState } from "react";
import { setWorkspaceTrusted, type WorkspaceCommandTrust } from "../api";

export function WorkspaceTrustPrompt({
  request,
  onClose,
}: {
  request: WorkspaceCommandTrust;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const trust = async () => {
    setSaving(true);
    setError("");
    const result = await setWorkspaceTrusted(request.workspace, true).catch(() => null);
    setSaving(false);
    if (!result?.ok) {
      setError(result?.error || "Could not save workspace trust.");
      return;
    }
    onClose();
  };

  return (
    <div className="gate-overlay" role="dialog" aria-modal="true" aria-labelledby="workspace-trust-title">
      <div className="gate max-w-[560px]">
        <div className="gate-mark">✦</div>
        <h2 id="workspace-trust-title">Trust this workspace&rsquo;s commands?</h2>
        <p className="gate-sub">
          This project asks OpenWorker to run the commands below without individual approval.
          Trust applies to future configuration changes at this exact folder until you revoke it
          in Settings.
        </p>
        <div className="rounded-lg border border-line bg-paper px-3 py-2.5 max-h-48 overflow-y-auto">
          {request.requested_commands.map((command) => (
            <code key={command} className="block text-[12.5px] py-1 text-ink">
              {command}
            </code>
          ))}
        </div>
        <div className="text-[11.5px] text-muted mt-2 break-all">{request.workspace}</div>
        {error && <div className="gate-error">{error}</div>}
        <div className="gate-foot justify-end gap-2">
          <button className="btn" onClick={onClose} disabled={saving}>
            Keep asking
          </button>
          <button className="btn primary" onClick={() => void trust()} disabled={saving}>
            {saving ? "Saving…" : "Trust workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}
