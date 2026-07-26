// Skills management (Connectors ▸ Skills): the list's three tiers, enable/disable,
// GitHub + marketplace install, delete (installed only), and the composer's "$" mention.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

// The sidebar's Skills row deep-links into Connectors ▸ Skills — the discoverable entry point.
async function openSkills(page) {
  await page.goto("/");
  await page.getByTestId("nav-skills").click();
}

test("the sidebar Skills row opens the Skills tab directly", async ({ page }) => {
  await openSkills(page);
  await expect(
    page.getByText("Loadable instruction packs that teach your coworkers repeatable tasks."),
  ).toBeVisible();
  await expect(page.getByTestId("skill-group-builtin")).toBeVisible();
});

test("recommended packs install with one click and leave the list once installed", async ({
  page,
}) => {
  await openSkills(page);
  await expect(page.getByTestId("skill-rec-canvas-design")).toBeVisible();
  await page.getByTestId("skill-rec-canvas-design").getByRole("button", { name: "Add" }).click();
  await expect(page.getByTestId("skill-row-canvas-design")).toBeVisible();
  await expect(page.getByTestId("skill-rec-canvas-design")).toHaveCount(0);
  await expect(page.getByTestId("skill-rec-mcp-builder")).toBeVisible();
});

test("lists built-in and installed skills; only installed ones can be removed", async ({
  page,
}) => {
  await openSkills(page);
  await expect(page.getByTestId("skill-row-docx-report")).toContainText("Built-in");
  await expect(page.getByTestId("skill-row-release-notes")).toContainText("Installed");
  await expect(page.getByTestId("skill-remove-release-notes")).toBeVisible();
  await expect(page.getByTestId("skill-remove-docx-report")).toHaveCount(0);

  await page.getByTestId("skill-remove-release-notes").click();
  await expect(page.getByTestId("skill-row-release-notes")).toHaveCount(0);
});

test("details expand the SKILL.md instructions", async ({ page }) => {
  await openSkills(page);
  await page.getByTestId("skill-detail-meeting-notes").click();
  await expect(page.getByText("Do the thing, step by step.")).toBeVisible();
});

test("installs from GitHub and from the marketplace", async ({ page }) => {
  await openSkills(page);

  await page.getByTestId("skill-add-git").click();
  await page.getByTestId("skill-git-form").getByPlaceholder("https://github.com").fill("acme/skills");
  await page
    .getByTestId("skill-git-form")
    .getByPlaceholder("skill folder in the repo")
    .fill("skills/changelog");
  await page.getByRole("button", { name: "Install", exact: true }).click();
  await expect(page.getByTestId("skill-notice")).toContainText("changelog");
  await expect(page.getByTestId("skill-row-changelog")).toBeVisible();

  await page.getByTestId("skill-add-market").click();
  await page.getByTestId("skill-market-query").fill("pdf");
  await page.getByTestId("skill-market").getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByTestId("skill-market-result-pdf")
    .getByRole("button", { name: "Install" })
    .click();
  // Market packs may bundle scripts — the notice must say runs stay approval-gated.
  await expect(page.getByTestId("skill-notice")).toContainText("approval-gated");
  await expect(page.getByTestId("skill-row-pdf")).toBeVisible();
});

test("composer $ mention inserts an explicit skill instruction", async ({ page }) => {
  await page.goto("/");
  const box = page.getByPlaceholder("Ask the coworker");
  await box.click();
  await box.fill("$meeting");
  await expect(page.getByTestId("skill-mention-popover")).toBeVisible();
  await page.getByTestId("skill-mention-meeting-notes").click();
  await expect(box).toHaveValue("Use the meeting-notes skill: ");
});
