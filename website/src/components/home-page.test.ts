import { describe, expect, test } from "bun:test";
import { HOMEPAGE_SUPPORTED_APPS } from "./home-page";

describe("homepage supported apps", () => {
  test("does not pull remote app icons into the mobile first render", () => {
    for (const app of HOMEPAGE_SUPPORTED_APPS) {
      expect(app.iconUrl ?? "").not.toMatch(/^https?:\/\//);
    }
  });
});
