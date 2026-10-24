#!/usr/bin/env node
/**
 * Create a new ADR markdown file using repo conventions and a template.
 *
 * Design goals:
 * - Safe defaults (auto-detect adr directory + numbering)
 * - No external deps
 * - Works even if the repo has no ADRs yet
 */

const fs = require('node:fs');
const path = require('node:path');

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function slugify(text) {
  const t = String(text || '')
    .trim()
    .toLowerCase();
  const noQuotes = t.replace(/['"`]/g, '');
  const dashed = noQuotes.replace(/[^a-z0-9]+/g, '-').replace(/-{2,}/g, '-');
  const trimmed = dashed.replace(/^-+/, '').replace(/-+$/, '');
  return trimmed || 'decision';
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function parseArgs(argv) {
  const out = {
    repoRoot: '.',
    dir: null,
    noCreateDir: false,
    title: null,
    status: 'proposed',
    template: 'simple', // simple | madr
    strategy: 'auto', // auto | date | slug
    deciders: '',
    consulted: '',
    informed: '',
    technicalStory: '',
    chosenOption: '',
    updateIndex: false,
    indexFile: null,
    json: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) die(`Missing value for ${a}`);
      return argv[++i];
    };

    if (a === '--repo-root') out.repoRoot = next();
    else if (a === '--dir') out.dir = next();
    else if (a === '--no-create-dir') out.noCreateDir = true;
    else if (a === '--title') out.title = next();
    else if (a === '--status') out.status = next();
    else if (a === '--template') out.template = next();
    else if (a === '--strategy') out.strategy = next();
    else if (a === '--deciders') out.deciders = next();
    else if (a === '--consulted') out.consulted = next();
    else if (a === '--informed') out.informed = next();
    else if (a === '--technical-story') out.technicalStory = next();
    else if (a === '--chosen-option') out.chosenOption = next();
    else if (a === '--update-index') out.updateIndex = true;
    else if (a === '--index-file') out.indexFile = next();
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        [
          'Usage: node new_adr.js --title "Choose database" [options]',
          '',
          'Options:',
          '  --repo-root <path>     Repo root (default: .)',
          '  --dir <path>           ADR directory (default: auto-detect, else adr/)',
          '  --no-create-dir        Do not create ADR directory if missing',
          '  --status <value>       ADR status (default: proposed)',
          '  --template simple|madr Template (default: simple)',
          '  --strategy auto|date|slug  Filename strategy (default: auto)',
          '  --deciders "a,b"      Deciders list',
          '  --consulted "a,b"     Consulted experts (RACI)',
          '  --informed "a,b"      Informed stakeholders (RACI)',
          '  --technical-story <x>  Issue/ticket/PR link or short ref',
          '  --chosen-option <x>    MADR template: chosen option label',
          '  --update-index         Update adr/README.md (or existing index)',
          '  --index-file <path>    Override index file (relative to repo root unless absolute)',
          '  --json                 Output machine-readable JSON (default: off)',
          '',
        ].join('\n'),
      );
      process.exit(0);
    } else {
      die(`Unknown arg: ${a}`);
    }
  }

  if (!out.title) die('Missing required --title');

  if (!['simple', 'madr'].includes(out.template))
    die(`Invalid --template: ${out.template}`);
  if (!['auto', 'date', 'slug'].includes(out.strategy))
    die(`Invalid --strategy: ${out.strategy}`);

  return out;
}

function detectAdrDir(repoRoot) {
  const candidates = [
    path.join(repoRoot, 'contributing', 'decisions'),
    path.join(repoRoot, 'docs', 'decisions'),
    path.join(repoRoot, 'adr'),
    path.join(repoRoot, 'docs', 'adr'),
    path.join(repoRoot, 'docs', 'adrs'),
    path.join(repoRoot, 'decisions'),
  ];
  for (const p of candidates) {
    try {
      if (fs.statSync(p).isDirectory()) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

function listMdFiles(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.md'))
    .map(e => e.name);
}

function detectStrategy(adrDir) {
  const md = listMdFiles(adrDir);
  for (const name of md) {
    if (/^\d{4}-\d{2}-\d{2}-/.test(name)) return 'date';
  }
  if (md.length > 0) return 'slug';
  return 'date';
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function loadTemplate(templateName) {
  const skillRoot = path.resolve(__dirname, '..');
  const templatePath = path.join(
    skillRoot,
    'assets',
    'templates',
    `adr-${templateName}.md`,
  );
  if (!fs.existsSync(templatePath)) die(`Template not found: ${templatePath}`);
  return fs.readFileSync(templatePath, 'utf8');
}

function renderTemplate(raw, vars) {
  // Handle YAML front matter placeholders (quoted and unquoted)
  let out = raw;

  // YAML front matter fields — replace the whole placeholder pattern
  // e.g. status: "{proposed | accepted | ...}" → status: proposed
  out = out.replace(
    /^(status:\s*)["']?\{[^}]*\}["']?\s*$/m,
    `$1${vars.status}`,
  );
  out = out.replace(/^(date:\s*)\{[^}]*\}\s*$/m, `$1${vars.date}`);
  out = out.replace(
    /^(decision-makers:\s*)["']?\{[^}]*\}["']?\s*$/m,
    `$1${vars.deciders || ''}`,
  );

  // consulted / informed: replace if a value was provided, otherwise remove the
  // entire line so we don't leak placeholder text like "{list everyone...}"
  if (vars.consulted) {
    out = out.replace(
      /^(consulted:\s*)["']?\{[^}]*\}["']?\s*$/m,
      `$1${vars.consulted}`,
    );
  } else {
    out = out.replace(/^consulted:\s*["']?\{[^}]*\}["']?\s*\n/m, '');
  }
  if (vars.informed) {
    out = out.replace(
      /^(informed:\s*)["']?\{[^}]*\}["']?\s*$/m,
      `$1${vars.informed}`,
    );
  } else {
    out = out.replace(/^informed:\s*["']?\{[^}]*\}["']?\s*\n/m, '');
  }

  // Replace MADR-style heading placeholder
  out = out.replace(/^(#\s+)\{short title[^}]*\}\s*$/m, `$1${vars.title}`);

  // Inline placeholders (title in heading, etc.)
  out = out
    .replaceAll('{TITLE}', vars.title)
    .replaceAll('{STATUS}', vars.status)
    .replaceAll('{DATE}', vars.date)
    .replaceAll('{DECIDERS}', vars.deciders)
    .replaceAll('{TECHNICAL_STORY}', vars.technicalStory)
    .replaceAll('{CHOSEN_OPTION}', vars.chosenOption);

  return out;
}

function chooseIndexFile(adrDir) {
  for (const name of ['README.md', 'index.md']) {
    const p = path.join(adrDir, name);
    if (fs.existsSync(p)) return p;
  }
  return path.join(adrDir, 'README.md');
}

function insertIndexEntryUnderHeading(lines, headingRegex, entryLine) {
  // Returns { lines, inserted }
  const headingIndex = lines.findIndex(l => headingRegex.test(l));
  if (headingIndex === -1) return { lines, inserted: false };

  let sectionEnd = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  // Prefer inserting at end of list in this section if there is a list.
  let lastListItem = -1;
  for (let i = sectionEnd - 1; i > headingIndex; i--) {
    if (/^[-*]\s+/.test(lines[i])) {
      lastListItem = i;
      break;
    }
  }

  const insertAt = lastListItem !== -1 ? lastListItem + 1 : sectionEnd;

  const out = [...lines];

  // Ensure there's a blank line after the heading if we're inserting immediately after it.
  if (insertAt === headingIndex + 1 && out[insertAt] !== '') {
    out.splice(insertAt, 0, '');
  }

  out.splice(insertAt, 0, entryLine);
  return { lines: out, inserted: true };
}

function updateIndex(indexFile, { relLink, title, status, date }) {
  let content = '';
  if (fs.existsSync(indexFile)) content = fs.readFileSync(indexFile, 'utf8');
  else content = '# ADR Log\n\n';

  if (content.includes(relLink)) return false;

  const normalized = content.replace(/\r\n/g, '\n');
  const hadTrailingNewline = normalized.endsWith('\n');
  let lines = normalized.split('\n');
  // Normalize away the trailing empty split element so insertion math is sane.
  if (
    hadTrailingNewline &&
    lines.length > 0 &&
    lines[lines.length - 1] === ''
  ) {
    lines = lines.slice(0, -1);
  }
  const entryLine = `- [${title}](${relLink}) (${status}, ${date})`;

  // Prefer inserting under "## ADRs" if it exists, otherwise append at EOF.
  const r = insertIndexEntryUnderHeading(lines, /^##\s+ADRs\s*$/i, entryLine);
  const nextLines = r.inserted ? r.lines : [...lines, entryLine];

  let next = nextLines.join('\n');
  if (hadTrailingNewline) next += '\n';

  fs.mkdirSync(path.dirname(indexFile), { recursive: true });
  fs.writeFileSync(indexFile, next, 'utf8');
  return true;
}

function main() {
  const args = parseArgs(process.argv);

  const repoRoot = path.resolve(process.cwd(), args.repoRoot);
  if (!fs.existsSync(repoRoot)) die(`Repo root does not exist: ${repoRoot}`);

  let adrDir;
  if (args.dir) adrDir = path.resolve(repoRoot, args.dir);
  else adrDir = detectAdrDir(repoRoot) || path.join(repoRoot, 'adr');

  if (!fs.existsSync(adrDir)) {
    if (args.noCreateDir) die(`ADR directory does not exist: ${adrDir}`);
    fs.mkdirSync(adrDir, { recursive: true });
  }

  let strategy = args.strategy;
  if (strategy === 'auto') strategy = detectStrategy(adrDir);

  const title = String(args.title).trim();
  const slug = slugify(title);

  const today = todayISO();

  let filename;
  if (strategy === 'date') {
    filename = `${today}-${slug}.md`;
  } else {
    filename = `${slug}.md`;
  }

  let out = path.join(adrDir, filename);
  if (fs.existsSync(out)) {
    if (strategy === 'date') die(`ADR already exists: ${out}`);
    let i = 2;
    while (true) {
      const candidate = path.join(adrDir, `${slug}-${i}.md`);
      if (!fs.existsSync(candidate)) {
        out = candidate;
        break;
      }
      i++;
    }
  }

  const deciders = String(args.deciders || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');

  const consulted = String(args.consulted || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');
  const informed = String(args.informed || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');

  const raw = loadTemplate(args.template);
  const rendered = renderTemplate(raw, {
    title,
    status: String(args.status).trim(),
    date: today,
    deciders,
    consulted,
    informed,
    technicalStory: String(args.technicalStory || '').trim(),
    chosenOption: String(args.chosenOption || '').trim(),
  });

  fs.writeFileSync(out, `${rendered.trimEnd()}\n`, 'utf8');

  let updatedIndexPath = null;
  let indexChanged = false;

  if (args.updateIndex) {
    let indexFile;
    if (args.indexFile) {
      indexFile = path.isAbsolute(args.indexFile)
        ? args.indexFile
        : path.resolve(repoRoot, args.indexFile);
    } else {
      indexFile = chooseIndexFile(adrDir);
    }

    const relLink = toPosix(path.relative(path.dirname(indexFile), out));
    indexChanged = updateIndex(indexFile, {
      relLink,
      title,
      status: String(args.status).trim(),
      date: today,
    });
    updatedIndexPath = indexFile;
  }

  if (args.json) {
    const payload = {
      repoRoot,
      adrDir,
      createdAdrPath: out,
      createdAdrRelPath: toPosix(path.relative(repoRoot, out)),
      title,
      status: String(args.status).trim(),
      template: args.template,
      strategy,
      date: today,
      indexUpdated: Boolean(updatedIndexPath),
      indexChanged,
      indexPath: updatedIndexPath,
      indexRelPath: updatedIndexPath
        ? toPosix(path.relative(repoRoot, updatedIndexPath))
        : null,
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(`${out}\n`);
  }
}

main();
