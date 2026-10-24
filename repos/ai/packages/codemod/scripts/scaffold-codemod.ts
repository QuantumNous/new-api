import fs from 'fs';
import path from 'path';

const codemodName = process.argv[2];
if (!codemodName) {
  console.error('Please provide a codemod name');
  process.exit(1);
}

// Templates
const codemodTemplate = `import { API, FileInfo } from 'jscodeshift';

export default function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // TODO: Implement transform

  return root.toSource();
}
`;

const testTemplate = `import { describe, it } from 'vitest';
import transformer from '../codemods/${codemodName}';
import { testTransform } from './test-utils';

describe('${codemodName}', () => {
  it('transforms correctly', () => {
    testTransform(transformer, '${codemodName}');
  });
});
`;

const inputTemplate = `// @ts-nocheck
// TODO: Add input code
`;

const outputTemplate = `// @ts-nocheck
// TODO: Add expected output code
`;

// File paths
const paths = {
  codemod: path.join(process.cwd(), 'src', 'codemods', `${codemodName}.ts`),
  test: path.join(process.cwd(), 'src', 'test', `${codemodName}.test.ts`),
  fixtures: path.join(process.cwd(), 'src', 'test', '__testfixtures__'),
};

// Create files
fs.writeFileSync(paths.codemod, codemodTemplate);
fs.writeFileSync(paths.test, testTemplate);
fs.writeFileSync(
  path.join(paths.fixtures, `${codemodName}.input.ts`),
  inputTemplate,
);
fs.writeFileSync(
  path.join(paths.fixtures, `${codemodName}.output.ts`),
  outputTemplate,
);

// Update bundle array
const upgradePath = path.join(process.cwd(), 'src', 'lib', 'upgrade.ts');
const upgradeContent = fs.readFileSync(upgradePath, 'utf8');

const bundleMatch = upgradeContent.match(/const bundle = \[([\s\S]*?)\];/);
if (bundleMatch) {
  const currentBundle = bundleMatch[1]
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.trim().replace(/[',]/g, ''));

  const newBundle = [...currentBundle, codemodName]
    .sort()
    .map(name => `  '${name}',`)
    .join('\n');

  const newContent = upgradeContent.replace(
    /const bundle = \[([\s\S]*?)\];/,
    `const bundle = [\n${newBundle}\n];`,
  );

  fs.writeFileSync(upgradePath, newContent);
}

console.log(`Created codemod files for '${codemodName}'`);
