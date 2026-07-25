import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";

describe("FlatkeyBrandLogo", () => {
  test("renders the shared responsive brand lockup", () => {
    const html = renderToStaticMarkup(<FlatkeyBrandLogo />);

    expect(html).toContain('data-flatkey-brand="lockup"');
    expect(html).toContain('src="/flatkey-mark.svg"');
    expect(html).toContain('data-flatkey-wordmark="true"');
    expect(html).toContain("flatkey");
    expect(html).not.toContain("flatkey.ai");
    expect(html).toContain("min-[901px]:h-9");
    expect(html).toContain("min-[901px]:text-[28px]");
    expect(html).toContain("font-bold");
    expect(html).toContain("Public Sans");
    expect(html).toContain("#0B0B0F");
  });

  test("preserves caller layout classes", () => {
    const html = renderToStaticMarkup(<FlatkeyBrandLogo className="h-11 transition-transform" />);

    expect(html).toContain("h-11");
    expect(html).toContain("transition-transform");
  });
});
