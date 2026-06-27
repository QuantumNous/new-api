---
name: "design-system-preview"
description: "Compile a design system directory (one with _ds_manifest.json and/or @dsCard-tagged .html cards) into a single self-contained, interactive preview.html — left outline nav, Readme, and scaled live example cards — without iframes. Run it as the last step whenever you create, import, or update a design system, or when the user asks to preview/export/share one as a single HTML file."
---
# Design system → single-file preview.html

Builds the design-system review pane as ONE static HTML
file: 248px outline nav (pinned Readme + collapsible groups + scrollspy) and a
content column (max-width 760px) with the rendered Readme and one live,
interactive preview card per manifest entry.

**No iframes.** Every card gets its own declarative Shadow DOM root
(`<template shadowrootmode="open">`) with deduplicated adopted stylesheets, and
card scripts run against per-card `document`/`window` proxies, so duplicate
`id="root"`s, `body` styles, and script globals never collide across cards.

## When to run

**Always as the final step of authoring**: after you create or import a design
system and the compiler + checker pass clean, build `preview.html` into the
design-system directory so the user can open one file and review everything.
Re-run it after any edit to cards, components, tokens, or `readme.md` — like
`_ds_bundle.js` and `_ds_manifest.json`, `preview.html` is a **generated
artifact**: never hand-edit it, always regenerate.

## Run

```bash
node <skill>/agents/build-preview.mjs designs/<project>
```

(`<skill>` is this skill's directory; `designs/<project>` is the design-system
folder.) Writes `designs/<project>/preview.html` by default. Open it directly
in a browser — file:// works: CSS assets/fonts are inlined as data: URIs, and
when any card `fetch()`es project files at runtime, the project's small asset
files (svg/png/json/… ≤3 MB total) are inlined too and served to the card from
memory.

Options:

| Flag | Meaning |
|---|---|
| `--out <file>` | output path (default `<dir>/preview.html`) |
| `--title <t>` | page title (default dir basename) |
| `--cdn` | reference React/Babel from unpkg instead of inlining (smaller file, needs network) |
| `--offline` | never hit the network; use vendor cache or emit CDN tags |

React/ReactDOM UMDs and Babel are inlined from `agents/vendor/` (shipped with
this skill), so the default build needs no network.

## Input format

- `_ds_manifest.json`: `{ namespace, components[], startingPoints[], cards[], templates[] }`.
  Cards: `{ path, group, name, subtitle, viewport: "WxH" }`. Starting points are
  appended to their `section` group and their `previewPath` is rendered —
  exactly like the original pane logic.
- Without a manifest, the directory is scanned for `.html` files whose first
  line is `<!-- @dsCard group="…" viewport="WxH" name="…" subtitle="…" -->`.
- `readme.md` at the root becomes the pinned Readme card.
- React cards (`<script type="text/babel">` + `_ds_bundle.js` + React CDN tags
  in the card HTML) are supported: JSX is compiled at build time
  (@babel/standalone from `agents/vendor/`), React production UMDs and
  `_ds_bundle.js` are inlined once at document level.

## How fidelity is kept

- Scaling per card: `scale = min(containerWidth/designW, 1)` via
  `transform: scale()` — width-only, so the height can never shrink the card
  and leave blank bands beside it; the card frame shrink-wraps the scaled
  stage. The design height is a minimum (cards grow to their content, below).
- Card CSS is processed at build time: `@import`s inlined recursively, `url()`
  assets embedded as data: URIs, `:root`→`:host`, `html`→`:host`,
  `body`→`.__dsroot` rewrites for shadow scoping, and `@font-face` rules hoisted
  to the document (shadow roots ignore font-face).
- Inline `on*=` handlers are rewritten to `data-ds-on*` and re-bound inside the
  card sandbox.
- Relative `fetch()` URLs in card scripts are rebased to the card's source
  directory (cards are re-rooted into one file at the project root), and served
  from the inlined asset map when available — so icon/JSON fetches work both
  over HTTP and file://.
- **Cards always render light.** The page chrome is light-only, so the preview
  forces `color-scheme: light` on every card host: `light-dark()` tokens
  resolve to their light value regardless of the viewer's OS theme (no more
  dark cards inside a light pane on dark-mode machines). Subtrees that opt into
  dark explicitly (e.g. a `.spectrum-dark` wrapper setting
  `color-scheme: dark`) still render dark.
- **Cards never clip vertically.** The declared `viewport` height is a
  minimum: when rendered content ends up taller (React mounts, runtime-fetched
  icons, wrapped rows), the card grows to the measured content height and
  rescales — re-measured on DOM changes, resource loads, and font readiness.
  Width is taken as declared (it drives the layout), so pick the `viewport`
  width deliberately; the height is just a starting hint. For a component
  starting point, keep its `@startingPoint viewport` equal to the directory
  card's `@dsCard viewport`, since both render the same html. Anything still
  scrollable (e.g. horizontal overflow) hides its scrollbar chrome.

## Known limits (inherent to no-iframe)

- Media queries / `vw`/`vh` units inside cards evaluate against the real page
  viewport, not the card's design viewport.
- A system that keys dark mode off `@media (prefers-color-scheme: dark)` (media
  queries, not `light-dark()`) still follows the viewer's OS theme inside cards.
- Card scripts touching exotic document APIs (`document.write`, `currentScript`)
  are not supported.

After building, validate by serving the file and screenshotting (see your
harness reference for preview/screenshot tools): outline items must
scroll+highlight, React cards must mount (check the console for `[ds-preview]`
errors), and cards must be visually isolated.
