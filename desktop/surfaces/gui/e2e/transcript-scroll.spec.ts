// FB-004/FB-005: the transcript follows a streaming turn only while the reader is at the
// bottom — scrolling up PINS the viewport (reading must never be yanked away) and surfaces
// a jump-to-latest pill; bubbles grow hover affordances (copy + timestamp) that reveal
// without shifting layout. Driven against the fixtures' slow "stream the epic" turn.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

// The copy test asserts real clipboard writes — grant instead of relying on defaults.
test.use({ permissions: ["clipboard-write"] });

const scrollerState = `(() => {
  const el = document.querySelector(".main-scroll");
  return el ? { top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight } : null;
})()`;

test("scrolling up mid-stream pins the viewport; jump-to-latest re-engages", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("stream the epic");
  await box.press("Enter");

  // Let the stream outgrow the viewport, then read something "above".
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".main-scroll");
      return !!el && el.scrollHeight > el.clientHeight + 400;
    },
    { timeout: 10_000 },
  );
  await page.locator(".main-scroll").evaluate((el) => (el.scrollTop = 0));

  // The stream keeps growing below…
  const h1 = (await page.evaluate(scrollerState))!.height;
  await page.waitForFunction(
    (prev) => {
      const el = document.querySelector(".main-scroll");
      return !!el && el.scrollHeight > prev;
    },
    h1,
    { timeout: 5_000 },
  );
  // …but the viewport stays where the reader put it (the old behavior yanked to bottom
  // on every delta), and the pill offers the way back.
  const pinned = (await page.evaluate(scrollerState))!;
  expect(pinned.top).toBeLessThan(50);
  await expect(page.getByTestId("jump-to-latest")).toBeVisible();

  await page.getByTestId("jump-to-latest").click();
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".main-scroll");
      return !!el && el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    },
    { timeout: 5_000 },
  );
  await expect(page.getByTestId("jump-to-latest")).toHaveCount(0);

  // Re-engaged: the follow survives the rest of the stream to the turn's end.
  await expect(page.getByText("The epic concludes.").first()).toBeVisible({ timeout: 10_000 });
  const done = (await page.evaluate(scrollerState))!;
  expect(done.height - done.top - done.client).toBeLessThan(80);
});

test("bubbles carry hover copy + timestamp without layout shift", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("hello meta");
  await box.press("Enter");
  await expect(page.getByText("Echo: hello meta", { exact: false }).first()).toBeVisible();

  // Live items are stamped client-side, so both bubbles expose the affordance strip.
  const userBubble = page.locator(".bubble-user").last();
  await userBubble.hover();
  const meta = page.getByTestId("bubble-copy");
  await expect(meta.first()).toBeVisible();
  await expect(page.getByTestId("bubble-ts").first()).toBeVisible();

  // Copy actually copies (the fixture page runs with clipboard permission in Chromium).
  await meta.first().click();
  await expect(page.getByText("Copied").first()).toBeVisible();
});
