import { describe, expect, test } from "bun:test";
import { SIGN_UP_URL } from "./pricing-links";

describe("pricing CTA link", () => {
  test("points pricing CTAs to the wallet top-up entry", () => {
    expect(SIGN_UP_URL).toBe("https://console.flatkey.ai/sign-in?redirect=/wallet");
  });
});
