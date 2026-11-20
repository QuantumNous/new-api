import { lazySchema, zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const nonEmptyStringSchema = z.string().min(1);
const resolutionSchema = z.enum(['480p', '720p']);
const modeSchema = z.enum(['edit-video', 'extend-video', 'reference-to-video']);

export type XaiVideoMode = z.infer<typeof modeSchema>;
type XaiVideoResolution = z.infer<typeof resolutionSchema>;

interface XaiVideoSharedOptions {
  pollIntervalMs?: number | null;
  pollTimeoutMs?: number | null;
  resolution?: XaiVideoResolution | null;
}

interface XaiVideoUserOptions {
  /**
   * A unique identifier representing the end user, for abuse monitoring.
   */
  user?: string;
}

interface XaiVideoEditModeOptions
  extends XaiVideoSharedOptions, XaiVideoUserOptions {
  /**
   * Select edit-video mode explicitly for best autocomplete and narrowing.
   */
  mode: 'edit-video';
  /** Source video URL to edit. */
  videoUrl: string;
}

interface XaiVideoExtendModeOptions extends XaiVideoSharedOptions {
  /**
   * Select extend-video mode explicitly for best autocomplete and narrowing.
   */
  mode: 'extend-video';
  /** Source video URL to extend from its last frame. */
  videoUrl: string;
}

interface XaiVideoReferenceToVideoOptions
  extends XaiVideoSharedOptions, XaiVideoUserOptions {
  /**
   * Select reference-to-video mode explicitly for best autocomplete and narrowing.
   */
  mode: 'reference-to-video';
  /** Reference image URLs (1-7) for R2V generation. */
  referenceImageUrls: string[];
}

interface XaiVideoGenerationOptions
  extends XaiVideoSharedOptions, XaiVideoUserOptions {
  mode?: undefined;
  videoUrl?: undefined;
  referenceImageUrls?: undefined;
}

interface XaiLegacyEditVideoOptions
  extends XaiVideoSharedOptions, XaiVideoUserOptions {
  /**
   * Legacy backward-compatible shape: omitting `mode` while providing
   * `videoUrl` behaves like edit-video.
   */
  mode?: undefined;
  videoUrl: string;
}

interface XaiLegacyReferenceToVideoOptions
  extends XaiVideoSharedOptions, XaiVideoUserOptions {
  /**
   * Legacy backward-compatible shape: omitting `mode` while providing
   * `referenceImageUrls` behaves like reference-to-video.
   */
  mode?: undefined;
  referenceImageUrls: string[];
}

/**
 * Provider options for xAI video generation.
 *
 * Use the `mode` option to select the operation:
 *
 * - `'edit-video'`         + `videoUrl`           -- video editing   (`POST /v1/videos/edits`)
 * - `'extend-video'`       + `videoUrl`           -- video extension (`POST /v1/videos/extensions`)
 * - `'reference-to-video'` + `referenceImageUrls` -- R2V generation  (`POST /v1/videos/generations`)
 * - no `mode`                                     -- standard generation from text prompts or image input
 *
 * Runtime remains backward compatible with legacy auto-detected provider
 * options, but the public TypeScript type is intentionally explicit so editors
 * can suggest valid modes and flag invalid field combinations.
 */
export type XaiVideoModelOptions =
  | XaiVideoGenerationOptions
  | XaiVideoEditModeOptions
  | XaiVideoExtendModeOptions
  | XaiVideoReferenceToVideoOptions
  | XaiLegacyEditVideoOptions
  | XaiLegacyReferenceToVideoOptions;

// ── Runtime schemas ───────────────────────────────────────────────────
const baseFields = {
  pollIntervalMs: z.number().positive().nullish(),
  pollTimeoutMs: z.number().positive().nullish(),
  resolution: resolutionSchema.nullish(),
};

const userField = {
  user: z.string().optional(),
};

const editVideoSchema = z.object({
  ...baseFields,
  ...userField,
  mode: z.literal('edit-video'),
  videoUrl: nonEmptyStringSchema,
  referenceImageUrls: z.undefined().optional(),
});

const extendVideoSchema = z.object({
  ...baseFields,
  mode: z.literal('extend-video'),
  videoUrl: nonEmptyStringSchema,
  referenceImageUrls: z.undefined().optional(),
});

const referenceToVideoSchema = z.object({
  ...baseFields,
  ...userField,
  mode: z.literal('reference-to-video'),
  referenceImageUrls: z.array(nonEmptyStringSchema).min(1).max(7),
  videoUrl: z.undefined().optional(),
});

const autoDetectSchema = z.object({
  ...baseFields,
  ...userField,
  mode: z.undefined().optional(),
  videoUrl: nonEmptyStringSchema.optional(),
  referenceImageUrls: z.array(nonEmptyStringSchema).min(1).max(7).optional(),
});

export const xaiVideoModelOptions = z.union([
  editVideoSchema,
  extendVideoSchema,
  referenceToVideoSchema,
  autoDetectSchema,
]);

const runtimeSchema = z.looseObject({
  mode: modeSchema.optional(),
  videoUrl: nonEmptyStringSchema.optional(),
  referenceImageUrls: z.array(nonEmptyStringSchema).min(1).max(7).optional(),
  user: z.string().optional(),
  ...baseFields,
});

export type XaiParsedVideoModelOptions = z.infer<typeof runtimeSchema>;

export const xaiVideoModelOptionsSchema = lazySchema(() =>
  zodSchema(runtimeSchema),
);
