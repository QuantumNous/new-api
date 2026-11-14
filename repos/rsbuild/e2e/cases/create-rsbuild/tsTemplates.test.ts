import { expect, test } from '@e2e/helper';
import { createAndValidate } from './helper';

test('should create react-ts project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'react-ts');
  expect(pkgJson.dependencies.react).toBeTruthy();
  expect(pkgJson.dependencies['react-dom']).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-react']).toBeTruthy();
});

test('should create preact-ts project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'preact-ts');
  expect(pkgJson.dependencies.preact).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-preact']).toBeTruthy();
});

test('should create vue-ts project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'vue-ts', {
    expectedBuildScript: 'vue-tsc && rsbuild build',
  });
  expect(pkgJson.dependencies.vue).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-vue']).toBeTruthy();
});

test('should create vue3-ts project alias as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'vue3-ts', {
    expectedBuildScript: 'vue-tsc && rsbuild build',
  });
  expect(pkgJson.dependencies.vue).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-vue']).toBeTruthy();
});

test('should create lit-ts project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'lit-ts');
  expect(pkgJson.dependencies.lit).toBeTruthy();
});

test('should create solid-ts project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'solid-ts');
  expect(pkgJson.dependencies['solid-js']).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-solid']).toBeTruthy();
});

test('should create svelte-ts project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'svelte-ts');
  expect(pkgJson.dependencies.svelte).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-svelte']).toBeTruthy();
});
