export const meta = {
  apiVersion: 1,
  key: "image-compress",
  name: { en: "Image compression", zh: "图片压缩" },
  description: {
    en: "Compresses large images in requests before they are sent upstream",
    zh: "发送到上游前压缩请求中的大图片",
  },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  // A failure sends the images as they are, which is safe.
  optional: true,
  configSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        title: { en: "Compression mode", zh: "压缩方式" },
        description: {
          en: "Lossless keeps every pixel and turns PNG and GIF images into WebP, so the upstream must accept WebP",
          zh: "无损模式保留全部像素，把 PNG 和 GIF 图片转为 WebP，上游需要支持 WebP",
        },
        enum: ["lossless", "lossy"],
        enumTitles: [
          { en: "Lossless", zh: "无损" },
          { en: "Lossy", zh: "有损" },
        ],
        default: "lossless",
      },
      minBytes: {
        type: "integer",
        title: { en: "Minimum image size", zh: "最小图片大小" },
        description: { en: "Images at least this large are compressed", zh: "不小于此大小的图片会被压缩" },
        unit: "byte",
        minimum: 0,
        default: 512000,
      },
      maxSide: {
        type: "integer",
        title: { en: "Maximum side length", zh: "最长边" },
        description: {
          en: "Images with a longer side are compressed and scaled down to fit",
          zh: "边长超过此值的图片会被压缩并等比缩小",
        },
        unit: "pixel",
        minimum: 16,
        maximum: 16384,
        default: 2048,
        visibleWhen: { mode: "lossy" },
      },
      format: {
        type: "string",
        title: { en: "Output format", zh: "输出格式" },
        description: {
          en: "Automatic uses PNG for images with transparency and JPEG for the rest",
          zh: "自动时有透明部分的图片用 PNG，其余用 JPEG",
        },
        enum: ["auto", "jpeg", "png"],
        enumTitles: [{ en: "Automatic", zh: "自动" }, "JPEG", "PNG"],
        default: "auto",
        visibleWhen: { mode: "lossy" },
      },
      // The host applies quality to JPEG output only.
      quality: {
        type: "integer",
        title: { en: "JPEG quality", zh: "JPEG 质量" },
        description: {
          en: "Higher keeps more detail and saves less space",
          zh: "越高越清晰，节省的空间越少",
        },
        minimum: 1,
        maximum: 100,
        default: 85,
        visibleWhen: { mode: "lossy", format: ["auto", "jpeg"] },
      },
    },
  },
  samples: [
    {
      name: { en: "Describe an image", zh: "描述图片" },
      lang: "en",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: [{ type: "text", text: "What is in this picture?" }, "[sample-image]"] }],
      },
    },
    {
      name: { en: "Describe an image", zh: "描述图片" },
      lang: "zh",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: [{ type: "text", text: "这张图片里有什么？" }, "[sample-image]"] }],
      },
    },
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
