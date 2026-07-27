// Capture the product screenshots the you-box.com download page ships.
//
// Every shot runs against the hermetic mocks in e2e/fixtures.ts (plus the screenshot overlay in
// ./fixtures.ts), so the content is seeded, deterministic, and has nothing to redact by hand.
// Output lands in screenshots/out/ as 2x PNGs; scripts/optimize-screenshots.sh converts them to
// the responsive .webp set the website loads.
import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures";

const OUT = "screenshots/out";

async function shoot(page: Page, name: string) {
  // Animations that are mid-flight when the shutter fires produce half-drawn frames.
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function ask(page: Page, prompt: string) {
  await page.goto("/");
  await page.getByPlaceholder(/Ask the/).fill(prompt);
  await page.getByRole("button", { name: "Send" }).click();
}

test("session — a finished piece of work in the transcript", async ({ page }) => {
  await ask(page, "Draft the launch note from the Q3 numbers");
  await expect(page.getByText("Revenue is up 18%")).toBeVisible();
  await shoot(page, "session");
});

test("approval — the agent asks before it acts", async ({ page }) => {
  await ask(page, "Post the launch summary to #launch-team");
  await expect(page.getByRole("button", { name: /Allow/ }).first()).toBeVisible();
  await shoot(page, "approval");
});

test("skills — the instruction packs library", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-skills").click();
  await expect(page.getByTestId("skill-group-builtin")).toBeVisible();
  await shoot(page, "skills");
});

test("connectors — the tools the agent can reach", async ({ page }) => {
  // The Skills row is the shortest path into the integrations shell; its sub-nav holds
  // the connectors list.
  await page.goto("/");
  await page.getByTestId("nav-skills").click();
  await page.locator(".page-subnav button").filter({ hasText: "Connectors" }).first().click();
  await expect(page.getByTestId("connector-slack")).toBeVisible();
  await shoot(page, "connectors");
});

test("automations — recurring work on a schedule", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("nav-automations").click();
  await expect(page.getByText("Daily AI News").first()).toBeVisible();
  await shoot(page, "automations");
});

test("inbox — unattended runs park their questions", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("inbox-chip").click();
  await expect(page.getByText("Approve: run_shell")).toBeVisible();
  await shoot(page, "inbox");
});
