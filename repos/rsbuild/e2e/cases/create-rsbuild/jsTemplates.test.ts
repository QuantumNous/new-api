import { expect, test } from '@e2e/helper';
import { createAndValidate } from './helper';

test('should create react project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'react');
  expect(pkgJson.dependencies.react).toBeTruthy();
  expect(pkgJson.dependencies['react-dom']).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-react']).toBeTruthy();
});

test('should create preact project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'preact');
  expect(pkgJson.dependencies.preact).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-preact']).toBeTruthy();
});

test('should create vue project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'vue');
  expect(pkgJson.dependencies.vue).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-vue']).toBeTruthy();
});

test('should create vue3 project alias as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'vue3');
  expect(pkgJson.dependencies.vue).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-vue']).toBeTruthy();
});

test('should create lit project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'lit');
  expect(pkgJson.dependencies.lit).toBeTruthy();
});

test('should create solid project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'solid');
  expect(pkgJson.dependencies['solid-js']).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-solid']).toBeTruthy();
});

test('should create svelte project as expected', async () => {
  const { pkgJson } = await createAndValidate(import.meta.dirname, 'svelte');
  expect(pkgJson.dependencies.svelte).toBeTruthy();
  expect(pkgJson.devDependencies['@rsbuild/plugin-svelte']).toBeTruthy();
});
