// Unit tests for agents/lib/ds-prompt.mjs — the generated _ds_prompt.md.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderDsPrompt,
  extractPromptExcerpt,
  sampleComponentNames,
} from '../lib/ds-prompt.mjs';

// --- sampleComponentNames --------------------------------------------------------

test('sampleComponentNames prefers PascalCase components over constants', () => {
  assert.deepEqual(
    sampleComponentNames(['ICON_NAMES', 'Button', 'Card', 'Alert']),
    ['Button', 'Card'],
  );
  // all-constant list falls back to the raw list
  assert.deepEqual(sampleComponentNames(['A_B', 'C_D']), ['A_B', 'C_D']);
  assert.deepEqual(sampleComponentNames([]), []);
  assert.deepEqual(sampleComponentNames(['Button'], 1), ['Button']);
});

// --- extractPromptExcerpt --------------------------------------------------------

test('extractPromptExcerpt keeps prose plus the first complete fence', () => {
  const text = 'Button — what & when.\n\n```jsx\n<Button />\n```\n\nMore docs after.\n';
  assert.equal(extractPromptExcerpt(text), 'Button — what & when.\n\n```jsx\n<Button />\n```');
});

test('extractPromptExcerpt caps prose lines (blank lines free)', () => {
  const text = 'a\n\nb\nc\nd\ne\nf\ng\n';
  assert.equal(extractPromptExcerpt(text, 3), 'a\n\nb\nc');
});

test('extractPromptExcerpt truncates an overlong block but re-closes the fence', () => {
  const body = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n');
  const out = extractPromptExcerpt(`Intro.\n\n\`\`\`jsx\n${body}\n\`\`\`\n`, 5, 14);
  const lines = out.split('\n');
  assert.equal(lines.filter((l) => l.startsWith('```')).length, 2, 'fence stays balanced');
  assert.ok(out.includes('line14') && !out.includes('line15'));
  assert.equal(lines[lines.length - 1], '```');
});

test('extractPromptExcerpt re-closes an unclosed fence and drops an empty one', () => {
  assert.equal(extractPromptExcerpt('P.\n\n```jsx\nx'), 'P.\n\n```jsx\nx\n```');
  assert.equal(extractPromptExcerpt('Only prose.\n\n```jsx\n```\n'), 'Only prose.');
  assert.equal(extractPromptExcerpt('\n\n  \nFirst.\n'), 'First.');
  assert.equal(extractPromptExcerpt(null), '');
});

// --- renderDsPrompt --------------------------------------------------------------

const baseArgs = {
  name: 'Acme',
  slug: 'acme',
  namespace: 'Acme_abc123',
  globalCssPaths: ['tokens.css', 'styles.css'],
  componentNames: ['Button', 'ICON_NAMES'],
  componentProps: [
    {
      name: 'Button',
      props: [
        { name: 'variant', values: ['primary', 'ghost'], default: 'primary' },
        { name: 'onClick', type: '(e: any) => void' },
        { name: 'label', type: 'string' },
      ],
    },
    { name: 'ICON_NAMES', kind: 'constant' },
  ],
  componentPrompts: [{ relPath: 'components/Button.prompt.md', excerpt: 'Button — usage.' }],
  readme: '# Acme guide\n\nRules here.',
  tokenNames: ['--b', '--a', '--a'],
  sourcePath: 'designs/acme',
  hasBundle: true,
};

test('renderDsPrompt composable: bundle wiring, samples, props, tokens, guide', () => {
  const md = renderDsPrompt(baseArgs);

  assert.ok(md.includes('**Acme** design system'));
  assert.ok(md.includes('Loading the bundle is how you use this design system.'));
  assert.ok(md.includes('<script src="_ds/acme/_ds_bundle.js"></script>'));
  assert.ok(md.includes('<link rel="stylesheet" href="_ds/acme/tokens.css">'));
  // sample destructure skips the constant export
  assert.ok(md.includes('const { Button } = window.Acme_abc123;'));
  assert.ok(md.includes('react@18.3.1'), 'pinned React UMD tags ride along');
  assert.ok(md.includes('@babel/standalone'));
  assert.ok(md.includes('never give a top-level binding a window-global name'));

  // prop contracts: enum with default star, function type folded, constant skipped
  assert.ok(md.includes('variant: primary* | ghost'));
  assert.ok(md.includes('onClick: function'));
  assert.ok(!md.includes('ICON_NAMES —'));

  // token allowlist sorted + deduped
  assert.ok(md.includes('--a, --b'));
  assert.ok(md.includes('The 2 custom properties'));

  // guide + excerpts + source pointer
  assert.ok(md.includes('<design-system-guide>') && md.includes('# Acme guide'));
  assert.ok(md.includes('### components/Button.prompt.md'));
  assert.ok(md.includes('`designs/acme/`'));
  assert.ok(md.endsWith('\n'));
});

test('renderDsPrompt stylesheet-only system skips bundle wiring', () => {
  const md = renderDsPrompt({ ...baseArgs, hasBundle: false, componentNames: [], componentProps: [] });
  assert.ok(md.includes('Loading the stylesheet(s) is how you use this design system.'));
  assert.ok(!md.includes('_ds_bundle.js'));
  assert.ok(!md.includes('react@18.3.1'));
});

test('renderDsPrompt bundle without components explains itself', () => {
  const md = renderDsPrompt({ ...baseArgs, componentNames: [], componentProps: [] });
  assert.ok(md.includes('currently exports no components'));
  assert.ok(md.includes('_ds_bundle.js'));
});

test('renderDsPrompt tolerates an empty call', () => {
  const md = renderDsPrompt();
  assert.ok(md.includes('design system'));
});
