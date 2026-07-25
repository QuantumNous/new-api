// The Google Calendar detail page: gmail-parity multi-account (Default badge,
// Make default, per-account disconnect, direct one-click add — no modal).
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openConnectors(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
}

async function signInAndConnectFirstAccount(page) {
  await openConnectors(page);
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-row")).toContainText("Rohit", { timeout: 10_000 });
  // starts disconnected → Available row → one click (mock connects instantly)
  await page
    .getByTestId("connector-google_calendar")
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await page.getByRole("button", { name: /Connect Google Calendar with one click/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("connector-google_calendar")).toContainText("rohit@gmail.com", {
    timeout: 10_000,
  });
}

test("connect, then add a second account from the page; first stays default", async ({
  page,
}) => {
  await signInAndConnectFirstAccount(page);
  await page.getByTestId("connector-google_calendar").click();
  await expect(page.getByTestId("gcal-detail")).toBeVisible();

  await page.getByTestId("add-account-btn").click();
  const rohit = page.getByTestId("gcal-account-rohit@gmail.com");
  const work = page.getByTestId("gcal-account-work@dlai.com");
  await expect(work).toBeVisible({ timeout: 10_000 });
  await expect(rohit).toContainText("Default");
  await expect(work).not.toContainText("Default");
  // list row summarizes the multi-account state
  await page.getByTestId("connectors-breadcrumb").click();
  await expect(page.getByTestId("connector-google_calendar")).toContainText("2 accounts");
});

test("Make default moves the badge; disconnecting the default repoints it", async ({
  page,
}) => {
  await signInAndConnectFirstAccount(page);
  await page.getByTestId("connector-google_calendar").click();
  await page.getByTestId("add-account-btn").click();
  await expect(page.getByTestId("gcal-account-work@dlai.com")).toBeVisible({ timeout: 10_000 });

  await page.getByTestId("gcal-make-default-work@dlai.com").click();
  await expect(page.getByTestId("gcal-account-work@dlai.com")).toContainText("Default");
  await expect(page.getByTestId("gcal-account-rohit@gmail.com")).not.toContainText("Default");

  await page.getByTestId("gcal-disconnect-work@dlai.com").click();
  await expect(page.getByTestId("gcal-account-work@dlai.com")).toHaveCount(0);
  await expect(page.getByTestId("gcal-account-rohit@gmail.com")).toContainText("Default");
});
