import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CliLandingPage } from "@/components/cli-landing-page";

test("CLI media examples render the selected locale", () => {
  const html = renderToStaticMarkup(<CliLandingPage locale="zh" />);

  expect(html).toContain("真实媒体任务");
  expect(html).toContain("9:16 UGC 广告短片");
  expect(html).not.toContain("Real media jobs");
  expect(html).not.toContain("Campaign hero images");
});
