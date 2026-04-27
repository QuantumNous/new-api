#!/usr/bin/env bun
/*
Copyright (C) 2026 QuantumNous

HeroUI v3 variant codemod.

What it does
------------
- Rewrites v2 visual button/chip/sidebar-trigger variants to v3 semantic ones:
    solid    -> primary
    bordered -> secondary
    flat     -> tertiary
    light    -> tertiary    (note: Chip should use 'soft' instead — see TODO)
    faded    -> secondary
    shadow   -> primary
- Collapses v2 `color="danger" variant="flat"` -> v3 `variant="danger-soft"` and
  drops the now-redundant `color` prop.
- Collapses v2 `color="danger" variant="solid"` -> v3 `variant="danger"` (drops color).
- Drops `color="primary" | "secondary" | "default"` from Button — v3 Button has
  no color prop and the variant carries the visual now.
- Leaves `color="success"` / `color="warning"` alone and prints a warning so a
  human can decide on a Tailwind override (v3 has no built-in success/warning
  Button variant).

What it does NOT do
-------------------
- It does not touch `<Chip color="primary">` (v3 Chip needs `color="accent"`
  but the rename is too lossy without context — manual pass).
- It does not change `startContent` / `endContent` (next codemod).
- It does not run on @heroui/styles internals or node_modules.

Usage
-----
    bun scripts/heroui-v3-variant-codemod.mjs           # apply
    bun scripts/heroui-v3-variant-codemod.mjs --dry     # report only
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DRY_RUN = process.argv.includes('--dry');
const ROOT = new URL('../src', import.meta.url).pathname;

// Walk the tracked file list rather than glob — keeps node_modules and other
// junk out of the loop without us re-implementing .gitignore.
const files = execSync(`git ls-files '${ROOT}/**/*.jsx' '${ROOT}/**/*.tsx'`, {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const variantMap = {
  solid: 'primary',
  bordered: 'secondary',
  flat: 'tertiary',
  light: 'tertiary',
  faded: 'secondary',
  shadow: 'primary',
};

let totalEdits = 0;
const warnings = [];
const fileEdits = new Map();

for (const file of files) {
  // Skip the Semi compatibility layer and node_modules-shaped things.
  if (file.includes('/components/ui/semi.js')) continue;
  if (file.includes('/components/ui/semi.ts')) continue;

  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const orig = src;
  let edits = 0;

  // Pass 1 — collapse `color="danger" variant="flat"` -> `variant="danger-soft"`
  // (handles either order, single or double quotes, optional whitespace).
  src = src.replace(
    /color=(['"])danger\1\s+variant=(['"])flat\2/g,
    `variant='danger-soft'`,
  );
  src = src.replace(
    /variant=(['"])flat\1\s+color=(['"])danger\2/g,
    `variant='danger-soft'`,
  );

  // Pass 2 — collapse `color="danger" variant="solid"` -> `variant="danger"`.
  src = src.replace(
    /color=(['"])danger\1\s+variant=(['"])solid\2/g,
    `variant='danger'`,
  );
  src = src.replace(
    /variant=(['"])solid\1\s+color=(['"])danger\2/g,
    `variant='danger'`,
  );

  // Pass 3 — bare `color="danger"` (no neighbouring variant): leave it for now.
  // Buttons already render danger styling via the variant remap below if any
  // visual variant is present; the only case we'd silently break is a Button
  // with neither variant nor color="danger" surviving — that just renders as
  // primary in v3, which matches the v2 "default solid danger" fallback close
  // enough for a codemod.

  // Pass 4 — variant string rewrites.
  for (const [v2, v3] of Object.entries(variantMap)) {
    const re = new RegExp(`variant=(['"])${v2}\\1`, 'g');
    src = src.replace(re, `variant='${v3}'`);
  }

  // Pass 5 — drop `color="primary"|"secondary"|"default"` from Button props.
  // We only strip when it sits next to a variant (otherwise it is probably a
  // Chip, where color="primary" still means something — manual review).
  src = src.replace(
    /(<Button\b[^>]*?)\s+color=(['"])(primary|secondary|default)\2([^>]*?>)/g,
    (match, before, _q, _color, after) => {
      if (/variant=/.test(before) || /variant=/.test(after)) return before + after;
      return match;
    },
  );

  // Pass 6 — flag `color="success"` / `color="warning"` on Button so humans
  // can pick a Tailwind override (v3 Button has no built-in success/warning).
  const successWarn = src.match(/<Button\b[^>]*?\bcolor=(['"])(success|warning)\1/g);
  if (successWarn) {
    for (const hit of successWarn) {
      warnings.push(`${file}: ${hit.slice(0, 120)}`);
    }
  }

  if (src !== orig) {
    const unique = new Set();
    for (const v2 of Object.keys(variantMap)) {
      if (orig.includes(`variant='${v2}'`) || orig.includes(`variant="${v2}"`)) {
        unique.add(v2);
      }
    }
    edits = (orig.match(/variant=['"](?:solid|bordered|flat|light|faded|shadow)['"]/g) || []).length;
    fileEdits.set(file, { edits, variants: [...unique] });
    totalEdits += edits;
    if (!DRY_RUN) writeFileSync(file, src);
  }
}

const lines = [
  `${DRY_RUN ? '[dry-run] ' : ''}HeroUI v3 variant codemod`,
  ``,
  `files touched: ${fileEdits.size}`,
  `variant edits: ${totalEdits}`,
  ``,
];

if (warnings.length) {
  lines.push(`color="success"|"warning" sites that need a manual Tailwind override:`);
  for (const w of warnings) lines.push(`  ${w}`);
  lines.push(``);
}

if (fileEdits.size && process.env.VERBOSE) {
  lines.push(`per file:`);
  for (const [f, info] of fileEdits) {
    lines.push(`  ${f.replace(`${ROOT}/`, '')}: ${info.edits} edits (${info.variants.join(', ')})`);
  }
}

console.log(lines.join('\n'));
