# deck-stage.js local patches

`deck-stage.js` is wholesale-overwritten whenever Claude Design ships an upgrade. This file records the local patches we layer on top of it, so they can be reapplied after each upgrade.

Per-upgrade flow:
1. Overwrite `deck-stage.js` with the new upstream version.
2. Reapply each patch below, locating it by its "anchor" string (so it still works even if upstream shifts line numbers).
3. Run `node --check deck-stage.js` to confirm there are no syntax errors.

---

## Patch 1: native fullscreen auto-hides the thumbnail rail

**Motivation**: the component only hides the rail when the host enters presentation mode via `postMessage({__omelette_presenting:true})`. It does **not** listen for native browser fullscreen. So when the deck is deployed standalone — or when fullscreen is entered with F11 / `element.requestFullscreen()` — the rail does not auto-hide.

**Approach**: add an independent `_fullscreen` flag and listen for `fullscreenchange`. Use a separate flag rather than reusing `_presenting`, so it doesn't clobber the host's presentation-mode messages (both paths can coexist).

Four edits.

### 1.1 `connectedCallback` — register the fullscreenchange listener

**Anchor** (immediately after the beforeprint/afterprint registration):

```js
      window.addEventListener('beforeprint', this._onBeforePrint);
      window.addEventListener('afterprint', this._onAfterPrint);
```

**Insert after it**:

```js
      // Native browser fullscreen (F11 / element.requestFullscreen) hides the
      // rail the same way host-driven presenting does. Independent flag so it
      // doesn't clobber _presenting when both paths are in play.
      this._onFsChange = () => {
        this._fullscreen = !!document.fullscreenElement;
        this._syncRailHidden();
        this._fit();
        this._scaleThumbs();
      };
      document.addEventListener('fullscreenchange', this._onFsChange);
```

### 1.2 `disconnectedCallback` — unbind the listener

**Anchor**:

```js
      window.removeEventListener('afterprint', this._onAfterPrint);
```

**Insert after it**:

```js
      if (this._onFsChange) document.removeEventListener('fullscreenchange', this._onFsChange);
```

### 1.3 `_railWidth()` — return 0 in fullscreen (let the canvas fill)

**Anchor / before**:

```js
      if (!this._railEnabled || !this._railVisible || this.hasAttribute('no-rail')
          || this.hasAttribute('noscale') || this._presenting || this._previewMode
          || NARROW_MQ.matches) return 0;
```

**After** (add `|| this._fullscreen`):

```js
      if (!this._railEnabled || !this._railVisible || this.hasAttribute('no-rail')
          || this.hasAttribute('noscale') || this._presenting || this._previewMode
          || this._fullscreen || NARROW_MQ.matches) return 0;
```

### 1.4 `_syncRailHidden()` — count fullscreen as a hard hide (display:none)

**Anchor / before**:

```js
      const hard = !this._railEnabled || this._presenting || this._previewMode;
```

**After** (add `|| this._fullscreen`):

```js
      const hard = !this._railEnabled || this._presenting || this._previewMode || this._fullscreen;
```

---

## Patch 2: Fullscreen toggle button + `F` shortcut in the overlay toolbar

**Motivation**: give the deck a one-click way into native fullscreen presenting, with a discoverable `F` shortcut, reusing Patch 1's rail-hide. (`requestFullscreen()` needs a user gesture — both a button click and a keydown satisfy that.)

**Builds on Patch 1 — apply that first.** Seven edits.

### 2.1 `stylesheet` — style the toolbar button and its `F` badge

First broaden the keycap rule so the new button's badge is styled too. **Before**:

```css
    .btn.reset .kbd {
```

**After**:

```css
    .btn .kbd {
```

Then add the fullscreen-button rules. **Anchor** (the closing brace of that `.kbd` rule, just before `.count`):

```css
      border-radius: 4px;
    }

    .count {
```

**Insert the `.btn.fs` rules between them**:

```css
      border-radius: 4px;
    }
    .btn.fs { padding: 0 8px; gap: 6px; }
    .btn.fs .fs-exit { display: none; }
    :host([data-fullscreen]) .btn.fs .fs-enter { display: none; }
    :host([data-fullscreen]) .btn.fs .fs-exit { display: block; }

    .count {
```

### 2.2 `_render` — add the button to the overlay markup

**Anchor** (the Reset button, last line of `overlay.innerHTML`):

```js
        <button class="btn reset" type="button" aria-label="Reset to first slide" title="Reset (R)">Reset<span class="kbd">R</span></button>
```

**Insert after it** (still inside the template literal). The two SVGs are the enter (corners-out) and exit (corners-in) icons; CSS from 2.1 shows one at a time based on `:host([data-fullscreen])`:

```js
        <button class="btn fs" type="button" aria-label="Enter fullscreen" title="Fullscreen (F)">
          <svg class="fs-enter" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>
          <svg class="fs-exit" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"/></svg>
          <span class="kbd">F</span>
        </button>
```

### 2.3 `_render` — wire the click handler

**Anchor**:

```js
      overlay.querySelector('.reset').addEventListener('click', () => this._go(0, 'click'));
```

**Insert after it**:

```js
      overlay.querySelector('.fs').addEventListener('click', () => this._toggleFullscreen());
```

### 2.4 `_render` — keep a ref to the button (for the state-reflecting aria-label)

**Anchor**:

```js
      this._totalEl = overlay.querySelector('.total');
```

**Insert after it**:

```js
      this._fsBtn = overlay.querySelector('.fs');
```

### 2.5 Add the `_toggleFullscreen()` method

**Anchor** (the end of `_advance()`):

```js
      if (i < 0 || i >= this._slides.length) { this._flashOverlay(); return; }
      this._go(i, reason);
    }
```

**Insert after that closing brace**:

```js
    /** Toggle native fullscreen on the whole document. Must be called from a
     *  user gesture (button click or keydown) or requestFullscreen rejects.
     *  The fullscreenchange handler (Patch 1) hides the rail and swaps the
     *  button icon. Standard API only — F11 / webkit-prefixed flows are out
     *  of scope, matching Patch 1's listener. */
    _toggleFullscreen() {
      try {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          const p = document.documentElement.requestFullscreen();
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) {}
    }
```

### 2.6 `_onKey` — add the `F` shortcut

**Anchor / before**:

```js
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (/^[0-9]$/.test(key)) {
```

**After** (insert an `f`/`F` branch — modifier-key combos already bail out earlier, so `Cmd/Ctrl+F` browser Find is untouched):

```js
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (key === 'f' || key === 'F') {
        this._toggleFullscreen();
      } else if (/^[0-9]$/.test(key)) {
```

### 2.7 `_onFsChange` — reflect state on the host + button (amends Patch 1.1)

**Anchor** (the first two lines of the Patch 1.1 handler):

```js
      this._onFsChange = () => {
        this._fullscreen = !!document.fullscreenElement;
```

**Insert immediately after the second line**:

```js
        this.toggleAttribute('data-fullscreen', this._fullscreen);
        if (this._fsBtn) {
          this._fsBtn.setAttribute('aria-label', this._fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
          this._fsBtn.setAttribute('title', this._fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)');
        }
```

---

## Verification

- `node --check deck-stage.js` passes.
- Open any deck in the browser and enter fullscreen via the **Fullscreen API** — e.g. `document.documentElement.requestFullscreen()` from a user gesture (button/keypress). The rail and its right-edge resize handle both disappear (`.rail[data-presenting]{display:none}` plus the adjacent-sibling selector that hides the resize handle), and the canvas re-fits to fill the viewport; exiting fullscreen restores the rail.
  - Note: the browser's own F11 fullscreen does **not** fire `fullscreenchange` or set `document.fullscreenElement`, so it won't hide the rail — only the Fullscreen API does. This matches how a "present" button (which calls `requestFullscreen()`) behaves.
  - Quick check without a real gesture: in devtools, `const d = document.querySelector('deck-stage'); d._fullscreen = true; d._syncRailHidden(); d._fit(); d._scaleThumbs();` should hide the rail; set `d._fullscreen = false` and rerun to restore.
- Host presentation mode (`__omelette_presenting`) is unaffected — the two flags are independent.
- Patch 2: press `F` (or click the ⛶ button in the overlay toolbar) — the deck enters fullscreen, the rail hides (Patch 1), and the button swaps to the exit icon with an "Exit fullscreen" label; pressing `F` / clicking again, or Esc, exits and restores everything. `Cmd/Ctrl+F` still opens the browser's Find (modifier-key combos bail out of `_onKey` before the shortcut).
