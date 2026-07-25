// UX-027: the Slack post-connect orientation card — installer pre-added to the
// allow-list ("you" chip), status line, 3-tab animated how-it-works carousel
// (no "Listen to a channel" — deferred by owner call), collapse persisted locally.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openSlackPage(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
  await page.getByTestId("connector-slack").click();
}

test("post-connect card: personalized status line + the installer's 'you' chip", async ({
  page,
}) => {
  await openSlackPage(page);
  const card = page.getByTestId("slack-howitworks");
  await expect(card).toContainText("Getting started with Slack & OpenWorker");
  await expect(card).toContainText("deeplearning.ai connected");
  await expect(card).toContainText("you're on the People list");
  // The pre-added installer renders as a named chip marked "you" in ITS workspace.
  const chip = page.getByTestId("slack-workspace-T1DL").getByTestId("people-chip-you");
  await expect(chip).toContainText("Rohit Prasad");
  await expect(chip).toContainText("· you");
});

test("carousel has exactly the 3 shipped scenes and tabs switch the caption", async ({
  page,
}) => {
  await openSlackPage(page);
  const card = page.getByTestId("slack-howitworks");
  await expect(card.getByTestId("hiw-tab-0")).toContainText("Mention → session");
  await expect(card.getByTestId("hiw-tab-1")).toContainText("Threads stay connected");
  await expect(card.getByTestId("hiw-tab-2")).toContainText("Allow teammates");
  await expect(card).not.toContainText("Listen to a channel"); // deferred (rev 4)

  await expect(card.getByTestId("hiw-caption")).toContainText("a session opens here");
  // rev 7: the post-it layer restates the concept in place
  await expect(card.getByTestId("hiw-scene")).toContainText("a @mention starts a NEW session");
  await card.getByTestId("hiw-tab-1").click();
  await expect(card.getByTestId("hiw-caption")).toContainText("same session");
  await expect(card.getByTestId("hiw-scene")).toContainText("2 replies");
  await expect(card.getByTestId("hiw-scene")).toContainText("continues the SAME conversation");
  await card.getByTestId("hiw-tab-2").click();
  await expect(card.getByTestId("hiw-caption")).toContainText("waits for your OK");
  await expect(card.getByTestId("hiw-scene")).toContainText("Allow & deliver");
});

test("collapse hides the carousel, keeps the status line, and survives a reload", async ({
  page,
}) => {
  await openSlackPage(page);
  const card = page.getByTestId("slack-howitworks");
  await expect(card.getByTestId("hiw-tab-0")).toBeVisible();

  await card.getByTestId("hiw-collapse").click();
  await expect(card.getByTestId("hiw-tab-0")).toHaveCount(0);
  await expect(card).toContainText("you're on the People list"); // status line stays

  await openSlackPage(page); // full re-navigation — the seen-state is local
  await expect(page.getByTestId("slack-howitworks")).toBeVisible();
  await expect(page.getByTestId("hiw-tab-0")).toHaveCount(0);
  await page.getByTestId("hiw-collapse").click(); // reopen works
  await expect(page.getByTestId("hiw-tab-0")).toBeVisible();
});
