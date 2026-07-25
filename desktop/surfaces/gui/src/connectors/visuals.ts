// Connector visuals helper — turns a connector/recommend *ref* (just an id like "github" or an MCP
// server name) into a <ConnectorVisual> ({logo, brand_color, label}) for ConnectorIcon/ConnectorBadge.
//
// The real brand color lives on the API connector descriptor (`brand_color`, added in Phase 1), so we
// index `/v1/connectors` by id and thread the descriptor's `logo` + `brand_color` through. This is the
// single source of truth: a row keyed by a known connector gets its true brand color, not a hardcoded
// table. Unknown refs fall back to the ref as a registry logo id (mcp → the mcp glyph) with a neutral
// color — exactly the registry's FALLBACK behaviour.

import type { Connector } from "../api";
import type { ConnectorVisual } from "./ConnectorIcon";

export type ConnectorMap = Record<string, Connector>;

/** Index a `/v1/connectors` list by connector id (`name`) for O(1) lookup. */
export function indexConnectors(list: Connector[]): ConnectorMap {
  const map: ConnectorMap = {};
  for (const c of list) map[c.name] = c;
  return map;
}

/** Title-case a bare ref when there's no descriptor to read a real title from. */
export function humanize(ref: string): string {
  if (!ref) return "";
  return ref.charAt(0).toUpperCase() + ref.slice(1);
}

/** Display label for a ref — the descriptor title when known, else a humanized id. */
export function labelFor(ref: string, byName: ConnectorMap): string {
  return byName[ref]?.title || humanize(ref);
}

/**
 * Visual (logo + brand color + label) for a ref. Known connector → its descriptor's logo/brand_color
 * (real brand colors flow here); MCP refs → the mcp glyph; otherwise the ref is tried as a logo id and
 * resolves to the neutral fallback plug if unknown.
 */
export function visualFor(ref: string, kind: string, byName: ConnectorMap): ConnectorVisual {
  const c = byName[ref];
  if (c) return { logo: c.logo || ref, brand_color: c.brand_color, title: c.title, label: c.title };
  if (kind === "mcp") return { logo: "mcp", label: humanize(ref) };
  return { logo: ref, label: humanize(ref) };
}
