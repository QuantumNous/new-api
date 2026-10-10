import { test } from '@e2e/helper';
import { createAndValidate } from './helper';

test('should create vanilla project as expected', async () => {
  await createAndValidate(import.meta.dirname, 'vanilla');
});

test('should create vanilla-ts project as expected', async () => {
  await createAndValidate(import.meta.dirname, 'vanilla-ts');
});

test('should allow to create project in sub dir', async () => {
  await createAndValidate(import.meta.dirname, 'vanilla', {
    name: 'test-temp-dir/rsbuild-project',
  });
});

test('should allow to create project in relative dir', async () => {
  await createAndValidate(import.meta.dirname, 'vanilla', {
    name: './test-temp-relative-dir',
  });
});
