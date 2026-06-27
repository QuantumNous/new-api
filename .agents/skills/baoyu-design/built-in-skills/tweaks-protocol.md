---
name: "tweaks-protocol"
description: "Tweaks protocol\nLow-level Tweaks host protocol (postMessage + persistence)"
---
The Tweaks host protocol — use this only when the `tweaks_panel.jsx` starter component can't be used (it wires all of this for you).

The user can toggle **Tweaks** on/off from the toolbar. When on, show additional in-page controls that let the user tweak aspects of the design — colors, fonts, spacing, copy, layout variants, feature flags, whatever makes sense. **You design the tweaks UI**; it lives inside the prototype. Title your panel/window **"Tweaks"** so the naming matches the toolbar toggle.

### Protocol

- **Order matters: register the listener before you announce availability.** If you post `__edit_mode_available` first, the host's activate message can land before your handler exists and the toggle silently does nothing.

- **First**, register a `message` listener on `window` that handles:
  `{type: '__activate_edit_mode'}` → show your Tweaks panel
  `{type: '__deactivate_edit_mode'}` → hide it
- **Then** — only once that listener is live — call:
  `window.parent.postMessage({type: '__edit_mode_available'}, '*')`
  This makes the toolbar toggle appear.
- If your panel has its own close button, post:
  `window.parent.postMessage({type: '__edit_mode_dismissed'}, '*')`
  so the toolbar toggle flips off in lockstep.
- When the user changes a value, apply it live in the page **and** persist it by calling:
  `window.parent.postMessage({type: '__edit_mode_set_keys', edits: {fontSize: 18}}, '*')`
  You can send partial updates — only the keys you include are merged.

### Persisting state

Wrap your tweakable defaults in comment markers so the host can rewrite them on disk, like this:

```
const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "primaryColor": "#D97757",
  "fontSize": 16,
  "dark": false
}/*EDITMODE-END*/;
```

The block between the markers **must be valid JSON** (double-quoted keys and strings). There must be exactly one such block in the root HTML file, inside inline `<script>`. When you post `__edit_mode_set_keys`, the host parses the JSON, merges your edits, and writes the file back — so the change survives reload.
