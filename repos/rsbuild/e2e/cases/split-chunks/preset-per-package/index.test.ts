import { basename } from 'node:path';
import { expect, findFile, test } from '@e2e/helper';

test('should generate chunks for each package when preset is "per-package"', async ({ build }) => {
  const rsbuild = await build({
    config: {},
  });

  const files = rsbuild.getDistFiles();

  const reactFile = findFile(
    files,
    (name) => name.includes('npm-react') && files[name].includes('React'),
  );
  expect(reactFile).toBeTruthy();

  const jsFiles = Object.keys(files)
    .filter((name) => name.endsWith('.js'))
    .map((name) => basename(name));

  expect(jsFiles.length).toEqual(4);
  expect(jsFiles).toContain('index.js');
  expect(jsFiles.find((file) => file.includes('npm-react'))).toBeTruthy();
  expect(jsFiles.find((file) => file.includes('npm-react-dom'))).toBeTruthy();
  expect(jsFiles.find((file) => file.includes('npm-scheduler'))).toBeTruthy();
});
