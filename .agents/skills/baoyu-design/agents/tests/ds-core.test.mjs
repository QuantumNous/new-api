// Unit tests for agents/lib/ds-core.mjs — the read-only design-system parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  buildModel,
  parseDtsInterfaces,
  pascalCase,
  collectExports,
  classifyByValue,
  makeResolver,
  riskyTopLevelGlobals,
} from '../lib/ds-core.mjs';
import { tmpdir, write, makeDsFixture } from './helpers.mjs';

// --- pascalCase ----------------------------------------------------------------

test('pascalCase', () => {
  assert.equal(pascalCase('acme-design'), 'AcmeDesign');
  assert.equal(pascalCase('my_cool.system'), 'MyCoolSystem');
  assert.equal(pascalCase('myCoolDS'), 'MyCoolDS');
  assert.equal(pascalCase(''), 'DesignSystem');
});

// --- classifyByValue + makeResolver ----------------------------------------------

test('classifyByValue classifies by resolved value', () => {
  const id = (v) => v;
  assert.equal(classifyByValue('#3366ff', id), 'color');
  assert.equal(classifyByValue('oklch(0.7 0.1 200)', id), 'color');
  assert.equal(classifyByValue('transparent', id), 'color');
  assert.equal(classifyByValue('1.5rem', id), 'spacing');
  assert.equal(classifyByValue('0 2px 8px rgba(0,0,0,.2)', id), 'shadow');
  assert.equal(classifyByValue('bold', id), null);
});

test('makeResolver follows var() chains and fallbacks', () => {
  const resolve = makeResolver(new Map([
    ['--a', '#fff'],
    ['--b', 'var(--a)'],
    ['--loop', 'var(--loop)'],
  ]));
  assert.equal(resolve('var(--b)'), '#fff');
  assert.equal(resolve('var(--missing, 4px)'), '4px');
  assert.equal(classifyByValue('var(--b)', resolve), 'color');
  // self-referencing chains terminate via the depth cap instead of hanging
  assert.equal(typeof resolve('var(--loop)'), 'string');
});

// --- collectExports --------------------------------------------------------------

test('collectExports finds every export style in source order', () => {
  const src = `
export function Alpha() {}
export const beta = 1;
export class Gamma {}
const Delta = 1, Eps = 2;
export { Delta, Eps as Zeta };
export default class Omega {}
`;
  assert.deepEqual(collectExports(src), ['Alpha', 'beta', 'Gamma', 'Delta', 'Zeta', 'Omega']);
});

test('collectExports dedupes and ignores default in named lists', () => {
  const src = 'export function X() {}\nexport { X, default as Y };\n';
  assert.deepEqual(collectExports(src), ['X', 'Y']);
});

// --- parseDtsInterfaces -----------------------------------------------------------

test('parseDtsInterfaces reads flat interfaces, unions, aliases, defaults', () => {
  const dts = `
export type Size =
  | 'sm'
  | 'md'
  | 'lg';

export interface ButtonProps {
  /** @default primary */
  variant?: 'primary' | "ghost";
  size?: Size;
  onClick?: (e: any) => void;
  label: string;
}
`;
  const ifaces = parseDtsInterfaces(dts);
  assert.equal(ifaces.length, 1);
  const props = Object.fromEntries(ifaces[0].props.map((p) => [p.name, p]));
  assert.deepEqual(props.variant.values, ['primary', 'ghost']);
  assert.equal(props.variant.default, 'primary');
  assert.deepEqual(props.size.values, ['sm', 'md', 'lg']); // one alias hop
  assert.equal(props.onClick.type, '(e: any) => void');
  assert.equal(props.label.type, 'string');
});

test('parseDtsInterfaces fails open on unreadable members', () => {
  const ifaces = parseDtsInterfaces('interface P { meta?: { a: number, b: string }; }');
  assert.equal(ifaces[0].props[0].name, 'meta');
  assert.ok(ifaces[0].props[0].type); // kept as a plain type, no values
  assert.deepEqual(parseDtsInterfaces(''), []);
});

// --- riskyTopLevelGlobals ----------------------------------------------------------

test('riskyTopLevelGlobals flags window-global collisions in text/babel blocks', () => {
  const html = `
<script type="text/babel">
const status = 'ok';
let { name } = props;
  const top = 1;
const safe = \`const location = 1;\`;
// const close = 1;
const statusBadge = 'fine';
</script>
<script>
const open = 1;
</script>
`;
  const found = riskyTopLevelGlobals(html).sort();
  // indented `top`, template-literal `location`, commented `close`, and the
  // non-babel block's `open` must all be ignored
  assert.deepEqual(found, ['name', 'status']);
});

test('riskyTopLevelGlobals handles destructured renames', () => {
  const html = '<script type="text/babel">\nconst { open: openItems, parent } = props;\n</script>';
  assert.deepEqual(riskyTopLevelGlobals(html), ['parent']);
});

// --- buildModel: the clean fixture --------------------------------------------------

test('buildModel parses the clean fixture without issues', (t) => {
  const root = makeDsFixture(tmpdir(t));
  const model = buildModel(root);

  assert.deepEqual(model.issues, []);
  assert.equal(model.globalCssEntry, 'styles.css');
  // post-order @import closure: imports before importer
  assert.deepEqual(model.globalCssPaths, ['tokens.css', 'styles.css']);

  // tokens + classification (annotated tokens keep their @kind)
  const kinds = Object.fromEntries(model.tokens.map((tk) => [tk.name, tk.kind]));
  assert.equal(kinds['--colorPrimary'], 'color');
  assert.equal(kinds['--colorAccent'], 'color'); // via var() resolution
  assert.equal(kinds['--spacingMd'], 'spacing');
  assert.equal(kinds['--shadowCard'], 'shadow');
  assert.equal(kinds['--fontFamilyBase'], 'font');
  assert.equal(kinds['--easeSnappy'], 'other');
  assert.deepEqual(model.unclassified, []);

  // components: module exports only; constants marked; props from .d.ts
  const byName = Object.fromEntries(model.components.map((c) => [c.name, c]));
  assert.ok(byName.Button && byName.Zicon);
  assert.equal(byName.BUTTON_SIZES.kind, 'constant');
  assert.ok(!byName.Badge, 'non-module exports are not components');
  const variant = byName.Button.props.find((p) => p.name === 'variant');
  assert.deepEqual(variant.values, ['primary', 'ghost', 'danger']);
  assert.equal(variant.default, 'primary');

  // cards + starting points
  assert.equal(model.cards.length, 1);
  assert.equal(model.cards[0].group, 'Forms');
  assert.equal(model.cards[0].name, 'Buttons');
  assert.deepEqual(
    model.startingPoints.map((s) => [s.name, s.kind]),
    [['Button', 'component'], ['home', 'screen']],
  );

  // fonts: @font-face family detected, token-only family reported as brand font
  assert.deepEqual(model.fonts.map((f) => f.family), ['inter local']);
  assert.deepEqual(model.brandFonts.map((b) => b.family), ['Acme Sans']);

  // namespace: deterministic PascalCase_hash6
  assert.match(model.namespace, /^[A-Za-z0-9]+_[0-9a-f]{6}$/);
  assert.equal(buildModel(root).namespace, model.namespace);
});

test('buildModel throws on a non-directory', () => {
  assert.throws(() => buildModel('/nonexistent/path/xyz'), /Not a directory/);
});

// --- buildModel: issue detection ----------------------------------------------------

test('buildModel reports a missing global CSS entry', (t) => {
  const root = tmpdir(t);
  write(root, 'components/X.jsx', 'export function X() { return null; }\n');
  const model = buildModel(root);
  assert.equal(model.globalCssEntry, null);
  assert.ok(model.issues.some((i) => /No global CSS entry/.test(i)));
});

test('buildModel reuses the namespace recorded in _ds_manifest.json', (t) => {
  const root = tmpdir(t);
  write(root, 'styles.css', ':root { --colorA: #000; }\n');
  write(root, '_ds_manifest.json', JSON.stringify({ namespace: 'Kept_abc123' }));
  assert.equal(buildModel(root).namespace, 'Kept_abc123');
});

test('buildModel flags duplicates, orphans, unclassified tokens, missing font src', (t) => {
  const root = tmpdir(t);
  write(root, 'styles.css', `:root { --zIndexModal: 100; }
@font-face { font-family: 'Ghost'; src: url("missing.woff2"); }
`);
  write(root, 'A.jsx', 'export function Dup() { return null; }\n');
  write(root, 'A.d.ts', 'export interface DupProps {}\n');
  write(root, 'B.jsx', 'export function Dup() { return null; }\n');
  write(root, 'B.d.ts', 'export interface DupProps {}\n');
  write(root, 'Lonely.d.ts', 'export interface LonelyProps {}\n');
  const { issues, unclassified } = buildModel(root);

  assert.ok(issues.some((i) => /Duplicate component name `Dup`/.test(i)));
  assert.ok(issues.some((i) => /Orphan `Lonely\.d\.ts`/.test(i)));
  assert.ok(issues.some((i) => /@font-face src not found/.test(i)));
  assert.deepEqual(unclassified, ['--zIndexModal']);
  assert.ok(issues.some((i) => /couldn't be classified/.test(i)));
});

test('buildModel flags HTML that sources a component module directly', (t) => {
  const root = makeDsFixture(tmpdir(t));
  write(root, 'page.html', '<html><body><script src="components/Button.jsx"></script></body></html>\n');
  const { issues } = buildModel(root);
  assert.ok(issues.some((i) => /sources component module `components\/Button\.jsx` directly/.test(i)));
});

test('buildModel flags risky top-level globals in card HTML', (t) => {
  const root = makeDsFixture(tmpdir(t));
  write(root, 'cards/bad.html', `<!-- @dsCard group="Forms" -->
<html><body><script type="text/babel">
const status = 'oops';
</script></body></html>
`);
  const { issues } = buildModel(root);
  assert.ok(issues.some((i) => /top-level `status`/.test(i)));
});

test('buildModel flags a stale namespace in the README', (t) => {
  const root = tmpdir(t);
  write(root, 'styles.css', ':root { --colorA: #000; }\n');
  write(root, 'README.md', '# X\n\nUse `window.Stale_aaaaaa.Button`.\n');
  const { issues } = buildModel(root);
  assert.ok(issues.some((i) => /stale namespace `window\.Stale_aaaaaa`/.test(i)));
});

test('buildModel skips phantom token matches across rule boundaries', (t) => {
  const root = tmpdir(t);
  write(root, 'styles.css', `.s2-btn--primary:hover { background: red; }
:root { --colorReal: #123456; }
`);
  const { tokens } = buildModel(root);
  assert.deepEqual(tokens.map((tk) => tk.name), ['--colorReal']);
});

test('buildModel survives a CSS @import cycle', (t) => {
  const root = tmpdir(t);
  write(root, 'styles.css', '@import "./other.css";\n:root { --colorA: #000; }\n');
  write(root, 'other.css', '@import "./styles.css";\n:root { --colorB: #fff; }\n');
  const model = buildModel(root);
  assert.deepEqual(model.globalCssPaths, ['other.css', 'styles.css']);
  assert.equal(model.tokens.length, 2);
});

// generated artifacts must never be parsed as source
test('buildModel ignores generated artifacts and skip-dirs', (t) => {
  const root = makeDsFixture(tmpdir(t));
  write(root, '_ds_bundle.js', 'window.x = 1;\n');
  write(root, 'node_modules/pkg/index.jsx', 'export function Evil() {}\n');
  write(root, 'vendor/v.jsx', 'export function Vendored() {}\n');
  const model = buildModel(root);
  const names = model.components.map((c) => c.name);
  assert.ok(!names.includes('Evil') && !names.includes('Vendored'));
  assert.ok(model.allSources.every((s) => !s.path.startsWith('node_modules/')));
});
