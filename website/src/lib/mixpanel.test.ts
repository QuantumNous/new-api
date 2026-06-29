import { describe, expect, test } from "bun:test";
import { MIXPANEL_BROWSER_SCRIPT, MIXPANEL_TOKEN } from "./mixpanel";

describe("Mixpanel browser script", () => {
  test("uses the configured project token", () => {
    expect(MIXPANEL_TOKEN).toBe("cf2f149bd61f607c3fd578596ad86921");
    expect(MIXPANEL_BROWSER_SCRIPT).toContain(MIXPANEL_TOKEN);
  });

  test("initializes Mixpanel directly on page load", () => {
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("mixpanel.init");
    expect(MIXPANEL_BROWSER_SCRIPT).not.toContain("consent()!=='granted'");
    expect(MIXPANEL_BROWSER_SCRIPT).not.toContain(
      "flatkey_analytics_consent"
    );
  });

  test("uses the requested autocapture and session recording config", () => {
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("autocapture: true");
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("record_sessions_percent: 100");
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("start_session_recording");
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("stop_session_recording");
  });

  test("identifies the logged-in user when the website identity endpoint returns one", () => {
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("/api/mixpanel/current-user");
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("mixpanel.identify(String(user.id))");
    expect(MIXPANEL_BROWSER_SCRIPT).toContain("mixpanel.people.set");
  });
});
