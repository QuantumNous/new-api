// Persona icon resolution (one source of truth for the sidebar, persona page, and sources drawer).
//
// A persona's `icon` (from the manifest, or the built-in registry) resolves to, in order:
//   1. an emoji        — rendered as-is (e.g. a manifest with `icon: 🛠️`),
//   2. a named glyph    — a value from our Icon set (e.g. `icon: wrench`),
//   3. a legacy logo-id — the built-ins' historic ids (cowork/code/chat/ops),
//   4. the family icon  — the fallback when a manifest declares nothing usable.
// So personas are visually distinct (Ops→wrench, Code→code, Cowork→diamond) instead of all ◆.

import { Icon, type IconName } from "./Icon";

const LEGACY: Record<string, IconName> = {
  cowork: "diamond",
  chat: "chat",
  code: "code",
  ops: "wrench",
};

// The glyphs a persona manifest may name directly (a curated, persona-appropriate subset).
const NAMED: ReadonlySet<string> = new Set<IconName>([
  "sparkle",
  "diamond",
  "chat",
  "code",
  "wrench",
  "sliders",
  "search",
  "clock",
  "folder",
  "shield",
  "table",
  "plug",
  "audit",
  "branch",
  "pencil",
]);

export function isEmojiIcon(icon?: string): boolean {
  return !!icon && /[^\x00-\x7F]/.test(icon);
}

export function personaGlyph(icon?: string, family?: string): IconName {
  if (icon && NAMED.has(icon)) return icon as IconName;
  if (icon && LEGACY[icon]) return LEGACY[icon];
  return family === "code" ? "code" : "sparkle";
}

/** Renders a persona's icon: an emoji as text, otherwise the resolved line glyph. */
export function PersonaGlyph({
  icon,
  family,
  size = 14,
}: {
  icon?: string;
  family?: string;
  size?: number;
}) {
  if (isEmojiIcon(icon)) {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>;
  }
  return <Icon name={personaGlyph(icon, family)} size={size} />;
}
