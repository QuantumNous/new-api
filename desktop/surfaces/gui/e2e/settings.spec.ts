import { test, expect } from "./fixtures";

// Guards the Settings-as-page refactor (§13, IA per UX-021): the ⚙ menu opens a full-page
// surface with a left sub-nav — General · Models · Voice input — and each section renders.
// Files is a card inside General; Personas is launch-flagged off.
test("Settings opens as a full page and navigates sections", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  // Full-page: left sub-nav + the General section (no modal backdrop).
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  for (const label of ["General", "Models", "Voice input"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  // Folded/hidden tabs: Files is a General card now; Personas is launch-flagged off.
  await expect(page.getByRole("button", { name: "Files", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Personas", exact: true })).toHaveCount(0);

  // The Files card lives inside General.
  await expect(page.getByText("Each conversation gets its own folder")).toBeVisible();

  await page.getByRole("button", { name: "Models", exact: true }).click();
  await expect(page.getByTestId("boxai-model-access")).toBeVisible();
});

// The launch flag brings the Personas tab back (the gallery/persona suites rely on it).
test("Settings: Personas tab returns behind the launch flag", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ocw.flag.personas", "1"));
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Personas", exact: true }).click();
  await expect(page.getByText("Add personas")).toBeVisible();
});

test("Models: BoxAI account is the only model access provider", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Models", exact: true }).click();

  const access = page.getByTestId("boxai-model-access");
  await expect(access).toContainText("BoxAI");
  await expect(access).toContainText("Sign in to access your account models");
  await expect(page.locator('[data-testid^="set-provider-"]')).toHaveCount(0);
  await expect(page.getByLabel(/API key|endpoint/i)).toHaveCount(0);
});

test("Models: sign-in launches the BoxAI browser flow", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Models", exact: true }).click();

  await page.getByTestId("boxai-model-access").getByRole("button", { name: /Sign in/ }).click();
  await expect(page.getByTestId("inline-cloud-sign-in")).toHaveText("Check your browser…");
});

// Token savings (owner ask 2026-07-17; moved under Models by UX-021): the card renders with
// the PDF fallback segmented control + attach thresholds, and edits POST through.
test("Settings: Token savings card edits PDF fallback and thresholds", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Models", exact: true }).click();

  const card = page.getByTestId("token-savings-card");
  await expect(card).toBeVisible();
  await expect(card.getByText("Token savings")).toBeVisible();

  // Fallback mode: fixture says "text"; switching marks "Send page images" active.
  const seg = page.getByTestId("pdf-fallback");
  await expect(seg.getByRole("button", { name: "Extract text" })).toHaveClass(/active/);
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith("/v1/settings/pdf") && r.method() === "POST"),
    seg.getByRole("button", { name: "Send page images" }).click(),
  ]);
  expect(req.postDataJSON()).toEqual({ pdf_fallback: "images" });
  await expect(seg.getByRole("button", { name: "Send page images" })).toHaveClass(/active/);

  // Thresholds: fixture starts at 2 pages / 10 MB; editing pages POSTs the clamped value.
  await expect(card.getByTestId("pdf-max-pages")).toHaveValue("2");
  await expect(card.getByTestId("pdf-max-mb")).toHaveValue("10");
  const [req2] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith("/v1/settings/pdf") && r.method() === "POST"),
    card.getByTestId("pdf-max-pages").fill("30"),
  ]);
  expect(req2.postDataJSON()).toEqual({ pdf_max_pages: 30 });
});
