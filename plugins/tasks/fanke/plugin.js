// 跨境AI (fanke2026) task plugin — MiniMax-H3 768P video generation via https://ai.fanke2026.xyz.
//
// Upstream contract:
//   POST /api/open/v1/video/generate            -> {success, jobId, taskId, status: "submitted"}
//   GET  /api/open/v1/video/status?jobId=<id>   -> {success, status, videoUrl?, errorMessage?}
// Every request carries "X-Public-Model-Ids: 1" (the platform's public model list) and is
// rejected when the API key is used from another domain. Tasks are pre-charged on submit and
// refunded by the platform when the upstream fails.
//
// The vendor addresses models by opaque ids (ft-video-v1-...), so the public model name maps
// to the upstream id here; a channel model_mapping may still override it.

const MODEL_IDS = {
  // 特价渠道 MiniMax H3 768P, billed per second (1-15s), fixed resolution,
  // 9 reference images, 3 reference audios, no reference video.
  "MiniMax-H3 768P 特价": "ft-video-v1-77e8ee7a636f15dac27b2ce6d6fcd746",
};

const LIMITS = {
  "MiniMax-H3 768P 特价": {
    minSeconds: 1,
    maxSeconds: 15,
    defaultSeconds: 5,
    ratios: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    maxImages: 9,
    maxAudios: 3,
    maxVideos: 0,
  },
};

const DEFAULT_RATIO = "9:16";
const PLATFORM_HEADERS = { "X-Public-Model-Ids": "1" };

export const meta = {
  apiVersion: 1,
  key: "fanke",
  name: "Fanke Video",
  description: {
    en: "Video generation via the 跨境AI (fanke2026) aggregation platform, billed per second",
    zh: "通过跨境AI（fanke2026）聚合平台生成视频，按秒计费",
  },
  version: "1.1.0",
  author: { name: "kyeai" },
  baseUrl: "https://ai.fanke2026.xyz",
  models: Object.keys(MODEL_IDS),
  fetchMode: "per_task",
  usageSchema: {
    // Requested video duration in seconds; the vendor bills the platform per second.
    seconds: {
      type: "number",
      unit: "second",
      description: { en: "Video generation unit price", zh: "视频生成单价" },
    },
  },
  usageExamples: [{ label: "768P 5s", facts: { seconds: 5 } }, { label: "768P 10s", facts: { seconds: 10 } }],
  samplePrompt: {
    en: "A red apple slowly rotating on a white table, studio lighting",
    zh: "一只红苹果在白色桌面上缓缓旋转，摄影棚灯光",
  },
  requestParams: [
    {
      name: "prompt",
      type: "string",
      required: true,
      description: { en: "Text description of the video to generate", zh: "想要生成视频的文字描述" },
    },
    {
      name: "seconds",
      type: "integer",
      minimum: 1,
      maximum: 15,
      default: 5,
      description: { en: "Video length in seconds; billed per second", zh: "视频时长（秒），按秒计费" },
    },
    {
      name: "ratio",
      type: "enum",
      enum: ["16:9", "4:3", "1:1", "3:4", "9:16"],
      default: "9:16",
      description: { en: "Aspect ratio; resolution is fixed at 768P", zh: "画面比例；分辨率固定 768P" },
    },
    {
      name: "size",
      type: "string",
      description: { en: "Aspect ratio as width x height (e.g. 720x1280); ignored when ratio is set", zh: "以宽x高指定画面比例（如 720x1280）；设置 ratio 后忽略" },
    },
    {
      name: "input_reference",
      type: "file",
      description: { en: "Reference image upload (multipart); repeat with the _2 .. _9 suffix for up to 9 images", zh: "参考图上传（multipart）；用 _2 .. _9 后缀最多 9 张" },
    },
    {
      name: "input_audio",
      type: "file",
      description: { en: "Reference audio upload (multipart); repeat with the _2 .. _3 suffix for up to 3 audios", zh: "参考音频上传（multipart）；用 _2 .. _3 后缀最多 3 个" },
    },
  ],
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
};

function trimmed(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function upstreamModelID(publicName, upstreamModel) {
  // A channel model_mapping resolves ctx.upstreamModel to the vendor id already.
  const resolved = trimmed(upstreamModel);
  if (resolved.indexOf("ft-video-v1-") === 0) return resolved;
  const mapped = MODEL_IDS[trimmed(publicName)];
  if (mapped) return mapped;
  if (resolved) return resolved;
  throw new Error("unsupported model: " + (trimmed(publicName) || "(empty)"));
}

function limitsFor(model) {
  const limits = LIMITS[trimmed(model)];
  if (!limits) throw new Error("unsupported model: " + (trimmed(model) || "(empty)"));
  return limits;
}

function durationOf(source, model) {
  const limits = limitsFor(model);
  const raw = source.duration === undefined || source.duration === null || source.duration === "" ? source.seconds : source.duration;
  if (raw === undefined || raw === null || raw === "") return limits.defaultSeconds;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < limits.minSeconds || seconds > limits.maxSeconds) {
    throw new Error(
      "duration must be an integer between " + limits.minSeconds + " and " + limits.maxSeconds + " seconds"
    );
  }
  return seconds;
}

function ratioFromSize(size, model) {
  const match = /^(\d{2,5})\s*[x*\u00d7]\s*(\d{2,5})$/.exec(trimmed(size));
  if (!match) return "";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!(width > 0) || !(height > 0)) return "";
  let best = "";
  let bestDelta = Infinity;
  for (const ratio of limitsFor(model).ratios) {
    const parts = ratio.split(":");
    const candidate = Number(parts[0]) / Number(parts[1]);
    const delta = Math.abs(candidate - width / height);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = ratio;
    }
  }
  // Reject sizes that are not one of the vendor's ratios (e.g. 1024x1024 vs 1:1 is fine,
  // 1000x999 is not worth guessing).
  return bestDelta <= 0.01 ? best : "";
}

function ratioOf(source, model) {
  const limits = limitsFor(model);
  const direct = trimmed(source.ratio);
  if (direct) {
    if (limits.ratios.indexOf(direct) < 0) throw new Error("ratio must be one of " + limits.ratios.join(", "));
    return direct;
  }
  const fromSize = ratioFromSize(source.size, model);
  return fromSize || DEFAULT_RATIO;
}

// Accepts a single url, a comma separated string, or an array; drops empty entries.
function urlList(value) {
  const raw = Array.isArray(value) ? value : trimmed(value) ? String(value).split(",") : [];
  const urls = [];
  for (const entry of raw) {
    const url = trimmed(entry);
    if (url && urls.indexOf(url) < 0) urls.push(url);
  }
  return urls;
}

function referenceUrls(source, key, model, kind) {
  const urls = urlList(source[key]);
  const limits = limitsFor(model);
  const max = kind === "image" ? limits.maxImages : kind === "audio" ? limits.maxAudios : limits.maxVideos;
  if (max === 0 && urls.length > 0) throw new Error("this model does not accept reference " + kind + "s");
  if (urls.length > max) throw new Error("at most " + max + " reference " + kind + "s are supported");
  return urls;
}

function submitBody(source, model, upstreamModel) {
  const limits = limitsFor(model);
  const prompt = trimmed(source.prompt);
  if (!prompt) throw new Error("prompt is required");
  const images = referenceUrls(source, "imageUrls", model, "image");
  const audios = referenceUrls(source, "audioUrls", model, "audio");
  referenceUrls(source, "videoUrls", model, "video");
  const singleImage = trimmed(source.image_url || source.input_reference || source.image);
  if (singleImage && images.indexOf(singleImage) < 0) images.unshift(singleImage);
  if (images.length > limits.maxImages) throw new Error("at most " + limits.maxImages + " reference images are supported");
  if (audios.length > 0 && images.length === 0) throw new Error("reference audio requires at least one reference image");
  const body = {
    model: upstreamModelID(model, upstreamModel),
    prompt: prompt,
    ratio: ratioOf(source, model),
    duration: durationOf(source, model),
    imageUrls: images,
    audioUrls: audios,
  };
  return body;
}

function ok(body) {
  return body && typeof body === "object" && !Array.isArray(body) && body.success !== false;
}

function failureReason(body) {
  if (!body || typeof body !== "object") return "the upstream returned an unexpected response";
  return trimmed(body.errorMessage) || trimmed(body.error) || trimmed(body.message) || "task failed";
}

function videoURL(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  return trimmed(body.videoUrl) || trimmed(body.video_url) || trimmed(body.url);
}

function responsesInput(req) {
  const texts = [];
  const images = [];
  const input = req.input;
  if (typeof input === "string") texts.push(input);
  else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") {
        texts.push(item);
        continue;
      }
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const content = item.content === undefined ? [item] : Array.isArray(item.content) ? item.content : [item.content];
      for (const part of content) {
        if (typeof part === "string") {
          texts.push(part);
          continue;
        }
        if (!part || typeof part !== "object" || Array.isArray(part)) continue;
        if (["input_text", "text"].includes(part.type) && typeof part.text === "string") texts.push(part.text);
        if (["input_image", "image_url"].includes(part.type)) {
          let image = part.image_url;
          if (image && typeof image === "object") image = image.url;
          if (trimmed(image)) images.push(trimmed(image));
        }
      }
    }
  }
  return {
    prompt: texts
      .filter(function (text) {
        return trimmed(text);
      })
      .join("\n"),
    images: images,
  };
}

function responsesVideoText(ctx) {
  const artifact = ctx && ctx.artifacts && ctx.artifacts.video;
  const url = trimmed(artifact && artifact.url);
  if (!url) throw new Error("video artifact is unavailable");
  const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return '<video controls src="' + escaped + '"></video>';
}

function upstreamHeaders(apiKey) {
  const headers = Object.assign({ Authorization: "Bearer " + apiKey }, PLATFORM_HEADERS);
  return headers;
}

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  const model = ctx.model;
  const headers = upstreamHeaders(ctx.apiKey);
  const files = ctx.files || [];
  if (files.length > 0) {
    // The vendor accepts the same fields as multipart parts, with repeated images/audios.
    const prompt = trimmed(req.prompt);
    if (!prompt) throw new Error("prompt is required");
    const parts = [
      { name: "model", value: upstreamModelID(model, ctx.upstreamModel) },
      { name: "prompt", value: prompt },
      { name: "ratio", value: ratioOf(req, model) },
      { name: "duration", value: durationOf(req, model) },
    ];
    for (const url of referenceUrls(req, "imageUrls", model, "image")) parts.push({ name: "imageUrls", value: url });
    for (const url of referenceUrls(req, "audioUrls", model, "audio")) parts.push({ name: "audioUrls", value: url });
    for (const file of files) parts.push({ name: "images", fileRef: file.ref, filename: file.filename });
    return { url: ctx.baseUrl + "/api/open/v1/video/generate", method: "POST", headers: headers, bodyType: "multipart", parts: parts };
  }
  headers["Content-Type"] = "application/json";
  return {
    url: ctx.baseUrl + "/api/open/v1/video/generate",
    method: "POST",
    headers: headers,
    body: submitBody(req, model, ctx.upstreamModel),
    action: trimmed(req.action) || "text_to_video",
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp && resp.body;
  if (!ok(body)) throw new Error(failureReason(body));
  const taskId = trimmed(body.jobId) || trimmed(body.taskId);
  if (!taskId) throw new Error("the upstream response has no job id");
  return { taskId: taskId, taskData: body };
}

export function buildQueryRequest(ctx) {
  const headers = upstreamHeaders(ctx.apiKey);
  headers["Cache-Control"] = "no-cache";
  return {
    // The timestamp and no-cache header keep third-party caches from replaying a stale status.
    url: ctx.baseUrl + "/api/open/v1/video/status?jobId=" + encodeURIComponent(ctx.taskId) + "&_=" + Date.now(),
    method: "GET",
    headers: headers,
  };
}

const STATUS_MAP = {
  submitted: "SUBMITTED",
  queued: "QUEUED",
  queueing: "QUEUED",
  pending: "QUEUED",
  processing: "IN_PROGRESS",
  running: "IN_PROGRESS",
  in_progress: "IN_PROGRESS",
  success: "SUCCESS",
  succeeded: "SUCCESS",
  completed: "SUCCESS",
  failed: "FAILURE",
  failure: "FAILURE",
  error: "FAILURE",
  cancelled: "FAILURE",
  canceled: "FAILURE",
};

export function parseTaskResult(ctx, body) {
  if (!ok(body)) return { status: "UNKNOWN", reason: failureReason(body) };
  const status = STATUS_MAP[trimmed(body.status).toLowerCase()];
  if (!status) return { status: "UNKNOWN", reason: "unrecognized status: " + trimmed(body.status) };
  const result = { status: status };
  if (status === "SUCCESS") {
    const url = videoURL(body);
    if (url) result.url = url;
  }
  if (status === "FAILURE") result.reason = failureReason(body);
  return result;
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  const req = ctx.requestBody || {};
  return { seconds: durationOf(req, ctx.model) };
}

export function extractUsageOnComplete() {
  // The status endpoint does not report the rendered duration, so settlement keeps the
  // bounded submit-time estimate.
  return null;
}

function taskVideoURL(task) {
  const data = (task && task.data) || {};
  return videoURL(data);
}

export function listArtifacts(task) {
  if (!task || task.status !== "SUCCESS") return [];
  return [{ key: "video", type: "video", mimeType: "video/mp4" }];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = taskVideoURL(ctx);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, headers: upstreamHeaders(ctx.apiKey) };
}

export const protocols = {
  openai_responses: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const req = ctx.body.value;
      if (!req || typeof req !== "object" || Array.isArray(req)) throw new Error("request body must be an object");
      const model = trimmed(req.model);
      if (!model) throw new Error("model is required");
      if (req.input !== undefined && typeof req.input !== "string" && !Array.isArray(req.input)) throw new Error("input must be a string or array");
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      if (req.metadata !== undefined && (!req.metadata || typeof req.metadata !== "object" || Array.isArray(req.metadata)))
        throw new Error("metadata must be an object");
      const input = responsesInput(req);
      const prompt = input.prompt || trimmed(req.prompt);
      if (!prompt) throw new Error("input is required");
      const requestBody = { model: model, prompt: prompt };
      const images = [];
      for (const image of [req.image_url, req.input_reference, req.image].concat(req.images || [], input.images)) {
        const url = trimmed(image);
        if (url && images.indexOf(url) < 0) images.push(url);
      }
      if (images.length) requestBody.imageUrls = images;
      if (req.audioUrls !== undefined) requestBody.audioUrls = req.audioUrls;
      if (Object.prototype.hasOwnProperty.call(req, "seconds")) requestBody.duration = req.seconds;
      else if (Object.prototype.hasOwnProperty.call(req, "duration")) requestBody.duration = req.duration;
      if (Object.prototype.hasOwnProperty.call(req, "size")) requestBody.size = req.size;
      const metadata = req.metadata || {};
      if (metadata.ratio !== undefined) requestBody.ratio = metadata.ratio;
      return {
        kind: "submit",
        model: model,
        action: images.length ? "image_to_video" : "text_to_video",
        requestBody: requestBody,
      };
    },
    renderEvents: function (ctx, task, previousState) {
      const status = String(task.status || "UNKNOWN").toUpperCase();
      const value = Number(String(task.progress || "").replace("%", ""));
      const progress = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const state = { status: status, progress: progress };
      if (status === "SUCCESS") {
        const text = responsesVideoText(ctx);
        const events = previousState && previousState.status === status ? [] : [{ type: "output", data: text }];
        return { events: events, state: state, done: true };
      }
      if (status === "FAILURE")
        return { events: [{ type: "error", code: "task_failed", message: task.fail_reason || "task failed" }], state: state, done: true };
      if (previousState && previousState.status === status && previousState.progress === progress)
        return { events: [], state: state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state: state, done: false };
    },
    renderFinal: function (ctx) {
      return {
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: responsesVideoText(ctx), annotations: [], logprobs: [] }],
          },
        ],
        metadata: { vendor: "fanke" },
      };
    },
  },
};

protocols.openai_video = {
  decodeRequest: function (ctx) {
    if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart"))
      throw new Error("JSON or multipart body required");
    const model = ctx.model;
    limitsFor(model);
    let source = {};
    let hasUpload = false;
    if (ctx.body.kind === "json") {
      if (!ctx.body.value || Array.isArray(ctx.body.value)) throw new Error("JSON object required");
      source = Object.assign({}, ctx.body.value);
    } else {
      const fields = ctx.body.fields || {};
      for (const name of Object.keys(fields)) {
        const values = fields[name] || [];
        if (values.length > 1) throw new Error(name + " must be provided once");
        source[name] = values[0];
      }
      const files = ctx.body.files || [];
      for (const file of files) {
        if (file.field !== "input_reference" && file.field !== "images")
          throw new Error("unexpected file field: " + file.field);
      }
      hasUpload = files.length > 0;
      if (source.imageUrls !== undefined) source.imageUrls = urlList(source.imageUrls);
      if (source.audioUrls !== undefined) source.audioUrls = urlList(source.audioUrls);
    }
    const body = submitBody(source, model);
    const action = hasUpload || body.imageUrls.length > 0 ? "image_to_video" : "text_to_video";
    return { kind: "submit", model: model, action: action, requestBody: Object.assign({}, source, { model: model }) };
  },
  render: function (ctx, task) {
    const statuses = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
    const output = {
      id: task.task_id,
      object: "video",
      model: (task.properties || {}).origin_model_name || "",
      status: statuses[task.status] || "unknown",
      progress: Number(String(task.progress || "0").replace("%", "")),
      created_at: Number(task.created_at || 0),
    };
    const completedAt = Number(task.finished_at || task.updated_at || 0);
    if (completedAt > 0) output.completed_at = completedAt;
    if (task.status === "FAILURE") output.error = { code: "video_generation_failed", message: task.fail_reason || "task failed" };
    return output;
  },
};
