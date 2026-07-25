// Pre-connect connector detail page (UX-DECISIONS §38): an AVAILABLE row
// navigates to a subpage with the About paragraph, honest Access bullets, and
// the tool list behind a collapsed disclosure; Connect opens the same modal as
// the list's pill (which itself must NOT navigate).
import { expect } from "@playwright/test";
import { test } from "./fixtures";

async function openConnectors(page) {
  await page.goto("/");
  await page.getByTestId("account-row").click();
  await page.getByRole("button", { name: "Connectors", exact: true }).click();
}

test("available row opens the pre-connect detail page", async ({ page }) => {
  await openConnectors(page);
  await page.getByTestId("connector-gmail").click();

  const detail = page.getByTestId("available-detail");
  await expect(detail).toContainText("Search, summarize, and send over your Gmail.");
  await expect(page.getByTestId("available-access")).toContainText("Reads and searches your mail.");
  await expect(detail).toContainText("Keys and tokens are stored only on this computer");

  // Tools are a collapsed disclosure — advanced detail, closed by default.
  await expect(detail).toContainText("2 tools this connector adds");
  await expect(detail).not.toContainText("Send email");
  await page.getByTestId("available-tools-toggle").click();
  await expect(detail).toContainText("Send email");
  await expect(detail).toContainText("asks first"); // write tools carry the tag

  // Breadcrumb returns to the list.
  await page.getByTestId("connectors-breadcrumb").click();
  await expect(page.getByTestId("connector-gmail")).toBeVisible();
});

test("detail Connect opens the modal; the list pill skips navigation", async ({ page }) => {
  await openConnectors(page);
  await page.getByTestId("connector-gmail").click();
  await page.getByTestId("available-connect").click();
  await expect(page.getByTestId("add-connection-modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("add-connection-modal")).not.toBeVisible();

  // Back on the list, the pill goes straight to the modal — no detail page.
  await page.getByTestId("connectors-breadcrumb").click();
  await page.getByTestId("connector-gmail").getByRole("button", { name: "Connect" }).click();
  await expect(page.getByTestId("add-connection-modal")).toBeVisible();
  await expect(page.getByTestId("available-detail")).not.toBeVisible();
});
