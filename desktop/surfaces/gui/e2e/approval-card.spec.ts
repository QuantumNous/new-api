// §35 (UX-018): approval cards speak the transcript's language. Routine workspace writes
// are a compact ROW (humanized title, inline args-preview, short "Always allow" with the
// full rule on hover); everything else is a full card — shell titles with the model's
// description, external actions wear the leaves-this-Mac note. No "PERMISSION REQUIRED"
// kicker, no raw args dump, no solid-fill buttons.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("routine write → compact row: humanized title, inline preview, Allow resolves", async ({
  page,
}) => {
  await page.goto("/");
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("please write a file");
  await page.getByRole("button", { name: "Send" }).click();

  const row = page.getByTestId("approval-row");
  await expect(row).toContainText("Write fetch_data.py");
  await expect(row).not.toContainText(/permission required/i);
  await expect(row.getByRole("button", { name: "Always allow", exact: true })).toHaveAttribute(
    "title",
    /for this session/,
  );

  // Preview expands INLINE from the tool args — the file doesn't exist yet.
  await row.getByText("preview ▾").click();
  await expect(row).toContainText("import json");
  await row.getByText("show all 6 lines").click();
  await expect(row).toContainText("done = True");

  await page.screenshot({ path: "test-results/ux018-compact-row.png", fullPage: false });

  await row.getByRole("button", { name: "Allow", exact: true }).click();
  await expect(page.getByText(/Done via write_file/)).toBeVisible();
});

test("run_shell → full card: description title, command preview, stays-on-this-Mac note", async ({
  page,
}) => {
  await page.goto("/");
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("please run a tool");
  await page.getByRole("button", { name: "Send" }).click();

  // The mocked proposal has no description → plain "Run a command" title; the command is
  // the preview; the reason still renders; the scope note replaces the old badge.
  await expect(page.getByText("Run a command").last()).toBeVisible();
  await expect(page.getByText("stays on this Mac").last()).toBeVisible();
  await expect(page.getByText("The coworker wants to run a command.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Always allow this command" }).last()).toBeVisible();
  await expect(page.getByText(/local action/)).toHaveCount(0);

  await page.screenshot({ path: "test-results/ux018-shell-card.png", fullPage: false });

  await page.getByRole("button", { name: "Allow once" }).last().click();
  await expect(page.getByText("The command ran; 1 file found.")).toBeVisible();
});

test("a one-paragraph digest send is clamped to a card, expandable in place", async ({
  page,
}) => {
  await page.goto("/");
  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("post the long digest");
  await page.getByRole("button", { name: "Send" }).click();

  // The message rides in a clamped preview box — not an unbounded quote wall.
  const prev = page.locator(".approval-prev");
  await expect(prev).toBeVisible();
  await expect(prev).toContainText("aisuite — last 24 hours");
  const clampedHeight = (await prev.boundingBox())!.height;
  expect(clampedHeight).toBeLessThan(200);

  await page.screenshot({ path: "test-results/send-digest-clamped.png", fullPage: false });

  // Expands in place, and can collapse back.
  await prev.getByText("show the full message").click();
  expect((await prev.boundingBox())!.height).toBeGreaterThan(clampedHeight);
  await expect(prev.getByText("show less")).toBeVisible();
});
