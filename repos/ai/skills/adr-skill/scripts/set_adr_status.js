#!/usr/bin/env node
/**
 * Update an ADR's status in-place.
 *
 * Supported patterns:
 * - Bullet status: "- Status: proposed" or "* Status: proposed"
 * - Nygard-style section: "## Status" followed by a single-line status value
 */

const fs = require('node:fs');
const path = require('node:path');

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(
      [
        'Usage: node set_adr_status.js <path> --status <value> [--json]',
        '',
        'Example:',
        '  node set_adr_status.js adr/2025-06-15-foo.md --status accepted',
        '',
      ].join('\n'),
    );
    process.exit(0);
  }

  if (argv.length < 3) die('Missing <path>');
  const file = argv[2];

  let status = null;
  let json = false;
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--status') {
      if (i + 1 >= argv.length) die('Missing value for --status');
      status = argv[++i];
    } else if (a === '--json') {
      json = true;
    } else {
      die(`Unknown arg: ${a}`);
    }
  }
  if (!status) die('Missing required --status');
  return { file, status: String(status).trim(), json };
}

function setYamlFrontMatterStatus(lines, newStatus) {
  // YAML front matter: starts with '---', ends with next '---'
  if (lines.length < 2 || lines[0].trim() !== '---')
    return { lines, changed: false };

  let changed = false;
  const out = [];
  let inFrontMatter = true;
  let passedOpening = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (i === 0 && line.trim() === '---') {
      passedOpening = true;
      out.push(line);
      continue;
    }

    if (passedOpening && inFrontMatter && line.trim() === '---') {
      inFrontMatter = false;
      out.push(line);
      continue;
    }

    if (passedOpening && inFrontMatter && /^status\s*:/.test(line)) {
      out.push(`status: ${newStatus}`);
      changed = true;
      continue;
    }

    out.push(line);
  }

  return { lines: out, changed };
}

function setBulletStatus(lines, newStatus) {
  let changed = false;
  const out = lines.map(line => {
    const m = line.match(/^([*-])\s*Status:\s*(.*)$/);
    if (!m) return line;
    changed = true;
    return `${m[1]} Status: ${newStatus}`;
  });
  return { lines: out, changed };
}

function setSectionStatus(lines, newStatus) {
  let changed = false;
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);

    if (!/^##\s+Status\s*$/.test(lines[i])) continue;

    // Replace next non-empty, non-heading line. If not found, insert.
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') {
      out.push(lines[j]);
      j++;
    }

    if (j < lines.length && !/^##\s+/.test(lines[j])) {
      out.push(newStatus);
      changed = true;
      i = j; // skip original status line
      continue;
    }

    out.push(newStatus);
    changed = true;
    i = j - 1;
  }

  return { lines: out, changed };
}

function main() {
  const args = parseArgs(process.argv);
  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) die(`File not found: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf8');
  const hadTrailingNewline = content.endsWith('\n');
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  let r = setYamlFrontMatterStatus(lines, args.status);
  if (!r.changed) r = setBulletStatus(lines, args.status);
  if (!r.changed) r = setSectionStatus(lines, args.status);
  if (!r.changed) {
    die(
      "Could not find a status to update. Expected YAML front matter 'status:', '- Status:'/'* Status:', or a '## Status' section.",
    );
  }

  const newContent = r.lines.join('\n') + (hadTrailingNewline ? '\n' : '');
  fs.writeFileSync(filePath, newContent, 'utf8');

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({
        filePath,
        fileRelPath: toPosix(path.relative(process.cwd(), filePath)),
        status: args.status,
        changed: true,
      })}\n`,
    );
  } else {
    process.stdout.write(`${filePath}\n`);
  }
}

main();
