import { useEffect, useRef, useState } from "react";
import {
  getConnectors,
  getRecentChannels,
  getSlackChannels,
  subscribeChannel,
  unsubscribeChannel,
  type RecentChannel,
} from "../api";
import { Icon } from "./Icon";

// A workspace roster hit for the typeahead: type a channel NAME, we resolve the
// id (conversations.list, cached on the desktop) and compose the address.
interface RosterHit {
  address: string;
  name: string;
  workspace: string; // labeled only when >1 workspace is connected
  is_private: boolean;
  is_member: boolean;
}

// A channel input with a popover of recently-seen channels (the "recent list + type-the-id"
// picker). Free typing is allowed (a slack:C0123 address or a channel Copy-link URL). The
// popover is hand-rolled, NOT a <datalist>: WKWebView (the macOS desktop shell) doesn't render
// datalist suggestions at all, so the native path would silently show nothing on Mac.
export function ChannelPicker({
  value,
  onChange,
  recent,
  onSubmit,
  onPickName,
}: {
  value: string;
  onChange: (v: string) => void;
  recent: RecentChannel[];
  onSubmit?: () => void;
  // Fires when a pick RESOLVES a display name for the raw address — callers can echo the
  // human name (+ workspace) wherever they show the target (§25 consent line, summaries).
  onPickName?: (address: string, name: string, workspace?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Slack workspaces for the roster lookup, learned lazily on first open (relay =
  // per-team; manual Socket Mode = the "default" flat workspace; [] = not connected).
  const [teams, setTeams] = useState<{ team_id: string; account: string }[] | null>(null);
  useEffect(() => {
    if (!open || teams !== null) return;
    getConnectors()
      .then((cs) => {
        const s = cs.find((c) => c.name === "slack");
        if (!s?.connected) return setTeams([]);
        setTeams(
          s.mode === "relay"
            ? (s.workspaces || []).map((w) => ({
                team_id: w.team_id,
                account: w.account || w.team_id,
              }))
            : [{ team_id: "default", account: s.account || "workspace" }],
        );
      })
      .catch(() => setTeams([]));
  }, [open, teams]);

  // Type a NAME → live roster suggestions (debounced; addresses/URLs skip the lookup).
  // `searching` keeps the wait VISIBLE: the first lookup per workspace is a cold
  // paginated conversations.list sweep — seconds on a big workspace — and a silent
  // gap reads as "the typeahead doesn't work" (owner report, 2026-07-09).
  const [roster, setRoster] = useState<RosterHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const name = value.trim().replace(/^#/, "");
    if (!open || !teams || teams.length === 0 || !name || name.includes(":") || name.includes("/")) {
      setRoster([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const rows = await Promise.all(
        teams.map(async (tm) => {
          try {
            const r = await getSlackChannels(tm.team_id, name);
            return (r.ok ? r.channels || [] : []).map((c) => ({
              address:
                tm.team_id === "default" ? `slack:${c.id}` : `slack:${tm.team_id}/${c.id}`,
              name: c.name,
              workspace: teams.length > 1 ? tm.account : "",
              is_private: c.is_private,
              is_member: c.is_member,
            }));
          } catch {
            return [] as RosterHit[];
          }
        }),
      );
      setRoster(rows.flat().slice(0, 12));
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [value, open, teams]);

  // Filter as the user types (name, address, or last-message text); full list on focus.
  const q = value.trim().toLowerCase();
  const options = recent.filter(
    (c) =>
      !q ||
      c.channel.toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.last_text || "").toLowerCase().includes(q),
  );
  // Roster hits the recent list already covers would be duplicates — drop them.
  const seen = new Set(options.map((c) => c.channel));
  const lookups = roster.filter((r) => !seen.has(r.address));

  // Display ≠ value (owner catch 2026-07-11: the box showed `slack:T…/C…`): the stored value
  // stays the raw address, but at rest the input shows the channel's NAME when we know it —
  // from a pick (remembered), the recent list, or a roster hit. Focus flips back to the raw
  // address for editing; the tooltip always carries it.
  const [focused, setFocused] = useState(false);
  const [pickedName, setPickedName] = useState<Record<string, string>>({});
  const knownName =
    pickedName[value] ||
    recent.find((c) => c.channel === value)?.name ||
    roster.find((r) => r.address === value)?.name ||
    "";
  const display = !focused && knownName ? `#${knownName}` : value;

  // A pick is a commit: blur the input so the display flips to the channel name (focus is
  // otherwise held by the mousedown-preventDefault that protects the pick from the blur).
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="relative flex-1 min-w-0" ref={wrap}>
      <input
        ref={inputRef}
        className="chan-input w-full"
        placeholder="slack:C0123 or channel link"
        value={display}
        title={value || undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && onSubmit) {
            setOpen(false);
            onSubmit();
          }
        }}
      />
      {open && (options.length > 0 || lookups.length > 0 || searching) && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-line bg-panel shadow-lg py-1 max-h-56 overflow-y-auto"
          role="listbox"
          data-testid="channel-suggestions"
        >
          {options.map((c) => (
            <button
              key={c.channel}
              role="option"
              className="block w-full text-left px-3 py-1.5 hover:bg-paper"
              onMouseDown={(e) => {
                // mousedown (not click) so the pick lands before the input's blur
                e.preventDefault();
                onChange(c.channel);
                if (c.name) {
                  setPickedName((m) => ({ ...m, [c.channel]: c.name! }));
                  onPickName?.(c.channel, c.name);
                }
                setOpen(false);
                inputRef.current?.blur();
              }}
            >
              <span className="text-[12.5px] text-ink">
                {c.name ? `#${c.name}` : c.channel}
              </span>
              {c.name && <span className="ml-1.5 text-[11px] text-faint">{c.channel}</span>}
              {c.last_text && (
                <span className="block text-[11px] text-faint truncate">
                  {c.last_from ? `${c.last_from}: ` : ""}
                  {c.last_text}
                </span>
              )}
            </button>
          ))}
          {/* The wait is visible: the first lookup per workspace sweeps the full
              channel roster (seconds on a big workspace; cached 15 min after). */}
          {searching && lookups.length === 0 && (
            <div
              className="px-3 py-1.5 text-[12px] text-faint"
              data-testid="roster-searching"
            >
              searching your workspace’s channels…
            </div>
          )}
          {/* Live workspace-roster hits: type the NAME, we resolved the id. */}
          {lookups.map((r) => (
            <button
              key={r.address}
              role="option"
              className="block w-full text-left px-3 py-1.5 hover:bg-paper"
              data-testid={`roster-channel-${r.address}`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(r.address);
                if (r.name) {
                  setPickedName((m) => ({ ...m, [r.address]: r.name }));
                  onPickName?.(r.address, r.name, r.workspace || undefined);
                }
                setOpen(false);
                inputRef.current?.blur();
              }}
            >
              <span className="text-[12.5px] text-ink">
                {r.is_private ? "🔒 " : "#"}
                {r.name}
              </span>
              {r.workspace && (
                <span className="ml-1.5 text-[11px] text-faint">{r.workspace}</span>
              )}
              {!r.is_member && (
                <span className="block text-[11px] text-warnInk">
                  invite @ocw to this channel in Slack so it can listen
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The per-session "connections" chip in the composer head: shows how many channels this session
// listens to, and opens a popover to add (picker) / remove (×) — the per-session manage surface.
export function SubscriptionsChip({
  sessionId,
  channels,
  onChanged,
}: {
  sessionId: string;
  channels: string[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentChannel[]>([]);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    getRecentChannels().then(setRecent).catch(() => setRecent([]));
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const add = async () => {
    const c = draft.trim();
    if (!c) return;
    await subscribeChannel(sessionId, c);
    setDraft("");
    onChanged();
  };
  const remove = async (c: string) => {
    await unsubscribeChannel(sessionId, c);
    onChanged();
  };

  return (
    <div className="sub-chip-wrap" ref={ref}>
      <button
        className={"wschip sub-chip" + (open ? " active" : "")}
        title="Channels this session listens to"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="plug" size={12} /> {channels.length || "+"}
      </button>
      {open && (
        <div className="sub-pop" onMouseDown={(e) => e.stopPropagation()}>
          <div className="sub-pop-head">Channels this session listens to</div>
          {channels.length === 0 ? (
            <div className="dim sub-pop-empty">Not subscribed to any channel.</div>
          ) : (
            channels.map((c) => {
              const nm = recent.find((r) => r.channel === c)?.name;
              return (
              <div className="sub-pop-row" key={c}>
                <span className="sub-pop-chan" title={c}>{nm ? `#${nm}` : c}</span>
                <button className="sub-pop-x" title="Unsubscribe" onClick={() => remove(c)}>
                  ×
                </button>
              </div>
              );
            })
          )}
          <div className="sub-pop-add">
            <ChannelPicker value={draft} onChange={setDraft} recent={recent} onSubmit={add} />
            <button className="btn-primary sm" disabled={!draft.trim()} onClick={add}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
