import { lowerUserAgent } from './shared';

// WebKit (Safari, all iOS browsers, GNOME Web). Distinguished from Blink by
// the legacy `-webkit-backdrop-filter` name — Blink forked from WebKit in 2013
// and only ships the unprefixed `backdrop-filter`.
/** WebKit: Safari, all iOS browsers, GNOME Web. Excludes Blink. */
export const webkit =
  typeof CSS !== 'undefined' && !!CSS.supports?.('-webkit-backdrop-filter:none');

// Anchored to `!webkit` so engines are mutually exclusive by construction.
// Firefox-on-iOS uses WebKit (its UA marker is `FxiOS/`, not `Firefox/`); the
// `!webkit` prefix also defends against future iOS-browser UA changes that
// might inject `Firefox` into a WebKit-based UA.
/** Gecko: Firefox. */
export const gecko = !webkit && lowerUserAgent.includes('firefox');

// All Chromium-based browsers ship `Chrome/` or `Chromium/` in their UA — both
// share the `chrom` prefix, so a single substring check covers Chrome, Edge,
// Opera, Brave, etc. Chrome-on-iOS uses `CriOS/` and stays WebKit. The positive
// UA check also makes this SSR-safe — an empty UA matches nothing.
/** Blink: Chrome, Edge, Opera, Brave, and other Chromium-based browsers. */
export const blink = !webkit && lowerUserAgent.includes('chrom');
