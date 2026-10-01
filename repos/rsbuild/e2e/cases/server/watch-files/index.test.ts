import fs from 'node:fs';
import path from 'node:path';
import { test } from '@e2e/helper';

test('should work with string and path to file', async ({ dev, page }) => {
  const file = path.join(import.meta.dirname, '/assets/example.txt');
  await dev({
    config: {
      dev: {
        watchFiles: {
          paths: file,
        },
      },
    },
  });

  await fs.promises.writeFile(file, 'test');
  // check the page is reloaded
  await new Promise((resolve) => {
    page.waitForURL(page.url()).then(resolve);
  });

  // reset file
  fs.truncateSync(file);
});

test('should work with string and path to directory', async ({ dev, page }) => {
  const file = path.join(import.meta.dirname, '/assets/example.txt');
  await dev({
    config: {
      dev: {
        watchFiles: {
          paths: path.join(import.meta.dirname, '/assets'),
        },
      },
    },
  });

  await fs.promises.writeFile(file, 'test');

  await new Promise((resolve) => {
    page.waitForURL(page.url()).then(resolve);
  });

  // reset file
  fs.truncateSync(file);
});

test('should work with string array directory', async ({ dev, page }) => {
  const file = path.join(import.meta.dirname, '/assets/example.txt');
  const other = path.join(import.meta.dirname, '/other/other.txt');
  await dev({
    config: {
      dev: {
        watchFiles: {
          paths: [
            path.join(import.meta.dirname, '/assets'),
            path.join(import.meta.dirname, '/other'),
          ],
        },
      },
    },
  });

  await fs.promises.writeFile(file, 'test');
  // check the page is reloaded
  await new Promise((resolve) => {
    page.waitForURL(page.url()).then(resolve);
  });
  // reset file
  fs.truncateSync(file);

  await fs.promises.writeFile(other, 'test');
  // check the page is reloaded
  await new Promise((resolve) => {
    page.waitForURL(page.url()).then(resolve);
  });
  // reset file
  fs.truncateSync(other);
});

test('should work with string and glob', async ({ dev, page }) => {
  const file = path.join(import.meta.dirname, '/assets/example.txt');
  const watchDir = path.join(import.meta.dirname, '/assets');
  await dev({
    config: {
      dev: {
        watchFiles: {
          paths: `${watchDir}/**/*`,
        },
      },
    },
  });

  await fs.promises.writeFile(file, 'test');
  // check the page is reloaded
  await new Promise((resolve) => {
    page.waitForURL(page.url()).then(resolve);
  });

  // reset file
  fs.truncateSync(file);
});

test('should work with options', async ({ dev, page }) => {
  const file = path.join(import.meta.dirname, '/assets/example.txt');
  await dev({
    config: {
      dev: {
        watchFiles: {
          paths: file,
          options: {
            usePolling: true,
          },
        },
      },
    },
  });

  await fs.promises.writeFile(file, 'test');
  // check the page is reloaded
  await new Promise((resolve) => {
    page.waitForURL(page.url()).then(resolve);
  });

  // reset file
  fs.truncateSync(file);
});
