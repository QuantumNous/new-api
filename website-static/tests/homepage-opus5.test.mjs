import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const homepages = [
  "index.html",
  "zh.html",
  "de.html",
  "es.html",
  "fr.html",
  "id.html",
  "ja.html",
  "pt.html",
  "ru.html",
  "vi.html",
];

function readHomepage(file) {
  return readFileSync(new URL(`../html/${file}`, import.meta.url), "utf8");
}

function modelWallLane(html) {
  const line = html
    .split(/\r?\n/)
    .find((candidate) => candidate.includes('<div class="lane">') && candidate.includes("claude-opus-4-8"));
  assert.ok(line, "homepage must keep the Opus 4.8 model wall lane");
  return line;
}

function tileSignatures(lane) {
  return [...lane.matchAll(/<div class="tile"[^>]*>[\s\S]*?<\/div>/g)].map((match) => match[0]);
}

function trustRows(html) {
  const trustSection = html.match(/<section class="v" id="trust">[\s\S]*?<\/section>/)?.[0];
  assert.ok(trustSection, "homepage must include the trust section");

  const lines = trustSection.split(/\r?\n/);
  const rowsStart = lines.findIndex((line) => line.includes('<div class="rows">'));
  assert.notEqual(rowsStart, -1, "trust section must include a rows block");

  const rowsEnd = lines.findIndex((line, index) => index > rowsStart && line.trim() === "</div>");
  assert.notEqual(rowsEnd, -1, "trust rows block must close");

  return lines.slice(rowsStart + 1, rowsEnd).map((line) => line.trim()).filter(Boolean);
}

test("localized homepages list claude-opus-5 in repeated model wall data and trust log", () => {
  const check = "\u2713";
  const dot = "\u00b7";
  const opus5Tile = `<div class="tile"><b>claude-opus-5</b><span><i style="font-style:normal;color:var(--green)">${check} verified</i> ${dot} anthropic ${dot} 1M</span><span class="pr">$4.50/M ${dot} 90% of list</span></div>`;
  const opus5TrustLine = `<div><span class="t">LIVE</span><b>claude-opus-5</b> fingerprint ${check} ${dot} official anthropic<span class="ok">PASS</span></div>`;

  for (const file of homepages) {
    const html = readHomepage(file);
    const lane = modelWallLane(html);
    const tiles = tileSignatures(lane);

    assert.equal(tiles.length % 2, 0, `${file} model wall lane must contain two equal halves`);
    assert.deepEqual(
      tiles.slice(0, tiles.length / 2),
      tiles.slice(tiles.length / 2),
      `${file} model wall lane halves must stay identical`,
    );
    assert.equal(
      tiles.filter((tile) => tile.includes("<b>claude-opus-5</b>")).length,
      2,
      `${file} model wall lane must contain claude-opus-5 exactly twice`,
    );
    assert.equal(
      tiles.filter((tile) => tile === opus5Tile).length,
      2,
      `${file} must use the approved claude-opus-5 card copy in both lane halves`,
    );
    assert.match(lane, /<b>claude-opus-4-8<\/b>/, `${file} must retain claude-opus-4-8`);

    const opus5TrustRows = trustRows(html).filter((row) => row.includes("<b>claude-opus-5</b>"));
    assert.deepEqual(opus5TrustRows, [opus5TrustLine], `${file} trust log must include exactly the approved claude-opus-5 PASS line`);
    const trustLine = opus5TrustRows[0];
    assert.doesNotMatch(trustLine, /\d+ms|388ms/, `${file} claude-opus-5 trust line must not claim latency`);
  }
});
