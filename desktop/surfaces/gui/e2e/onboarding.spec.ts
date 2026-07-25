// First-run onboarding (UX-DECISIONS §24 → §29 → §39): model → your tools → go.
// §39: step 1 is a provider GALLERY (cards wear their own state; a card opens its key
// form inside a fixed-height swap region; Test verifies, SAVES, and returns) and step 2
// is a two-state tools page (why-paragraph + sign-in → mini connector gallery with live
// one-click connects). Entered here via the REPLAY path (Settings ▸ Appearance ▸ "Run
// setup again") — which is itself under test.
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openOnboarding(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByTestId("account-menu").getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Run setup again" }).click();
  await expect(page.getByTestId("ob-step-model")).toBeVisible();
}

test("provider gallery: cards wear their state; Next arms off stored credentials", async ({
  page,
}) => {
  await openOnboarding(page);

  // Every card carries its own status with zero clicks (the 2026-07-16 confusion —
  // "is OpenAI already connected?" — is answered by the gallery itself).
  await expect(page.getByTestId("ob-provider-openai")).toContainText("✓ Connected");
  await expect(page.getByTestId("ob-provider-anthropic")).toContainText("✓ Connected");
  await expect(page.getByTestId("ob-provider-zai")).toContainText("Not set up");
  await expect(page.getByTestId("ob-provider-ollama")).toContainText("No key needed");
  // Recognition-first order: anthropic before openai before the OpenAI-compat tail.
  const names = await page
    .getByTestId("ob-provider-gallery")
    .locator("[data-testid^=ob-provider-]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(names.indexOf("ob-provider-anthropic")).toBeLessThan(names.indexOf("ob-provider-openai"));
  expect(names.indexOf("ob-provider-openai")).toBeLessThan(names.indexOf("ob-provider-zai"));

  // A configured provider already arms Next — no form visit required.
  await expect(page.getByTestId("ob-continue")).toBeEnabled();
  await page.getByTestId("ob-continue").click();
  await expect(page.getByTestId("ob-step-tools")).toBeVisible();
});

test("key form: Test verifies, saves, and returns to the gallery with the ✓", async ({
  page,
}) => {
  await openOnboarding(page);

  await page.getByTestId("ob-provider-zai").click();
  // The header stays put (§39 fixed frame): the welcome headline is still on screen.
  await expect(page.getByRole("heading", { name: "Welcome to OpenWorker" })).toBeVisible();
  // Optional endpoint is a quiet disclosure with no explainer copy (owner call 2026-07-18).
  await expect(page.getByTestId("ob-field-base_url")).toHaveCount(0);
  await page.getByTestId("ob-endpoint-link").click();
  await expect(page.getByTestId("ob-field-base_url")).toHaveValue(/api\.z\.ai/);

  // Bad key: the error is a line, not a navigation.
  await page.getByTestId("ob-field-api_key").fill("bad-key");
  await page.getByTestId("ob-test").click();
  await expect(page.getByText("Invalid API key.")).toBeVisible();

  // Good key: state lands IN the field ("✓ Tested & saved" pill), then the form
  // auto-returns to the gallery where the Z AI card now wears its ✓.
  await page.getByTestId("ob-field-api_key").fill("zk-good");
  await page.getByTestId("ob-test").click();
  await expect(page.getByTestId("ob-saved-pill")).toBeVisible();
  await expect(page.getByTestId("ob-provider-zai")).toContainText("✓ Connected", {
    timeout: 5_000,
  });
  await expect(page.getByTestId("ob-continue")).toBeEnabled();
});

test("key form: revisiting a connected provider shows the in-field saved state; drafts survive switching", async ({
  page,
}) => {
  await openOnboarding(page);

  // Revisit a configured provider: green in-field pill + masked placeholder — the old
  // empty-password-field-reads-as-not-set-up trap (owner complaint 2026-07-16) is gone.
  await page.getByTestId("ob-provider-openai").click();
  await expect(page.getByTestId("ob-saved-pill")).toBeVisible();
  await expect(page.getByTestId("ob-field-api_key")).toHaveAttribute("placeholder", "••••••••");

  // Typed-but-unsaved input survives a peek at another provider (drafts).
  await page.getByTestId("ob-back").click();
  await page.getByTestId("ob-provider-zai").click();
  await page.getByTestId("ob-field-api_key").fill("zk-draft");
  await page.getByTestId("ob-back").click();
  await page.getByTestId("ob-provider-openai").click();
  await expect(page.getByTestId("ob-saved-pill")).toBeVisible();
  await page.getByTestId("ob-back").click();
  await page.getByTestId("ob-provider-zai").click();
  await expect(page.getByTestId("ob-field-api_key")).toHaveValue("zk-draft");

  // Next from a dirty form auto-verifies and saves first (2026-07-12: no hidden
  // Test-then-Continue two-step), then advances.
  await page.getByTestId("ob-field-api_key").fill("zk-good");
  await page.getByTestId("ob-continue").click();
  await expect(page.getByTestId("ob-step-tools")).toBeVisible();
});

test("tools page: sign-in morphs the page into the connector gallery; a card connects one-click", async ({
  page,
}) => {
  await openOnboarding(page);
  await page.getByTestId("ob-continue").click();
  await expect(page.getByTestId("ob-step-tools")).toBeVisible();

  // Pre-sign-in (§41): the benefit rows are already there (no Connect buttons yet),
  // the combined Google row says Coming soon, the band asks for sign-in, and the one
  // footer button is the quiet "Continue without sign-in".
  await expect(page.getByText("Chat can only advise")).toBeVisible();
  await expect(page.getByTestId("ob-tool-outlook")).toContainText("Stay on top of email");
  await expect(page.getByTestId("ob-tool-outlook").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("ob-tool-attio")).toContainText("Track every relationship");
  await expect(page.getByTestId("ob-tool-google-soon")).toContainText("Coming soon");
  await expect(page.getByText("Sign in for one-click connections")).toBeVisible();
  await expect(page.getByTestId("ob-tools-skip")).toContainText("Continue without sign-in");

  // Sign-in lands out-of-band; the band's SLOT stays put and flips to the congrats
  // (zero layout shift), and every row grows its Connect pill.
  await page.getByTestId("ob-cloud-signin").click();
  await expect(page.getByTestId("ob-tools-signedin")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("ob-tools-signedin")).toContainText("You’re signed in");
  await expect(
    page.getByTestId("ob-tool-attio").getByRole("button", { name: "Connect" }),
  ).toBeVisible();
  await expect(page.getByTestId("ob-tool-google-soon").getByRole("button")).toHaveCount(0);

  // One-click connect: the consent completes in the (mock) browser; the poll flips the
  // row to ✓ Connected. Next was armed the whole time — connecting is optional.
  await page.getByTestId("ob-tool-outlook").getByRole("button", { name: "Connect" }).click();
  await expect(page.getByTestId("ob-tool-outlook")).toContainText("✓ Connected", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("ob-continue-tools")).toBeEnabled();
  await page.getByTestId("ob-continue-tools").click();

  // Done step: the automation CTA lands on the Automations quickstart.
  await expect(page.getByTestId("ob-step-done")).toBeVisible();
  await page.getByTestId("ob-cta-automation").click();
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Automations" })).toBeVisible();
});

test("tools page skips cleanly; Start working lands in a session with the panel open", async ({
  page,
}) => {
  await openOnboarding(page);
  await page.getByTestId("ob-continue").click();
  await page.getByTestId("ob-tools-skip").click();
  await expect(page.getByTestId("ob-step-done")).toBeVisible();
  await page.getByTestId("ob-start").click();
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
  // §32: "Start working" lands with the rail's Access section expanded (the drawer is gone).
  await expect(page.getByRole("region", { name: "Session access" })).toBeVisible();
});
