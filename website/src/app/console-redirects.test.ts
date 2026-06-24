import { describe, expect, test } from "bun:test";
import { GET as dashboardRedirect } from "./dashboard/route";
import { GET as localizedSignInRedirect } from "./[locale]/sign-in/route";
import { GET as localizedSignUpRedirect } from "./[locale]/sign-up/route";
import { GET as localizedSetupRedirect } from "./[locale]/setup/route";
import { GET as signInRedirect } from "./sign-in/route";
import { GET as signUpRedirect } from "./sign-up/route";
import { GET as setupRedirect } from "./setup/route";

describe("console redirects", () => {
  test("preserves dashboard search params", () => {
    const response = dashboardRedirect(new Request("https://flatkey.ai/dashboard?next=%2Fplayground&utm_source=home"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://console.flatkey.ai/dashboard?next=%2Fplayground&utm_source=home");
  });

  test("preserves sign-in search params", () => {
    const response = signInRedirect(new Request("https://flatkey.ai/sign-in?redirect=%2Fdashboard"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://console.flatkey.ai/sign-in?redirect=%2Fdashboard");
  });

  test("preserves sign-up search params", () => {
    const response = signUpRedirect(new Request("https://flatkey.ai/sign-up?invite=abc123"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://console.flatkey.ai/sign-up?invite=abc123");
  });

  test("preserves localized sign-in search params", async () => {
    const response = await localizedSignInRedirect(new Request("https://flatkey.ai/es/sign-in?redirect=%2Fdashboard"), {
      params: Promise.resolve({ locale: "es" }),
    });

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://console.flatkey.ai/sign-in?redirect=%2Fdashboard");
  });

  test("preserves localized sign-up search params", async () => {
    const response = await localizedSignUpRedirect(new Request("https://flatkey.ai/fr/sign-up?invite=abc123"), {
      params: Promise.resolve({ locale: "fr" }),
    });

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://console.flatkey.ai/sign-up?invite=abc123");
  });

  test("routes setup to sign-up with keys redirect", () => {
    const response = setupRedirect(new Request("https://flatkey.ai/setup?utm_source=blog"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://console.flatkey.ai/sign-up?utm_source=blog&redirect=%2Fkeys"
    );
  });

  test("preserves an explicit setup redirect target", async () => {
    const response = await localizedSetupRedirect(
      new Request("https://flatkey.ai/ja/setup?redirect=%2Fdashboard&utm_source=blog"),
      {
        params: Promise.resolve({ locale: "ja" }),
      }
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://console.flatkey.ai/sign-up?redirect=%2Fdashboard&utm_source=blog"
    );
  });
});
