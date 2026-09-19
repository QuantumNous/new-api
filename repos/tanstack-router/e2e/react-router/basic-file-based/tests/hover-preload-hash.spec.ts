import { expect, test } from '@playwright/test'
import { toRuntimePath } from '@tanstack/router-e2e-utils'

test('clicking hash link then hovering another link does not scroll back to hash', async ({
  page,
}) => {
  // Go to the page without hash
  await page.goto(toRuntimePath('/hover-preload-hash'))

  // Click the hash link to navigate to position1
  await page.getByTestId('link-to-hash').click()
  await expect(page.locator('#position1')).toBeInViewport()

  // Scroll up so position1 is no longer in view
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.locator('#position1')).not.toBeInViewport()

  // Hover the link to trigger intent preload (should NOT scroll back)
  await page.getByTestId('link-to-only-route-inside-group').hover()
  await page.waitForTimeout(400)

  // Ensure we did not jump back to the hash target
  await expect(page.locator('#position1')).not.toBeInViewport()
})
