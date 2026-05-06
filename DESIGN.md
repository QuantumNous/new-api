# ByteCola Design

This document is the canonical design specification for ByteCola. Use it as the source of truth for logo usage, color decisions, and visual consistency. `BRAND.md` is kept only as historical project context and should not be used for new design updates.

## Design Intent

ByteCola makes AI feel as immediate as opening a cola: ready, refreshing, and easy to start. The visual system should feel clean enough for a serious AI gateway, but still carry a light cola signal through color and a small bubble detail.

The current logo direction follows an Apple-like product style: minimal decoration, strong whitespace, system typography, precise proportions, and small purposeful details instead of busy illustration.

## Logo Concept

The ByteCola logo is built from three ideas:

- `Byte` represents the digital layer and uses Byte Blue.
- `Cola` represents instant refreshment and uses Cola Red.
- The bubble is the brand signal, integrated into the final `a` or the app icon instead of floating as a detached red dot.

The bubble should read as carbonation, lightness, and "ready now." It must not look like an alert badge, error state, or notification dot.

## Logo System

### Primary Wordmark

Use [web/public/bytecola.png](web/public/bytecola.png) or [web/public/bytecola-logo-primary.png](web/public/bytecola-logo-primary.png) when the full brand name should be visible.

Rules:

- Use the horizontal wordmark on home pages, about pages, marketing sections, and larger authentication screens.
- Keep the transparent background intact.
- Keep `Byte` blue and `Cola` red.
- Keep the bubble attached to the terminal `a` area.
- Do not place the bubble after the wordmark as a detached decorative dot.

### Logo Mark

Use [web/public/bytecola-logo-mark.png](web/public/bytecola-logo-mark.png) when space is limited.

Rules:

- Use the blue `B` as the primary small-size identifier.
- Keep the cola bubble attached to the mark.
- Use this mark for compact headers, sidebar collapsed states, and small brand placements.

### App Icon

Use [web/public/bytecola-logo-app-icon.png](web/public/bytecola-logo-app-icon.png) as the icon master.

Rules:

- Use the Apple Surface rounded card as the app icon background.
- Keep the large blue `B` centered.
- Keep the bubble overlapping the lower-right body of the `B`.
- Use derived icon files for favicon, PWA, mobile, and browser surfaces.

## Color Tokens

### Core Colors

| Token            | HEX       | Usage                                            |
| ---------------- | --------- | ------------------------------------------------ |
| Byte Blue        | `#1494D1` | `Byte`, logo mark, primary brand identity        |
| Cola Red         | `#DB0D18` | `Cola`, cola bubble refraction, energetic accent |
| Brand Background | `#F7F4F1` | Warm brand canvas and marketing surfaces         |
| Apple Surface    | `#F5F5F7` | App icon card and neutral product surfaces       |
| Apple Ink        | `#1D1D1F` | Primary text and high-contrast UI copy           |
| System Gray      | `#86868B` | Secondary text and subtle metadata               |
| Bubble Mist      | `#D9E2E7` | Bubble borders, glass edges, quiet dividers      |

### Red Usage

Cola Red is a brand color, not a warning color. Use it to express cola, energy, and refreshment.

Do:

- Use Cola Red for the `Cola` letters in the primary wordmark.
- Use small red-tinted refraction inside the bubble.
- Use it sparingly for high-emphasis brand moments.

Do not:

- Use Cola Red as a generic error color in product UI.
- Use a detached red dot that can be mistaken for an alert badge.
- Use large red backgrounds unless the layout is explicitly promotional.

## Typography

Logo Typeface:

- `SF Pro Display / Segoe UI Bold`

Recommended UI stack:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC",
  sans-serif;
```

The logo assets are generated with `Segoe UI Bold` so the shape remains close to Apple-like system typography without adding an external font dependency.

## Composition Rules

### Spacing

- Keep clear space around the primary wordmark equal to at least the height of the capital `B` counter.
- Keep clear space around the app icon equal to at least 12% of the icon size.
- Avoid crowding the bubble with other red UI elements.

### Minimum Sizes

- Primary wordmark: minimum width `160px`.
- Logo mark: minimum size `32px`.
- Favicon: use generated favicon files only.
- App icon: use generated square icon files only.

### Backgrounds

- Light backgrounds: use the primary wordmark or app icon directly.
- Dark backgrounds: prefer the app icon; do not place the transparent wordmark on dark backgrounds unless contrast has been checked.
- Busy image backgrounds: use the app icon or place the wordmark on a neutral surface card.

## Asset Map

| Asset                                   | Purpose                       |
| --------------------------------------- | ----------------------------- |
| `web/public/bytecola.png`               | Primary horizontal wordmark   |
| `web/public/bytecola-logo-primary.png`  | Primary logo lockup           |
| `web/public/bytecola-logo-mark.png`     | Compact transparent logo mark |
| `web/public/bytecola-logo-app-icon.png` | 1024x1024 app icon master     |
| `web/public/logo.png`                   | Default site logo fallback    |
| `web/public/favicon.ico`                | Browser favicon bundle        |
| `web/public/favicon-16x16.png`          | 16px browser favicon          |
| `web/public/favicon-32x32.png`          | 32px browser favicon          |
| `web/public/apple-touch-icon.png`       | Apple touch icon              |
| `web/public/android-chrome-192x192.png` | PWA Android icon              |
| `web/public/android-chrome-512x512.png` | PWA Android icon              |
| `web/public/site.webmanifest`           | PWA icon and theme metadata   |

## Product Tone

ByteCola should feel:

- Immediate, not complex.
- Refreshing, not childish.
- Precise, not decorative.
- Friendly, not casual to the point of losing trust.
- Product-ready, not campaign-only.

## Implementation Notes

- Keep frontend brand defaults in `web/src/branding/brand.js`.
- Keep existing public asset paths stable so frontend code and backend configuration do not need to change.
- Use `/logo.png` for default system logo configuration.
- Use `/bytecola.png` when a page needs the full wordmark.
- Update this `DESIGN.md` before making future visual changes.
- Do not use `BRAND.md` as the active design source going forward.
