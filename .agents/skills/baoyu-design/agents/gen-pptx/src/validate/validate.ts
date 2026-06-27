import type {
  SetupResult,
  CapturedSlide,
  GenPptxInput,
  Mode,
  ValidationFlag,
} from "../types.ts";

/** Per-slide capture facts the validator inspects (hash + image-decode counts). */
export interface SlideHashResult {
  hash: number;
  imagesWaited: number;
  imagesFailed: number;
}

// Cross-check the capture against the request and emit advisory flags. Returns
// up to 10 distinct WarningKind entries. (←Fe)
export function validate(
  setup: SetupResult,
  perSlide: SlideHashResult[],
  slideTrees: CapturedSlide[],
  input: GenPptxInput,
  mode: Mode,
): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  if (!setup.fontsReady) {
    flags.push({
      kind: "fonts_timeout",
      message:
        "document.fonts.ready did not resolve within 8s — text metrics may use fallback fonts. Check that font URLs are reachable.",
    });
  }

  const misses = Array.isArray(setup.fontSwapMisses) ? setup.fontSwapMisses : [];
  if (misses.length > 0) {
    const list = misses.join(", ");
    flags.push({
      kind: "font_swap_failed",
      message:
        mode === "screenshots"
          ? `Font swap target(s) ${list} never loaded — the Google Fonts CSS fetch failed or returned nothing for the family, or the face isn't installed locally. The screenshots were rendered with a fallback font. Retry with a corrected family name or a Google-served family (check fonts.google.com) — web-safe faces may not exist in this rendering environment either, so they are not a fix here. Tell the user plainly which fonts couldn't be applied.`
          : `Font swap target(s) ${list} never loaded — the Google Fonts CSS fetch failed or returned nothing for the family, or the face isn't installed locally. The exported file names these fonts, but layout used a fallback, so text sizing and wrapping may drift. Retry with a corrected family name (check fonts.google.com) or web-safe fonts, and tell the user plainly which fonts couldn't be applied.`,
    });
  }

  if (mode === "editable" && input.resetTransformSelector && !setup.resetRect) {
    flags.push({
      kind: "reset_selector_miss",
      message: `resetTransformSelector ${JSON.stringify(input.resetTransformSelector)} matched nothing — capture may be scaled.`,
    });
  } else if (setup.resetRect) {
    const dw = Math.abs(setup.resetRect.w - input.width);
    const dh = Math.abs(setup.resetRect.h - input.height);
    if (dw > 2 || dh > 2) {
      flags.push({
        kind: "slide_size_mismatch",
        message: `resetTransformSelector measures ${Math.round(setup.resetRect.w)}×${Math.round(setup.resetRect.h)} after reset, expected ${input.width}×${input.height}. Check the element isn't constrained by a parent's max-width/overflow.`,
      });
    }
  }

  for (let i = 0; i < slideTrees.length; i++) {
    const rect = slideTrees[i].rect;
    if (Math.abs(rect.w - input.width) > 2 || Math.abs(rect.h - input.height) > 2) {
      flags.push({
        kind: "slide_size_mismatch",
        message: `Slide ${i + 1} root measures ${Math.round(rect.w)}×${Math.round(rect.h)}, expected ${input.width}×${input.height}. The selector may be matching a wrapper rather than the slide content, or the deck doesn't fix slide dimensions.`,
      });
      break;
    }
  }

  const dupAdjacent: number[] = [];
  for (let i = 1; i < perSlide.length; i++) {
    if (perSlide[i].hash === perSlide[i - 1].hash) dupAdjacent.push(i);
  }
  if (dupAdjacent.length > 0) {
    flags.push({
      kind: "duplicate_adjacent",
      message: `Slides ${dupAdjacent.map((i) => `${i}/${i + 1}`).join(", ")} captured identically — showJs likely failed to navigate. Check the JS actually changes the visible slide; some decks need a longer delay for transitions.`,
    });
  }

  const counts = new Map<number, number>();
  for (const r of perSlide) counts.set(r.hash, (counts.get(r.hash) ?? 0) + 1);
  const maxCount = Math.max(0, ...counts.values());
  if (perSlide.length >= 3 && maxCount > perSlide.length / 2) {
    flags.push({
      kind: "duplicate_majority",
      message: `${maxCount}/${perSlide.length} slides captured identically. The deck likely doesn't expose a JS navigation hook, or the showJs is wrong.`,
    });
  }

  const notes = setup.notes;
  if (notes.length === 0) {
    flags.push({
      kind: "no_speaker_notes",
      message:
        "No speaker notes found in the deck (neither data-speaker-notes attributes nor a #speaker-notes JSON block). Expected if the deck has no notes.",
    });
  } else {
    if (notes.length !== input.slides.length) {
      flags.push({
        kind: "notes_count_mismatch",
        message: `Speaker notes have ${notes.length} entries but ${input.slides.length} slides were requested — notes attach by index, so the tail will be missing or misalign.`,
      });
    }
    const nonEmpty = notes.filter((n) => n.trim());
    if (nonEmpty.length >= 2 && new Set(nonEmpty).size === 1) {
      flags.push({
        kind: "notes_uniform_nonempty",
        message: `All ${nonEmpty.length} non-empty speaker notes are identical — likely a placeholder, not real notes.`,
      });
    }
  }

  const failed = perSlide.reduce((sum, r) => sum + r.imagesFailed, 0);
  if (failed > 0) {
    const waited = perSlide.reduce((sum, r) => sum + r.imagesWaited, 0);
    flags.push({
      kind: "images_failed",
      message: `${failed}/${waited} images failed to decode before capture — they'll be missing from the export. Usually a 404 src or a CORS-blocked external URL.`,
    });
  }

  return flags;
}
