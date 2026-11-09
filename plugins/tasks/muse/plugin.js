const MUSE_MODELS = { "muse-image-1.0": {} };
const MUSE_SIZES = ["1024x1024", "1536x1024", "1024x1536"];
const MAX_IMAGE_COUNT = 10;
const MAX_INPUT_IMAGES = 10;
const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
const IMAGE_UNIT_LABEL = { en: "image", zh: "张", "zh-TW": "張", fr: "image", ja: "枚", ru: "изображение", vi: "ảnh" };

export const meta = {
  apiVersion: 1,
  key: "muse",
  name: "Muse",
  icon: "Meta.Color",
  description: {
    en: "Muse image generation and editing",
    zh: "Muse 图片生成和编辑",
  },
  version: "1.1.0",
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

function isFileRef(value) {
  return plainObject(value) && typeof value.__fileRef === "string";
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

function imageAction(operation) {
  if (operation === "edit" || operation === "image_edit") return "image_edit";
  if (operation === "generate" || operation === "image_generation") return "image_generation";
  throw new Error("Muse image operation is not supported");
}

function imageInput(value) {
  if (typeof value === "string") {
    const input = trimmed(value);
    if (/^(https?:\/\/|data:image\/)/i.test(input)) return { image_url: input };
    throw new Error("image must be an HTTP URL or Base64 data URL");
  }
  if (!plainObject(value)) throw new Error("image must be an HTTP URL or Base64 data URL");
  const keys = Object.keys(value);
  if (keys.length !== 1 || (keys[0] !== "image_url" && keys[0] !== "file_id"))
    throw new Error("each image must contain exactly one of image_url or file_id");
  const key = keys[0];
  if (key === "image_url" && isFileRef(value[key])) return { image_url: value[key] };
  const input = trimmed(value[key]);
  if (!input) throw new Error(key + " must not be empty");
  if (key === "image_url" && !/^(https?:\/\/|data:image\/)/i.test(input))
    throw new Error("image_url must be an HTTP URL or Base64 data URL");
  return { [key]: input };
}

function appendImageInputs(values, source) {
  if (source === undefined || source === null) return;
  const items = Array.isArray(source) ? source : [source];
  for (const item of items) values.push(imageInput(item));
}

function multipartImageFiles(files) {
  const inputs = [];
  let numbered = false;
  let repeated = false;
  const indexes = [];
  for (const file of files || []) {
    const field = trimmed(file.field);
    if (field === "image") {
      repeated = true;
    } else {
      const match = /^image\[(\d+)\]$/.exec(field);
      if (!match) throw new Error(field + " is not supported");
      numbered = true;
      indexes.push(Number(match[1]));
    }
    const mimeType = trimmed(file.mimeType).toLowerCase();
    inputs.push({
      image_url: {
        __fileRef: file.ref,
        encoding: "dataUrl",
        mimeType: /^image\/[a-z0-9.+-]+$/.test(mimeType) ? mimeType : "image/png",
        maxBytes: MAX_INPUT_IMAGE_BYTES,
      },
    });
  }
  if (numbered && repeated) throw new Error("use image or image[N], not both");
  if (numbered) {
    indexes.sort(function (a, b) { return a - b; });
    for (let i = 0; i < indexes.length; i++) {
      if (indexes[i] !== i) throw new Error("image[N] fields must be numbered from image[0]");
    }
  }
  return inputs;
}

function imageRequest(source, identity, operation, files) {
  const body = plainObject(source);
  if (!body) throw new Error("request body must be an object");
  const action = imageAction(operation);
  const model = imageModel(identity);
  if (body.aspect_ratio !== undefined) throw new Error("aspect_ratio is not supported by Muse; use size");
  if (body.resolution !== undefined || body.quality !== undefined)
    throw new Error("resolution and quality are not supported by Muse; use size");
  if (body.mask !== undefined) throw new Error("mask is not supported by Muse");
  if (body.stream === true || body.stream === "true") throw new Error("stream is not supported");
  const prompt = trimmed(body.prompt);
  if (!prompt) throw new Error("prompt is required");
  const count = imageInteger(body.n === undefined || body.n === null || body.n === "" ? 1 : body.n, "n");
  const size = body.size === undefined || body.size === null || body.size === "" ? MUSE_SIZES[0] : trimmed(body.size);
  if (!MUSE_SIZES.includes(size)) throw new Error("size must be one of " + MUSE_SIZES.join(", "));
  if (body.response_format !== undefined && body.response_format !== "url" && body.response_format !== "b64_json")
    throw new Error("response_format must be url or b64_json");
  const responseFormat = body.response_format === undefined ? "url" : body.response_format;
  const images = [];
  appendImageInputs(images, body.image);
  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) throw new Error("images must be an array");
    appendImageInputs(images, body.images);
  }
  images.push(...multipartImageFiles(files));
  if (images.length > MAX_INPUT_IMAGES) throw new Error("Muse image edits support at most " + MAX_INPUT_IMAGES + " images");
  if (action === "image_generation" && images.length) throw new Error("image inputs require the image edit endpoint");
  if (action === "image_edit" && !images.length) throw new Error("image is required for Muse image edits");
  const request = { model: model, prompt: prompt, n: count, size: size, response_format: responseFormat };
  if (images.length) request.images = images;
  return { action: action, body: request };
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
  request.body.model = ctx.upstreamModel || request.body.model;
  return {
    url: ctx.baseUrl + (request.action === "image_edit" ? "/v1/images/edits" : "/v1/images/generations"),
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
    body: request.body,
    action: request.action,
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
  return { image_count: request.body.n };
}

export function extractUsageOnComplete(task, result, body) {
  if (!task || (task.action !== "image_generation" && task.action !== "image_edit")) return null;
  return { image_count: imagePayloadCount(body) };
}

export const protocols = {
  openai_image: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart"))
        throw new Error("JSON or multipart body required");
      let source;
      let files = [];
      if (ctx.body.kind === "json") {
        source = ctx.body.value;
      } else {
        source = {};
        const fields = ctx.body.fields || {};
        for (const name of Object.keys(fields)) {
          if (fields[name].length > 1) throw new Error(name + " must be provided once");
          source[name] = fields[name][0];
        }
        files = ctx.body.files || [];
      }
      const request = imageRequest(source, ctx, ctx.operation, files);
      return { kind: "submit", model: ctx.model, action: request.action, requestBody: request.body };
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
