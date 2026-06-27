---
name: "save-as-pdf"
description: "Save as PDF\nPrint-ready PDF export"
---
# Save as PDF

Export the current HTML design as a print-friendly HTML file optimized for PDF export.

## Steps

1. **Read the current HTML design file** to understand its structure and content.

2. **Create a print-ready HTML file**. The print file path is the source path with `-print` inserted before the extension — same directory, same basename. If the source is `slides/deck.html`, write `slides/deck-print.html`; if the source is `web/index.html`, write `web/index-print.html`. **Do NOT** use the deck title or project name as the filename, and **do NOT** write to the project root if the source is in a subdirectory — any change in directory depth breaks every relative URL (`@font-face` `src: url(...)`, `<img src>`, `<link href>`, CSS `background: url(...)`) and the print tab shows missing images and system-font fallbacks.

   - Add `@media print` styles with appropriate rules:
     - `@page { size: landscape; margin: 0.5cm; }` for 16:9 slide-like proportions
     - Remove background colors that won't print by default (or use `-webkit-print-color-adjust: exact` to force them)
   - Use CSS page break properties:
     - `break-before: page` to start new pages
     - `break-inside: avoid` to prevent splitting elements across pages
     - `break-after: page` where appropriate
   - Convert scroll-based or interactive layouts to static paged layouts
   - Remove hover states and `overflow: hidden` clipping; freeze animations/transitions at their end state (recipe below)
   - Remove any JavaScript interactivity that doesn't make sense in print
   - Preserve all visual content — images, SVGs, colors, typography

   **Jump animations to their end state.** Do NOT use `animation: none` (that reverts fade-ins to the hidden base). Instead add to `@media print`:
   ```css
   *, *::before, *::after {
     animation-delay: -99s !important; animation-duration: .001s !important;
     animation-iteration-count: 1 !important; animation-fill-mode: both !important;
     animation-play-state: running !important; transition-duration: 0s !important;
   }
   ```
   For `<deck-stage>` decks, also set `data-deck-active` on **every** direct-child slide (not just the current one) so `[data-deck-active]`-keyed entrance styles resolve on every page. deck-stage.js already lays out one slide per page at print, so with the CSS above and the attribute set, the copy is print-ready.

   For `.dc.html` Design Component files, keep the `<script src="support.js">` reference and the `<x-dc>` template intact — do NOT flatten the rendered output into static HTML. The runtime mounts React at load time, so layer your `@media print` CSS on top of the existing document and let the component render itself in the print tab.

3. **Test the file** by previewing it per your selected harness reference, then make sure there are no JS errors. No need to screenshot unless asked.

4. **Add the auto-print script** to the file after verifying it looks correct. This should call `window.print()`, but not before making sure the layout is ready (ie fonts and JS have loaded). Make sure your code waits until these conditions are met:
- All fonts are loaded
- If using Babel JSX transforms, make sure this code does not execute until those are parsed (e.g. place it within a JSX script.)
- Add a 500ms delay just to be safe
- Use your judgement; there may be other things to wait for besides these depending on the page!

5. **Call the `open_for_print` tool** with the project-relative path to the print-ready file.

## Important Notes

- The goal is a file that looks great when saved as PDF via the browser's print dialog
- Maintain visual fidelity — the PDF should look as close to the original design as possible
- For slide decks or multi-section designs, each slide/section should be on its own page
- The `-print.html` is plumbing for the print tab, not a deliverable — `open_for_print` is the only delivery step. Do NOT `present_fs_item_for_download` it; its relative asset paths only resolve via the project file server and break when opened standalone.
