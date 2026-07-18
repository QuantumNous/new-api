import { describe, expect, it } from "bun:test";

import { assertBundleBudgets } from "./check-bundle-budget.mjs";

const bytes = (kib) => kib * 1024;

describe("assertBundleBudgets", () => {
  it("accepts entry, largest chunk, and total sizes within their budgets", () => {
    expect(() =>
      assertBundleBudgets(
        {
          entry: { path: "static/js/index.js", gzipBytes: bytes(100) },
          largest: { path: "static/js/async/chart.js", gzipBytes: bytes(200) },
          totalGzipBytes: bytes(500),
        },
        { entryGzipKiB: 150, maxJsGzipKiB: 250, totalJsGzipKiB: 600 },
      ),
    ).not.toThrow();
  });

  it("rejects each budget independently", () => {
    const stats = {
      entry: { path: "static/js/index.js", gzipBytes: bytes(200) },
      largest: { path: "static/js/async/chart.js", gzipBytes: bytes(300) },
      totalGzipBytes: bytes(700),
    };

    expect(() =>
      assertBundleBudgets(stats, {
        entryGzipKiB: 150,
        maxJsGzipKiB: 350,
        totalJsGzipKiB: 800,
      }),
    ).toThrow("Entry bundle");
    expect(() =>
      assertBundleBudgets(stats, {
        entryGzipKiB: 250,
        maxJsGzipKiB: 250,
        totalJsGzipKiB: 800,
      }),
    ).toThrow("Largest JS chunk");
    expect(() =>
      assertBundleBudgets(stats, {
        entryGzipKiB: 250,
        maxJsGzipKiB: 350,
        totalJsGzipKiB: 600,
      }),
    ).toThrow("Total JavaScript");
  });
});
