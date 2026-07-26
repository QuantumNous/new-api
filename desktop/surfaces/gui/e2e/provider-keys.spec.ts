// BoxAI Desktop intentionally has no bring-your-own-provider surface. These regressions guard
// against API-key and custom-endpoint controls returning to Settings.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openModels(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Models", exact: true }).click();
  await expect(page.getByTestId("boxai-model-access")).toBeVisible();
}

test("Models offers BoxAI sign-in instead of third-party API keys", async ({ page }) => {
  await openModels(page);
  const access = page.getByTestId("boxai-model-access");
  await expect(access).toContainText("Sign in to access your account models");
  await expect(access).toContainText("Custom keys and endpoints are disabled");
  await expect(page.getByLabel(/API key/i)).toHaveCount(0);
});

test("third-party provider cards are absent", async ({ page }) => {
  await openModels(page);
  for (const provider of ["openai", "anthropic", "zai", "ollama"]) {
    await expect(page.getByTestId(`set-provider-${provider}`)).toHaveCount(0);
  }
});

test("custom model endpoints cannot be configured", async ({ page }) => {
  await openModels(page);
  await expect(page.getByTestId("set-field-base_url")).toHaveCount(0);
  await expect(page.getByText(/localhost:11434|api\.z\.ai/i)).toHaveCount(0);
});
