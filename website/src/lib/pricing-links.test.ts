import { describe, expect, test } from "bun:test";
import { SIGN_UP_URL, pricingCheckoutUrl } from "./pricing-links";

describe("pricing CTA link", () => {
  test("points pricing CTAs to the wallet top-up entry", () => {
    expect(SIGN_UP_URL).toBe("https://console.flatkey.ai/sign-in?redirect=/wallet");
  });

  test("preserves selected package context in wallet sign-in redirect", () => {
    expect(
      pricingCheckoutUrl({
        amount: 20,
        currency: "USD",
        amountMinor: 2000,
        stripeLookupKey: "topup-usd-2000",
      })
    ).toBe(
      "https://console.flatkey.ai/sign-in?redirect=%2Fwallet%3Famount%3D20%26currency%3DUSD%26amount_minor%3D2000%26stripe_lookup_key%3Dtopup-usd-2000"
    );
  });
});
