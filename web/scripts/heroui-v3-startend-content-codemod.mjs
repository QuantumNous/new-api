#!/usr/bin/env bun
/*
Copyright (C) 2025 QuantumNous

HeroUI v3 startContent / endContent codemod.

Phase 5 of web/TODO.md. v3 Button & Chip removed the startContent /
endContent props — icons must live in `children` and rely on the
component's built-in `gap-2` for spacing. Without this rewrite the
icon prop was silently ignored and ~135 buttons across the app shipped
without their leading / trailing icon.

What it does
------------
Walks every .jsx / .tsx file via @babel/parser, finds every
JSXAttribute named `startContent` or `endContent`, drops the attribute,
and injects the attribute's expression as the first / last child of
the surrounding JSX element. Source-level edits — preserves the rest
of the file as-is. Run `bun run lint:fix` after for prettier polish.

What it does NOT do
-------------------
- It does not assume v3 Chip — Chip still gets the same children
  treatment, but the v3 docs ask you to wrap the icon side-by-side
  with text, which is exactly what this codemod produces.
- It does not run on @heroui/styles internals or node_modules.

Usage
-----
    bun scripts/heroui-v3-startend-content-codemod.mjs           # apply
    bun scripts/heroui-v3-startend-content-codemod.mjs --dry     # report only
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const DRY_RUN = process.argv.includes('--dry');
const ROOT = new URL('../src', import.meta.url).pathname;

const files = execSync(`git ls-files '${ROOT}/**/*.jsx' '${ROOT}/**/*.tsx'`, {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

let touched = 0;
let edits = 0;
const skipped = [];

for (const file of files) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (!src.includes('startContent=') && !src.includes('endContent=')) {
    continue;
  }

  let ast;
  try {
    ast = parse(src, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties'],
      errorRecovery: true,
    });
  } catch (err) {
    skipped.push(`${file}: parse error — ${err.message}`);
    continue;
  }

  // Collect edits as { start, end, replacement } in *file* coordinates.
  // Apply them right-to-left so earlier offsets stay valid.
  const fileEdits = [];

  traverse(ast, {
    JSXAttribute(path) {
      const name = path.node.name?.name;
      if (name !== 'startContent' && name !== 'endContent') return;

      const value = path.node.value;
      if (!value || value.type !== 'JSXExpressionContainer') {
        // We only know how to migrate {expr} forms, not bare strings.
        skipped.push(
          `${file}:${path.node.loc?.start.line}: non-expression ${name} — leave for manual fix`,
        );
        return;
      }

      const exprNode = value.expression;
      const rawExprSource = src.slice(exprNode.start, exprNode.end);
      // JSXElement / JSXFragment children render as themselves (no
      // surrounding `{}`). Anything else (CallExpression, Identifier,
      // ConditionalExpression, …) needs to live inside a JSX expression
      // container or it would be parsed as plain text.
      // Examples:
      //   <Icon /> ({foo: 1})  →  no `{}`
      //   getIcon(p)           →  `{getIcon(p)}`
      //   isReady ? <A/> : <B/> → `{isReady ? <A/> : <B/>}`
      const isJsxValue =
        exprNode.type === 'JSXElement' || exprNode.type === 'JSXFragment';
      const exprSource = isJsxValue ? rawExprSource : `{${rawExprSource}}`;

      // Walk back over leading whitespace so the deletion swallows the
      // attribute's own line. This avoids leaving a blank gap between
      // surviving siblings.
      let attrStart = path.node.start;
      while (attrStart > 0 && /[ \t]/.test(src[attrStart - 1])) {
        attrStart--;
      }
      let attrEnd = path.node.end;
      // Also swallow the trailing newline so we don't leave a blank line.
      if (src[attrEnd] === '\n') attrEnd++;
      else if (src[attrEnd] === '\r' && src[attrEnd + 1] === '\n') attrEnd += 2;
      // If we ate the newline, we should *not* also swallow the leading
      // newline of the previous line.
      if (attrStart > 0 && src[attrStart - 1] === '\n') {
        // good — this attribute had its own line; the deletion now spans
        // [start-of-line .. end-of-line].
      } else {
        // Inline attribute (e.g. `<Button foo={x} startContent={<Y/>}>`).
        // Walk *forward* over a single trailing space so we don't leave
        // double spaces.
        if (src[attrEnd] === ' ') attrEnd++;
      }

      // Find the surrounding JSXElement.
      const opening = path.parentPath; // JSXOpeningElement
      const jsxElement = opening.parentPath; // JSXElement (or JSXFragment)
      if (
        !jsxElement ||
        jsxElement.node.type !== 'JSXElement' ||
        opening.node.type !== 'JSXOpeningElement'
      ) {
        skipped.push(
          `${file}:${path.node.loc?.start.line}: ${name} on non-JSXElement parent`,
        );
        return;
      }

      // If the element is self-closing, we have no children slot to inject
      // into. Convert <Foo startContent={<X/>} /> → <Foo><X/></Foo>.
      const selfClosing = opening.node.selfClosing;
      const tagName = src.slice(opening.node.name.start, opening.node.name.end);

      // Detect the indentation we should use for the injected child by
      // looking at the indentation of the line the opening tag starts on,
      // plus 2 spaces.
      const lineStart = src.lastIndexOf('\n', opening.node.start) + 1;
      const lineIndent = src.slice(lineStart).match(/^[ \t]*/)[0];
      const childIndent = lineIndent + '  ';

      // Drop the attribute.
      fileEdits.push({
        start: attrStart,
        end: attrEnd,
        replacement: '',
      });

      if (selfClosing) {
        // Convert `<Foo .../>` → `<Foo ...>{indent}<expr>{lineIndent}</Foo>`.
        // The opening node ends at the `/>`. Replace the trailing `/>` with `>`,
        // then append children + closing tag right after.
        const closingSlash = src.lastIndexOf('/>', opening.node.end);
        if (closingSlash === -1) {
          skipped.push(
            `${file}:${path.node.loc?.start.line}: self-closing without /> — skip`,
          );
          return;
        }
        fileEdits.push({
          start: closingSlash,
          end: closingSlash + 2,
          replacement: `>\n${childIndent}${exprSource}\n${lineIndent}</${tagName}>`,
        });
      } else {
        const openingEnd = opening.node.end; // index of `>` + 1
        const closingStart = jsxElement.node.closingElement?.start;
        if (closingStart == null) {
          skipped.push(
            `${file}:${path.node.loc?.start.line}: no closingElement found`,
          );
          return;
        }
        if (name === 'startContent') {
          fileEdits.push({
            start: openingEnd,
            end: openingEnd,
            replacement: `\n${childIndent}${exprSource}`,
          });
        } else {
          // endContent — insert *before* closingElement.
          // Find the start of the closing tag's line so we share indent.
          fileEdits.push({
            start: closingStart,
            end: closingStart,
            replacement: `${exprSource}\n${lineIndent}`,
          });
        }
      }
      edits++;
    },
  });

  if (fileEdits.length === 0) continue;

  fileEdits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of fileEdits) {
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end);
  }

  if (!DRY_RUN) {
    writeFileSync(file, out);
  }
  touched++;
}

const lines = [
  `${DRY_RUN ? '[dry-run] ' : ''}HeroUI v3 startContent / endContent codemod`,
  ``,
  `files touched: ${touched}`,
  `attribute edits: ${edits}`,
];

if (skipped.length) {
  lines.push(``, `manual review needed:`);
  for (const s of skipped) lines.push(`  ${s}`);
}

console.log(lines.join('\n'));
