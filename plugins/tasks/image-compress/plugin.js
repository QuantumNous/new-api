export const meta = {
  apiVersion: 1,
  key: "image-compress",
  name: { en: "Image compression" },
  description: { en: "Compresses large images in requests before they are sent upstream" },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  // A failure sends the images as they are, which is safe.
  optional: true,
  configSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        title: { en: "Compression mode" },
        description: { en: "Lossless keeps every pixel and turns PNG and GIF images into WebP, so the upstream must accept WebP" },
        enum: ["lossless", "lossy"],
        enumTitles: [
          { en: "Lossless" },
          { en: "Lossy" },
        ],
        default: "lossless",
      },
      minBytes: {
        type: "integer",
        title: { en: "Minimum image size" },
        description: { en: "Images at least this large are compressed" },
        unit: "byte",
        minimum: 0,
        default: 512000,
      },
      maxSide: {
        type: "integer",
        title: { en: "Maximum side length" },
        description: { en: "Images with a longer side are compressed and scaled down to fit" },
        unit: "pixel",
        minimum: 16,
        maximum: 16384,
        default: 2048,
        visibleWhen: { mode: "lossy" },
      },
      format: {
        type: "string",
        title: { en: "Output format" },
        description: { en: "Automatic uses PNG for images with transparency and JPEG for the rest" },
        enum: ["auto", "jpeg", "png"],
        enumTitles: [{ en: "Automatic" }, "JPEG", "PNG"],
        default: "auto",
        visibleWhen: { mode: "lossy" },
      },
      // The host applies quality to JPEG output only.
      quality: {
        type: "integer",
        title: { en: "JPEG quality" },
        description: { en: "Higher keeps more detail and saves less space" },
        minimum: 1,
        maximum: 100,
        default: 85,
        visibleWhen: { mode: "lossy", format: ["auto", "jpeg"] },
      },
    },
  },
  samples: [
{
      name: { en: "Describe an image" },
      lang: "en",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: [{ type: "text", text: "What is in this picture?" }, "[sample-image]"] }],
      },
    }
],
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
// Lossless WebP of a JPEG or WebP image comes out larger, so the host would
// do the work and keep the original: the pixels of a lossy image carry its
// coding noise, and a lossless WebP is already as small as the host's
// encoder makes it.
const LOSSLESS_TYPES = ["image/png", "image/gif"];
// The host takes at most 32 effects from one call; later images stay as sent.
const MAX_EFFECTS = 32;

export function outbound(ctx, req) {
  const config = ctx.config || {};
  const lossless = config.mode !== "lossy";
  const effects = [];
  for (const media of req.media || []) {
    if (effects.length >= MAX_EFFECTS) break;
    const mimeType = String(media.mimeType || "").toLowerCase();
    if (!IMAGE_TYPES.includes(mimeType)) continue;
    // Lossless never resizes, so only the file size qualifies an image there.
    // The host keeps an image whose new encoding is not smaller.
    if (lossless) {
      if (LOSSLESS_TYPES.includes(mimeType) && media.bytes >= config.minBytes) {
        effects.push({ type: "media.reencode", media: media.index, format: "webp" });
      }
      continue;
    }
    const longerSide = Math.max(media.width || 0, media.height || 0);
    if (media.bytes < config.minBytes && longerSide <= config.maxSide) continue;
    effects.push({
      type: "media.reencode",
      media: media.index,
      format: config.format,
      quality: config.quality,
      maxSide: config.maxSide,
    });
  }
  return { action: "continue", effects: effects };
}
