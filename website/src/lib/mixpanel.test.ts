import { describe, expect, test } from "bun:test";
import {
  MIXPANEL_BROWSER_SCRIPT,
  MIXPANEL_CONSENT_KEY,
  MIXPANEL_TOKEN,
} from "./mixpanel";

describe("Mixpanel browser script", () => {
  test("uses the configured project token", () => {
    expect(MIXPANEL_TOKEN).toBe("cf2f149bd61f607c3fd578596ad86921");
    expect(MIXPANEL_BROWSER_SCRIPT).toContain(MIXPANEL_TOKEN);
  });

  test("waits for explicit analytics consent before initialization", () => {
    expect(MIXPANEL_BROWSER_SCRIPT).toContain(MIXPANEL_CONSENT_KEY);
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("granted");
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("mixpanel.init");
  });
});
