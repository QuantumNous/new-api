import fs from 'fs';
import path from 'path';

// Read actual codemod files from the filesystem
const codemodsDir = path.join(process.cwd(), 'src', 'codemods');

if (!fs.existsSync(codemodsDir)) {
  throw new Error(`Codemods directory not found: ${codemodsDir}`);
}

function scanCodemodsRecursively(dir: string, prefix: string = ''): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory() && item !== 'not-implemented' && item !== 'lib') {
      files.push(...scanCodemodsRecursively(itemPath, prefix + item + '/'));
    } else if (
      stat.isFile() &&
      item.endsWith('.ts') &&
      !item.includes('lib/')
    ) {
      files.push(prefix + item.replace('.ts', ''));
    }
  }

  return files;
}

const codemodFiles = scanCodemodsRecursively(codemodsDir).sort();

function generateDescription(name: string): string {
  const readable = name.replace(/-/g, ' ');

  if (name.startsWith('remove-')) {
    return `Removes ${readable.replace('remove ', '')}`;
  }

  if (name.startsWith('replace-')) {
    return `Replaces ${readable.replace('replace ', '')}`;
  }

  if (name.startsWith('rename-')) {
    return `Renames ${readable.replace('rename ', '')}`;
  }

  if (name.startsWith('rewrite-')) {
    return `Rewrites ${readable.replace('rewrite ', '')}`;
  }

  if (name.startsWith('add-')) {
    return `Adds ${readable.replace('add ', '')}`;
  }

  return `Transforms ${readable}`;
}

function categorizeCodemod(name: string): string {
  if (name.startsWith('v4/')) {
    return 'v4 Codemods (v3 → v4 Migration)';
  }

  if (name.startsWith('v5/')) {
    return 'v5 Codemods (v4 → v5 Migration)';
  }

  if (name.startsWith('v6/')) {
    return 'v6 Codemods (v5 → v6 Migration)';
  }

  return 'General Codemods';
}

const categories: Record<
  string,
  Array<{ name: string; description: string }>
> = {};

codemodFiles.forEach(codemod => {
  const category = categorizeCodemod(codemod);
  const description = generateDescription(codemod);

  if (!categories[category]) {
    categories[category] = [];
  }

  categories[category].push({ name: codemod, description });
});

const categoryOrder = [
  'v4 Codemods (v3 → v4 Migration)',
  'v5 Codemods (v4 → v5 Migration)',
  'v6 Codemods (v5 → v6 Migration)',
  'General Codemods',
];

function generateCategoryTable(
  categoryName: string,
  codemods: Array<{ name: string; description: string }>,
) {
  const header = `### ${categoryName}

| Codemod | Description |
| ------- | ----------- |`;

  const rows = codemods
    .map(codemod => `| \`${codemod.name}\` | ${codemod.description} |`)
    .join('\n');

  return `${header}\n${rows}`;
}

const availableCodemodsSection = `## Available Codemods

${categoryOrder
  .filter(categoryName => categories[categoryName])
  .map(categoryName =>
    generateCategoryTable(categoryName, categories[categoryName]),
  )
  .join('\n\n')}`;

const readmePath = path.join(process.cwd(), 'README.md');
const readmeContent = fs.readFileSync(readmePath, 'utf8');

const startMarker = '## Available Codemods';
const endMarker = '## CLI Options';

const startIndex = readmeContent.indexOf(startMarker);
const endIndex = readmeContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  throw new Error(
    'Could not find Available Codemods section markers in README.md',
  );
}

const newReadmeContent =
  readmeContent.substring(0, startIndex) +
  availableCodemodsSection +
  '\n\n' +
  readmeContent.substring(endIndex);

fs.writeFileSync(readmePath, newReadmeContent);

console.log('README.md updated with current codemods');
