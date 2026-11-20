import { expect, test } from '@e2e/helper';
import type { Page } from 'playwright';

declare global {
  interface Window {
    swStatus: string;
  }
}

const waitForServiceWorker = async (page: Page) => {
  // Wait for the service worker to be registered and activated
  // This is more reliable than waiting for Playwright's 'serviceworker' event
  // because the SW might already be registered before we set up the listener
  await page.waitForFunction(() => {
    return (
      window.navigator.serviceWorker.controller !== null &&
      (window.swStatus === 'ready' || window.swStatus === 'error')
    );
  });

  // Verify the service worker is properly activated
  const swState = await page.evaluate(async () => {
    const registration = await window.navigator.serviceWorker.getRegistration();
    return {
      hasController: window.navigator.serviceWorker.controller !== null,
      state: registration?.active?.state,
      swStatus: window.swStatus,
    };
  });

  expect(swState.swStatus).toBe('ready');
  expect(swState.hasController).toBe(true);
  expect(swState.state).toBe('activated');
};

test('should compile service worker in build', async ({ page, buildPreview }) => {
  const rsbuild = await buildPreview();
  const files = rsbuild.getDistFiles();
  const filenames = Object.keys(files);
  expect(filenames.some((filename) => filename.endsWith('dist/sw.js'))).toBeTruthy();
  await waitForServiceWorker(page);
});

test('should compile service worker in dev', async ({ dev, page }) => {
  await dev();
  await waitForServiceWorker(page);
});
