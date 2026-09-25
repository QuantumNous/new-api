import { expect, test } from '@playwright/test';

test.describe('form setFocus', () => {
  test('should focus input', async ({ page }) => {
    await page.goto('/setFocus');
    await page.locator('button:has-text("Focus Input")').click();
    await expect(page.locator('input[name="focusInput"]')).toBeFocused();
  });

  test('should select input content', async ({ page }) => {
    await page.goto('/setFocus');
    await page.locator('button:has-text("Select Input Content")').click();
    const locator = page.locator('input[name="selectInputContent"]');
    // setFocus() in createFormControl.ts defers the actual focus()/select()
    // calls via a bare setTimeout, so the click above resolves before the
    // field is really focused and selected. Wait for focus first so the
    // (synchronous, same-callback) select() has definitely also run.
    await expect(locator).toBeFocused();
    // The button triggers setFocus with `shouldSelect: true`, which selects
    // the entire existing value. Typing while text is selected replaces it
    // (real-user behavior). We intentionally do NOT use the `type()` helper
    // here: its `press('End')` collapses the selection to the end first,
    // which would append rather than replace, defeating the point of this
    // test (verifying select-on-focus).
    await locator.pressSequentially('New Value');
    await expect(locator).toHaveValue('New Value');
  });

  test('should focus textarea', async ({ page }) => {
    await page.goto('/setFocus');
    await page.locator('button:has-text("Focus Textarea")').click();
    await expect(page.locator('textarea[name="focusTextarea"]')).toBeFocused();
  });

  test('should select textarea content', async ({ page }) => {
    await page.goto('/setFocus');
    await page.locator('button:has-text("Select Textarea Content")').click();
    const locator = page.locator('textarea[name="selectTextareaContent"]');
    // Same reasoning as the input case above: wait for the deferred
    // focus()/select() to actually land, and don't use the `type()` helper
    // since it would collapse the pre-existing selection instead of
    // replacing it.
    await expect(locator).toBeFocused();
    await locator.pressSequentially('New Value');
    await expect(locator).toHaveValue('New Value');
  });
});
