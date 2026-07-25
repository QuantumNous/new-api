// Launch feature flags.
//
// A flag is read at render time (not import time) so tests and a running build can flip
// it via localStorage without a reload race: `localStorage.setItem(key, "1")` shows the
// feature, `"0"` force-hides it, anything else falls back to the shipped default.

function flag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // No storage (jsdom teardown, privacy mode) — ship the default.
  }
  return fallback;
}

/** Personas management is hidden for launch (owner call, 2026-07-19): the Settings tab
 * and the "Manage personas…" menu entry stay off until the persona catalog is ready.
 * The e2e suite sets `ocw.flag.personas` to keep the hidden flows covered. */
export const showPersonas = () => flag("ocw.flag.personas", false);
