import { describe, expect, test } from "bun:test";
import { MARKETS, getMarketMetadataInput } from "./market-landing";
import { SITE_ORIGIN, buildMetadata } from "./seo";

describe("market landing metadata", () => {
  // Market pages are physical single-locale routes: canonical must be the
  // literal slug (never /pt/br or /id/id-market) and no hreflang alternates,
  // since no [locale]-prefixed siblings exist.
  test("canonical is the unprefixed slug with no hreflang alternates", () => {
    for (const market of MARKETS) {
      const metadata = buildMetadata(getMarketMetadataInput(market.slug)!);
      expect(metadata.alternates?.canonical).toBe(`${SITE_ORIGIN}${market.slug}`);
      expect(metadata.alternates?.languages).toBeUndefined();
    }
  });
});
