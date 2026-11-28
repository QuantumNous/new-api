import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import { createAndValidate } from './helper';

const readCreatedFile = (dir: string, ...paths: string[]) => {
  const file = join(dir, ...paths);
  expect(existsSync(file)).toBeTruthy();
  // Windows writes generated fixtures with CRLF, but the expected snapshots use LF.
  return readFileSync(file, 'utf-8').replaceAll('\r\n', '\n');
};

test('should create project with eslint as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'vanilla', {
    name: 'test-temp-eslint',
    tools: ['eslint'],
    clean: false,
  });
  expect(pkgJson.devDependencies.eslint).toBeTruthy();
  expect(existsSync(join(dir, 'eslint.config.mjs'))).toBeTruthy();
  await clean();
});

test('should create project with prettier as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'vanilla', {
    name: 'test-temp-prettier',
    tools: ['prettier'],
    clean: false,
  });
  expect(pkgJson.devDependencies.prettier).toBeTruthy();
  expect(existsSync(join(dir, '.prettierrc'))).toBeTruthy();
  await clean();
});

test('should create project with tailwindcss as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'vanilla', {
    name: 'test-temp-tailwindcss',
    tools: ['tailwindcss'],
    clean: false,
  });
  expect(pkgJson.devDependencies.tailwindcss).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-tailwindcss']).toBeTruthy();
  expect(pkgJson.devDependencies['@tailwindcss/postcss']).toBeFalsy();

  const cssContent = readCreatedFile(dir, 'src', 'index.css');
  expect(cssContent.includes("@import 'tailwindcss';")).toBeTruthy();

  const configContent = readCreatedFile(dir, 'rsbuild.config.js');
  expect(configContent).toBe(`// @ts-check
import { defineConfig } from '@rsbuild/core';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginTailwindcss()],
});
`);
  await clean();
});

test('should create React project with tailwindcss as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'react', {
    name: 'test-temp-tailwindcss',
    tools: ['tailwindcss'],
    clean: false,
  });
  expect(pkgJson.devDependencies.tailwindcss).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-tailwindcss']).toBeTruthy();
  expect(pkgJson.devDependencies['@tailwindcss/postcss']).toBeFalsy();
  const cssContent = readCreatedFile(dir, 'src', 'App.css');
  expect(cssContent.includes("@import 'tailwindcss';")).toBeTruthy();

  const configContent = readCreatedFile(dir, 'rsbuild.config.js');
  expect(configContent).toBe(`// @ts-check
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact(), pluginTailwindcss()],
});
`);
  await clean();
});

test('should create Lit TS project with tailwindcss as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'lit-ts', {
    name: 'test-temp-lit-ts-tailwindcss',
    tools: ['tailwindcss'],
    clean: false,
  });
  expect(pkgJson.devDependencies.tailwindcss).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-tailwindcss']).toBeTruthy();

  const configContent = readCreatedFile(dir, 'rsbuild.config.ts');
  expect(configContent).toBe(`import { defineConfig } from '@rsbuild/core';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginTailwindcss()],
  html: {
    template: './src/index.html',
  },
  source: {
    decorators: {
      version: 'legacy',
    },
  },
});
`);
  await clean();
});

test('should create project with ESLint and prettier as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'vanilla', {
    name: 'test-temp-eslint-prettier',
    tools: ['eslint', 'prettier'],
    clean: false,
  });
  expect(pkgJson.devDependencies.eslint).toBeTruthy();
  expect(pkgJson.devDependencies.prettier).toBeTruthy();
  expect(existsSync(join(dir, '.prettierrc'))).toBeTruthy();
  expect(existsSync(join(dir, 'eslint.config.mjs'))).toBeTruthy();
  await clean();
});

test('should create React project with ESLint as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'react-ts', {
    name: 'test-temp-react-eslint',
    tools: ['eslint'],
    clean: false,
  });
  expect(pkgJson.devDependencies.eslint).toBeTruthy();
  expect(pkgJson.devDependencies['eslint-plugin-react-hooks']).toBeTruthy();
  expect(existsSync(join(dir, 'eslint.config.mjs'))).toBeTruthy();
  await clean();
});

test('should create React project with Rslint as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'react-ts', {
    name: 'test-temp-react-rslint',
    tools: ['rslint'],
    clean: false,
  });
  expect(pkgJson.devDependencies['@rslint/core']).toBeTruthy();

  const configContent = readCreatedFile(dir, 'rslint.config.ts');
  expect(configContent.includes('reactPlugin.configs.recommended')).toBeTruthy();
  expect(configContent.includes('ts.configs.recommended')).toBeTruthy();
  await clean();
});

test('should create Vue project with vanilla Rslint as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'vue-js', {
    name: 'test-temp-vue-rslint',
    tools: ['rslint'],
    clean: false,
  });
  expect(pkgJson.devDependencies['@rslint/core']).toBeTruthy();

  const configContent = readCreatedFile(dir, 'rslint.config.ts');
  expect(configContent.includes('js.configs.recommended')).toBeTruthy();
  expect(configContent.includes('reactPlugin')).toBeFalsy();
  expect(configContent.includes('ts.configs.recommended')).toBeFalsy();
  await clean();
});

test('should create Vue project with ESLint as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'vue-ts', {
    name: 'test-temp-vue-eslint',
    tools: ['eslint'],
    clean: false,
    expectedBuildScript: 'vue-tsc && rsbuild build',
  });
  expect(pkgJson.devDependencies.eslint).toBeTruthy();
  expect(pkgJson.devDependencies['eslint-plugin-vue']).toBeTruthy();
  expect(existsSync(join(dir, 'eslint.config.mjs'))).toBeTruthy();
  await clean();
});

test('should create project with biome as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'vanilla', {
    name: 'test-temp-eslint',
    tools: ['biome'],
    clean: false,
  });
  expect(pkgJson.devDependencies['@biomejs/biome']).toBeTruthy();
  expect(existsSync(join(dir, 'biome.json'))).toBeTruthy();
  await clean();
});

test('should create React project with react-compiler as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'react', {
    name: 'test-temp-react-compiler',
    tools: ['react-compiler'],
    clean: false,
  });
  expect(pkgJson.dependencies['react-compiler-runtime']).toBeFalsy();

  const configContent = readCreatedFile(dir, 'rsbuild.config.js');
  expect(configContent).toBe(`// @ts-check
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
  ],
});
`);
  await clean();
});

test('should create React project with react-compiler and tailwindcss as expected', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'react', {
    name: 'test-temp-react-compiler-tailwindcss',
    tools: ['react-compiler', 'tailwindcss'],
    clean: false,
  });
  expect(pkgJson.devDependencies['@rsbuild/plugin-tailwindcss']).toBeTruthy();

  const configContent = readCreatedFile(dir, 'rsbuild.config.js');
  expect(configContent).toBe(`// @ts-check
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
  ],
});
`);
  await clean();
});

test('should preserve tailwindcss when react-compiler runs after it', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'react', {
    name: 'test-temp-tailwindcss-react-compiler',
    tools: ['tailwindcss', 'react-compiler'],
    clean: false,
  });
  expect(pkgJson.devDependencies['@rsbuild/plugin-tailwindcss']).toBeTruthy();

  const configContent = readCreatedFile(dir, 'rsbuild.config.js');
  expect(configContent).toBe(`// @ts-check
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
  ],
});
`);
  await clean();
});

test('should ignore react-compiler for non-React projects', async () => {
  const { dir, pkgJson, clean } = await createAndValidate(import.meta.dirname, 'vanilla', {
    name: 'test-temp-vanilla-react-compiler',
    tools: ['react-compiler'],
    clean: false,
  });
  expect(pkgJson.dependencies?.['react-compiler-runtime']).toBeFalsy();

  const configContent = readCreatedFile(dir, 'rsbuild.config.js');
  expect(configContent.includes('pluginBabel')).toBeFalsy();
  expect(configContent.includes('react-compiler')).toBeFalsy();
  await clean();
});
