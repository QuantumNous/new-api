// helpers.mjs — shared fixtures + runners for the agent-script tests.
// Run from the repo root with `npm test`, or directly:
//   node --test 'skills/baoyu-design/agents/tests/*.test.mjs'

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const AGENTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

// per-test temp dir, removed when the test (incl. subtests) finishes
export function tmpdir(t, prefix = 'baoyu-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export function write(root, relPath, content) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

export const read = (root, relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');
export const exists = (root, relPath) => fs.existsSync(path.join(root, relPath));
export const readJson = (root, relPath) => JSON.parse(read(root, relPath));

export function runScript(script, args = [], opts = {}) {
  return spawnSync(process.execPath, [path.join(AGENTS_DIR, script), ...args], {
    encoding: 'utf8',
    timeout: 120_000,
    ...opts,
  });
}

// A small but complete design system in the authoring convention: global CSS
// with an @import closure + @font-face + brand font, annotated tokens, two
// component modules (one importing the other so bundle ordering matters), a
// constant export, a non-module PascalCase helper, a @dsCard card, a component
// and a screen @startingPoint, a *.prompt.md, and a README. Designed to parse
// with ZERO issues so CLI tests can assert the clean path.
export function makeDsFixture(root) {
  write(root, 'tokens.css', `:root {
  --colorPrimary: #3366ff;
  --colorAccent: var(--colorPrimary);
  --spacingMd: 16px;
  --shadowCard: 0 2px 8px rgba(0, 0, 0, 0.2);
  --fontFamilyBase: 'Acme Sans', sans-serif; /* @kind font */
  --easeSnappy: cubic-bezier(0.2, 0, 0, 1); /* @kind other */
}
`);
  write(root, 'styles.css', `@import "./tokens.css";

@font-face {
  font-family: 'Inter Local';
  src: url("fonts/inter.woff2") format("woff2");
}

.btn { padding: var(--spacingMd); color: var(--colorPrimary); }
`);
  write(root, 'fonts/inter.woff2', 'not-a-real-font');

  write(root, 'components/Button.jsx', `import React from 'react';
import { Zicon } from './Zicon.jsx';

export function Button({ variant = 'primary', disabled, label, onClick }) {
  return (
    <button className={'btn btn-' + variant} disabled={disabled} onClick={onClick}>
      <Zicon name="dot" />
      {label}
    </button>
  );
}

export const BUTTON_SIZES = ['sm', 'md'];
`);
  write(root, 'components/Button.d.ts', `/** @startingPoint section="Forms" subtitle="Primary action" */
export type ButtonVariant = 'primary' | 'ghost' | 'danger';

export interface ButtonProps {
  /** @default primary */
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: (e: any) => void;
  label: string;
}
`);
  write(root, 'components/Button.prompt.md', `Button — the primary action trigger. Use one per view.

\`\`\`jsx
<Button label="Save" variant="primary" />
\`\`\`

Longer guidance that should not make it into the excerpt because the fence above ends it.
`);

  write(root, 'components/Zicon.jsx', `export function Zicon({ name }) {
  return <span className="icon" data-name={name} />;
}
`);
  write(root, 'components/Zicon.d.ts', `export interface ZiconProps {
  name: string;
}
`);

  // PascalCase export without a .d.ts: bundled + exposed, but not a module component
  write(root, 'helpers/Badge.jsx', `export function Badge({ children }) {
  return <em className="badge">{children}</em>;
}
`);

  write(root, 'cards/buttons.html', `<!-- @dsCard group="Forms" name="Buttons" subtitle="All button variants" -->
<!doctype html>
<html><head><link rel="stylesheet" href="../styles.css"></head>
<body><button class="btn btn-primary">Save</button></body></html>
`);

  write(root, 'screens/home/index.html', `<!-- @startingPoint section="Screens" subtitle="Landing" -->
<!doctype html>
<html><head><link rel="stylesheet" href="../../styles.css"></head>
<body><main>Home</main></body></html>
`);

  write(root, 'README.md', `# Acme Design System

A tiny fixture system used by the test suite.
`);
  return root;
}
