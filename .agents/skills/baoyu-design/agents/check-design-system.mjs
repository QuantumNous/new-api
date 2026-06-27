#!/usr/bin/env node
// check-design-system.mjs — READ-ONLY validator for a portable design system.
// Usage: node check-design-system.mjs <projectDir> [--verbose]
//
// Reimplements the web product's `check_design_system` tool: it parses the
// design-system folder with ds-core (which writes NOTHING) and prints the
// namespace, components, @dsCard cards (by group), starting points, tokens and
// fonts, followed by any issues to fix. This script imports only ds-core and
// never writes to disk — that is what makes it safe to run as a read-only
// subagent. Run it after edits to confirm an edit registered; fix what it
// reports and run again until clean.

import { buildModel } from './lib/ds-core.mjs';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v') || args.includes('verbose');
const projectDir = args.find((a) => !a.startsWith('-') && a !== 'verbose');

if (!projectDir) {
  process.stderr.write('Usage: node check-design-system.mjs <projectDir> [--verbose]\n');
  process.exit(64);
}

let model;
try {
  model = buildModel(projectDir);
} catch (e) {
  process.stderr.write(`check-design-system: ${(e && e.message) || e}\n`);
  process.exit(1);
}

const {
  namespace, components, cards, startingPoints, tokens, fonts, brandFonts,
  unexposedExports, allSources, issues, globalCssEntry, tokenHist,
} = model;

// --- summary line ---
// Cap the inline inventory: a 9000-component .fig import would otherwise bury
// the verdict in one ~150 KB line. --verbose still prints the full export map.
const COMPONENTS_SHOWN = 40;
const constantExports = components.filter((c) => c.kind === 'constant');
const realComponents = components.filter((c) => c.kind !== 'constant');
const constSeg = constantExports.length
  ? ` (+${constantExports.length} constant export${constantExports.length === 1 ? '' : 's'}: ${constantExports.map((c) => c.name).join(', ')})`
  : '';
const compSeg = realComponents.length
  ? `Components: ${realComponents.length}${constSeg} (${realComponents.slice(0, COMPONENTS_SHOWN).map((c) => c.name).join(', ')}${
      realComponents.length > COMPONENTS_SHOWN ? `, … +${realComponents.length - COMPONENTS_SHOWN} more — full list with --verbose` : ''}).`
  : `Components: (none)${constSeg}.`;

let cardSeg;
if (cards.length) {
  const byGroup = {};
  for (const c of cards) byGroup[c.group] = (byGroup[c.group] || 0) + 1;
  const groups = Object.keys(byGroup).sort().map((g) => `${g}: ${byGroup[g]}`).join(', ');
  cardSeg = `@dsCard cards: ${cards.length} (${groups}).`;
} else {
  cardSeg = '@dsCard cards: 0 (none — tag any .html with <!-- @dsCard group="…" --> on line 1).';
}

const spSeg = startingPoints.length
  ? `Starting points: ${startingPoints.length} (${startingPoints.map((s) => s.name).join(', ')}).`
  : 'Starting points: (none).';

const fontSeg = fonts.length
  ? `Fonts: ${fonts.map((f) => f.family).join(', ')}.`
  : 'Fonts: (none).';

const summary =
  `Namespace: ${namespace} (use \`const { X } = window.${namespace}\` in @dsCard HTML). ` +
  `${compSeg} ${cardSeg} ${spSeg} Tokens: ${tokens.length}. ${fontSeg}`;

const lines = [summary];

if (issues.length) {
  lines.push('');
  lines.push('Issues to fix:');
  lines.push('');
  for (const i of issues) lines.push(`• ${i}`);
} else {
  lines.push('');
  lines.push('No issues — clean. ✅');
}

if (verbose) {
  lines.push('');
  lines.push('Token kinds: ' + Object.keys(tokenHist).sort()
    .map((k) => `${k} ${tokenHist[k]}`).join(', ') + '.');
  if (brandFonts.length) {
    lines.push('Brand fonts (no @font-face — falls back to a system font): ' +
      brandFonts.map((b) => `${b.family} [${b.tokens.join(', ')}]`).join('; ') + '.');
  }
  lines.push('');
  lines.push('Export map (✓ = exposed on window namespace; lowercase names compile but are NOT exposed):');
  for (const s of allSources) {
    if (!s.exports.length) {
      lines.push(`  ${s.path}: (no exports${s.isModule ? '' : ', not a component module'})`);
      continue;
    }
    for (const name of s.exports) {
      const exposed = s.isModule && /^[A-Z]/.test(name);
      lines.push(`  ${exposed ? '✓' : '·'} ${name} — ${s.path}`);
    }
  }
}

process.stdout.write(lines.join('\n') + '\n');

// hard error: nothing to validate without a token entry point
process.exit(globalCssEntry ? 0 : 2);
