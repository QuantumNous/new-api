import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactPage } from "./contact-page";

describe("ContactPage", () => {
  test("renders the contact support title as the page H1", () => {
    const html = renderToStaticMarkup(<ContactPage locale="en" />);

    expect(html).toContain("<h1");
    expect(html).toContain("Questions? Talk to us.");
  });
});
