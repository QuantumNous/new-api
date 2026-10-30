export const meta = {
  apiVersion: 1,
  key: "kling",
  name: "Kling",
  icon: "Kling.Color",
  description: {
    en: "Kuaishou Kling video generation (text-to-video and image-to-video)",
    zh: "快手可灵视频生成（文生视频、图生视频）",
  },
  version: "1.1.1",
  author: { name: "QuantumNous" },
  channelTypes: [50],
  models: ["kling-v2-5-turbo", "kling-v2-6", "kling-v3"],
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    // Kling final unit deduction (estimated at submit, actual on completion).
    units: {
      type: "number",
      unit: "credit",
      description: { en: "Kling credit unit price", zh: "可灵资源包单位单价" },
    },
  },
  usageExamples: [
    { label: "v2.5 turbo std 5s", facts: { units: 1.5 } },
    { label: "v2.6 pro 10s · audio", facts: { units: 10 } },
    { label: "v3 pro 5s", facts: { units: 4 } },
    { label: "v3 4k 5s", facts: { units: 15 } },
  ],
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
  // Kling's own paths; the gateway also serves each under /kling.
  routes: [
    { method: "POST", path: "/v1/videos/text2video", type: "submit", action: "text_to_video", decode: "decodeSubmit", render: "taskCreated" },
    { method: "POST", path: "/v1/videos/image2video", type: "submit", action: "image_to_video", decode: "decodeSubmit", render: "taskCreated" },
    { method: "GET", path: "/v1/videos/text2video/:task_id", type: "query", render: "taskStatus" },
    { method: "GET", path: "/v1/videos/image2video/:task_id", type: "query", render: "taskStatus" },
  ],
};

// The official resource-package consumption of Kling's models in units per
// output second of each mode, not a currency price
// (kling.ai/document-api/pricing/base/video): silent, with native audio (sound
// "on"), and with a reference voice (voice_list). Kling checks modes and
// durations itself and reports the units it deducted as final_unit_deduction,
// which settles the task.
const KLING_MODELS = {
  "kling-v2-5-turbo": { units: { std: 0.3, pro: 0.5 } },
  "kling-v2-6": { units: { std: 0.3, pro: 0.5 }, soundUnits: { pro: 1.0 }, voiceUnits: { pro: 1.2 } },
  "kling-v3": { units: { std: 0.6, pro: 0.8, "4k": 3.0 }, soundUnits: { std: 0.9, pro: 1.2, "4k": 3.0 } },
};

// A channel may map a declared model to a name outside the table; it reserves
// the highest consumption of each mode and settles on the units Kling reports.
const DEFAULT_KLING_MODEL = {
  units: { std: 0.9, pro: 1.2, "4k": 3.0 },
  soundUnits: { std: 0.9, pro: 1.2, "4k": 3.0 },
  voiceUnits: { std: 1.2, pro: 1.2, "4k": 3.0 },
};

// Kling's numeric error codes for the statuses the gateway answers with
// (kling.ai/document-api/api/get-started/error-codes).
const ERROR_CODES = { 400: 1201, 401: 1000, 403: 1103, 404: 1203, 429: 1302, 500: 5000, 503: 5001, 504: 5002 };

// Kling would call these back with its own task ids, which the gateway does
// not hand out, so a native request carrying them is refused.
const UNSUPPORTED_FIELDS = ["callback_url", "external_task_id"];

function trimmed(value) {
  return String(value || "").trim();
}

function responsesInput(req) {
  const texts = [],
    images = [];
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

function isRelay(apiKey) {
  return apiKey.startsWith("sk-");
}

// The host signal is authoritative on New API channels; the sk- key prefix
// stays as the heuristic for legacy type-50 channels pointed at a gateway.
function viaGateway(ctx) {
  return !!(ctx.upstream && ctx.upstream.kind === "new_api") || isRelay(ctx.apiKey);
}

function tokenFor(ctx) {
  const apiKey = trimmed(ctx.apiKey);
  if (!apiKey) throw new Error("api_key is empty");
  if (viaGateway(ctx)) return apiKey;
  const parts = apiKey.split("|");
  if (parts.length === 1) return apiKey;
  if (parts.length !== 2) throw new Error("invalid api_key, required format is accessKey|secretKey");
  const now = utils.unixNow();
  return utils.jwtSignHS256({ iss: parts[0].trim(), exp: now + 1800, nbf: now - 5 }, parts[1].trim());
}

function pathFor(action) {
  return action === "image_to_video" ? "/v1/videos/image2video" : "/v1/videos/text2video";
}

function urlFor(ctx, action) {
  return ctx.baseUrl + (viaGateway(ctx) ? "/kling" : "") + pathFor(action);
}

// OpenAI video sizes the host protocols map to Kling's text-to-video
// aspect_ratio; without a size Kling uses its default, 16:9.
function aspectRatio(size) {
  const ratios = { "1024x1024": "1:1", "512x512": "1:1", "1280x720": "16:9", "1920x1080": "16:9", "720x1280": "9:16", "1080x1920": "9:16" };
  return ratios[size] || "1:1";
}

function submitModel(ctx, req) {
  return trimmed((ctx && ctx.upstreamModel) || (ctx && ctx.model) || (req && req.model));
}

function klingModel(model) {
  return Object.prototype.hasOwnProperty.call(KLING_MODELS, model) ? KLING_MODELS[model] : DEFAULT_KLING_MODEL;
}

// mode defaults to std; Kling checks it for the model.
function klingMode(mode) {
  return trimmed(mode).toLowerCase() || "std";
}

// Kling takes duration as a string and checks it for the model; a duration is
// billed, so the plugin bounds it first.
function validateKlingDuration(value) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isInteger(n) || n <= 0 || n > 3600) throw new Error("duration must be a positive integer of at most 3600");
  return n;
}

// The duration Kling receives and the one billed: metadata.duration (the whole
// body on native routes) overrides the top-level duration, and Kling's default
// is 5.
function outboundDuration(req) {
  const metadata = (req && req.metadata) || {};
  let value = metadata.duration;
  if (value === undefined || value === null) value = req && req.duration;
  if (value === undefined || value === null) return 5;
  return validateKlingDuration(value);
}

function outboundMode(req) {
  const metadata = (req && req.metadata) || {};
  return klingMode((req && req.mode) || metadata.mode);
}

// Units per output second: native audio (sound "on", default "off") and a
// reference voice cost more. A mode the model's table does not list reserves
// the table's dearest, and audio the model has no table for the dearest audio
// of any model; the units Kling reports settle the task.
function unitsPerSecond(model, mode, metadata) {
  const profile = klingModel(model);
  let table = profile.units;
  if (trimmed(metadata.sound).toLowerCase() === "on") {
    const voice = Array.isArray(metadata.voice_list) && metadata.voice_list.length > 0;
    table = (voice && profile.voiceUnits) || profile.soundUnits || (voice ? DEFAULT_KLING_MODEL.voiceUnits : DEFAULT_KLING_MODEL.soundUnits);
  }
  if (Object.prototype.hasOwnProperty.call(table, mode)) return table[mode];
  return Object.keys(table).reduce((dearest, key) => Math.max(dearest, table[key]), 0);
}

function hasKlingImage(req, hasInputReferenceFile) {
  if (hasInputReferenceFile) return true;
  const metadata = (req && req.metadata) || {};
  if (req && req.image && typeof req.image === "object" && !Array.isArray(req.image) && req.image.__fileRef) return true;
  return Boolean(trimmed(req && req.input_reference) || trimmed(req && req.image) || metadata.image || metadata.image_tail);
}

function filePlaceholder(image) {
  if (!image || typeof image !== "object" || Array.isArray(image) || !image.__fileRef) return image;
  const placeholder = { __fileRef: image.__fileRef, encoding: image.encoding };
  if (image.mimeType) placeholder.mimeType = image.mimeType;
  if (image.maxBytes !== undefined && image.maxBytes !== null) placeholder.maxBytes = image.maxBytes;
  return placeholder;
}

// Kling's own body, whose model_name is required, sent as is for Kling to
// check.
function decodeNativeSubmit(ctx) {
  if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
  const body = ctx.body.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("request body must be an object");
  const model = typeof body.model_name === "string" ? body.model_name.trim() : "";
  if (!model) throw new Error("model_name is required");
  for (const name of UNSUPPORTED_FIELDS) {
    if (body[name] !== undefined && body[name] !== null) throw new Error(name + " is not supported; query the task instead");
  }
  if (body.duration !== undefined && body.duration !== null) validateKlingDuration(body.duration);
  return { kind: "submit", model: model, requestBody: { model: model, vendorBody: body } };
}

export const native = {
  decodeSubmit: decodeNativeSubmit,
  taskCreated: function (ctx, task) {
    const result = task.data || {},
      data = result.data || {};
    return Object.assign({}, result, { data: Object.assign({}, data, { task_id: task.task_id }) });
  },
  // Kling's last reply for the task. The gateway can fail a task Kling still
  // reports as running (poll failures or the task timeout); it then reads failed.
  taskStatus: function (ctx, task) {
    const statusMap = { NOT_START: "submitted", SUBMITTED: "submitted", QUEUED: "submitted", IN_PROGRESS: "processing", SUCCESS: "succeed", FAILURE: "failed" };
    const result = task.data && typeof task.data === "object" && !Array.isArray(task.data) ? task.data : null;
    if (result) {
      const data = Object.assign({}, result.data && typeof result.data === "object" ? result.data : {}, { task_id: task.task_id });
      if (task.status === "FAILURE" && data.task_status !== "failed") {
        data.task_status = "failed";
        data.task_status_msg = task.fail_reason || "";
      }
      return Object.assign({}, result, { data: data });
    }
    return {
      code: 0,
      message: "",
      request_id: "",
      data: {
        task_id: task.task_id,
        task_status: statusMap[task.status] || "submitted",
        task_status_msg: task.fail_reason || "",
        created_at: task.created_at * 1000,
        updated_at: (task.updated_at || task.created_at) * 1000,
      },
    };
  },
  error: function (ctx, error) {
    return { code: ERROR_CODES[error.httpStatus] || (error.httpStatus >= 500 ? 5000 : 1200), message: error.message, request_id: error.requestId || "" };
  },
};

// Native routes send the client's own body with the channel's model. The host
// protocols add the prompt, first frame, mode and an aspect ratio mapped from
// size; image-to-video has no aspect ratio. They always send mode and
// duration, at Kling's defaults when absent.
export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody;
  const metadata = req.metadata || {};
  const inferredAction = req.image || metadata.image || metadata.image_tail ? "image_to_video" : "text_to_video";
  const action = ctx.action === "text_to_video" || ctx.action === "image_to_video" ? ctx.action : inferredAction;
  const model = submitModel(ctx, req);
  if (!model) throw new Error("model_name is required");
  let body;
  if (req.vendorBody) body = Object.assign({}, req.vendorBody, { model_name: model });
  else {
    body = {};
    if (req.prompt) body.prompt = req.prompt;
    if (req.image) body.image = req.image;
    if (req.mode) body.mode = req.mode;
    if (action === "text_to_video" && req.size !== undefined && req.size !== null && req.size !== "") body.aspect_ratio = aspectRatio(req.size);
    Object.assign(body, metadata);
    body.model_name = model;
    body.mode = klingMode(body.mode);
    body.duration = String(outboundDuration(req));
    if (body.image) body.image = filePlaceholder(body.image);
    if (body.image_tail) body.image_tail = filePlaceholder(body.image_tail);
    if (!body.prompt) delete body.prompt;
    if (!body.image) delete body.image;
  }
  return {
    url: urlFor(ctx, action),
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + tokenFor(ctx), "User-Agent": "kling-sdk/1.0" },
    body: body,
    action: action,
  };
}

export function parseSubmitResponse(ctx, resp) {
  const result = resp.body || {};
  if (result.code !== 0) throw new Error(result.message || "kling submit failed");
  if (!result.data || !result.data.task_id) throw new Error("missing task_id");
  return { taskId: result.data.task_id, taskData: result };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  const req = ctx.requestBody || {};
  // A native body reads like the metadata of a host-protocol request.
  const source = req.vendorBody ? { metadata: req.vendorBody } : req;
  return { units: unitsPerSecond(submitModel(ctx, req), outboundMode(source), source.metadata || {}) * outboundDuration(source) };
}

export function buildQueryRequest(ctx) {
  return {
    url: urlFor(ctx, ctx.action) + "/" + ctx.taskId,
    method: "GET",
    headers: { Accept: "application/json", Authorization: "Bearer " + tokenFor(ctx), "User-Agent": "kling-sdk/1.0" },
  };
}

export function parseTaskResult(ctx, body) {
  const data = body.data || {};
  const statuses = { submitted: "SUBMITTED", processing: "IN_PROGRESS", succeed: "SUCCESS", failed: "FAILURE" };
  const status = statuses[data.task_status];
  if (!status) return { status: "UNKNOWN", reason: "unknown task status: " + String(data.task_status || "") };
  const videos = status === "SUCCESS" && data.task_result && data.task_result.videos ? data.task_result.videos : [];
  const result = { code: body.code || 0, taskId: data.task_id, status: status, reason: data.task_status_msg || "" };
  if (videos.length && videos[0].url) result.url = videos[0].url;
  const units = Number.parseFloat(data.final_unit_deduction || "");
  if (Number.isFinite(units) && units > 0) {
    result.completionTokens = Math.ceil(units);
    result.totalTokens = Math.ceil(units);
  }
  return result;
}

function artifactData(ctx) {
  const data = (ctx && ctx.data) || {};
  if (data.data && typeof data.data === "object" && data.data.task_id && Object.prototype.hasOwnProperty.call(data.data, "data")) return data.data.data || {};
  return data;
}

function artifactVideoURL(ctx) {
  const result = (artifactData(ctx).data || {}).task_result || {};
  const videos = Array.isArray(result.videos) ? result.videos : [];
  return videos.length ? String(videos[0].url || "").trim() : "";
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" && artifactVideoURL(task) ? [{ key: "video", type: "video" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = artifactVideoURL(ctx);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

export function extractUsageOnComplete(_task, _taskResult, body) {
  const data = (body && body.data) || {};
  if (
    !Object.prototype.hasOwnProperty.call(data, "final_unit_deduction") ||
    data.final_unit_deduction === undefined ||
    data.final_unit_deduction === null ||
    data.final_unit_deduction === ""
  ) {
    return null;
  }
  const units = Number.parseFloat(data.final_unit_deduction);
  if (!Number.isFinite(units)) return null;
  return { units: units };
}

export const protocols = {
  openai_responses: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const req = ctx.body.value;
      if (!req || typeof req !== "object" || Array.isArray(req)) throw new Error("request body must be an object");
      const model = trimmed(ctx.model);
      if (!model) throw new Error("model is required");
      if (req.input !== undefined && typeof req.input !== "string" && !Array.isArray(req.input)) throw new Error("input must be a string or array");
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      if (req.metadata !== undefined && (!req.metadata || typeof req.metadata !== "object" || Array.isArray(req.metadata)))
        throw new Error("metadata must be an object");
      const input = responsesInput(req);
      const prompt = input.prompt || trimmed(req.prompt);
      const images = [];
      for (const image of [req.image, req.input_reference].concat(req.images || [], input.images)) {
        if (trimmed(image) && !images.includes(trimmed(image))) images.push(trimmed(image));
      }
      if (!prompt && images.length === 0) throw new Error("input is required");
      const metadata = Object.assign({}, req.metadata || {});
      if (Object.prototype.hasOwnProperty.call(req, "mode")) metadata.mode = req.mode;
      metadata.mode = klingMode(metadata.mode);
      if (images.length > 1 && !metadata.image_tail) metadata.image_tail = images[1];
      const requestBody = { model: model, prompt: prompt, metadata: metadata };
      if (images.length) requestBody.image = images[0];
      if (Object.prototype.hasOwnProperty.call(req, "seconds")) requestBody.duration = req.seconds;
      else if (Object.prototype.hasOwnProperty.call(req, "duration")) requestBody.duration = req.duration;
      if (Object.prototype.hasOwnProperty.call(req, "size")) requestBody.size = req.size;
      return { kind: "submit", model: model, action: images.length ? "image_to_video" : "text_to_video", requestBody: requestBody };
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
      if (previousState && previousState.status === status && previousState.progress === progress) return { events: [], state: state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state: state, done: false };
    },
    renderFinal: function (ctx, _task) {
      return {
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: responsesVideoText(ctx), annotations: [], logprobs: [] }],
          },
        ],
        metadata: { vendor: "kling" },
      };
    },
  },
  openai_video: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
      let req;
      let hasInputReferenceFile = false;
      if (ctx.body.kind === "json") {
        if (!ctx.body.value || Array.isArray(ctx.body.value)) throw new Error("JSON object required");
        req = Object.assign({}, ctx.body.value);
      } else {
        const first = function (name) {
          const values = (ctx.body.fields || {})[name] || [];
          if (values.length > 1) throw new Error(name + " must be provided once");
          return values[0];
        };
        req = {};
        const fields = ctx.body.fields || {};
        for (const name of Object.keys(fields)) {
          req[name] = first(name);
        }
        for (const file of ctx.body.files || []) {
          if (file.field !== "input_reference") throw new Error("unexpected file field: " + file.field);
          if (hasInputReferenceFile) throw new Error("input_reference must be provided once");
          hasInputReferenceFile = true;
        }
        if (req.metadata !== undefined) {
          let parsed;
          try {
            parsed = JSON.parse(req.metadata);
          } catch (e) {
            throw new Error("metadata must be a JSON object string");
          }
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("metadata must be a JSON object string");
          req.metadata = parsed;
        }
        if (req.seconds !== undefined) req.seconds = Number(req.seconds);
        else if (req.duration !== undefined) req.seconds = Number(req.duration);
      }
      const seconds = req.seconds === undefined ? req.duration : req.seconds;
      if (seconds !== undefined) req.duration = validateKlingDuration(seconds);
      else req.duration = 5;
      if (hasInputReferenceFile) {
        req.image = { __fileRef: "request_file:input_reference", encoding: "base64", maxBytes: 10485760 };
      } else {
        const image = trimmed(req.input_reference || req.image);
        if (image) req.image = image;
      }
      const metadata = req.metadata || {};
      req.mode = klingMode(req.mode || metadata.mode);
      const hasImage = hasKlingImage(req, hasInputReferenceFile);
      // vendorBody carries a native request's own body; clients of this protocol cannot set it.
      delete req.vendorBody;
      return {
        kind: "submit",
        model: ctx.model,
        action: hasImage ? "image_to_video" : "text_to_video",
        requestBody: Object.assign({}, req, { model: ctx.model }),
      };
    },
    render: function (ctx, task) {
      const response = task.data || {};
      const data = response.data || {};
      const statusMap = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
      const output = {
        id: task.task_id,
        object: "video",
        model: "",
        status: statusMap[task.status] || "unknown",
        progress: Number(String(task.progress || "0").replace("%", "")),
        created_at: data.created_at || 0,
      };
      if (data.updated_at) output.completed_at = data.updated_at;
      const videos = data.task_result && data.task_result.videos ? data.task_result.videos : [];
      if (videos.length) {
        if (videos[0].duration) output.seconds = videos[0].duration;
      }
      if (response.code !== 0 && response.message) output.error = { message: response.message, code: String(response.code) };
      if (data.task_status === "failed") output.error = { message: data.task_status_msg, code: "" };
      return output;
    },
  },
};
