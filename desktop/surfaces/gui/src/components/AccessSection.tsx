// AccessSection — the rail's "what can this session touch" section (§32; absorbs the §23
// Session-settings drawer and retires the topbar row/glance). One collapsible rail section:
//   · header: "Access" + a permanent summary ("Slack, GitHub · 2 folders") — the §23 trust
//     glance made ambient. Ships collapsed; expanding edits INLINE at rail width (no overlay).
//   · Sources — Connected toggles (per-session mute), Recommended (connect-in-context), and the
//     two-way connectors' channels drill-down — the drawer's content, recut.
//   · Folders — the session's working directories (add/remove, RO/RW gate, branch).
// Owns its data (GET /v1/sessions/{id}/connections + the connector index), like the settings
// row before it. Deep links (intro "Configure ›", onboarding "Start working") bump `openKey`
// to expand it and scroll it into view.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CLOUD_CHANGED,
  getCloudStatus,
  getConnectors,
  getRecentChannels,
  getSessionConnections,
  getSubscriptions,
  setSessionConnection,
  subscribeChannel,
  unsubscribeChannel,
  type CloudStatus,
  type Connector,
  type RecentChannel,
  type SessionConnections,
  type Subscription,
} from "../api";
import { ConnectorBadge } from "../connectors/ConnectorIcon";
import { indexConnectors, labelFor, visualFor, type ConnectorMap } from "../connectors/visuals";
import { baseName } from "../paths";
import { useRoots } from "../useRoots";
import { AddFolderForm } from "./AddFolderForm";
import { Icon } from "./Icon";
import { ConnectSetup } from "./ManageTabs";
import { RootRow } from "./RootRow";
import { ChannelPicker } from "./SubscriptionsChip";
import { Toggle } from "./Toggle";

// A channel address's platform: "slack:C0123" → "slack"; a bare id or "#mention" defaults to
// slack (the backend's own default when no platform prefix is given).
const platformOf = (channel: string) => (channel.includes(":") ? channel.split(":")[0] : "slack");

const SEC_H = "text-[11px] uppercase tracking-[0.05em] text-faint font-semibold";
const TAG_CORE =
  "text-[10px] px-1.5 py-0.5 rounded-full bg-warnSoft/70 text-warnInk border border-warnInk/15";
const BTN_ACCENT = "text-[12px] px-2.5 py-1.5 rounded-lg bg-accent text-white shrink-0";
const BTN_BORDERED =
  "text-[12px] px-2.5 py-1.5 rounded-lg border border-line bg-paper hover:border-lineStrong shrink-0";

export function AccessSection({
  sessionId,
  personaId,
  projectScoped,
  workspace,
  branch,
  scratchPrimary,
  openKey = 0,
  onOpenIntegrations,
}: {
  sessionId: string;
  personaId?: string;
  // Project-scoped (code-family) sessions summarize the folder NAME, not a count.
  projectScoped?: boolean;
  workspace?: string;
  branch?: string | null;
  scratchPrimary?: boolean;
  // Bumped by deep links ("Configure ›", onboarding's Start-working) → expand + scroll here.
  openKey?: number;
  onOpenIntegrations?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [conns, setConns] = useState<SessionConnections | null>(null);
  const [byName, setByName] = useState<ConnectorMap>({});
  const { roots, busy: rootsBusy, error: rootsError, addRoot, toggleAccess, removeRoot } =
    useRoots(sessionId, open ? 1 : 0);
  const rootEl = useRef<HTMLElement | null>(null);

  const reload = useCallback(() => {
    // personaId hint: a brand-new session has no server-side record yet, so without it the
    // view would resolve to the DEFAULT persona's defaults/recommends.
    getSessionConnections(sessionId, personaId)
      .then(setConns)
      .catch(() => setConns(null));
  }, [sessionId, personaId]);
  useEffect(() => {
    reload();
  }, [reload]);

  // The connector index feeds brand colors and gates the "Channels ·" links; refetch on every
  // expand so a single failed fetch at mount can't hide them for the session's whole lifetime.
  useEffect(() => {
    let live = true;
    getConnectors()
      .then((list) => live && setByName(indexConnectors(list)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);

  // Deep link: expand + scroll into view (ignore the mount value).
  const seenKey = useRef(openKey);
  useEffect(() => {
    if (openKey === seenKey.current) return;
    seenKey.current = openKey;
    setOpen(true);
    setTimeout(() => rootEl.current?.scrollIntoView({ block: "nearest" }), 30);
  }, [openKey]);

  // Child views (connect-in-context / channels drill-down) replace the section body inline.
  const [channelsFor, setChannelsFor] = useState<string | null>(null);
  const [connectFor, setConnectFor] = useState<Connector | null>(null);
  // "+ Add a source…" (§32 addendum): the FULL catalog in-session. The list shows on focus,
  // before any typing (FB-012: typing-to-see was a hidden step), and the query filters it
  // live; rich browsing (detail pages, connect states) stays on the global Connectors page.
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  // The add flow guarantees the new source is live HERE: the user asked for it in this
  // session, so after the connect lands it is also enabled per-session explicitly.
  const [addedFrom, setAddedFrom] = useState<string | null>(null);
  // Folders mirrors Sources: flat rows + a quiet "+" link that expands the inline form.
  const [addingFolder, setAddingFolder] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus | null>(null);
  useEffect(() => {
    if (!connectFor) return;
    // null means UNKNOWN (renders as "checking"), never signed-out: a single failed
    // fetch here used to demand sign-in from a signed-in user with no way to recover
    // (FB-013). Poll while the connect pane is open, keep last-good on failure, and
    // listen for the sign-in broadcast so the pane flips the moment login lands.
    const load = () => getCloudStatus().then(setCloud).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    window.addEventListener(CLOUD_CHANGED, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(CLOUD_CHANGED, load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!connectFor]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [recent, setRecent] = useState<RecentChannel[]>([]);
  const [draft, setDraft] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const loadSubs = () => getSubscriptions().then(setSubs).catch(() => setSubs([]));
  useEffect(() => {
    if (!open) return;
    loadSubs();
    getRecentChannels().then(setRecent).catch(() => setRecent([]));
  }, [open]);

  // Collapsing the section also closes any child view — reopening starts at the top level.
  useEffect(() => {
    if (!open) {
      setChannelsFor(null);
      setConnectFor(null);
      setAdding(false);
      setQuery("");
      setAddedFrom(null);
      setAddingFolder(false);
    }
  }, [open]);

  const toggleSession = async (connector: string, next: boolean) => {
    await setSessionConnection(sessionId, connector, next);
    reload();
  };
  const channelsOf = (connector: string) =>
    subs.filter((s) => s.session_id === sessionId && platformOf(s.channel) === connector);
  const addChannel = async () => {
    const raw = draft.trim();
    if (!raw || !channelsFor) return;
    const channel = raw.includes(":") || raw.startsWith("#") ? raw : `${channelsFor}:${raw}`;
    const r = await subscribeChannel(sessionId, channel);
    if (!r.ok) {
      setAddErr(r.error || "Couldn't add that channel.");
      return;
    }
    setAddErr(null);
    setDraft("");
    loadSubs();
  };
  const removeChannel = async (channel: string) => {
    await unsubscribeChannel(sessionId, channel);
    loadSubs();
  };

  const connected = conns?.connected ?? [];
  const recommended = conns?.recommended ?? [];
  const live = connected.filter((c) => c.enabled);

  // Catalog list: available, not already in the Connected list (those have toggles above).
  // Empty query = the whole catalog (FB-012 — the list renders before any typing); a query
  // narrows it on title/name/aliases ("calendar" must surface Outlook, not just Google
  // Calendar). Alphabetical so filtering never reorders; the container height-caps it, so
  // no count cap here.
  const connectedSet = new Set(connected.map((c) => c.connector));
  const q = query.trim().toLowerCase();
  const results = Object.values(byName)
    .filter(
      (c) =>
        c.available &&
        !connectedSet.has(c.name) &&
        (!q ||
          c.title.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.aliases ?? []).some((a) => a.toLowerCase().includes(q))),
    )
    .sort((a, b) => a.title.localeCompare(b.title));

  // The header summary — the §23 glance, permanent: live source names + the folder fact.
  const names = live.map((c) => labelFor(c.connector, byName));
  const sourcesPart =
    names.length === 0
      ? "no sources"
      : names.length <= 2
        ? names.join(", ")
        : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  const folderPart = projectScoped
    ? baseName(workspace || roots.find((r) => r.primary)?.path || "") || null
    : roots.length > 0
      ? `${roots.length} folder${roots.length === 1 ? "" : "s"}`
      : null;
  const summary = folderPart ? `${sourcesPart} · ${folderPart}` : sourcesPart;

  return (
    <section className="rail-section" ref={rootEl} data-testid="access-section">
      <div className="rail-section-head">
        <button className="rail-section-toggle" onClick={() => setOpen((v) => !v)} data-testid="access-toggle">
          <Icon name={open ? "chevronDown" : "chevronRight"} size={14} className="rail-chev" />
          <span>Access</span>
          <span
            className="ml-auto min-w-0 truncate text-[11px] font-normal text-faint"
            data-testid="access-summary"
            title={summary}
          >
            {summary}
          </span>
        </button>
      </div>
      {open && (
        <div className="rail-section-body" role="region" aria-label="Session access">
          {connectFor ? (
            <ConnectInline
              c={connectFor}
              cloud={cloud}
              onDone={() => {
                const name = connectFor.name;
                setConnectFor(null);
                if (addedFrom === name) {
                  // Added from THIS session's panel → also enable it here explicitly (a
                  // catalog connector need not be in the persona's default-on set).
                  setAddedFrom(null);
                  setSessionConnection(sessionId, name, true)
                    .catch(() => {})
                    .finally(reload);
                  return;
                }
                reload();
              }}
              onBack={() => {
                setConnectFor(null);
                setAddedFrom(null);
              }}
            />
          ) : channelsFor ? (
            <ChannelsInline
              label={labelFor(channelsFor, byName)}
              channels={channelsOf(channelsFor)}
              recent={recent}
              draft={draft}
              onDraft={(v) => {
                setDraft(v);
                setAddErr(null);
              }}
              onAdd={addChannel}
              error={addErr}
              onRemove={removeChannel}
              onBack={() => setChannelsFor(null)}
            />
          ) : (
            <div className="space-y-4">
              {/* Sources — each toggle is a per-session override (mute for THIS session only). */}
              <div>
                <div className={`${SEC_H} mb-1.5`}>Sources</div>
                {connected.length === 0 && (
                  <div className="text-[12px] text-faint py-0.5">
                    No connectors enabled for this session.
                  </div>
                )}
                <div className="space-y-1">
                  {connected.map((c) => (
                    <div className="flex items-center gap-2 py-1" key={c.connector}>
                      <ConnectorBadge connector={visualFor(c.connector, "connector", byName)} size={24} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-medium leading-tight truncate">
                          <span>{labelFor(c.connector, byName)}</span>
                          {c.detail && <span className="text-faint font-normal"> · {c.detail}</span>}
                        </div>
                        {byName[c.connector]?.channels && (
                          <button
                            className="inline-flex items-center gap-0.5 text-[11px] text-accent hover:underline"
                            onClick={() => {
                              setDraft("");
                              setChannelsFor(c.connector);
                            }}
                          >
                            Channels · {channelsOf(c.connector).length}
                            <Icon name="chevronRight" size={10} />
                          </button>
                        )}
                      </div>
                      <Toggle
                        checked={c.enabled}
                        onChange={(next) => toggleSession(c.connector, next)}
                        title="Enabled for this session — tap to mute here"
                      />
                    </div>
                  ))}
                </div>
                {connected.length > 0 && (
                  <p className="text-[10.5px] text-faint mt-1 leading-snug">
                    Off mutes it for <b>this session only</b> — the connector stays connected.
                  </p>
                )}
                {/* §32 addendum (owner ask 2026-07-13; FB-012): the catalog's long tail,
                    in-session. A quiet row that becomes a typeahead: full list on focus,
                    filter as you type. */}
                {adding ? (
                  <div className="mt-1.5">
                    <input
                      className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-panel text-[12.5px] outline-none focus:border-accent"
                      placeholder="Search connectors…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setAdding(false);
                          setQuery("");
                        }
                      }}
                      autoFocus
                      data-testid="access-add-search"
                    />
                    {results.length === 0 && (
                      // Also covers a failed/empty catalog fetch: an open picker must never
                      // be silently blank — point at the Connectors page either way.
                      <div className="text-[11.5px] text-faint mt-1.5 px-0.5">
                        No match — see all on the Connectors page below.
                      </div>
                    )}
                    <div className="mt-1 max-h-64 overflow-y-auto">
                      {results.map((c) => (
                        <button
                          key={c.name}
                          className="w-full flex items-center gap-2 py-1.5 px-0.5 rounded-lg text-left hover:bg-paper"
                          data-testid={`access-add-${c.name}`}
                          onClick={() => {
                            setAdding(false);
                            setQuery("");
                            setAddedFrom(c.name);
                            setConnectFor(c);
                          }}
                        >
                          <ConnectorBadge connector={visualFor(c.name, "connector", byName)} size={22} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-medium leading-tight">
                              {c.title}
                            </span>
                            <span className="block text-[11px] text-faint truncate">{c.blurb}</span>
                          </span>
                          <Icon name="chevronRight" size={11} className="text-faint shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    className="mt-1 text-[12px] text-accent hover:underline text-left"
                    onClick={() => setAdding(true)}
                    data-testid="access-add-source"
                  >
                    + Add a source…
                  </button>
                )}
              </div>

              {recommended.length > 0 && (
                <div>
                  <div className={`${SEC_H} mb-1.5`}>Recommended</div>
                  <div className="space-y-1">
                    {recommended.map((r) => (
                      <div className="flex items-center gap-2 py-1" key={r.connector}>
                        <ConnectorBadge connector={visualFor(r.connector, "connector", byName)} size={24} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[12.5px] font-medium leading-tight">
                            <span className="truncate">{labelFor(r.connector, byName)}</span>
                            {r.tier === "core" && <span className={TAG_CORE}>core</span>}
                          </div>
                          <div className="text-[11px] text-faint truncate" title={r.reason}>
                            {r.reason}
                          </div>
                        </div>
                        <button
                          className={r.tier === "core" ? BTN_ACCENT : BTN_BORDERED}
                          onClick={() => {
                            // Connect IN CONTEXT when we ship this connector; unknown refs
                            // (no descriptor) still fall back to the global page.
                            const desc = byName[r.connector];
                            if (desc) setConnectFor(desc);
                            else onOpenIntegrations?.();
                          }}
                        >
                          Connect
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Working directories — standing session config (§22/§23 lineage). Flat rows +
                  a quiet "+" link, structurally identical to Sources (owner ask 2026-07-13:
                  the old drawer's card wrapper read too heavy in the rail). */}
              <div data-testid="drawer-directories">
                <div className={`${SEC_H} mb-1.5`}>Folders</div>
                <div className="-mx-1.5">
                  {roots.map((r) => (
                    <RootRow
                      key={r.path}
                      root={r}
                      busy={rootsBusy}
                      scratchPrimary={scratchPrimary}
                      branch={r.primary ? branch : undefined}
                      onToggle={toggleAccess}
                      onRemove={removeRoot}
                    />
                  ))}
                </div>
                {addingFolder ? (
                  <div className="mt-1.5">
                    <AddFolderForm
                      onAdd={addRoot}
                      busy={rootsBusy}
                      startOpen
                      onDismiss={() => setAddingFolder(false)}
                    />
                  </div>
                ) : (
                  <button
                    className="mt-1 text-[12px] text-accent hover:underline text-left"
                    onClick={() => setAddingFolder(true)}
                  >
                    + Give access to a folder…
                  </button>
                )}
                {rootsError && <div className="roots-err">{rootsError}</div>}
              </div>

              <button
                className="text-[12px] text-accent font-medium hover:underline text-left"
                onClick={() => onOpenIntegrations?.()}
              >
                Manage all connectors (global) →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Connect-in-context (§32 child view): the same ConnectSetup the global Connectors page uses,
// hosted inline in the section so connecting never navigates away. Managed connects complete
// out-of-band (browser → broker → sidecar), so poll until the connector flips.
function ConnectInline({
  c,
  cloud,
  onDone,
  onBack,
}: {
  c: Connector;
  cloud: CloudStatus | null;
  onDone: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const list = await getConnectors();
        if (list.find((x) => x.name === c.name)?.connected) onDone();
      } catch {
        /* poll again */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [c.name, onDone]);

  return (
    <div>
      <button
        className="inline-flex items-center gap-1 text-[12px] text-faint hover:text-ink mb-2"
        onClick={onBack}
        aria-label="Back to sources"
      >
        <Icon name="arrowLeft" size={13} /> Connect {c.title}
      </button>
      {c.blurb && <p className="text-[12px] text-muted mb-1 leading-relaxed">{c.blurb}</p>}
      <div className="-mx-2">
        <ConnectSetup c={c} cloud={cloud} onConnected={onDone} />
      </div>
      {/* Scope semantics, stated once (owner ask 2026-07-13): connecting is account-level,
          the toggle above is what scopes it to a session. */}
      <p className="text-[10.5px] text-faint mt-2 leading-snug">
        Connecting makes {c.title} available to all your coworkers — the toggle in this list
        controls just this session.
      </p>
    </div>
  );
}

// The per-connector channels drill-down (§32 child view): which channels THIS session listens
// to on a two-way messaging connector (Slack/Telegram).
function ChannelsInline({
  label,
  channels,
  recent,
  draft,
  onDraft,
  onAdd,
  error,
  onRemove,
  onBack,
}: {
  label: string;
  channels: Subscription[];
  recent: RecentChannel[];
  draft: string;
  onDraft: (v: string) => void;
  onAdd: () => void;
  error?: string | null;
  onRemove: (channel: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        className="inline-flex items-center gap-1 text-[12px] text-faint hover:text-ink mb-2"
        onClick={onBack}
        aria-label="Back to sources"
      >
        <Icon name="arrowLeft" size={13} /> {label} channels
      </button>
      <div className={`${SEC_H} mb-1.5`}>Subscribed channels · {channels.length}</div>
      {channels.length === 0 ? (
        <div className="text-[12px] text-faint py-0.5">
          Not listening to any {label} channel yet.
        </div>
      ) : (
        <div className="space-y-1">
          {channels.map((s) => (
            <div className="flex items-center gap-1.5 py-1" key={s.channel}>
              <Icon name="plug" size={13} className="text-muted shrink-0" />
              <span className="min-w-0 flex-1 text-[12.5px] truncate" title={s.channel}>
                {s.channel_name ? `#${s.channel_name}` : s.channel}
              </span>
              {s.collision && (
                <span
                  className="text-[10.5px] text-warnInk bg-warnSoft/70 border border-warnInk/15 rounded px-1 shrink-0"
                  title="This channel is also this session's Inbox-routing target — inbound and outbound collide."
                >
                  ⚠
                </span>
              )}
              <button
                className="w-5 h-5 grid place-items-center text-faint hover:text-danger shrink-0"
                title="Stop listening"
                onClick={() => onRemove(s.channel)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={`${SEC_H} mt-3 mb-1.5`}>Add a channel</div>
      <div className="flex items-center gap-1.5">
        <ChannelPicker value={draft} onChange={onDraft} recent={recent} onSubmit={onAdd} />
        <button className={BTN_ACCENT} disabled={!draft.trim()} onClick={onAdd}>
          Add
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-warnInk mt-1.5 leading-snug" data-testid="channel-add-error">
          {error}
        </p>
      )}
      <p className="text-[10.5px] text-faint mt-1.5 leading-snug">
        The agent receives messages posted to these channels. Removing one stops this session
        from listening — the connector stays connected.
      </p>
    </div>
  );
}
