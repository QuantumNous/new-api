// Browser-context only. One-time page prep before per-slide capture: hide
// selectors, apply font swaps (local src:local + Google Fonts web fetch), reset
// the slide transform/size for measurement, wait for fonts.ready, and collect
// speaker notes. (←Pt)

import type { FontSwap, Rect, SetupResult } from "../types.ts";

export interface SetupInput {
  mode?: "editable" | "screenshots";
  width: number;
  height: number;
  hideSelectors?: string[];
  googleFontImports?: string[];
  fontSwaps?: FontSwap[];
  resetTransformSelector?: string;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const swapProbeName = (fam: string): string => "__om-swap-probe-" + encodeURIComponent(fam.toLowerCase());

export async function setup(input: SetupInput): Promise<SetupResult> {
  const hideSelectors = Array.isArray(input.hideSelectors)
    ? input.hideSelectors.filter((s) => typeof s === "string")
    : [];
  const gfonts = Array.isArray(input.googleFontImports)
    ? input.googleFontImports.filter((s) => typeof s === "string")
    : [];
  const swaps = (Array.isArray(input.fontSwaps) ? input.fontSwaps : []).filter(
    (p) => !!p && typeof p.from === "string" && typeof p.to === "string",
  );
  const skipWebSafe = (input.mode ?? "editable") === "editable";
  const width = Number(input.width) || 0;
  const height = Number(input.height) || 0;

  for (const sel of hideSelectors) {
    try {
      document.querySelectorAll(sel).forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });
    } catch {
      /* invalid selector — skip */
    }
  }

  // Lowercased — CSS family matching is case-insensitive.
  const gfontSet: Record<string, number> = {};
  for (const g of gfonts) gfontSet[g.toLowerCase()] = 1;
  const localSwaps = swaps.filter((p) => !gfontSet[p.to.toLowerCase()]);

  const localSwapCss = localSwaps
    .map(
      (p) =>
        "@font-face{font-family:" +
        JSON.stringify(p.from) +
        ";src:local(" +
        JSON.stringify(p.to) +
        ");}" +
        "@font-face{font-family:" +
        JSON.stringify(swapProbeName(p.to)) +
        ";src:local(" +
        JSON.stringify(p.to) +
        ");}",
    )
    .join("\n");
  if (localSwapCss) {
    const st = document.createElement("style");
    st.setAttribute("data-genpptx", "swap");
    st.textContent = localSwapCss;
    document.head.appendChild(st);
  }

  const webSwaps = swaps.filter((p) => gfontSet[p.to.toLowerCase()]);
  let swapCancelled = false;
  const swapMisses: string[] = [];
  const swapMissSet: Record<string, number> = {};
  const recordSwapMiss = (fam: string): void => {
    const k = fam.toLowerCase();
    if (!swapMissSet[k]) {
      swapMissSet[k] = 1;
      swapMisses.push(fam);
    }
  };

  const webSwapDone = Promise.all(
    webSwaps.map((p) => {
      const fam = "font-family:" + JSON.stringify(p.from);
      const base = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(p.to);
      return fetch(base + ":wght@400;500;600;700&display=swap")
        .then((r) => (r.ok ? r.text() : ""))
        .then((css) => css || fetch(base + "&display=swap").then((r) => (r.ok ? r.text() : "")))
        .then((css) => {
          if (!css) {
            recordSwapMiss(p.to);
            return;
          }
          if (swapCancelled) return;
          const st = document.createElement("style");
          st.setAttribute("data-genpptx", "swap");
          st.textContent = css.replace(/font-family:\s*['"][^'"]*['"]/gi, () => fam);
          document.head.appendChild(st);
        })
        .catch(() => recordSwapMiss(p.to));
    }),
  );

  for (const family of gfonts) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(family) + ":wght@400;500;600;700&display=swap";
    link.setAttribute("data-genpptx", "gfont");
    link.onerror = () => {
      if (swapCancelled) return;
      const fb = document.createElement("link");
      fb.rel = "stylesheet";
      fb.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(family) + "&display=swap";
      fb.setAttribute("data-genpptx", "gfont");
      document.head.appendChild(fb);
    };
    document.head.appendChild(link);
  }

  let resetRect: Rect | null = null;
  if (input.resetTransformSelector) {
    const resetEl = document.querySelector(input.resetTransformSelector) as HTMLElement | null;
    if (resetEl) {
      resetEl.setAttribute("noscale", "");
      resetEl.setAttribute("width", String(width));
      resetEl.setAttribute("height", String(height));
      resetEl.style.transform = "none";
      resetEl.style.transition = "none";
      resetEl.style.width = width + "px";
      resetEl.style.height = height + "px";
      void resetEl.offsetHeight;
      const measureEl = (resetEl.shadowRoot && resetEl.shadowRoot.querySelector(".canvas")) || resetEl;
      const r = measureEl.getBoundingClientRect();
      resetRect = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
  }

  let fontsReady = false;
  try {
    await Promise.race([
      webSwapDone
        .then(() => document.fonts.ready)
        .then(() => {
          fontsReady = true;
        }),
      sleep(8000),
    ]);
  } catch {
    /* fonts.ready rejection is non-fatal */
  }
  swapCancelled = true;

  if (localSwaps.length && document.fonts && document.fonts.load) {
    try {
      await Promise.race([
        Promise.all(
          localSwaps.map((p) =>
            document.fonts.load("72px " + JSON.stringify(swapProbeName(p.to))).catch(() => undefined),
          ),
        ),
        sleep(500),
      ]);
    } catch {
      /* probe warming best-effort */
    }
  }

  // Canvas-metric probe for local swaps: a face that matches both generic
  // baselines never loaded. Warning-grade only.
  try {
    const pctx = document.createElement("canvas").getContext("2d");
    if (pctx) {
      const probeStr = "BESbswy—MWmi0Il1";
      pctx.font = "72px monospace";
      const probeMonoW = pctx.measureText(probeStr).width;
      pctx.font = "72px sans-serif";
      const probeSansW = pctx.measureText(probeStr).width;
      const genericSkip: Record<string, number> = {
        serif: 1,
        "sans-serif": 1,
        monospace: 1,
        "system-ui": 1,
        cursive: 1,
        fantasy: 1,
        "-apple-system": 1,
        blinkmacsystemfont: 1,
        "ui-serif": 1,
        "ui-sans-serif": 1,
        "ui-monospace": 1,
        "ui-rounded": 1,
        math: 1,
        emoji: 1,
      };
      const webSafeFaces: Record<string, number> = {
        arial: 1,
        helvetica: 1,
        georgia: 1,
        "times new roman": 1,
        times: 1,
        "courier new": 1,
        courier: 1,
        verdana: 1,
        tahoma: 1,
        "trebuchet ms": 1,
        impact: 1,
        "comic sans ms": 1,
        "segoe ui": 1,
        calibri: 1,
        cambria: 1,
        palatino: 1,
        "palatino linotype": 1,
        garamond: 1,
        "book antiqua": 1,
        consolas: 1,
        candara: 1,
        corbel: 1,
        constantia: 1,
        "arial narrow": 1,
        "arial black": 1,
        "century gothic": 1,
        "lucida sans": 1,
        "lucida console": 1,
        "lucida sans unicode": 1,
        "cambria math": 1,
        "segoe ui emoji": 1,
        "microsoft yahei": 1,
        simsun: 1,
        simhei: 1,
        "yu gothic": 1,
        "ms gothic": 1,
        "ms mincho": 1,
        meiryo: 1,
        "malgun gothic": 1,
        batang: 1,
        pmingliu: 1,
        mingliu: 1,
        "microsoft jhenghei": 1,
      };
      for (const swap of localSwaps) {
        const lfam = swap.to;
        const lfamLc = lfam.toLowerCase();
        if (genericSkip[lfamLc]) continue;
        if (skipWebSafe && webSafeFaces[lfamLc]) continue;
        if (swapMissSet[lfamLc]) continue;
        const lq = JSON.stringify(swapProbeName(lfam));
        pctx.font = "72px " + lq + ", monospace";
        const lwm = pctx.measureText(probeStr).width;
        pctx.font = "72px " + lq + ", sans-serif";
        const lws = pctx.measureText(probeStr).width;
        if (Math.abs(lwm - probeMonoW) <= 0.01 && Math.abs(lws - probeSansW) <= 0.01) {
          recordSwapMiss(lfam);
        }
      }
    }
  } catch {
    /* probe best-effort */
  }

  // Speaker notes: per-slide data-speaker-notes is authoritative; fall through
  // to the legacy #speaker-notes JSON array otherwise.
  let notes: string[] = [];
  let json: string[] = [];
  try {
    const notesEl = document.getElementById("speaker-notes");
    if (notesEl && notesEl.textContent) {
      const parsed = JSON.parse(notesEl.textContent);
      if (Array.isArray(parsed)) json = parsed.map(String);
    }
  } catch {
    /* malformed notes JSON — ignore */
  }
  const ds = document.querySelector("deck-stage");
  if (ds) {
    const slides = Array.prototype.filter.call(
      ds.children,
      (c: Element) => !/^(template|script|style)$/i.test(c.tagName),
    ) as Element[];
    let anyAttr = false;
    notes = slides.map((s, i) => {
      const a = s.getAttribute("data-speaker-notes");
      if (a !== null) {
        anyAttr = true;
        return a;
      }
      return typeof json[i] === "string" ? json[i] : "";
    });
    if (!anyAttr) notes = json;
  } else {
    notes = json;
  }

  return { notes, fontsReady, resetRect, fontSwapMisses: swapMisses };
}
