import { useEffect, useMemo, useState } from "react";
import {
  getConnectors,
  getInbox,
  getInboxRouting,
  getPersonas,
  getRecentChannels,
  getUnrouted,
  resolveInboxItem,
  type InboxItem,
  type Persona,
  type RecentChannel,
} from "../api";
import { Icon } from "./Icon";
import { InboxItemCard } from "./InboxItemCard";
import { InboxConfigure } from "./InboxConfigure";
import { PanelHead } from "./IntegrationsView";
import { shortPersonaName } from "../personaScope";

const ICON_FOR: Record<string, "diamond" | "chat" | "code"> = {
  cowork: "diamond",
  chat: "chat",
  code: "code",
};

const KIND_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approval", label: "Approvals" },
  { key: "question", label: "Questions" },
];

const CHIP = (active: boolean) =>
  "text-[11.5px] px-2.5 py-1 rounded-full border " +
  (active
    ? "border-accent text-accent bg-accentSoft"
    : "border-line text-muted hover:border-lineStrong");

// Page-level tabs (§28): underline style, one visual level ABOVE the filter chips.
const TAB = (active: boolean) =>
  "pb-2 -mb-px text-[13px] border-b-2 flex items-center gap-1.5 " +
  (active
    ? "text-ink font-medium border-accent"
    : "text-muted border-transparent hover:text-ink");

// The Inbox: pending approvals / questions / notifications from across sessions, including
// unattended ones. Resolving here releases any agent suspended on the item. Each item links back
// to its originating session so you can see the context before answering. Items whose session
// was deleted are closed server-side (an orphaned prompt can never be answered), so everything
// listed here is actionable. Filters: by kind and by persona (owner ask, 2026-07-03).
// Two page tabs (§28): Pending (the queue) and Configure (the former Connectors ▸ Messaging
// routing page — mirror channel, DM route, subscriptions, Unrouted). Pending's routing status
// is read-only and links to Configure; the old inline editor was the mirror setting's SECOND
// editor and is gone.
export function InboxView({
  onOpenSession,
}: {
  onOpenSession: (sessionId: string, workspace: string, agent: string) => void;
}) {
  const [tab, setTab] = useState<"pending" | "configure">("pending");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [routing, setRouting] = useState<string | null>(null); // e.g. "slack:C0123" or null
  const [slackConnected, setSlackConnected] = useState(false);
  const [recent, setRecent] = useState<RecentChannel[]>([]);
  const [unroutedCount, setUnroutedCount] = useState(0);
  const [kind, setKind] = useState<string>("all");
  const [personaFilter, setPersonaFilter] = useState<string>("all");

  const load = () => {
    getInbox(undefined, "pending").then(setItems).catch(() => {});
    getUnrouted().then((u) => setUnroutedCount(u.length)).catch(() => setUnroutedCount(0));
  };
  const loadRouting = () =>
    getInboxRouting()
      .then((bindings) => {
        const bound = bindings.find((b) => b.channel);
        setRouting(bound ? `${bound.channel}:${bound.target}` : null);
      })
      .catch(() => setRouting(null));
  useEffect(() => {
    load();
    loadRouting();
    getPersonas().then(setPersonas).catch(() => {});
    getConnectors()
      .then((cs) => setSlackConnected(!!cs.find((c) => c.name === "slack" && c.connected)))
      .catch(() => {});
    getRecentChannels().then(setRecent).catch(() => setRecent([]));
    const t = setInterval(() => {
      load();
      loadRouting(); // edits happen on the Configure tab; keep Pending's status line honest
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const resolve = async (id: string, resolution: string) => {
    await resolveInboxItem(id, resolution);
    load();
  };

  // Personas that actually have pending items drive the filter chips (no empty chips).
  const personasWithItems = useMemo(() => {
    const ids = [...new Set(items.map((i) => i.session_agent).filter(Boolean))] as string[];
    return ids.map((id) => ({
      id,
      label: shortPersonaName(personas?.find((p) => p.id === id)?.name, id),
    }));
  }, [items, personas]);

  const visible = items.filter(
    (it) =>
      (kind === "all" || it.kind === kind) &&
      (personaFilter === "all" || it.session_agent === personaFilter),
  );

  // The originating-session chip: persona icon + session title, clickable to open that session.
  const sessionChip = (it: InboxItem) => {
    const exists = it.session_exists !== false;
    const p = personas?.find((x) => x.id === it.session_agent);
    const label = it.session_title || it.session_id;
    const icon = (p && ICON_FOR[p.icon]) || "diamond";
    const cls = `ico-${p?.icon || "cowork"}`;
    return (
      <button
        className="inbox-session-chip"
        title={exists ? `Open “${label}”` : "Session unavailable"}
        disabled={!exists}
        onClick={() =>
          exists && onOpenSession(it.session_id, it.session_workspace || "", it.session_agent || "cowork")
        }
      >
        <span className={"inbox-chip-ico " + cls}>
          <Icon name={icon} size={11} />
        </span>
        <span className="inbox-chip-label">{label}</span>
        {exists && <Icon name="chevronRight" size={13} className="inbox-chip-go" />}
      </button>
    );
  };

  const routingName = routing ? recent.find((c) => c.channel === routing)?.name : undefined;
  const routingLabel = routingName ? `#${routingName}` : routing;

  return (
    <main className="flex-1 min-w-0 flex bg-paper">
      <div className="flex-1 min-w-0 overflow-y-auto hairline-scroll">
        <div className="max-w-4xl mx-auto px-7 py-6">
          <PanelHead
            title="Inbox"
            sub="Approvals, questions, and notifications from your coworkers — including sessions running unattended."
          />

          <div className="flex gap-5 border-b border-line mb-4">
            <button
              className={TAB(tab === "pending")}
              data-testid="inbox-tab-pending"
              onClick={() => {
                setTab("pending");
                // Configure-tab edits change the mirror target — re-read so the status line
                // is honest the moment the user lands back on Pending, not a poll later.
                loadRouting();
                load();
              }}
            >
              Pending
              {items.length > 0 && (
                <span className="text-[11px] px-1.5 rounded-full bg-accentSoft text-accent leading-4">
                  {items.length}
                </span>
              )}
            </button>
            <button
              className={TAB(tab === "configure")}
              data-testid="inbox-tab-configure"
              onClick={() => setTab("configure")}
            >
              Configure
              {unroutedCount > 0 && (
                <span className="text-[11px] px-1.5 rounded-full bg-warnSoft text-warnInk leading-4">
                  ⚠ {unroutedCount}
                </span>
              )}
            </button>
          </div>

          {tab === "configure" ? (
            <InboxConfigure />
          ) : (
            <>
              <div className="text-[12px] text-faint -mt-1 mb-4" data-testid="inbox-routing">
                {routing ? (
                  <span>
                    Also delivered to{" "}
                    <span className="text-muted" title={routing}>
                      {routingLabel}
                    </span>{" "}
                    — replies there resolve items here.{" "}
                  </span>
                ) : slackConnected ? (
                  <span>Delivered here only. </span>
                ) : (
                  <span>
                    Delivered here only. Connect Slack (Connectors page) to also get these in a
                    channel — more platforms later.{" "}
                  </span>
                )}
                <button
                  className="text-accent hover:underline"
                  data-testid="inbox-route-configure"
                  onClick={() => setTab("configure")}
                >
                  Configure ›
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-4" data-testid="inbox-filters">
                {KIND_TABS.map((t) => (
                  <button key={t.key} className={CHIP(kind === t.key)} onClick={() => setKind(t.key)}>
                    {t.label}
                  </button>
                ))}
                {personasWithItems.length > 1 && (
                  <>
                    <span className="w-px h-4 bg-line mx-1" />
                    <button
                      className={CHIP(personaFilter === "all")}
                      onClick={() => setPersonaFilter("all")}
                    >
                      All coworkers
                    </button>
                    {personasWithItems.map((p) => (
                      <button
                        key={p.id}
                        className={CHIP(personaFilter === p.id)}
                        onClick={() => setPersonaFilter(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </>
                )}
              </div>

              {visible.length === 0 ? (
                <div className="manage-empty">
                  {items.length === 0 ? "Nothing pending." : "Nothing pending for this filter."}
                </div>
              ) : null}

              <div className="space-y-4">
                {visible.map((it) => (
                  <InboxItemCard key={it.id} item={it} onResolve={resolve} chip={sessionChip(it)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
