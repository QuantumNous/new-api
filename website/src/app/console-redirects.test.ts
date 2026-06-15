import { describe, expect, test } from "bun:test";
import { GET as dashboardRedirect } from "./dashboard/route";
import { GET as signInRedirect } from "./sign-in/route";
import { GET as signUpRedirect } from "./sign-up/route";

describe("console redirects", () => {
  test("preserves dashboard search params", () => {
    const response = dashboardRedirect(new Request("https://flatkey.ai/dashboard?next=%2Fplayground&utm_source=home"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://router.flatkey.ai/dashboard?next=%2Fplayground&utm_source=home");
  });

  test("preserves sign-in search params", () => {
    const response = signInRedirect(new Request("https://flatkey.ai/sign-in?redirect=%2Fdashboard"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://router.flatkey.ai/sign-in?redirect=%2Fdashboard");
  });

  test("preserves sign-up search params", () => {
    const response = signUpRedirect(new Request("https://flatkey.ai/sign-up?invite=abc123"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://router.flatkey.ai/sign-up?invite=abc123");
  });
});
