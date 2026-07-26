// First-run setup is intentionally BoxAI-account based: no provider gallery, pasted keys, or
// custom endpoints. Authentication opens in the system browser before tools setup.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openOnboarding(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Run setup again" }).click();
  await expect(page.getByTestId("ob-step-model")).toBeVisible();
}

async function signInAndContinue(page) {
  await page.getByTestId("ob-cloud-signin").click();
  await expect(page.getByTestId("ob-boxai-signedin")).toContainText("Signed in to BoxAI", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("ob-continue")).toBeEnabled();
  await page.getByTestId("ob-continue").click();
  await expect(page.getByTestId("ob-step-tools")).toBeVisible();
}

test("model setup requires BoxAI browser sign-in", async ({ page }) => {
  await openOnboarding(page);
  await expect(page.getByRole("heading", { name: /Welcome to BoxAI Desktop/ })).toBeVisible();
  await expect(page.getByText("Sign in with your BoxAI account to use the models available to your account.")).toBeVisible();
  await expect(page.getByTestId("ob-cloud-signin")).toHaveText("Sign in with BoxAI");
  await expect(page.getByTestId("ob-continue")).toBeDisabled();
});

test("onboarding exposes no third-party key or custom endpoint controls", async ({ page }) => {
  await openOnboarding(page);
  await expect(page.getByText("Model access is managed by BoxAI; custom providers and endpoints are not supported.")).toBeVisible();
  await expect(page.locator('[data-testid^="ob-provider-"]')).toHaveCount(0);
  await expect(page.getByLabel(/API key/i)).toHaveCount(0);
  await expect(page.getByTestId("ob-field-base_url")).toHaveCount(0);
});

test("successful BoxAI sign-in unlocks account setup", async ({ page }) => {
  await openOnboarding(page);
  await signInAndContinue(page);
});

test("tools page connects a BoxAI-managed integration", async ({ page }) => {
  await openOnboarding(page);
  await signInAndContinue(page);
  await expect(page.getByTestId("ob-tool-outlook").getByRole("button", { name: "Connect" })).toBeVisible();
  await page.getByTestId("ob-tool-outlook").getByRole("button", { name: "Connect" }).click();
  await expect(page.getByTestId("ob-tool-outlook")).toContainText("✓ Connected", { timeout: 10_000 });
  await page.getByTestId("ob-continue-tools").click();
  await expect(page.getByTestId("ob-step-done")).toBeVisible();
});

test("tools page continues cleanly; Start working lands in a session with access open", async ({ page }) => {
  await openOnboarding(page);
  await signInAndContinue(page);
  await page.getByTestId("ob-continue-tools").click();
  await expect(page.getByTestId("ob-step-done")).toBeVisible();
  await page.getByTestId("ob-start").click();
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Session access" })).toBeVisible();
});
