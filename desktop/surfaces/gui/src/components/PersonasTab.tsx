import { useEffect, useState } from "react";
import {
  deletePersona,
  getPersonas,
  getSessions,
  installPersona,
  updatePersona,
  type Persona,
  type PersonaConsent,
} from "../api";
import type { SessionInfo } from "../types";
import { Icon } from "./Icon";

// Personas management: enable a persona, choose whether it shows in the new-session picker,
// set the default, and install more from a local directory or a GitHub repo (snapshotted).
// Re-skinned to the mock's Tailwind card idiom (§ Settings-as-page); the page title supplies the
// heading, so this drops its own "Personas" sub-header.
const CARD = "rounded-xl2 border border-line bg-panel";
const SEC_H = "text-[11px] uppercase tracking-[0.05em] text-faint font-semibold";
const CHECK = "flex items-center gap-1.5 text-[12.5px] text-muted select-none shrink-0";
const SELECT = "px-2.5 py-2 rounded-lg border border-line bg-paper text-[13px] text-ink shrink-0";
const INPUT =
  "flex-1 min-w-0 px-3 py-2 rounded-lg border border-line bg-paper text-[13px] text-ink outline-none focus:border-accent";
const BTN_ACCENT = "text-[12.5px] px-3 py-2 rounded-lg bg-accent text-white shrink-0 disabled:opacity-40";
const BTN_BORDERED =
  "text-[12.5px] px-2.5 py-1.5 rounded-lg border border-line bg-paper hover:border-lineStrong shrink-0 disabled:opacity-40 disabled:hover:border-line";

export function PersonasTab({ onOpenPersona }: { onOpenPersona?: (id: string) => void }) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [mode, setMode] = useState<"git" | "dir">("git");
  const [src, setSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [consent, setConsent] = useState<PersonaConsent[] | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  // Disabling archives the persona's conversations (server-side), so when there are any we
  // arm an inline confirm (same two-step idiom as delete) instead of flipping immediately.
  const [confirmOff, setConfirmOff] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  const reload = () => getPersonas().then(setPersonas).catch(() => {});
  const reloadSessions = () => getSessions().then(setSessions).catch(() => {});
  useEffect(() => {
    reload();
    reloadSessions();
  }, []);

  // Real conversations the disable would archive (unarchived; run sessions are server-hidden).
  const liveCount = (id: string) =>
    sessions.filter((s) => s.agent === id && !s.archived).length;

  const toggle = async (
    id: string,
    body: { enabled?: boolean; surfaced?: boolean; default?: boolean },
  ) => {
    const r = await updatePersona(id, body);
    if (r.personas) setPersonas(r.personas);
    else reload();
    if (body.enabled === false) reloadSessions(); // counts just changed
  };

  const requestDisable = (p: Persona) => {
    if (liveCount(p.id) > 0) setConfirmOff(p.id);
    else toggle(p.id, { enabled: false });
  };

  const remove = async (id: string) => {
    setConfirmDel(null);
    const r = await deletePersona(id);
    if (!r.ok) {
      setMsg(r.error || "delete failed");
      return;
    }
    if (r.personas) setPersonas(r.personas);
    else reload();
  };

  const install = async () => {
    if (!src.trim()) return;
    setBusy(true);
    setMsg(null);
    setConsent(null);
    const r = await installPersona(
      mode === "git" ? { git_url: src.trim() } : { dir: src.trim() },
    );
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error || "install failed");
      return;
    }
    setConsent(r.consent || []);
    if (r.personas) setPersonas(r.personas);
    setMsg(`Installed ${(r.consent || []).length} persona(s) — review and enable below.`);
    setSrc("");
  };

  return (
    <div>
      <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
        Enable a coworker, then choose whether it appears in the new-session picker. The starred persona
        is the default for new sessions.
      </p>

      <div className={CARD + " divide-y divide-line mb-6"}>
        {personas.map((p) => (
          <div key={p.id} className="px-4 py-3">
            <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium flex items-center gap-1.5">
                <span className="truncate">{p.name}</span>
                {p.default && <span className="text-accent" title="Default for new sessions">★</span>}
                {p.builtin && <span className="text-[11px] text-faint font-normal">· built-in</span>}
              </div>
              <div className="text-[12px] text-muted truncate">{p.tagline}</div>
            </div>
            <label className={CHECK}>
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) =>
                  e.target.checked ? toggle(p.id, { enabled: true }) : requestDisable(p)
                }
              />
              Enabled
            </label>
            <label className={CHECK + (p.enabled ? "" : " opacity-40")}>
              <input
                type="checkbox"
                checked={p.surfaced}
                disabled={!p.enabled}
                onChange={(e) => toggle(p.id, { surfaced: e.target.checked })}
              />
              In picker
            </label>
            <button
              className={BTN_BORDERED}
              disabled={p.default || !p.enabled}
              onClick={() => toggle(p.id, { default: true })}
            >
              Set default
            </button>
            {onOpenPersona && (
              <button
                className="text-faint hover:text-ink shrink-0 p-1"
                title={`Configure ${p.name}`}
                aria-label={`Configure ${p.name}`}
                data-testid={`persona-configure-${p.id}`}
                onClick={() => onOpenPersona(p.id)}
              >
                <Icon name="sliders" size={15} />
              </button>
            )}
            {!p.builtin &&
              (confirmDel === p.id ? (
                <span className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="text-[12px] px-2 py-1.5 rounded-lg bg-danger text-white"
                    data-testid={`persona-delete-confirm-${p.id}`}
                    onClick={() => remove(p.id)}
                  >
                    Delete
                  </button>
                  <button className={BTN_BORDERED} onClick={() => setConfirmDel(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  className="text-faint hover:text-danger shrink-0 p-1"
                  title="Delete this persona"
                  aria-label={`Delete ${p.name}`}
                  data-testid={`persona-delete-${p.id}`}
                  onClick={() => setConfirmDel(p.id)}
                >
                  <Icon name="trash" size={14} />
                </button>
              ))}
            </div>
            {confirmOff === p.id && (
              <div
                className="mt-2 flex items-center gap-2.5 text-[12px] text-muted"
                data-testid={`persona-disable-warning-${p.id}`}
              >
                <span className="min-w-0">
                  Disabling archives its {liveCount(p.id)} conversation
                  {liveCount(p.id) === 1 ? "" : "s"} — they stay available under “Show
                  archived”.
                </span>
                <button
                  className="text-[12px] px-2.5 py-1.5 rounded-lg bg-accent text-white shrink-0"
                  data-testid={`persona-disable-confirm-${p.id}`}
                  onClick={() => {
                    setConfirmOff(null);
                    toggle(p.id, { enabled: false });
                  }}
                >
                  Disable
                </button>
                <button className={BTN_BORDERED} onClick={() => setConfirmOff(null)}>
                  Keep enabled
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={SEC_H + " mb-1.5"}>Add personas</div>
      <p className="text-[12px] text-muted mb-3 leading-relaxed">
        Load from a local directory or a public GitHub repo. Files are copied into a managed area (a
        snapshot), so the persona stays stable even if the source changes. No code runs — a persona only
        composes vetted tools.
      </p>
      <div className="flex items-center gap-2">
        <select className={SELECT} value={mode} onChange={(e) => setMode(e.target.value as "git" | "dir")}>
          <option value="git">GitHub URL</option>
          <option value="dir">Local directory</option>
        </select>
        <input
          className={INPUT}
          placeholder={mode === "git" ? "https://github.com/acme/ops-persona" : "/path/to/personas"}
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && install()}
        />
        <button className={BTN_ACCENT} disabled={busy || !src.trim()} onClick={install}>
          {busy ? "Installing…" : "Install"}
        </button>
      </div>
      {msg && <div className="text-[12.5px] text-muted mt-2.5">{msg}</div>}

      {consent && consent.length > 0 && (
        <div className="mt-4 space-y-2">
          {consent.map((c) => (
            <div key={c.id} className={CARD + " p-3.5"}>
              <div className="text-[13.5px] font-medium">{c.name}</div>
              <div className="text-[12px] text-muted mt-0.5 mb-2">{c.description}</div>
              <div className="text-[12px] text-ink">Tools: {c.tools.join(", ") || "—"}</div>
              <div className="text-[12px] text-ink">
                Risk: {c.risk.join(", ") || "read"}
                {c.connectors ? " · connectors" : ""}
                {c.messaging ? " · messaging" : ""}
                {c.mcp.length ? ` · mcp: ${c.mcp.join(", ")}` : ""}
              </div>
              <div className="text-[12px] text-faint mt-1">
                Recommended mode: {c.recommended_mode}. Enable it above to use it.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
