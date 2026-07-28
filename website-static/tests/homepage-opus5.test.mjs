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

test("localized homepages list claude-opus-5 in repeated model wall data without restoring the removed trust screen", () => {
  const check = "\u2713";
  const dot = "\u00b7";
  const opus5Tile = `<div class="tile"><b>claude-opus-5</b><span><i style="font-style:normal;color:var(--green)">${check} verified</i> ${dot} anthropic ${dot} 1M</span><span class="pr">$4.50/M ${dot} 90% of list</span></div>`;

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
    assert.doesNotMatch(
      html,
      /<section class="v" id="trust">/,
      `${file} must not restore the removed standalone trust screen`,
    );
  }
});
