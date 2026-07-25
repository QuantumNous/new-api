// §33 refinement #3 (owner, 2026-07-14 — v2's gate only covered turn START; mid-turn
// narration still painted as a floating paragraph): ONE rule for all streamed text.
//
//   mode = "hold"   turn-start, under the threshold — show nothing but the spinner; if a
//                   tool call arrives the text was narration and renders inside the group.
//   mode = "quiet"  mid-turn, under the threshold — the text belongs to the LIVE turn
//                   group: on its collapsed header ("Running 12 steps… · checking the
//                   historical pages…") or as the small quiet line when expanded. Never a
//                   floating paragraph.
//   mode = "answer" crossed the threshold with no tool call — it's the answer; render the
//                   streaming bubble from that point.
//   mode = "none"   nothing streaming (or session idle).
//
// Turns also start COLLAPSED while running (owner call): the header's live line is the
// pulse; expanding is opt-in.

import type { Item } from "./types";

// Owner call: 40 words (~1-2s of stream) — "people can wait 1-2 seconds longer".
export const STREAM_PROMOTE_WORDS = 40;

export type StreamMode = "none" | "hold" | "quiet" | "answer";

// The turn already has activity behind it when the last real item is a tool, an approval,
// or a narration line; a stream right after the user's message is turn-start.
export function midTurn(items: Item[], running: boolean): boolean {
  if (!running) return false;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.kind === "notice") continue;
    return item.kind === "tool" || item.kind === "approval" || item.kind === "assistant";
  }
  return false;
}

export function streamMode(streaming: string, items: Item[], running: boolean): StreamMode {
  if (!streaming) return "none";
  const words = streaming.trim().split(/\s+/).filter(Boolean).length;
  if (words >= STREAM_PROMOTE_WORDS || !running) return "answer";
  return midTurn(items, running) ? "quiet" : "hold";
}
