import { useEffect, useState } from "react";
import {
  getDmRoute,
  getInboxRouting,
  getRecentChannels,
  getSessions,
  getSubscriptions,
  getUnrouted,
  setDmRoute,
  setInboxBinding,
  subscribeChannel,
  unsubscribeChannel,
  type RecentChannel,
  type Subscription,
  type UnroutedItem,
} from "../api";
import type { SessionInfo } from "../types";
import { ChannelPicker } from "./SubscriptionsChip";
import { Icon } from "./Icon";

// Inbox ▸ Configure (UX-DECISIONS §28): the former Connectors ▸ "Messaging routing" page,
// relocated whole — where inbox items go out (mirror channel), how inbound messages reach
// sessions (DM route, channel subscriptions), and the Unrouted dead-letter. Moving it here
// also deleted a duplication: the mirror channel used to be editable BOTH on this page and
// via an inline configurator on the Inbox list.
const CARD = "rounded-xl2 border border-line bg-panel";
const SELECT = "px-2.5 py-1.5 rounded-lg border border-line bg-paper text-[13px] text-ink";
const BTN_ACCENT_SM = "text-[12px] px-2.5 py-1 rounded-md bg-accent text-white disabled:opacity-50";

export function InboxConfigure() {
  return (
    <div data-testid="inbox-configure">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <InboxRoutingCard />
        <DmRouteCard />
      </div>
      <SubscriptionsCard />
      {/* Unrouted = delivery FAILURES ("messages that never reached you"), so it lives with
          the Inbox now (§28; previously with routing under Connectors, §26). */}
      <div className="mt-6" data-testid="unrouted-section">
        <h3 className="text-[14px] font-semibold mb-1">Unrouted</h3>
        <p className="text-[12.5px] text-muted mb-3">
          Inbound messages and background-turn failures nothing claimed — nothing vanishes
          silently.
        </p>
        <UnroutedTable />
      </div>
    </div>
  );
}

// Where an Unattended session's approvals/questions get mirrored as interactive buttons. Targets
// the "default" route (sessions fall back to it); pick a channel separate from any you subscribe to.
function InboxRoutingCard() {
  const [recent, setRecent] = useState<RecentChannel[]>([]);
  const [target, setTarget] = useState(""); // current default-binding address, e.g. "slack:C0123"
  const [draft, setDraft] = useState("");

  const load = () => {
    getRecentChannels().then(setRecent).catch(() => setRecent([]));
    getInboxRouting()
      .then((bs) => {
        const def = bs.find((b) => b.name === "default");
        setTarget(def?.channel ? `${def.channel}:${def.target}` : "");
      })
      .catch(() => setTarget(""));
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const save = async () => {
    const addr = draft.trim();
    if (!addr) return;
    // "slack:C0123" → channel="slack", target="C0123"; a bare id assumes slack.
    const [platform, id] = addr.includes(":") ? addr.split(":", 2) : ["slack", addr];
    await setInboxBinding("default", platform, id);
    setDraft("");
    load();
  };
  const clear = async () => {
    await setInboxBinding("default", null, "");
    load();
  };

  // Show the channel's NAME when the recent list knows it (raw address as the fallback/tooltip).
  const known = recent.find((c) => c.channel === target)?.name;

  return (
    <div className={CARD + " p-4"} data-testid="inbox-mirror-card">
      <div className="font-semibold text-[13.5px] mb-1">Unattended approvals</div>
      <p className="text-[12px] text-muted mb-3">
        Channel where an Unattended session posts Approve/Deny buttons. Currently mirroring to{" "}
        <strong className="text-ink font-medium" title={target || undefined}>
          {known ? `#${known}` : target || "in-app Inbox only"}
        </strong>
        .
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-muted shrink-0">
          <Icon name="plug" size={16} />
        </span>
        <ChannelPicker value={draft} onChange={setDraft} recent={recent} onSubmit={save} />
        <button className={BTN_ACCENT_SM} disabled={!draft.trim()} onClick={save}>
          Set
        </button>
        {target && (
          <button className="text-[12px] text-danger/80 hover:text-danger" onClick={clear}>
            clear
          </button>
        )}
      </div>
    </div>
  );
}

// Which session handles incoming DMs to the bot. None → DMs park in the Unrouted section below.
function DmRouteCard() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [dm, setDm] = useState<string>("");

  const load = () => {
    getSessions().then(setSessions).catch(() => setSessions([]));
    getDmRoute().then((s) => setDm(s || "")).catch(() => setDm(""));
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const real = sessions.filter((s) => !s.session_id.startsWith("__"));
  const choose = async (sessionId: string) => {
    setDm(sessionId);
    await setDmRoute(sessionId);
    load();
  };

  return (
    <div className={CARD + " p-4"}>
      <div className="font-semibold text-[13.5px] mb-1">Direct messages</div>
      <p className="text-[12px] text-muted mb-3">
        Session that handles DMs to the bot. With none, DMs park under Unrouted below.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted shrink-0">
          <Icon name="chat" size={16} />
        </span>
        <select className={"flex-1 " + SELECT} value={dm} onChange={(e) => choose(e.target.value)}>
          <option value="">No session — park DMs</option>
          {real.map((s) => (
            <option key={s.session_id} value={s.session_id}>
              {s.title || s.session_id}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Which sessions listen to which channels (inbound), and where each routes its Inbox (outbound).
// Subscriptions can be created by the agent (it asks you via ask_user) or added here directly.
function SubscriptionsCard() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [recent, setRecent] = useState<RecentChannel[]>([]);
  const [addSession, setAddSession] = useState("");
  const [addChannel, setAddChannel] = useState("");

  const load = () => {
    getSubscriptions().then(setSubs).catch(() => setSubs([]));
    getSessions().then(setSessions).catch(() => setSessions([]));
    getRecentChannels().then(setRecent).catch(() => setRecent([]));
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const real = sessions.filter((s) => !s.session_id.startsWith("__"));
  const add = async () => {
    if (!addSession || !addChannel.trim()) return;
    await subscribeChannel(addSession, addChannel.trim());
    setAddChannel("");
    load();
  };
  const remove = async (sessionId: string, channel: string) => {
    await unsubscribeChannel(sessionId, channel);
    load();
  };

  return (
    <div className={CARD + " mb-4 overflow-hidden"}>
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <span className="text-muted shrink-0">
          <Icon name="plug" size={15} />
        </span>
        <span className="font-semibold text-[13.5px]">Channel subscriptions</span>
        <span className="text-[12px] text-muted">— sessions that listen to a channel (inbound)</span>
      </div>

      {subs && subs.length > 0 ? (
        <table className="w-full text-[13px]">
          <thead className="text-[11px] uppercase tracking-[0.04em] text-faint">
            <tr className="text-left">
              <th className="font-medium px-4 py-2">Session</th>
              <th className="font-medium px-4 py-2">Listens to</th>
              <th className="font-medium px-4 py-2">Inbox routes to</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {subs.map((s, i) => (
              <tr className="border-t border-line" key={i}>
                <td className="px-4 py-2.5 truncate max-w-[12rem]" title={s.session_title}>
                  {s.session_title}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5" title={s.channel}>
                    <span className="text-muted shrink-0">
                      <Icon name="plug" size={13} />
                    </span>
                    {s.channel_name ? `#${s.channel_name}` : s.channel}
                    {s.channel_name && (
                      <span className="text-[11px] text-faint">{s.channel}</span>
                    )}
                  </span>
                  {s.collision && (
                    <span
                      className="ml-1.5 text-[11px] text-warnInk bg-warnSoft/70 border border-warnInk/15 rounded px-1.5 py-0.5"
                      title="This channel is also your Inbox-routing target — inbound and outbound on one channel conflate broadcast with request/reply."
                    >
                      ⚠ collides
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted">{s.routing_target || "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    className="text-faint hover:text-danger"
                    title="Unsubscribe"
                    onClick={() => remove(s.session_id, s.channel)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-4 py-3 text-[12.5px] text-muted">
          No channel subscriptions yet — add one below or ask a coworker to watch a channel.
        </div>
      )}

      <div className="border-t border-line px-4 py-3 flex items-center gap-2 flex-wrap">
        <select
          className={SELECT}
          value={addSession}
          onChange={(e) => setAddSession(e.target.value)}
        >
          <option value="">Choose a session…</option>
          {real.map((s) => (
            <option key={s.session_id} value={s.session_id}>
              {s.title || s.session_id}
            </option>
          ))}
        </select>
        <ChannelPicker value={addChannel} onChange={setAddChannel} recent={recent} onSubmit={add} />
        <button className={BTN_ACCENT_SM} disabled={!addSession || !addChannel.trim()} onClick={add}>
          + Subscribe
        </button>
      </div>
    </div>
  );
}

// Dead-letter view: inbound messages that had no destination (e.g. a DM with no session designated)
// and background turns that failed (e.g. a dead model). Read-only — for visibility/debugging.
function UnroutedTable() {
  const [items, setItems] = useState<UnroutedItem[] | null>(null);

  useEffect(() => {
    const load = () => getUnrouted().then(setItems).catch(() => setItems([]));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (items && items.length === 0)
    return (
      <div className={CARD + " p-4 text-[13px] text-muted"}>
        Nothing here — no dropped messages or failed turns.
      </div>
    );

  return (
    <div className={CARD + " overflow-hidden"}>
      <table className="w-full text-[13px]">
        <thead className="text-[11px] uppercase tracking-[0.04em] text-faint">
          <tr className="text-left">
            <th className="font-medium px-4 py-2">When</th>
            <th className="font-medium px-4 py-2">Source</th>
            <th className="font-medium px-4 py-2">Reason</th>
            <th className="font-medium px-4 py-2">Message</th>
          </tr>
        </thead>
        <tbody>
          {(items ?? []).map((it, i) => (
            <tr className="border-t border-line" key={i}>
              <td className="px-4 py-2.5 text-muted whitespace-nowrap">
                {new Date(it.ts * 1000).toLocaleString()}
              </td>
              <td className="px-4 py-2.5" title={it.sender}>
                {it.source}
              </td>
              <td className="px-4 py-2.5">
                <span className="text-warnInk" title={it.reason}>
                  {it.reason}
                </span>
              </td>
              <td className="px-4 py-2.5 text-muted truncate max-w-[16rem]" title={it.text}>
                {it.text}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
