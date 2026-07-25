// PersonaView — the persona detail page (§5, mock parity). Identity header + Enable toggle, About,
// Built-in capabilities (tools), "Connections for full benefit" (manifest `recommends`, core/optional
// + reason + connect state), "New sessions get by default" (persona-default connection toggles), and a
// defaults footer (recommended models / default mode / workspace).
//
// Data: fetches GET /v1/personas/{id} on mount; also fetches /v1/connectors to thread real brand
// colors (Phase 1's `brand_color`) into the badges via visualFor(). Toggling a default connection
// POSTs /v1/personas/{id}/connections and applies the returned `default_connections` (re-read).
// Enabling/disabling POSTs /v1/personas/{id}/enable.

import { useEffect, useState } from "react";
import {
  getConnectors,
  getPersonaDetail,
  setPersonaConnection,
  setPersonaEnabled,
  type PersonaDetail,
} from "../api";
import { ConnectorBadge } from "../connectors/ConnectorIcon";
import { fullPersonaName, shortPersonaName } from "../personaScope";
import { Icon } from "./Icon";
import { PersonaGlyph } from "./personaIcon";
import { Toggle } from "./Toggle";
import { indexConnectors, labelFor, visualFor, type ConnectorMap } from "../connectors/visuals";

// Shared section-heading + tag + button utility strings (mock parity).
const SEC_H = "text-[11px] uppercase tracking-[0.05em] text-faint font-semibold";
const TAG_CORE =
  "text-[10px] px-1.5 py-0.5 rounded-full bg-warnSoft/70 text-warnInk border border-warnInk/15";
const TAG_MCP = "text-[10px] px-1.5 py-0.5 rounded border border-line text-faint";
const BTN_ACCENT = "text-[12px] px-2.5 py-1.5 rounded-lg bg-accent text-white shrink-0";
const BTN_BORDERED =
  "text-[12px] px-2.5 py-1.5 rounded-lg border border-line bg-paper hover:border-lineStrong shrink-0";

export function PersonaView({
  personaId,
  onBack,
  onOpenIntegrations,
}: {
  personaId: string;
  onBack?: () => void;
  onOpenIntegrations?: () => void;
}) {
  const [detail, setDetail] = useState<PersonaDetail | null>(null);
  const [byName, setByName] = useState<ConnectorMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setDetail(null);
    setError(null);
    getPersonaDetail(personaId)
      .then((d) => live && setDetail(d))
      .catch(() => live && setError("Could not load this persona."));
    getConnectors()
      .then((list) => live && setByName(indexConnectors(list)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [personaId]);

  const toggleEnabled = async (next: boolean) => {
    setDetail((d) => (d ? { ...d, enabled: next } : d)); // optimistic
    const r = await setPersonaEnabled(personaId, next);
    if (!r.ok) getPersonaDetail(personaId).then(setDetail).catch(() => {});
  };

  const toggleDefault = async (connector: string, next: boolean) => {
    const r = await setPersonaConnection(personaId, connector, next);
    if (r.default_connections) {
      setDetail((d) => (d ? { ...d, default_connections: r.default_connections! } : d));
    } else {
      getPersonaDetail(personaId).then(setDetail).catch(() => {});
    }
  };

  const header = (
    <div className="h-12 shrink-0 px-5 flex items-center gap-3 border-b border-line bg-paper">
      {onBack && (
        <>
          <button
            className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"
            onClick={onBack}
          >
            <Icon name="arrowLeft" size={15} /> Back
          </button>
          <span className="text-faint">·</span>
        </>
      )}
      <span className="text-[13px] font-semibold">Persona</span>
    </div>
  );

  if (error || !detail) {
    return (
      <main className="flex-1 min-w-0 flex flex-col bg-paper">
        {header}
        <div className="p-12 text-center text-faint text-[13px]">{error || "Loading…"}</div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col bg-paper">
      {header}
      <div className="flex-1 overflow-y-auto hairline-scroll">
        <div className="max-w-3xl mx-auto px-7 py-6 space-y-6">
          {/* identity + enable */}
          <header className="flex items-start gap-3.5">
            <span className="w-12 h-12 rounded-xl2 bg-panel border border-line grid place-items-center text-[22px]">
              <PersonaGlyph icon={detail.icon} size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold tracking-tight">
                {fullPersonaName(detail.name, personaId)}
              </h1>
              <p className="text-[13px] text-muted mt-0.5">{detail.tagline}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[12px] text-muted">{detail.enabled ? "Enabled" : "Disabled"}</span>
              <Toggle checked={detail.enabled} onChange={toggleEnabled} title="Enable this persona" />
            </div>
          </header>

          {/* about */}
          {detail.description && (
            <section>
              <div className={`${SEC_H} mb-1.5`}>About</div>
              <p className="text-[14px] leading-relaxed text-ink/90">{detail.description}</p>
            </section>
          )}

          {/* tools */}
          {detail.tools.length > 0 && (
            <section>
              <div className={`${SEC_H} mb-2`}>Built-in capabilities</div>
              <div className="flex flex-wrap gap-1.5">
                {detail.tools.map((t) => (
                  <span
                    className="px-2 py-1 rounded-md bg-panel border border-line text-[12px] font-mono"
                    key={t}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* connections for full benefit (manifest recommends) */}
          {detail.recommends.length > 0 && (
            <section>
              <div className={`${SEC_H} mb-1`}>Connections for full benefit</div>
              <p className="text-[12.5px] text-muted mb-2.5">
                Declared by the persona — wire {shortPersonaName(detail.name, personaId)} into these
                to unlock its full workflow.
              </p>
              <div className="rounded-xl2 border border-line overflow-hidden">
                {detail.recommends.map((r, i) => {
                  const isMcp = r.kind === "mcp";
                  return (
                    <div
                      className={
                        "flex items-center gap-3 p-3 bg-panel" + (i > 0 ? " border-t border-line" : "")
                      }
                      key={`${r.kind}:${r.ref}`}
                    >
                      <ConnectorBadge connector={visualFor(r.ref, r.kind, byName)} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">{labelFor(r.ref, byName)}</span>
                          {isMcp ? (
                            <span className={TAG_MCP}>MCP</span>
                          ) : r.tier === "core" ? (
                            <span className={TAG_CORE}>core</span>
                          ) : null}
                        </div>
                        <div className="text-[12px] text-muted">{r.reason}</div>
                      </div>
                      {r.connected ? (
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-ok shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                          connected
                        </span>
                      ) : (
                        <button
                          className={r.tier === "core" && !isMcp ? BTN_ACCENT : BTN_BORDERED}
                          onClick={onOpenIntegrations}
                        >
                          {isMcp ? "Add" : "Connect"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* persona-default connections (persona → session default) */}
          {detail.default_connections.length > 0 && (
            <section>
              <div className={`${SEC_H} mb-1`}>New sessions get by default</div>
              <p className="text-[12.5px] text-muted mb-2.5">
                When you start a {shortPersonaName(detail.name, personaId)} session these are enabled
                automatically. You can still mute any of them per session.
              </p>
              <div className="space-y-1.5">
                {detail.default_connections.map((c) => (
                  <div
                    className={
                      "flex items-center gap-3 p-2.5 rounded-xl2 border border-line bg-panel" +
                      (c.connected ? "" : " opacity-50")
                    }
                    key={c.connector}
                  >
                    <ConnectorBadge connector={visualFor(c.connector, "connector", byName)} size={32} />
                    <div className="flex-1 text-[13px] font-medium">
                      {labelFor(c.connector, byName)}
                      {!c.connected && (
                        <span className="text-[11px] text-faint font-normal"> · connect to enable</span>
                      )}
                    </div>
                    <Toggle
                      checked={c.enabled}
                      disabled={!c.connected}
                      onChange={(next) => toggleDefault(c.connector, next)}
                      title={c.connected ? "On by default for new sessions" : "Connect this first"}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* defaults footer */}
          <section className="flex flex-wrap gap-x-8 gap-y-2 text-[12.5px]">
            {detail.recommended_models.length > 0 && (
              <div>
                <span className="text-faint">Models</span> ·{" "}
                {detail.recommended_models.map((m, i) => (
                  <span key={m}>
                    <span className="font-mono">{m}</span>
                    {i < detail.recommended_models.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            )}
            {detail.default_permission_mode && (
              <div>
                <span className="text-faint">Default mode</span> · {detail.default_permission_mode}
              </div>
            )}
            {detail.workspace && (
              <div>
                <span className="text-faint">Workspace</span> · {detail.workspace}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
