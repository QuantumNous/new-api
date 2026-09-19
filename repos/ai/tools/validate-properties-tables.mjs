#!/usr/bin/env node
// Validates <PropertiesTable> usage in content/**/*.mdx.
//
// The docs are rendered downstream (vercel/ai-studio), which maps every
// parameter through camelToKebab(parameter.name). A parameter object that is
// missing its `name` field crashes the static prerender with
// "Cannot read properties of undefined (reading 'replace')". Nothing in this
// repo renders the MDX, so such mistakes are invisible here until the
// downstream build breaks. This script catches them in CI.
//
// Rules:
//   - The `content={[...]}` attribute is a list of parameter objects.
//   - Each parameter object must have a string `name`.
//   - A parameter may carry a nested `properties: [...]` of group objects.
//   - Each group object holds a `parameters: [...]` list of parameter objects
//     (recurse, same `name` requirement).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { globSync } from 'node:fs';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const files = globSync('content/**/*.mdx', { cwd: repoRoot }).sort();

const errors = [];

for (const rel of files) {
  const abs = resolve(repoRoot, rel);
  const source = readFileSync(abs, 'utf8');

  for (const { code, offset } of extractPropertiesTableContents(source)) {
    // Parse `[...]` as an expression by wrapping it in an assignment.
    const wrapped = `const __x = ${code};`;
    const sf = ts.createSourceFile(
      'snippet.ts',
      wrapped,
      ts.ScriptTarget.Latest,
      true,
    );
    const wrapPrefix = 'const __x = '.length;

    const decl = sf.statements[0];
    const arrayLiteral = decl?.declarationList?.declarations?.[0]?.initializer;
    if (!arrayLiteral || !ts.isArrayLiteralExpression(arrayLiteral)) continue;

    validateParameterList(arrayLiteral, ({ pos, message }) => {
      // Map the snippet position back to the original file line/column.
      const snippetPos = pos - wrapPrefix + offset;
      const lc = lineColAt(source, snippetPos);
      errors.push({ file: rel, line: lc.line, column: lc.column, message });
    });
  }
}

if (errors.length > 0) {
  console.error(
    `\n✖ Found ${errors.length} invalid <PropertiesTable> parameter(s):\n`,
  );
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line}:${e.column} — ${e.message}`);
  }
  console.error(
    '\nEvery parameter object in a <PropertiesTable> `content` or nested ' +
      '`parameters` array must declare a string `name`.\n',
  );
  process.exit(1);
}

console.log(
  `✓ Validated <PropertiesTable> usage in ${files.length} MDX file(s).`,
);

// --- helpers ---------------------------------------------------------------

// Finds every `<PropertiesTable ... content={ <expr> } ... />` and returns the
// `content` expression source plus its offset in the original file.
function extractPropertiesTableContents(source) {
  const results = [];
  const tagRe = /<PropertiesTable\b/g;
  let m;
  while ((m = tagRe.exec(source)) !== null) {
    const attrIdx = source.indexOf('content', m.index);
    if (attrIdx === -1) continue;
    const eqIdx = source.indexOf('=', attrIdx);
    const braceIdx = source.indexOf('{', eqIdx);
    if (braceIdx === -1) continue;
    const end = matchBalanced(source, braceIdx, '{', '}');
    if (end === -1) continue;
    // Strip the outer JSX braces to leave the bare expression.
    const code = source.slice(braceIdx + 1, end);
    results.push({ code, offset: braceIdx + 1 });
  }
  return results;
}

// Returns the index of the closing delimiter matching the opener at `start`.
function matchBalanced(source, start, open, close) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function validateParameterList(arrayLiteral, report) {
  for (const el of arrayLiteral.elements) {
    if (!ts.isObjectLiteralExpression(el)) continue;
    const name = getProp(el, 'name');
    if (!name || !ts.isStringLiteralLike(name.initializer)) {
      report({
        pos: el.getStart(),
        message: 'parameter object is missing a string `name`',
      });
    }
    // Recurse into nested groups: properties: [{ type, parameters: [...] }]
    const properties = getProp(el, 'properties');
    if (properties && ts.isArrayLiteralExpression(properties.initializer)) {
      for (const group of properties.initializer.elements) {
        if (!ts.isObjectLiteralExpression(group)) continue;
        const params = getProp(group, 'parameters');
        if (params && ts.isArrayLiteralExpression(params.initializer)) {
          validateParameterList(params.initializer, report);
        }
      }
    }
  }
}

function getProp(objLiteral, name) {
  return objLiteral.properties.find(
    p =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === name,
  );
}

function lineColAt(source, pos) {
  let line = 1;
  let lastNl = -1;
  for (let i = 0; i < pos && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      lastNl = i;
    }
  }
  return { line, column: pos - lastNl };
}
