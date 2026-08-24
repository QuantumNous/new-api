import { describe, expect, test } from "bun:test";
import { resolveWebsiteLoadingNavigationTarget } from "./website-loading-transition";

const CURRENT = "https://flatkey.ai/models";

describe("resolveWebsiteLoadingNavigationTarget", () => {
  test("triggers for same-origin model routes and contact pages", () => {
    expect(resolveWebsiteLoadingNavigationTarget({ href: "/models/seedance-2-0", windowHref: CURRENT })).toEqual({
      routeKey: "/models/seedance-2-0",
      sameOrigin: true,
    });
    expect(resolveWebsiteLoadingNavigationTarget({ href: "/zh/models/seedance-2-0", windowHref: CURRENT })).toEqual({
      routeKey: "/zh/models/seedance-2-0",
      sameOrigin: true,
    });
    expect(resolveWebsiteLoadingNavigationTarget({ href: "/contact?source=sales", windowHref: CURRENT })).toEqual({
      routeKey: "/contact?source=sales",
      sameOrigin: true,
    });
  });

  test("triggers for cross-origin same-tab sales and console links", () => {
    expect(
      resolveWebsiteLoadingNavigationTarget({
        href: "https://console.flatkey.ai/sign-up?lng=en",
        windowHref: CURRENT,
      }),
    ).toEqual({
      routeKey: "/sign-up?lng=en",
      sameOrigin: false,
    });
  });

  test("skips anchors and non-page navigation", () => {
    expect(resolveWebsiteLoadingNavigationTarget({ href: "#pricing", windowHref: CURRENT })).toBeNull();
    expect(resolveWebsiteLoadingNavigationTarget({ href: "/models#pricing", windowHref: CURRENT })).toBeNull();
    expect(resolveWebsiteLoadingNavigationTarget({ href: "/models?vendor=Qwen", localOnly: true, windowHref: CURRENT })).toBeNull();
    expect(resolveWebsiteLoadingNavigationTarget({ href: "mailto:sales@flatkey.ai", windowHref: CURRENT })).toBeNull();
    expect(resolveWebsiteLoadingNavigationTarget({ href: "/download", download: true, windowHref: CURRENT })).toBeNull();
    expect(resolveWebsiteLoadingNavigationTarget({ href: "/contact", target: "_blank", windowHref: CURRENT })).toBeNull();
    expect(resolveWebsiteLoadingNavigationTarget({ href: "/contact", metaKey: true, windowHref: CURRENT })).toBeNull();
  });
});
