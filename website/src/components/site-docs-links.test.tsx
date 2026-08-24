import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteConfigProvider } from "./site-config-provider";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SiteShell } from "./site-shell";

const DOCS_URL = "https://docs.example.com/start";

function renderHeader(docsUrl: string | null, pathname = "/") {
  return renderToStaticMarkup(
    <SiteConfigProvider docsUrl={docsUrl}>
      <SiteHeader locale="en" pathname={pathname} />
    </SiteConfigProvider>,
  );
}

function openingTagBeforeText(html: string, tagName: "a" | "button", text: string) {
  const textIndex = html.indexOf(`>${text}<`);
  expect(textIndex).toBeGreaterThanOrEqual(0);

  const tagStart = html.lastIndexOf(`<${tagName}`, textIndex);
  expect(tagStart).toBeGreaterThanOrEqual(0);

  const tagEnd = html.indexOf(">", tagStart);
  expect(tagEnd).toBeGreaterThan(tagStart);

  return html.slice(tagStart, tagEnd + 1);
}

function renderFooter(docsUrl: string | null) {
  return renderToStaticMarkup(
    <SiteConfigProvider docsUrl={docsUrl}>
      <SiteFooter locale="en" />
    </SiteConfigProvider>,
  );
}

describe("website documentation links", () => {
  test("renders safe desktop and mobile resource links before Use Cases", () => {
    const html = renderHeader(DOCS_URL);
    const docsAnchors =
      html.match(/<a[^>]+href="https:\/\/docs\.example\.com\/start"[^>]*>/g) ??
      [];

    expect(docsAnchors.length).toBeGreaterThan(0);
    for (const docsAnchor of docsAnchors) {
      expect(docsAnchor).toContain('target="_blank"');
      expect(docsAnchor).toContain('rel="noopener noreferrer"');
    }
    expect(html.indexOf(">Ranking<")).toBeLessThan(html.indexOf(">Documentation<"));
    expect(html.indexOf(">Documentation<")).toBeLessThan(
      html.indexOf(">Use Cases<"),
    );
    expect(html).toContain('aria-label="Toggle navigation menu"');
    expect(html).not.toContain(">Menu<");
  });

  test("renders a safe footer link before legal links", () => {
    const html = renderFooter(DOCS_URL);
    const docsAnchor = html.match(
      /<a[^>]+href="https:\/\/docs\.example\.com\/start"[^>]*>/,
    )?.[0];

    expect(docsAnchor).toContain('target="_blank"');
    expect(docsAnchor).toContain('rel="noopener noreferrer"');
    expect(html.indexOf(">Documentation<")).toBeLessThan(
      html.indexOf(">Terms of Service<"),
    );
    expect(html).toContain('href="https://discord.gg/Xnm8Cc7JRD"');
  });

  test("hides header and footer entries when the setting is unavailable", () => {
    expect(renderHeader(null)).not.toContain("Documentation");
    expect(renderFooter(null)).not.toContain("Documentation");
  });

  test("defaults the public site sign-in link to the console sign-in page", () => {
    const html = renderToStaticMarkup(
      <SiteConfigProvider docsUrl={DOCS_URL}>
        <SiteShell locale="en" pathname="/">
          <div>body</div>
        </SiteShell>
      </SiteConfigProvider>,
    );

    expect(html).toContain(
      'href="https://console.flatkey.ai/sign-in?lng=en"',
    );
  });

  test("renders desktop dropdown triggers as borderless menu buttons matching normal link typography", () => {
    const html = renderHeader(DOCS_URL);
    const productButton = openingTagBeforeText(html, "button", "Product");
    const resourceButton = openingTagBeforeText(html, "button", "Resource");
    const cliLink = openingTagBeforeText(html, "a", "CLI");

    for (const trigger of [productButton, resourceButton]) {
      expect(trigger).toContain("border-0");
      expect(trigger).toContain("appearance-none");
      expect(trigger).toContain("cursor-pointer");
      expect(trigger).toContain("[font-family:inherit]");
      expect(trigger).toContain("text-[14px]");
      expect(trigger).toContain("font-semibold");
      expect(trigger).toContain("text-[#0B0B0F]");
      expect(trigger).toContain("px-1.5");
      expect(trigger).not.toContain("hover:bg");
      expect(trigger).not.toContain("after:");
    }

    expect(cliLink).toContain("[font-family:inherit]");
    expect(cliLink).toContain("text-[14px]");
    expect(cliLink).toContain("font-semibold");
    expect(cliLink).toContain("text-[#0B0B0F]");
    expect(cliLink).toContain("px-1.5");
    expect(cliLink).not.toContain("after:");
    expect(html).not.toContain("desktopNavDotClass");
    expect(html).not.toContain("rounded-full bg-[#AAA7B0]");
    expect(html).not.toContain("size-1.5 shrink-0 rounded-full");
  });

  test("uses a stable selected menu text state without background, underline, or scaling", () => {
    const modelsHtml = renderHeader(DOCS_URL, "/models");
    const pricingHtml = renderHeader(DOCS_URL, "/pricing");
    const productButton = openingTagBeforeText(modelsHtml, "button", "Product");
    const pricingLink = openingTagBeforeText(pricingHtml, "a", "Pricing");

    for (const activeItem of [productButton, pricingLink]) {
      expect(activeItem).toContain("text-[#050505]");
      expect(activeItem).not.toContain("bg-[#F7F2FF]");
      expect(activeItem).not.toContain("bg-[#F3EDFF]");
      expect(activeItem).not.toContain("scale-[1.04]");
      expect(activeItem).not.toContain("text-shadow");
      expect(activeItem).not.toContain("after:");
    }
  });

  test("keeps dropdowns open across the hover bridge and animates dropdown item hover", () => {
    const html = renderHeader(DOCS_URL);

    expect(html).toContain("before:top-full");
    expect(html).toContain("before:h-3");
    expect(html).toContain("group-hover/nav:pointer-events-auto");
    expect(html).toContain("hover:translate-x-1");
    expect(html).toContain("hover:scale-[1.01]");
  });

  test("opens the desktop language menu on hover with a pointer cursor", () => {
    const html = renderHeader(DOCS_URL);
    const languageButton = html.match(
      /<button[^>]+aria-label="Change language"[^>]*>/,
    )?.[0];

    expect(languageButton).toContain("cursor-pointer");
    expect(html).toContain("group/language");
    expect(html).toContain("group-hover/language:pointer-events-auto");
    expect(html).toContain("before:w-[178px]");
  });
});
