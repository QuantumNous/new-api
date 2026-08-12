#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { argv, stdin, stdout, stderr } from 'node:process';

const categories = [
  ['breaking', '### Breaking Changes 🍭'],
  ['feat', '### New Features 🎉'],
  ['perf', '### Performance 🚀'],
  ['fix', '### Bug Fixes 🐞'],
  ['refactor', '### Refactor 🔨'],
  ['docs', '### Document 📖'],
  ['other', '### Other Changes'],
];

const typeMap = {
  feat: 'feat',
  feature: 'feat',
  perf: 'perf',
  fix: 'fix',
  refactor: 'refactor',
  docs: 'docs',
  doc: 'docs',
};

const itemRE = /^[*-]\s+([a-zA-Z]+)(?:\([^)]+\))?(!)?:\s+/;
const joinedItemRE = /(?<!^)(?=\*\s+[a-zA-Z]+(?:\([^)]+\))?!?:\s+)/g;

async function readMarkdown(input) {
  if (input && input !== '-') {
    return readFile(input, 'utf8');
  }

  let markdown = '';
  stdin.setEncoding('utf8');

  for await (const chunk of stdin) {
    markdown += chunk;
  }

  return markdown;
}

function classify(item) {
  const match = itemRE.exec(item);

  if (!match) {
    return 'other';
  }

  const type = match[1].toLowerCase();

  if (match[2] === '!' || type === 'breaking' || type === 'break') {
    return 'breaking';
  }

  return typeMap[type] ?? 'other';
}

function organize(markdown) {
  const heading = /^##\s+What's Changed\s*$/m.exec(markdown);

  if (!heading) {
    throw new Error("Could not find a `## What's Changed` section.");
  }

  const bodyStart = heading.index + heading[0].length;
  const afterHeading = markdown.slice(bodyStart);
  const nextSection = /^(?:##\s+|\*\*Full Changelog\*\*:)/m.exec(afterHeading);
  const bodyEnd = nextSection ? bodyStart + nextSection.index : markdown.length;
  const grouped = Object.fromEntries(categories.map(([key]) => [key, []]));
  const preserved = [];

  for (const rawLine of markdown.slice(bodyStart, bodyEnd).split('\n')) {
    for (const line of rawLine.split(joinedItemRE)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('### ')) {
        continue;
      }

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        grouped[classify(trimmed)].push(trimmed);
      } else {
        preserved.push(line);
      }
    }
  }

  const lines = preserved.filter((line) => line.trim());

  for (const [key, title] of categories) {
    if (grouped[key].length > 0) {
      lines.push(title, ...grouped[key]);
    }
  }

  if (lines.length === 0) {
    return markdown;
  }

  const prefix = markdown.slice(0, bodyStart).trimEnd();
  const suffix = markdown.slice(bodyEnd).replace(/^\n+/, '');

  return suffix
    ? `${prefix}\n${lines.join('\n')}\n\n${suffix}`
    : `${prefix}\n${lines.join('\n')}\n`;
}

try {
  if (argv.length > 3) {
    throw new Error('Usage: create-draft-release-notes.mjs [release-notes.md]');
  }

  stdout.write(organize(await readMarkdown(argv[2])));
} catch (error) {
  stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
