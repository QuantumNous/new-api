---
name: "low-level-tweaks-api"
description: "Low-level tweaks API\nSend free-text from the Tweaks panel into chat"
---
How to send free-text from inside the Tweaks panel back to the chat (the `tweaks_panel.jsx` starter's `<TweakSuggestionBar>` wraps this for you).

To send free-text from inside the panel to the main agent loop (e.g. "add a shadow depth slider"), post `window.parent.postMessage({type: '__edit_mode_chat', text: '…'}, '*')`. The host drops this into the chat composer; the user reviews and hits Send. You'll receive it as a new turn and can edit the page accordingly.

Add `<TweakSuggestionBar suggestions={["…", "…", "…"]}>` as the **first child** of `<TweaksPanel>` to render a suggestion input that typewriter-cycles through the three; when the user picks one, types their own, or clicks "Ideas", the text drops into the chat composer for them to send — you'll receive it as a new turn. **Always include the bar with three suggestions.** When you receive the Ideas request, respond by editing the `suggestions` array in place.

**Keep each suggestion under ~35 characters** so it fits the input without truncating — "Add a minimalism slider", not "Add a minimalism slider that strips ornament and opens up whitespace". Suggestions must be tweaks to the **user's design content** — never the canvas, artboard, frame, bezel, Tweaks panel, or any starter-component scaffolding. **Aim for expressive, multi-variable knobs that feel more powerful than a design tool**, not pixel-pushing: "Add a minimalism slider" (strips ornament, collapses the palette, opens up whitespace), "Add a time-of-day slider" (morphs the palette dawn → dusk → night), "Add a brutalism toggle", "Add a chaos dial", "Add an era slider — 1998 → flat → glass". A border-radius slider is fine as a third idea, but lead with at least one that a static design tool couldn't give you. Each must still be implementable as a key in `TWEAK_DEFAULTS` plus a control — skip anything that needs new assets or network calls.
