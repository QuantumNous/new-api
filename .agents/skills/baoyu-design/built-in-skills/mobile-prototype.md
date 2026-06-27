---
name: "mobile-prototype"
description: "Mobile prototype\nPin-to-home-screen-ready mobile prototype"
---
The user is building a mobile prototype that they'll open on an iPhone and pin to their home screen. Emit a single self-contained HTML file that is ready for that flow by default — don't ask first.

## Required <head> tags

Always include these, otherwise the "pin to home screen" banner won't trigger in the preview and the prototype won't install cleanly:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="<short prototype title>">
<link rel="apple-touch-icon" href="icon.png">
<link rel="icon" href="icon.png">
```

## App icon

Create an icon.png in the project root (512×512, square, no transparency on the edges — iOS masks it to a rounded square itself). Make a simple, bold mark that reads at small sizes: a single glyph or monogram on a solid or two-tone background. Avoid photo backgrounds, tiny type, or gradient washes that muddy at 60×60. If the user hasn't specified a brand, pick a deliberate single accent color and use it consistently across the icon and the prototype UI. If an image backend is available you can **generate** this icon — see [`generate-images.md`](generate-images.md) — still favoring a simple, bold mark that reads at 60×60; save it as `icon.png` in the project root. With no backend, draw a simple mark instead.

## Layout — full-bleed with device inset on desktop

By default, the page should fill the entire viewport on phone widths (safe-area insets honoured via env(safe-area-inset-*)) — no page chrome, no max-width container, edge-to-edge content. The status bar area should feel intentional (matching background or a gradient that tucks under the notch).

On large viewports (min-width: 700px), center the app inside a device-sized inset rectangle so the designer can see it as a "phone on desktop" during iteration. Target ~390×844 for the phone frame, round the corners (~40px), and drop it in a soft background. Example:

```css
html, body { margin: 0; height: 100%; overscroll-behavior: none; }
body {
  background: #111;
  display: grid;
  place-items: center;
}
#app {
  width: 100vw;
  height: 100vh;
  background: <app bg>;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
@media (min-width: 700px) {
  #app {
    width: 390px;
    height: 844px;
    border-radius: 44px;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0,0,0,0.35);
  }
}
```

## No fake chrome

Do NOT draw a fake iOS status bar (the "9:41 · battery · wifi" strip at the top) or a fake virtual keyboard at the bottom. When the prototype is installed to the home screen, the real iOS status bar and real keyboard render on top of your layout — a painted fake looks doubled up and childish. Leave that space alone and let env(safe-area-inset-top) / env(safe-area-inset-bottom) reserve the room. The same applies on the desktop device-frame preview: no fake status bar inside the phone rectangle.

Wrap your app content in <div id="app">. Navigation, state, transitions, forms — everything that makes it feel like a real app — should all work inside that single file. No external build, no CDN dependencies beyond what's already allowed in the normal prototype workflow.
