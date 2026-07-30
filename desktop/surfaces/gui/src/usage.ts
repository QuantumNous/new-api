// Per-session token-usage accumulation (OPE-42). Pure functions so the reducer is
// unit-testable without the app. The server attaches a `usage` sidecar
// ({model, input, output, cache_read, cache_write}) to assistant messages and to the
// assistant_message event; older servers and non-reporting backends send none, and
// everything here no-ops gracefully in that case.

import type { ConversationMessage } from "./api";
import type { SessionUsage, TurnUsage } from "./types";

export function emptyUsage(): SessionUsage {
  return { byModel: {}, context: 0 };
}

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Fold one turn's usage sidecar into the session accumulation. */
export function addTurnUsage(prev: SessionUsage, raw: any): SessionUsage {
  if (!raw || typeof raw !== "object") return prev;
  const turn: TurnUsage = {
    model: typeof raw.model === "string" && raw.model ? raw.model : null,
    input: num(raw.input),
    output: num(raw.output),
    cache_read: num(raw.cache_read),
    cache_write: num(raw.cache_write),
  };
  const key = turn.model || "unknown";
  const cur = prev.byModel[key];
  return {
    byModel: {
      ...prev.byModel,
      [key]: {
        model: turn.model,
        input: (cur?.input || 0) + turn.input,
        output: (cur?.output || 0) + turn.output,
        cache_read: (cur?.cache_read || 0) + turn.cache_read,
        cache_write: (cur?.cache_write || 0) + turn.cache_write,
      },
    },
    // Prompt-side total of the LATEST round-trip = what currently sits in the
    // context window (not a sum — each request resends the whole history).
    context: turn.input + turn.cache_read + turn.cache_write,
  };
}

/** Rebuild the accumulation from a replayed transcript (session load/switch). */
export function usageFromMessages(messages: ConversationMessage[]): SessionUsage {
  let acc = emptyUsage();
  for (const m of messages || []) {
    if (m.role === "assistant" && m.usage) acc = addTurnUsage(acc, m.usage);
  }
  return acc;
}

/** All tokens consumed this session, across models and directions (chip headline). */
export function totalTokens(u: SessionUsage): number {
  return Object.values(u.byModel).reduce(
    (sum, t) => sum + t.input + t.output + t.cache_read + t.cache_write,
    0,
  );
}

/** 980 → "980", 12_400 → "12.4k", 982_000 → "982k", 1_240_000 → "1.24M". */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    return (k < 100 ? k.toFixed(1).replace(/\.0$/, "") : String(Math.round(k))) + "k";
  }
  const m = n / 1_000_000;
  return (m < 100 ? m.toFixed(2).replace(/\.?0+$/, "") : String(Math.round(m))) + "M";
}
