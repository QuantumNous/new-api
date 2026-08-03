import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("server-only", () => ({}));

describe("OnlineContactPage", () => {
  test("renders localized contact copy for Japanese routes", async () => {
    const { OnlineContactPage } = await import("./online-contact-page");
    const html = renderToStaticMarkup(<OnlineContactPage locale="ja" />);

    expect(html).toContain("公式モデルでスケール");
    expect(html).toContain("営業に相談");
    expect(html).toContain("送信");
    expect(html).not.toContain("Scale on official models");
    expect(html).not.toContain("Talk to sales");
    expect(html).not.toContain("Send — we reply within 1 business day");
  });
});
