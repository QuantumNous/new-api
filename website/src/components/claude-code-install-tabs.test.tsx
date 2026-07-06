import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ClaudeCodeInstallTabs } from "./claude-code-install-tabs";

describe("ClaudeCodeInstallTabs", () => {
  test("keeps install controls inside narrow mobile containers", () => {
    const html = renderToStaticMarkup(<ClaudeCodeInstallTabs locale="ja" />);

    expect(html).toContain("max-w-full");
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-x-auto");
  });
});
