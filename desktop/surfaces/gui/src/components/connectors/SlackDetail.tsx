import { useEffect, useRef, useState } from "react";
import {
  allowUser,
  disallowUser,
  disconnectSlackWorkspace,
  getSlackDirectory,
  getSubscriptions,
  resolveUnauthorized,
  unsubscribeChannel,
  type Connector,
  type ParkedMessage,
  type SlackMember,
  type SlackStatus,
  type SlackWorkspace,
  type Subscription,
} from "../../api";
import { ConnectorBadge } from "../../connectors/ConnectorIcon";
import { AddConnectionModal } from "./AddConnectionModal";
import type { DetailProps } from "./ConnectorsSection";
import { SlackHowItWorks } from "./SlackHowItWorks";
import { ToolsDisclosure } from "./ToolsDisclosure";
import { FOOT, GRP, GRP_H, PILL_ACCENT, PILL_LINE, ROW, TAG_WARN, XBTN } from "./ui";

// The Slack detail page (UX-DECISIONS §21): one group per connected workspace —
// People (allow-list) · Waiting (parked senders) · Listening (session ↔ channel) ·
// Disconnect — because Slack ids are workspace-scoped, everything is filed under
// the workspace it belongs to. Adding a workspace goes through the ONE entry
// point: the header button → AddConnectionModal (One click | Manual).

/** Two-letter initials for a person chip. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const LABEL = "text-[12.5px] text-muted w-24 shrink-0";

/** The relay status line, one honest layer at a time: sign-in → socket → live.
 * Dot color + text; never a synthetic "Slack is down" claim. */
function relayHealth(slack: SlackStatus | null): { dot: string; text: string } {
  if (!slack) return { dot: "bg-ok", text: "Live · managed relay" };
  if (!slack.signed_in)
    return { dot: "bg-warnInk", text: "Sign-in needed — relaying is paused" };
  if (slack.relay.state === "offline")
    return { dot: "bg-faint/60", text: "Offline — can't reach the relay" };
  if (slack.relay.state === "reconnecting")
    return { dot: "bg-warnInk", text: "Reconnecting to the relay…" };
  return { dot: "bg-ok", text: "Live · managed relay" };
}

export function SlackDetail({ c, cloud, slack, onChanged }: DetailProps) {
  const [adding, setAdding] = useState(false);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const loadSubs = () => getSubscriptions().then(setSubs).catch(() => setSubs([]));
  useEffect(() => {
    loadSubs();
  }, [c.name]);

  const relay = c.mode === "relay";
  const workspaces = c.workspaces ?? [];
  const changed = () => {
    onChanged();
    loadSubs();
  };

  return (
    <div data-testid="slack-workspaces">
      <div className="flex items-center gap-3.5 mb-5">
        <ConnectorBadge connector={c} size={44} title="Slack" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold tracking-tight leading-tight">Slack</h2>
          <div className="text-[12.5px] text-muted flex items-center gap-1.5">
            {c.connected ? (
              <>
                <span
                  className={
                    "w-2 h-2 rounded-full " + (relay ? relayHealth(slack).dot : "bg-ok")
                  }
                />
                <span data-testid="slack-mode-badge">
                  {relay
                    ? relayHealth(slack).text
                    : "Connected · Socket Mode (manual tokens)"}
                </span>
              </>
            ) : (
              <span>Not connected</span>
            )}
          </div>
        </div>
        {relay || !c.connected ? (
          <button className={PILL_ACCENT} data-testid="add-workspace-btn" onClick={() => setAdding(true)}>
            ＋ Add workspace
          </button>
        ) : null}
      </div>

      {!c.connected && (
        <div className={GRP}>
          <div className={ROW + " text-[12.5px] text-muted"}>
            One @ocw app, installed per workspace — each keeps its own allow-list.
            {cloud?.signed_in ? "" : " One-click needs cloud sign-in; Manual works without it."}
          </div>
        </div>
      )}

      {/* UX-027: post-connect orientation — status line + animated how-it-works
          carousel (collapsible; collapsed state is the local "seen" flag). */}
      {relay && workspaces.length > 0 && <SlackHowItWorks workspaces={workspaces} />}

      {relay &&
        workspaces.map((w) => (
          <WorkspaceGroup
            key={w.team_id}
            c={c}
            w={w}
            subs={subs}
            tokenOk={slack?.teams?.[w.team_id]?.token_ok !== false}
            onChanged={changed}
          />
        ))}

      {/* Manual Socket Mode: one workspace, the flat allow-list (unchanged semantics). */}
      {c.connected && !relay && (
        <div data-testid="slack-manual-card">
          <div className={GRP_H}>{c.account || "workspace"} <span className="font-normal text-faint">· manual tokens</span></div>
          <div className={GRP}>
            <PeopleRow
              allowed={c.allowed_users}
              names={c.allowed_user_names}
              teamId={null}
              onRemove={(u) => disallowUser("slack", u).then(changed)}
              onChanged={changed}
            />
            {(c.unauthorized ?? [])
              .filter((m) => !m.team_id)
              .map((m) => (
                <WaitingRow key={m.id} m={m} onChanged={changed} />
              ))}
            <ListeningRows
              subs={subs.filter((s) => s.channel.startsWith("slack:") && !s.channel.includes("/"))}
              onChanged={changed}
            />
          </div>
        </div>
      )}

      <ToolsDisclosure c={c} onChanged={onChanged} />
      {c.connected && (
        <div className={FOOT + " mt-2"}>Names come from Slack automatically. IDs show on hover.</div>
      )}

      {adding && (
        <AddConnectionModal
          c={c}
          cloud={cloud}
          title="Add a workspace"
          onClose={() => setAdding(false)}
          onChanged={changed}
        />
      )}
    </div>
  );
}

function WorkspaceGroup({
  c,
  w,
  subs,
  tokenOk,
  onChanged,
}: {
  c: Connector;
  w: SlackWorkspace;
  subs: Subscription[];
  tokenOk: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const parked = (c.unauthorized ?? []).filter((m) => m.team_id === w.team_id);
  const listening = subs.filter((s) => s.channel.startsWith(`slack:${w.team_id}/`));
  const empty = w.allowed_users.length === 0 && parked.length === 0 && listening.length === 0;

  const disconnect = async () => {
    setBusy(true);
    await disconnectSlackWorkspace(w.team_id);
    setBusy(false);
    onChanged();
  };

  return (
    <div data-testid={`slack-workspace-${w.team_id}`}>
      <div className={GRP_H + " flex items-center gap-2"}>
        <span>
          {/* Domain beats raw id as the differentiator (names can collide across
              workspaces; domains can't). The id stays reachable on hover. */}
          {w.account || w.team_id}{" "}
          <span className="font-normal text-faint" title={w.team_id}>
            · {w.domain || w.team_id}
          </span>
        </span>
        {!tokenOk && (
          <span className={TAG_WARN} data-testid={`token-warn-${w.team_id}`}>
            ⚠ Token revoked — reinstall
          </span>
        )}
      </div>
      <div className={GRP}>
        {empty ? (
          <div className={ROW}>
            <span className="min-w-0 flex-1 text-[12.5px] text-muted flex items-center gap-2 flex-wrap">
              <span>No one allowed yet — mentions of the bot show up here for your OK.</span>
              <PersonPicker teamId={w.team_id} allowed={[]} onChanged={onChanged} />
            </span>
            <DisconnectBtn teamId={w.team_id} busy={busy} onClick={disconnect} />
          </div>
        ) : (
          <>
            <PeopleRow
              allowed={w.allowed_users}
              names={w.allowed_user_names}
              teamId={w.team_id}
              installerId={w.installer_user_id}
              installerName={w.installer_name}
              onRemove={(u) => disallowUser("slack", u, w.team_id).then(onChanged)}
              onChanged={onChanged}
            />
            {parked.map((m) => (
              <WaitingRow key={m.id} m={m} onChanged={onChanged} />
            ))}
            <ListeningRows subs={listening} onChanged={onChanged} />
            <div className={ROW}>
              <span className="flex-1" />
              <DisconnectBtn teamId={w.team_id} busy={busy} onClick={disconnect} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DisconnectBtn({ teamId, busy, onClick }: { teamId: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      className="text-[12.5px] text-danger/80 hover:text-danger shrink-0"
      data-testid={`disconnect-workspace-${teamId}`}
      title="Stops relaying this workspace to this computer. The app stays installed in Slack."
      onClick={onClick}
      disabled={busy}
    >
      {busy ? "Disconnecting…" : "Disconnect workspace"}
    </button>
  );
}

function PeopleRow({
  allowed,
  names,
  teamId,
  installerId,
  installerName,
  onRemove,
  onChanged,
}: {
  allowed: string[];
  names?: Record<string, string | null>;
  teamId: string | null; // null = manual flat list (directory queries as "default")
  installerId?: string; // authed_user — pre-added on managed connect (UX-027)
  installerName?: string;
  onRemove: (userId: string) => void;
  onChanged: () => void;
}) {
  // The installer's chip reads "you" — their name may still be unresolved (it's
  // fetched lazily for outbound attribution), so fall back to a literal "You".
  const label = (u: string) =>
    names?.[u] || (u === installerId ? installerName || "You" : u);
  return (
    <div className={ROW}>
      <span className={LABEL}>People</span>
      <span className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
        {allowed.length === 0 && (
          <span className="text-[12px] text-faint">nobody yet — pick a name, or approve a waiting sender below</span>
        )}
        {allowed.map((u) => (
          <span
            key={u}
            className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-paper border border-line text-[12.5px]"
            title={`id ${u}`}
            data-testid={u === installerId ? "people-chip-you" : undefined}
          >
            <span className="w-5 h-5 rounded-full bg-accentSoft text-accent grid place-items-center text-[9px] font-bold">
              {initials(label(u))}
            </span>
            {label(u)}
            {u === installerId && <span className="text-[10.5px] text-faint">· you</span>}
            <button className={XBTN} title="remove" onClick={() => onRemove(u)}>
              ×
            </button>
          </span>
        ))}
        <PersonPicker teamId={teamId} allowed={allowed} onChanged={onChanged} />
      </span>
    </div>
  );
}

// "Find your name in a list": typeahead over the workspace directory (users.list,
// cached on the desktop). A pick lands on the allow-list with the display name in
// hand — the park→approve flow stays as the path for senders nobody pre-added.
function PersonPicker({
  teamId,
  allowed,
  onChanged,
}: {
  teamId: string | null;
  allowed: string[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SlackMember[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  // Fixed-position drop: the group cards clip overflow (GRP is overflow-hidden),
  // so an absolute popover inside them would be cut off after the first row.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toggle = () => {
    if (open) return setOpen(false);
    const r = btn.current?.getBoundingClientRect();
    setPos(r ? { top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 300) } : null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      getSlackDirectory(teamId || "default", q)
        .then((r) => {
          if (r.ok) {
            setRows(r.members || []);
            setErr(null);
          } else setErr(r.error || "directory unavailable");
        })
        .catch(() => setErr("directory unavailable"));
    }, 200);
    return () => clearTimeout(t);
  }, [open, q, teamId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = async (m: SlackMember) => {
    await allowUser("slack", m.id, teamId, m.name);
    setOpen(false);
    setQ("");
    onChanged();
  };
  const candidates = rows.filter((m) => !allowed.includes(m.id));

  return (
    <span className="relative" ref={wrap}>
      <button
        ref={btn}
        className="inline-flex items-center px-2 py-0.5 rounded-full border border-dashed border-line text-[12.5px] text-muted hover:text-ink hover:border-faint"
        data-testid={`add-person-${teamId || "default"}`}
        title="Pick from the workspace directory"
        onClick={toggle}
      >
        ＋ Add person
      </button>
      {open && (
        <div
          className="fixed z-50 w-72 rounded-xl border border-line bg-panel shadow-lg p-1"
          style={{ top: pos?.top, left: pos?.left }}
          data-testid="person-picker"
        >
          <input
            autoFocus
            className="w-full bg-paper border border-line rounded-lg px-2 py-1 text-[12.5px] outline-none placeholder:text-faint"
            placeholder="Type a name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <div className="max-h-56 overflow-y-auto py-1">
            {err ? (
              <div className="px-2 py-1.5 text-[12px] text-warnInk">{err}</div>
            ) : candidates.length === 0 ? (
              <div className="px-2 py-1.5 text-[12px] text-faint">no matches</div>
            ) : (
              candidates.map((m) => (
                <button
                  key={m.id}
                  className="block w-full text-left px-2 py-1.5 rounded-lg hover:bg-paper"
                  data-testid={`pick-person-${m.id}`}
                  title={`id ${m.id}`}
                  onMouseDown={(e) => {
                    // mousedown (not click) so the pick lands before the input's blur
                    e.preventDefault();
                    pick(m);
                  }}
                >
                  <span className="text-[12.5px] font-medium">{m.name}</span>{" "}
                  <span className="text-[11.5px] text-faint">@{m.handle}</span>
                  {m.guest && (
                    <span className="ml-1.5 text-[10.5px] text-warnInk bg-warnSoft/70 border border-warnInk/15 rounded px-1 py-0.5">
                      guest
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="px-2 pb-1 text-[10.5px] text-faint">
            From your workspace directory — stays on this computer.
          </div>
        </div>
      )}
    </span>
  );
}

function WaitingRow({ m, onChanged }: { m: ParkedMessage; onChanged: () => void }) {
  const act = async (action: "dismiss" | "allow" | "allow_deliver") => {
    await resolveUnauthorized("slack", m.id, action);
    onChanged();
  };
  return (
    <div className={ROW + " bg-warnSoft/25"} data-testid={`waiting-${m.id}`}>
      <span className={LABEL}>Waiting</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium text-[13px]">{m.user_name || m.user_id}</span>{" "}
        <span className="text-[12.5px] text-muted">in {m.chat_name || m.chat_id}</span>
        <span className="block text-[12.5px] text-muted truncate">“{m.text}”</span>
      </span>
      <button
        className={PILL_ACCENT + " !py-1"}
        data-testid={`parked-allow-deliver-${m.id}`}
        title="Allow the sender and deliver this message now"
        onClick={() => act("allow_deliver")}
      >
        Allow & deliver
      </button>
      <button
        className={PILL_LINE + " !py-1"}
        data-testid={`parked-allow-${m.id}`}
        title="Allow the sender; this message is discarded"
        onClick={() => act("allow")}
      >
        Allow
      </button>
      <button className={XBTN + " px-1"} data-testid={`parked-dismiss-${m.id}`} title="Dismiss" onClick={() => act("dismiss")}>
        ×
      </button>
    </div>
  );
}

function ListeningRows({ subs, onChanged }: { subs: Subscription[]; onChanged: () => void }) {
  if (subs.length === 0) return null;
  return (
    <div className={ROW} data-testid="listening-slack">
      <span className={LABEL}>Listening</span>
      <span className="min-w-0 flex-1 space-y-1">
        {subs.map((s) => (
          <span key={s.session_id + s.channel} className="flex items-center gap-2 text-[12.5px]">
            <span className="font-medium truncate" title={s.session_id}>
              {s.session_title || s.session_id}
            </span>
            <span className="text-faint">←</span>
            <span className="text-muted truncate" title={s.channel}>
              {s.channel_name ? `#${s.channel_name}` : s.channel}
            </span>
            <button
              className={XBTN + " ml-auto"}
              title="Unsubscribe this session"
              onClick={async () => {
                await unsubscribeChannel(s.session_id, s.channel);
                onChanged();
              }}
            >
              ×
            </button>
          </span>
        ))}
      </span>
    </div>
  );
}
