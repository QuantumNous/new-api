// Google one-click paused pending CASA verification (owner ask 2026-07-22): the managed
// button parks with a "Coming soon" badge — pre-connect modal AND the connected page's
// add-account — while the manual token path stays fully live. The shared fixture keeps
// gmail unpaused (the cloud-machinery specs use it as their one-click subject), so this
// spec overrides the connectors payload per test, like automations-quickstart does.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

const GMAIL_BASE = {
  name: "gmail",
  title: "Gmail",
  icon: "✉",
  blurb: "Search, summarize, draft, and send email.",
  about: "Search, summarize, and send over your Gmail.",
  access: ["Reads and searches your mail."],
  auth: "oauth",
  two_way: false,
  channels: false,
  available: true,
  brand_color: "#ea4335",
  logo: "gmail",
  fields: [
    { key: "access_token", label: "OAuth access token", secret: true, required: true, help: "", placeholder: "" },
  ],
  instructions: [],
  account: null,
  allowed_users: [],
  tools: [],
  managed: true,
  managed_paused: true,
  managed_profile: false,
};

async function serveGmail(page, extra: Record<string, unknown>) {
  await page.route("**/v1/connectors", (route) =>
    route.fulfill({ json: { connectors: [{ ...GMAIL_BASE, connected: false, enabled: false, ...extra }] } }),
  );
}

async function openConnectors(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
}

test("paused one-click: Coming soon badge in the connect modal, manual path alive", async ({
  page,
}) => {
  await serveGmail(page, {});
  await openConnectors(page);
  await page.getByTestId("connector-gmail").getByRole("button", { name: "Connect", exact: true }).click();

  const soon = page.getByTestId("managed-coming-soon");
  await expect(soon).toBeVisible();
  await expect(soon).toBeDisabled();
  await expect(soon).toContainText("Coming soon");
  await expect(page.getByText("connect manually below for now")).toBeVisible();
  // The manual token field is still right there.
  await expect(page.getByText("OAuth access token")).toBeVisible();
});

test("paused one-click: connected page's add-account is parked too", async ({ page }) => {
  await serveGmail(page, {
    connected: true,
    enabled: true,
    account: "rohit@gmail.com",
    accounts: [
      { email: "rohit@gmail.com", default: true, managed: true, scopes: "gmail", needs_reauth: false },
    ],
    filters: { senders: [], labels: [] },
  });
  await openConnectors(page);
  await page.getByTestId("connector-gmail").click();
  await expect(page.getByTestId("gmail-detail")).toBeVisible();

  const add = page.getByTestId("add-account-btn");
  await expect(add).toBeDisabled();
  await expect(add).toContainText("Coming soon");
  // Existing accounts keep working and stay manageable.
  await expect(page.getByTestId("gmail-account-rohit@gmail.com")).toContainText("Default");
});
