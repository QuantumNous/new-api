const MUSE_MODELS = { "muse-image-1.0": {} };
const MUSE_SIZES = ["1024x1024", "1536x1024", "1024x1536"];
const MAX_IMAGE_COUNT = 10;
const IMAGE_UNIT_LABEL = { en: "image", zh: "张", "zh-TW": "張", fr: "image", ja: "枚", ru: "изображение", vi: "ảnh" };

export const meta = {
  apiVersion: 1,
  key: "muse",
  name: "Muse",
  icon: "Meta.Color",
  description: {
    en: "Muse image generation",
    zh: "Muse 图片生成",
  },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  models: Object.keys(MUSE_MODELS),
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    image_count: {
      type: "number",
      unit: "count",
      unitLabel: IMAGE_UNIT_LABEL,
      description: { en: "Image generation unit price", zh: "图片生成单价" },
    },
  },
  usageExamples: [
    { label: "1 image", facts: { image_count: 1 } },
    { label: "2 images", facts: { image_count: 2 } },
  ],
  protocols: [{ name: "openai_image", models: Object.keys(MUSE_MODELS) }],
};

function trimmed(value) {
  return String(value || "").trim();
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function imageInteger(value, name) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || number > MAX_IMAGE_COUNT)
    throw new Error(name + " must be an integer between 1 and " + MAX_IMAGE_COUNT);
  return number;
}

function imageModel(identity) {
  const names = [identity && identity.upstreamModel, identity && identity.model].map(trimmed).filter(Boolean);
  for (const name of names) {
    if (MUSE_MODELS[name]) return name;
  }
  throw new Error((names[0] || "model") + " is not a supported Muse image model");
}

function imageRequest(source, identity, operation) {
  const body = plainObject(source);
  if (!body) throw new Error("request body must be an object");
  if (operation !== "generate" && operation !== "image_generation") throw new Error("Muse image edits are not supported");
  const model = imageModel(identity);
  if (body.aspect_ratio !== undefined) throw new Error("aspect_ratio is not supported by Muse; use size");
  if (body.resolution !== undefined || body.quality !== undefined)
    throw new Error("resolution and quality are not supported by Muse; use size");
  if (body.image !== undefined || body.images !== undefined || body.mask !== undefined)
    throw new Error("Muse image edits are not supported");
  if (body.stream === true || body.stream === "true") throw new Error("stream is not supported");
  const prompt = trimmed(body.prompt);
  if (!prompt) throw new Error("prompt is required");
  const count = imageInteger(body.n === undefined || body.n === null || body.n === "" ? 1 : body.n, "n");
  const size = body.size === undefined || body.size === null || body.size === "" ? MUSE_SIZES[0] : trimmed(body.size);
  if (!MUSE_SIZES.includes(size)) throw new Error("size must be one of " + MUSE_SIZES.join(", "));
  if (body.response_format !== undefined && body.response_format !== "url" && body.response_format !== "b64_json")
    throw new Error("response_format must be url or b64_json");
  const responseFormat = body.response_format === undefined ? "url" : body.response_format;
  return { model: model, prompt: prompt, n: count, size: size, response_format: responseFormat };
}

function imageEntries(body) {
  const data = plainObject(body) ? body.data : null;
  const entries = Array.isArray(data) ? data : data ? [data] : [];
  return entries.filter(function (item) {
    return plainObject(item) && (trimmed(item.url) || trimmed(item.b64_json));
  });
}

function imagePayloadCount(body) {
  const data = plainObject(body) ? body.data : null;
  if (!Array.isArray(data)) return imageEntries(body).length;
  let urls = 0;
  let b64s = 0;
  for (const item of data) {
    if (!plainObject(item)) continue;
    if (trimmed(item.url)) urls++;
    if (trimmed(item.b64_json)) b64s++;
  }
  return Math.max(urls, b64s);
}

export function buildSubmitRequest(ctx) {
  const request = imageRequest(ctx.requestBody || {}, ctx, ctx.action);
  request.model = ctx.upstreamModel || request.model;
  return {
    url: ctx.baseUrl + "/v1/images/generations",
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
    body: request,
    action: "image_generation",
    rewriteModel: ctx.upstreamModel || ctx.model,
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = plainObject(resp.body);
  if (!body) throw new Error("invalid Muse image response");
  const result = { taskId: ctx.publicTaskId, taskData: body };
  if (!imageEntries(body).length) result.immediate = { status: "FAILURE", reason: "Muse returned no images" };
  else result.immediate = { status: "SUCCESS", progress: "100%" };
  return result;
}

export function parseTaskResult() {
  return { status: "SUCCESS" };
}

export function buildQueryRequest() {
  throw new Error("Muse image requests complete synchronously");
}

export function extractUsage(ctx) {
  const request = imageRequest(ctx.requestBody || {}, ctx, ctx.action);
  return { image_count: request.n };
}

export function extractUsageOnComplete(task, result, body) {
  if (!task || task.action !== "image_generation") return null;
  return { image_count: imagePayloadCount(body) };
}

export const protocols = {
  openai_image: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("Muse image generation requires a JSON body");
      const request = imageRequest(ctx.body.value, ctx, ctx.operation);
      return { kind: "submit", model: ctx.model, action: "image_generation", requestBody: request };
    },
    render: function (ctx, task) {
      const data = imageEntries(task.data).map(function (item) {
        const entry = {};
        if (trimmed(item.url)) entry.url = item.url;
        if (trimmed(item.b64_json)) entry.b64_json = item.b64_json;
        if (trimmed(item.revised_prompt)) entry.revised_prompt = item.revised_prompt;
        return entry;
      });
      if (!data.length) throw new Error("Muse returned no images");
      return { created: task.created_at, data: data };
    },
  },
};
