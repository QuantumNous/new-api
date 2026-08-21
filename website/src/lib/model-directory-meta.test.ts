import { describe, expect, test } from "bun:test";
import { getPricingData } from "./pricing";
import { MODEL_DIRECTORY_META } from "./model-directory-meta-data";

// The static metadata table is keyed by exact model name, so it silently loses
// coverage whenever a model is added or renamed upstream. This test fetches the
// live catalogue and reports the drift by name.
//
// Skipped when the pricing API is unreachable, so offline runs and CI without
// network access do not fail on an unrelated dependency.

const MODELS_PAGE_PRICING_GROUP = "plg";

const STAGING_PREVIEW_MODELS = [
  "bytedance/seedance-2.0",
  "bytedance/seedance-2.0-fast",
  "claude-3-5-haiku-20241022",
  "doubao/doubao-seedance-2-0-260128",
  "gemini-2.0-flash",
  "jimeng-image-4.5",
  "jimeng-image-5.0-lite",
  "jimeng-video-3.0-fast",
  "jimeng-video-3.0-pro",
  "jimeng-video-seedance-2.0",
  "jimeng-video-seedance-2.0-fast",
  "jimeng-video-seedance-2.0-mini",
  "mirothinker-1-7-deepresearch",
  "mirothinker-1-7-deepresearch-mini",
  "seedance-2.0",
  "seedance-2.0-fast",
  "seedance-2.0-mini",
] as const;

const PENDING_PRODUCTION_METADATA_MODELS = new Set([
  "eleven_multilingual_v2",
  "eleven_sound_v1",
  "mirothinker-1-7-deepresearch",
  "mirothinker-1-7-deepresearch-mini",
  "seedance-2.0",
  "seedance-2.0-fast",
  "seedance-2.0-mini",
]);

describe("model directory metadata coverage", () => {
  test("loads candidate metadata only in the staging preview build", () => {
    const loadedPreviewModels = STAGING_PREVIEW_MODELS.filter((name) => MODEL_DIRECTORY_META[name] != null);

    if (process.env.NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW === "true") {
      expect(loadedPreviewModels).toEqual(STAGING_PREVIEW_MODELS);
      for (const name of STAGING_PREVIEW_MODELS) {
        const metadata = MODEL_DIRECTORY_META[name];
        expect(metadata.vendor.trim(), `${name} vendor`).not.toBe("");
        expect(metadata.providers.length, `${name} providers`).toBeGreaterThan(0);
        expect(metadata.modalities.length, `${name} modalities`).toBeGreaterThan(0);
        expect(metadata.series.trim(), `${name} series`).not.toBe("");
        expect(metadata.categories.length, `${name} categories`).toBeGreaterThan(0);
        expect(metadata.releasedAt, `${name} releasedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof metadata.distillable, `${name} distillable`).toBe("boolean");
      }
    } else {
      expect(loadedPreviewModels).toEqual([]);
    }
  });

  test("fills every metadata-driven filter field in the staging preview build", () => {
    if (process.env.NEXT_PUBLIC_MODEL_DIRECTORY_STAGING_PREVIEW !== "true") return;

    for (const [name, metadata] of Object.entries(MODEL_DIRECTORY_META)) {
      expect(metadata.providers.length, `${name} providers`).toBeGreaterThan(0);
      expect(metadata.categories.length, `${name} categories`).toBeGreaterThan(0);
      expect(metadata.releasedAt, `${name} releasedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("flags unreviewed live gaps while allowing explicitly pending backfills", async () => {
    const pricing = await getPricingData(MODELS_PAGE_PRICING_GROUP);
    if (pricing.models.length === 0) {
      console.warn("pricing API unreachable — skipping metadata coverage check");
      return;
    }

    const live = new Set(pricing.models.map((model) => model.model_name));
    const covered = new Set(Object.keys(MODEL_DIRECTORY_META));

    const missing = [...live].filter((name) => !covered.has(name)).sort();
    const pending = missing.filter((name) => PENDING_PRODUCTION_METADATA_MODELS.has(name));
    const unexpectedMissing = missing.filter((name) => !PENDING_PRODUCTION_METADATA_MODELS.has(name));
    const stale = [...covered].filter((name) => !live.has(name)).sort();

    // A stale entry is inert — it describes a model the catalogue no longer
    // serves, so nothing renders from it. Worth reporting, not worth failing.
    if (stale.length > 0) {
      console.warn(`directory metadata for models no longer live:\n  ${stale.join("\n  ")}`);
    }

    // Reviewed gaps remain visible without bypassing the operator approval
    // gate. Any new live-model drift still fails this test immediately.
    if (pending.length > 0) {
      console.warn(`directory metadata pending operator review:\n  ${pending.join("\n  ")}`);
    }
    expect(
      unexpectedMissing,
      `unreviewed models live on /api/website/pricing with no directory metadata:\n  ${unexpectedMissing.join("\n  ")}`
    ).toEqual([]);
  }, 30_000);
});
