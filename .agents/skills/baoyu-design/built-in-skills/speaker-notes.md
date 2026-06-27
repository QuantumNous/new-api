---
name: "speaker-notes"
description: "Speaker notes\nPresenter script alongside visual-first slides"
---
Write speaker notes for this deck and keep the slides visual-first.

One string per slide, same order. Write conversationally — full scripts of what the presenter actually says out loud, not bullet points.

Ask a few questions about tone + conversational style before writing.

Because the script carries the narrative, strip text off the slides. Slides should lean on large figures, quotes, full-bleed images, diagrams, and one-line headlines — NOT paragraphs. If a slide is mostly text, you've put the script on the slide instead of in the notes.

### Format

Put each slide's note as plain text in a `data-speaker-notes` attribute on its `<section>`:

```html
<section data-label="Title" data-speaker-notes="Keep it under a minute">…</section>
```

The system renders the notes. For that to work, the page MUST call `window.postMessage({slideIndexChanged: N})` on init and on every slide change — the `deck_stage.js` starter component does this for you. The attribute travels with the slide on reorder/duplicate/delete, so there's nothing to realign. (Older decks that used a `<script id="speaker-notes">` JSON block still work; don't write that for new decks.)
