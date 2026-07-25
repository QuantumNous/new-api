// Appearance: Light / Dark / Auto-as-system. The preference lives in localStorage only —
// it's per-device (like macOS appearance itself) and must apply before the sidecar is even
// reachable. index.html sets data-theme inline pre-paint with the same key, so the first
// frame is already the right color; this module keeps it current from then on.
import { useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "auto";

const KEY = "openwork-theme";
const PREF_EVENT = "openwork:theme-pref";
const media = window.matchMedia?.("(prefers-color-scheme: dark)");

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "auto" && !!media?.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* private mode etc. — still applies for this session */
  }
  apply(pref);
  window.dispatchEvent(new CustomEvent(PREF_EVENT));
}

/** Call once at startup: applies the stored pref and follows macOS appearance while in auto. */
export function initTheme() {
  apply(getThemePref());
  media?.addEventListener("change", () => {
    if (getThemePref() === "auto") apply("auto");
  });
}

/** The settings control's hook — stays in sync if the pref changes elsewhere. */
export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  useEffect(() => {
    const sync = () => setPref(getThemePref());
    window.addEventListener(PREF_EVENT, sync);
    return () => window.removeEventListener(PREF_EVENT, sync);
  }, []);
  return [pref, setThemePref];
}
