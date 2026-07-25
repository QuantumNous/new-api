import { useEffect, useRef, useState } from "react";
import type { Persona } from "../api";
import type { SessionInfo } from "../types";
import { isProjectScoped, shortPersonaName } from "../personaScope";
import { Icon } from "./Icon";
import { baseName } from "../paths";

// Command-palette search (Codex-style): clicking Search opens this overlay over the whole app
// rather than filtering the sidebar in place (which made the grouped list collapse). It searches
// ALL sessions, split into Pinned + Recent, filters as you type, and supports ↑/↓ + Enter + ⌘1–9.

const byRecent = (a: SessionInfo, b: SessionInfo) =>
  (b.updated_at || "").localeCompare(a.updated_at || "");

export function SearchModal({
  sessions,
  personas,
  onSelect,
  onClose,
}: {
  sessions: SessionInfo[];
  personas?: Persona[];
  onSelect: (id: string, workspace: string, agent: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const personaOf = (id: string) => personas?.find((p) => p.id === id);
  // Right-side tag: the project folder for project-scoped personas, else the short persona name.
  const tagFor = (s: SessionInfo) =>
    s.workspace && isProjectScoped(personaOf(s.agent))
      ? baseName(s.workspace)
      : shortPersonaName(personaOf(s.agent)?.name, s.agent);

  const q = query.trim().toLowerCase();
  const real = sessions.filter((s) => !s.session_id.startsWith("__") && !s.archived);
  const match = (s: SessionInfo) =>
    !q ||
    (s.title || s.session_id).toLowerCase().includes(q) ||
    tagFor(s).toLowerCase().includes(q);

  const filtered = real.filter(match);
  const pinned = filtered.filter((s) => s.pinned).sort(byRecent);
  const recent = filtered.filter((s) => !s.pinned).sort(byRecent);
  const ordered = [...pinned, ...recent]; // flat order drives keyboard nav + ⌘N

  // Reset the highlight whenever the result set changes.
  useEffect(() => {
    setActive(0);
  }, [q]);

  const choose = (s?: SessionInfo) => {
    const target = s || ordered[active];
    if (!target) return;
    onSelect(target.session_id, target.workspace, target.agent);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, ordered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose();
    } else if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
      const idx = Number(e.key) - 1;
      if (ordered[idx]) {
        e.preventDefault();
        choose(ordered[idx]);
      }
    }
  };

  const row = (s: SessionInfo, idx: number) => {
    const isActive = idx === active;
    return (
      <button
        key={s.session_id}
        className={
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left " +
          (isActive ? "bg-accentSoft" : "hover:bg-paper")
        }
        onMouseEnter={() => setActive(idx)}
        onClick={() => choose(s)}
      >
        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
          {s.title || s.session_id}
        </span>
        <span className="text-[12px] text-faint shrink-0">{tagFor(s)}</span>
        {idx < 9 && (
          <kbd className="text-[10.5px] text-faint bg-paper border border-line rounded px-1.5 py-0.5 shrink-0 font-sans">
            ⌘{idx + 1}
          </kbd>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50" onKeyDown={onKey}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute left-1/2 top-[14vh] -translate-x-1/2 w-[640px] max-w-[92vw] rounded-xl2 border border-line bg-panel shadow-2xl overflow-hidden">
        <div className="px-4 pt-3.5 pb-2.5 border-b border-line flex items-center gap-2.5">
          <Icon name="search" size={16} className="text-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-faint"
          />
          <kbd className="text-[10.5px] text-faint bg-paper border border-line rounded px-1.5 py-0.5 font-sans">
            Esc
          </kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto hairline-scroll py-2">
          {ordered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-faint">No chats found.</div>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="px-2">
                  <div className="px-2 py-1 text-[11px] uppercase tracking-[0.05em] text-faint font-semibold">
                    Pinned chats
                  </div>
                  {pinned.map((s, i) => row(s, i))}
                </div>
              )}
              {recent.length > 0 && (
                <div className="px-2 mt-1">
                  <div className="px-2 py-1 text-[11px] uppercase tracking-[0.05em] text-faint font-semibold">
                    Recent chats
                  </div>
                  {recent.map((s, i) => row(s, pinned.length + i))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
