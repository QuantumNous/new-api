import { test } from "node:test";
import assert from "node:assert/strict";
import { parseColor, parseGradient, opacityToTransparency } from "../src/core/color.ts";
import { pxToInches, pxToPoints, clamp } from "../src/core/units.ts";
import {
  extractPx,
  isBold,
  textAlign,
  parseBorderRadius,
  extractRotation,
  parseShadow,
  lineSpacingMultiple,
  letterSpacingPoints,
  underlineStyle,
  normalizeText,
  trimBlockNewlines,
  noWrap,
} from "../src/core/css.ts";
import { resolveFontFamily } from "../src/core/fonts.ts";
import { safeBasename } from "../src/core/filename.ts";

test("parseColor: hex forms", () => {
  assert.deepEqual(parseColor("#fff"), { hex: "FFFFFF", alpha: 1 });
  assert.deepEqual(parseColor("#000000"), { hex: "000000", alpha: 1 });
  assert.deepEqual(parseColor("#ff8800"), { hex: "FF8800", alpha: 1 });
  // 8-digit: trailing pair is alpha/255.
  const c = parseColor("#11223380");
  assert.equal(c?.hex, "112233");
  assert.ok(Math.abs((c?.alpha ?? 0) - 128 / 255) < 1e-9);
  // 4-digit shorthand expands.
  assert.deepEqual(parseColor("#0f08"), { hex: "00FF00", alpha: 136 / 255 });
});

test("parseColor: rgb/rgba", () => {
  assert.deepEqual(parseColor("rgb(255, 136, 0)"), { hex: "FF8800", alpha: 1 });
  assert.deepEqual(parseColor("rgba(0,0,0,0.5)"), { hex: "000000", alpha: 0.5 });
  // space/slash syntax
  assert.deepEqual(parseColor("rgb(16 32 48 / 50%)"), { hex: "102030", alpha: 0.5 });
  // channel clamping
  assert.deepEqual(parseColor("rgb(300, -5, 128)"), { hex: "FF0080", alpha: 1 });
});

test("parseColor: transparent / null cases", () => {
  assert.equal(parseColor("transparent"), null);
  assert.equal(parseColor("none"), null);
  assert.equal(parseColor("rgba(0,0,0,0)"), null);
  assert.equal(parseColor("#00000000"), null);
  assert.equal(parseColor(""), null);
  assert.equal(parseColor(undefined), null);
  assert.equal(parseColor("notacolor"), null);
});

test("parseGradient: first stop", () => {
  assert.deepEqual(
    parseGradient("linear-gradient(90deg, #ff0000, #0000ff)"),
    { hex: "FF0000", alpha: 1 },
  );
  assert.equal(parseGradient("none"), null);
  assert.equal(parseGradient("url(x.png)"), null);
});

test("opacityToTransparency", () => {
  assert.equal(opacityToTransparency(1), 0);
  assert.equal(opacityToTransparency(0), 100);
  assert.equal(opacityToTransparency(0.25), 75);
});

test("units", () => {
  assert.equal(pxToInches(96), 1);
  assert.equal(pxToInches(1920), 20);
  assert.equal(pxToPoints(16), 12);
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(50, 0, 10), 10);
  assert.equal(clamp(NaN, 2, 10), 2);
});

test("extractPx", () => {
  assert.equal(extractPx("16px"), 16);
  assert.equal(extractPx("-4.5px"), -4.5);
  assert.equal(extractPx("normal"), 0);
  assert.equal(extractPx(""), 0);
});

test("isBold", () => {
  assert.equal(isBold("bold"), true);
  assert.equal(isBold("bolder"), true);
  assert.equal(isBold("700"), true);
  assert.equal(isBold("600"), true);
  assert.equal(isBold("500"), false);
  assert.equal(isBold("normal"), false);
});

test("textAlign", () => {
  assert.equal(textAlign("center"), "center");
  assert.equal(textAlign("right"), "right");
  assert.equal(textAlign("end"), "right");
  assert.equal(textAlign("justify"), "justify");
  assert.equal(textAlign("start"), "left");
  assert.equal(textAlign(undefined), "left");
});

test("parseBorderRadius", () => {
  assert.equal(parseBorderRadius("8px", 100), 8);
  // clamped to half the shorter side
  assert.equal(parseBorderRadius("100px", 40), 20);
  // percentage of shorter side
  assert.equal(parseBorderRadius("50%", 40), 20);
  assert.equal(parseBorderRadius("0px", 100), 0);
  assert.equal(parseBorderRadius("8px", 0), 0);
});

test("extractRotation", () => {
  assert.equal(extractRotation("rotate(45deg)"), 45);
  assert.equal(extractRotation("rotate(0deg)"), undefined);
  assert.equal(extractRotation("none"), undefined);
  // matrix(cos, sin, ...) for 90deg => atan2(1,0) = 90
  assert.equal(extractRotation("matrix(0, 1, -1, 0, 0, 0)"), 90);
});

test("parseShadow", () => {
  const s = parseShadow("rgba(0,0,0,0.25) 0px 4px 8px");
  assert.equal(s?.type, "outer");
  assert.equal(s?.color, "000000");
  assert.equal(s?.opacity, 0.25);
  assert.equal(s?.blur, pxToPoints(8));
  assert.equal(s?.offset, pxToPoints(4));
  // inset shadows are skipped
  assert.equal(parseShadow("inset 0 2px 4px rgba(0,0,0,0.5)"), null);
  assert.equal(parseShadow("none"), null);
});

test("lineSpacingMultiple", () => {
  assert.equal(lineSpacingMultiple("normal", 16), undefined);
  // unitless multiplier passes through
  assert.equal(lineSpacingMultiple("1.5", 16), 1.5);
  // px normalized against 1.3333 default leading
  const ls = lineSpacingMultiple("24px", 16);
  assert.ok(ls && Math.abs(ls - 24 / (16 * 1.3333333333333333)) < 1e-9);
});

test("letterSpacingPoints", () => {
  assert.equal(letterSpacingPoints("normal"), undefined);
  assert.equal(letterSpacingPoints("2px"), pxToPoints(2));
  assert.equal(letterSpacingPoints("0px"), undefined);
});

test("underlineStyle", () => {
  assert.equal(underlineStyle("double"), "dbl");
  assert.equal(underlineStyle("dashed"), "dash");
  assert.equal(underlineStyle("wavy"), "wavy");
  assert.equal(underlineStyle("solid"), "sng");
  assert.equal(underlineStyle(undefined), "sng");
});

test("normalizeText", () => {
  assert.equal(normalizeText("  a   b  ", "normal"), "a b");
  // pre/pre-wrap preserve spaces and newlines verbatim — including a leading
  // newline that separates an inline sibling from the line that follows it.
  // Block-end trimming is the caller's job (trimBlockNewlines).
  assert.equal(normalizeText("\n\nkeep\nlines\n\n", "pre"), "\n\nkeep\nlines\n\n");
  assert.equal(normalizeText("\n├─ a.md   ", "pre"), "\n├─ a.md   ");
  // pre-line collapses runs of spaces/tabs but keeps newlines (no block trim).
  assert.equal(normalizeText("a  \n  b", "pre-line"), "a\nb");
});

test("trimBlockNewlines", () => {
  assert.equal(trimBlockNewlines("\n\nkeep\nlines\n\n"), "keep\nlines");
  assert.equal(trimBlockNewlines("no edges"), "no edges");
  // only newlines are trimmed — leading/trailing spaces survive.
  assert.equal(trimBlockNewlines("\n  x  \n"), "  x  ");
});

test("noWrap", () => {
  assert.equal(noWrap({ whiteSpace: "pre" }), true);
  assert.equal(noWrap({ whiteSpace: "nowrap", overflow: "visible" }), true);
  // scrollable nowrap can still wrap visually -> not a hard nowrap
  assert.equal(noWrap({ whiteSpace: "nowrap", overflow: "auto" }), false);
  assert.equal(
    noWrap({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
    false,
  );
  assert.equal(noWrap({ whiteSpace: "normal" }), false);
});

test("resolveFontFamily", () => {
  assert.equal(resolveFontFamily('"Space Grotesk", sans-serif'), "Space Grotesk");
  assert.equal(resolveFontFamily("sans-serif"), "Arial");
  assert.equal(resolveFontFamily("monospace"), "Courier New");
  assert.equal(resolveFontFamily(undefined), "Arial");
  // swap map (case-insensitive)
  assert.equal(resolveFontFamily("BrandSans", { brandsans: "Poppins" }), "Poppins");
});

test("safeBasename: preserves Unicode, sanitizes unsafe chars", () => {
  // CJK / Cyrillic / accented Latin survive verbatim
  assert.equal(safeBasename("小米SU7-外观与价格", "deck"), "小米SU7-外观与价格");
  assert.equal(safeBasename("спам", "deck"), "спам");
  assert.equal(safeBasename("café-déjà", "deck"), "café-déjà".normalize("NFC"));
  // empty / undefined → fallback
  assert.equal(safeBasename("", "deck"), "deck");
  assert.equal(safeBasename(undefined, "deck"), "deck");
  // path separators and reserved chars → underscore
  assert.equal(safeBasename("a/b\\c", "deck"), "a_b_c");
  assert.equal(safeBasename('a<b>c:d|e?f*g"h', "deck"), "a_b_c_d_e_f_g_h");
  // leading/trailing dots & spaces stripped; internal whitespace collapsed
  assert.equal(safeBasename("  спам  ", "deck"), "спам");
  assert.equal(safeBasename(".hidden", "deck"), "hidden");
  assert.equal(safeBasename("a   b", "deck"), "a b");
  // spaces preserved (per design)
  assert.equal(safeBasename("My Deck", "deck"), "My Deck");
  // dotted names preserved (extension handling is the caller's job)
  assert.equal(safeBasename("v1.2", "deck"), "v1.2");
  assert.equal(safeBasename("deck.pptx", "deck"), "deck.pptx");
  // all-illegal collapses to underscores (not fallback)
  assert.equal(safeBasename("///", "deck"), "___");
});
