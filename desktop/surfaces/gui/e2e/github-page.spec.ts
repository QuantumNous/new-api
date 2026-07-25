// The GitHub detail page (github-relay-spec §8): one group per App INSTALLATION
// with People / Waiting rows and a per-installation disconnect, add-installation
// via the header MODAL (One click | Manual), and the park → allow & deliver flow
// that admits a new sender login into that installation's allow-list.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openGithubPage(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
  await page.getByTestId("connector-github").click();
}

test("lists each installation as its own group with people and waiting rows", async ({
  page,
}) => {
  await openGithubPage(page);
  const group = page.getByTestId("github-install-101");
  await expect(group).toContainText("acme");
  await expect(group).toContainText("selected repos"); // repo consent is GitHub-native
  await expect(group).toContainText("@rohit-dev"); // logins ARE the readable identity
  // the parked mention files under ITS installation, quoting the trigger
  await expect(group).toContainText("@maya-dev");
  await expect(group).toContainText("please take a look");
});

test("allow & deliver admits the sender into that installation's list", async ({
  page,
}) => {
  await openGithubPage(page);
  await page.getByTestId("parked-allow-deliver-gh-pk1").click();
  const group = page.getByTestId("github-install-101");
  await expect(group).toContainText("@maya-dev"); // now a People chip
  await expect(page.getByTestId("waiting-gh-pk1")).toHaveCount(0);
});

test("add installation opens the modal; signed in installs a second org", async ({
  page,
}) => {
  await openGithubPage(page);
  await page.getByTestId("add-installation-btn").click();
  const modal = page.getByTestId("add-connection-modal");
  await expect(modal).toContainText("@ocw-agent App"); // one-click pane
  await expect(modal).toContainText("Sign in to OpenWorker Cloud"); // signed out
  // Manual PAT pane is right there too — both modes, one entry point
  await modal.getByTestId("modal-pane-manual").click();
  await expect(modal).toContainText("Personal access token");
  await page.keyboard.press("Escape");

  // sign in from the list's cloud strip, then install one-click
  await page.getByTestId("connectors-breadcrumb").click();
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-row")).toContainText("Rohit", { timeout: 10_000 });
  await page.getByTestId("connector-github").click();
  await page.getByTestId("add-installation-btn").click();
  await page.getByTestId("modal-install-github-app").click();
  // the mock completes the browser install instantly; the page's poll shows it
  await expect(page.getByTestId("github-install-202")).toContainText("hooli", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("github-install-202")).toContainText("all repos");
  await expect(page.getByTestId("github-install-101")).toBeVisible(); // existing stays
});

test("modal has ONE connect button and sends no flow — authorize-first lives in the broker", async ({
  page,
}) => {
  // The broker's default github flow user-authorizes first (links existing installations,
  // redirects to the install page only when there are none) — so the modal's old
  // "Already installed? Link it" secondary and its flow=authorize are gone.
  await openGithubPage(page);
  await page.getByTestId("connectors-breadcrumb").click();
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-row")).toContainText("Rohit", { timeout: 10_000 });
  await page.getByTestId("connector-github").click();

  let flowSent: string | null = null;
  await page.route("**/v1/connectors/github/connect-managed", async (route) => {
    flowSent = (route.request().postDataJSON() || {}).flow ?? "";
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.getByTestId("add-installation-btn").click();
  await expect(page.getByTestId("modal-link-github-install")).toHaveCount(0);
  await page.getByTestId("modal-install-github-app").click();
  await expect.poll(() => flowSent).toBe("");
});

test("disconnect removes one installation and keeps the rest", async ({ page }) => {
  await openGithubPage(page);
  // add a second installation first (signed-in one-click)
  await page.getByTestId("connectors-breadcrumb").click();
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-sign-in").click();
  await expect(page.getByTestId("account-row")).toContainText("Rohit", { timeout: 10_000 });
  await page.getByTestId("connector-github").click();
  await page.getByTestId("add-installation-btn").click();
  await page.getByTestId("modal-install-github-app").click();
  await expect(page.getByTestId("github-install-202")).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape"); // the modal never auto-closes (by design)

  await page.getByTestId("disconnect-install-202").click();
  await expect(page.getByTestId("github-install-202")).toHaveCount(0);
  await expect(page.getByTestId("github-install-101")).toBeVisible();
});
