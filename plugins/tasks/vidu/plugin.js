export const meta = {
  apiVersion: 1,
  key: "vidu",
  name: "Vidu",
  icon: "Vidu.Color",
  description: {
    en: "Shengshu Vidu video generation (text-to-video, image-to-video, first-and-last-frame, and reference-to-video)",
    zh: "生数 Vidu 视频生成（文生视频、图生视频、首尾帧、参考生视频）",
  },
  version: "1.2.0",
  author: { name: "QuantumNous" },
  channelTypes: [52],
  models: [
    "viduq3-pro",
    "viduq3-turbo",
    "viduq3-pro-fast",
    "viduq3",
    "viduq3-mix",
    "viduq3-ad",
    "viduq3-drama",
    "viduq4-preview",
    "viduq2-pro",
    "viduq2-turbo",
    "viduq2-pro-fast",
    "viduq2",
    "viduq1-classic",
    "viduq1",
    "vidu2.0",
    "vidu1.5",
  ],
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    // estimated/actual Vidu credits
    credits: {
      type: "number",
      unit: "credit",
      description: { en: "Vidu credit unit price", zh: "Vidu 积分单价" },
    },
    // Requested video duration in seconds.
    duration: {
      type: "number",
      unit: "second",
      description: { en: "Video generation unit price", zh: "视频生成单价" },
    },
    // Requested output video resolution.
    resolution: {
      enum: ["360p", "540p", "720p", "1080p", "2K", "4K"],
      enumLabels: {
        "360p": { en: "360p", zh: "360p" },
        "540p": { en: "540p", zh: "540p" },
        "720p": { en: "720p", zh: "720p" },
        "1080p": { en: "1080p", zh: "1080p" },
        "2K": { en: "2K", zh: "2K" },
        "4K": { en: "4K", zh: "4K" },
      },
      description: { en: "Output video resolution", zh: "输出视频分辨率" },
    },
  },
  // credits is 0 in examples because this plugin does not estimate vendor credits;
  // schema completeness requires the key. Actual credits arrive from upstream.
  usageExamples: [
    { label: "q4 5s 4K", facts: { credits: 0, duration: 5, resolution: "4K" } },
    { label: "q3 pro 5s 1080p", facts: { credits: 0, duration: 5, resolution: "1080p" } },
    { label: "q2 5s 720p", facts: { credits: 0, duration: 5, resolution: "720p" } },
    { label: "q1 5s 1080p", facts: { credits: 0, duration: 5, resolution: "1080p" } },
    { label: "2.0 4s 360p", facts: { credits: 0, duration: 4, resolution: "360p" } },
    { label: "2.0 8s 720p", facts: { credits: 0, duration: 8, resolution: "720p" } },
  ],
  // Vidu request and response bodies, for clients and for a downstream New API
  // gateway, at Vidu's own paths; the gateway also serves each under /vidu.
  routes: [
    { method: "POST", path: "/ent/v2/text2video", type: "submit", decode: "createTask", render: "taskCreated" },
    { method: "POST", path: "/ent/v2/img2video", type: "submit", decode: "createTask", render: "taskCreated" },
    { method: "POST", path: "/ent/v2/start-end2video", type: "submit", decode: "createTask", render: "taskCreated" },
    { method: "POST", path: "/ent/v2/reference2video", type: "submit", decode: "createTask", render: "taskCreated" },
    { method: "GET", path: "/ent/v2/tasks/:task_id/creations", type: "query", render: "taskStatus" },
  ],
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
};

// The models of each Vidu endpoint with their durations (shortest, longest,
// default) and resolutions, the default first, from
// platform.vidu.com/docs/api-reference/video-models; vidu2.0 from the pricing
// page, where 8 seconds come only in 720p. Vidu checks requests itself; the
// lists give the defaults it renders and the dearest a request can cost.
const Q4 = { durations: [3, 16, 5], resolutions: ["720p", "540p", "1080p", "2K", "4K"] };
const Q3 = { durations: [1, 16, 5], resolutions: ["720p", "540p", "1080p"] };
const Q3_FAST = { durations: [1, 16, 5], resolutions: ["720p", "1080p"] };
const Q3_REFERENCE = { durations: [3, 16, 5], resolutions: ["720p", "540p", "1080p"] };
const Q3_SCENE = { durations: [3, 15, 5], resolutions: ["720p", "1080p"] };
const Q2 = { durations: [1, 10, 5], resolutions: ["720p", "540p", "1080p"] };
const Q2_FRAMES = { durations: [1, 10, 5], resolutions: ["720p", "360p", "540p", "1080p"] };
const Q2_FAST = { durations: [1, 10, 5], resolutions: ["720p", "1080p"] };
const Q1 = { durations: [5, 5, 5], resolutions: ["1080p"] };
const VIDU2 = { durations: [4, 8, 4], resolutions: ["360p", "720p", "1080p"], longest: ["720p"] };
// Vidu has started taking vidu1.5 offline (platform.vidu.com/docs/pricing)
// without a shutdown date; drop it once Vidu does. Its image-to-video page
// (api-reference/video-models/vidu-1-5/image-to-video) gives vidu2.0's
// durations and resolutions; the other endpoints come from the last docs that
// listed vidu1.5, where reference-to-video also takes 8 seconds and 1080p.
const VIDU1_5 = VIDU2;
const ENDPOINT_MODELS = {
  text_to_video: { "viduq3-pro": Q3, "viduq3-turbo": Q3, viduq2: Q2, viduq1: Q1, "vidu1.5": VIDU1_5 },
  image_to_video: {
    "viduq4-preview": Q4,
    "viduq3-pro": Q3,
    "viduq3-turbo": Q3,
    "viduq3-pro-fast": Q3_FAST,
    "viduq2-pro": Q2,
    "viduq2-turbo": Q2,
    "viduq1-classic": Q1,
    viduq1: Q1,
    "vidu2.0": VIDU2,
    "vidu1.5": VIDU1_5,
  },
  first_tail_to_video: {
    "viduq3-pro": Q3,
    "viduq3-turbo": Q3,
    "viduq3-pro-fast": Q3_FAST,
    "viduq2-pro": Q2_FRAMES,
    "viduq2-turbo": Q2_FRAMES,
    "viduq2-pro-fast": Q2_FAST,
    viduq1: Q1,
    "viduq1-classic": Q1,
    "vidu2.0": VIDU2,
    "vidu1.5": VIDU1_5,
  },
  reference_to_video: {
    "viduq4-preview": Q4,
    viduq3: Q3_REFERENCE,
    "viduq3-turbo": Q3_REFERENCE,
    "viduq3-mix": Q3_SCENE,
    "viduq3-ad": Q3_SCENE,
    "viduq3-drama": { durations: [2, 16, 8], resolutions: ["1080p", "720p"] },
    "viduq2-pro": Q2,
    viduq2: Q2,
    viduq1: Q1,
    "vidu2.0": { durations: [4, 4, 4], resolutions: ["360p", "720p"] },
    "vidu1.5": VIDU1_5,
  },
};
// Vidu's resolutions from the cheapest to the dearest.
const RESOLUTIONS = ["360p", "540p", "720p", "1080p", "2K", "4K"];
// The defaults of Vidu's current models with every resolution, for a
// host-protocol request whose model the endpoint does not list.
const WIDEST = { durations: [1, 16, 5], resolutions: ["720p", "360p", "540p", "1080p", "2K", "4K"] };

// The submit route names the action; one or two reference images would
// otherwise read as image-to-video or first-and-last-frame.
const ROUTE_ACTIONS = {
  text2video: "text_to_video",
  img2video: "image_to_video",
  "start-end2video": "first_tail_to_video",
  reference2video: "reference_to_video",
};

function trimmed(value) {
  return String(value || "").trim();
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// On a New API channel the same plugin answers on another gateway, which
// serves the Vidu wire format under /vidu, the form every gateway release
// serves, and takes its own token as a Bearer header.
function viaGateway(ctx) {
  return Boolean(ctx.upstream && ctx.upstream.kind === "new_api");
}

function apiRoot(ctx) {
  return ctx.baseUrl + (viaGateway(ctx) ? "/vidu" : "") + "/ent/v2";
}

function authorization(ctx) {
  return (viaGateway(ctx) ? "Bearer " : "Token ") + ctx.apiKey;
}

function listedProfile(action, model) {
  const models = ENDPOINT_MODELS[action] || {};
  return Object.prototype.hasOwnProperty.call(models, model) ? models[model] : null;
}

// The longest duration and dearest resolution of a model on an endpoint. A
// model listed only on other endpoints takes those of all of them, and a
// model the plugin does not list those of every Vidu model.
function dearestSettings(action, model) {
  let profiles = [listedProfile(action, model)];
  if (!profiles[0]) profiles = Object.keys(ENDPOINT_MODELS).map((name) => listedProfile(name, model)).filter(Boolean);
  if (!profiles.length) {
    for (const name of Object.keys(ENDPOINT_MODELS)) profiles = profiles.concat(Object.keys(ENDPOINT_MODELS[name]).map((key) => ENDPOINT_MODELS[name][key]));
  }
  const settings = { duration: 0, resolution: RESOLUTIONS[0] };
  for (const profile of profiles) {
    settings.duration = Math.max(settings.duration, profile.durations[1]);
    for (const tier of profile.resolutions) {
      if (RESOLUTIONS.indexOf(tier) > RESOLUTIONS.indexOf(settings.resolution)) settings.resolution = tier;
    }
  }
  return settings;
}

// The duration and resolution a native request is reserved for: those the
// plugin can read from the body, the model's defaults on the endpoint when
// the body leaves them out, and otherwise the dearest the model renders.
function nativeSettings(action, model, body) {
  const listed = listedProfile(action, model);
  const settings = dearestSettings(action, model);
  const seconds = typeof body.duration === "number" || typeof body.duration === "string" ? Number(body.duration) : NaN;
  let durationKnown = true;
  if (Number.isInteger(seconds) && seconds > 0 && seconds <= 3600) settings.duration = seconds;
  else if ((body.duration === undefined || body.duration === null) && listed) settings.duration = listed.durations[2];
  else durationKnown = false;
  const tier = RESOLUTIONS.find((item) => item.toLowerCase() === trimmed(body.resolution).toLowerCase());
  if (tier) settings.resolution = tier;
  else if ((body.resolution === undefined || body.resolution === null) && listed && durationKnown)
    settings.resolution = listed.longest && settings.duration === listed.durations[1] ? listed.longest[0] : listed.resolutions[0];
  return settings;
}

// The host protocols map an OpenAI size or a tier in any case onto the
// model's resolutions; an unknown value keeps the model's default.
function mappedResolution(value, resolutions) {
  const raw = trimmed(value);
  if (!raw) return undefined;
  const tier = resolutions.find((item) => item.toLowerCase() === raw.toLowerCase());
  if (tier) return tier;
  const parts = raw.toLowerCase().replace("*", "x").split("x");
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (parts.length !== 2 || !(width > 0) || !(height > 0)) return undefined;
  const longer = Math.max(width, height);
  const wanted = longer >= 3840 ? "4K" : longer >= 2560 ? "2K" : longer >= 1920 ? "1080p" : longer >= 1280 ? "720p" : longer >= 960 ? "540p" : "360p";
  return resolutions.includes(wanted) ? wanted : undefined;
}

// The duration and resolution a host-protocol or legacy request sends Vidu:
// the request's, whose size or resolution may sit in metadata, or the model's
// defaults on the endpoint. Vidu checks them for the model.
function requestSettings(req, action, model) {
  const profile = listedProfile(action, model) || WIDEST;
  const duration = req.duration === undefined || req.duration === null || req.duration === "" ? profile.durations[2] : Number(req.duration);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 3600) throw new Error("seconds must be between 1 and 3600");
  const resolutions = profile.longest && duration === profile.durations[1] ? profile.longest : profile.resolutions;
  const metadata = (req && req.metadata) || {};
  return { duration: duration, resolution: mappedResolution(req.resolution || metadata.resolution || req.size, resolutions) || resolutions[0] };
}

function filePlaceholder(image) {
  if (!image || typeof image !== "object" || Array.isArray(image) || !image.__fileRef) return image;
  const placeholder = { __fileRef: image.__fileRef, encoding: image.encoding };
  if (image.mimeType) placeholder.mimeType = image.mimeType;
  if (image.maxBytes !== undefined && image.maxBytes !== null) placeholder.maxBytes = image.maxBytes;
  return placeholder;
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

function actionFor(req) {
  if (req.vendorBody) return req.action;
  if (req.metadata && req.metadata.action) {
    const aliases = {
      generate: "image_to_video",
      textGenerate: "text_to_video",
      firstTailGenerate: "first_tail_to_video",
      referenceGenerate: "reference_to_video",
      remixGenerate: "remix",
    };
    return aliases[req.metadata.action] || req.metadata.action;
  }
  if (!req.images || req.images.length === 0) return "text_to_video";
  if (req.images.length === 2) return "first_tail_to_video";
  if (req.images.length > 2) return "reference_to_video";
  return "image_to_video";
}

function pathFor(action) {
  if (action === "image_to_video") return "/img2video";
  if (action === "first_tail_to_video") return "/start-end2video";
  if (action === "reference_to_video") return "/reference2video";
  return "/text2video";
}

// The fields of Vidu's query reply (GET /ent/v2/tasks/{id}/creations); the
// create reply shares some of them under other names.
const QUERY_FIELDS = ["state", "err_code", "credits", "payload", "bgm", "off_peak", "creations"];

export const native = {
  // Vidu's own body, sent as is for Vidu to check. The route names the
  // endpoint.
  createTask: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const body = plainObject(ctx.body.value);
    if (!body) throw new Error("request body must be an object");
    const model = trimmed(body.model);
    if (!model) throw new Error("model is required");
    if (body.callback_url !== undefined && body.callback_url !== null) throw new Error("callback_url is not supported; query the task instead");
    const action = ROUTE_ACTIONS[ctx.path.slice(ctx.path.lastIndexOf("/") + 1)];
    return { kind: "submit", model: model, action: action, requestBody: { model: model, action: action, vendorBody: body } };
  },
  taskCreated: function (ctx, task) {
    return Object.assign({}, plainObject(task.data) || {}, { task_id: task.task_id });
  },
  // Vidu's query reply. Before the first poll the task holds the create
  // reply, whose query fields are kept; the poller can fail a task whose
  // snapshot was still processing, which then reads failed so a downstream
  // gateway sees the same state.
  taskStatus: function (ctx, task) {
    const data = plainObject(task.data) || {};
    let output = Object.assign({}, data, { id: task.task_id });
    if (data.task_id !== undefined && data.id === undefined) {
      output = { id: task.task_id, err_code: "", creations: [] };
      for (const key of QUERY_FIELDS) {
        if (data[key] !== undefined) output[key] = data[key];
      }
    }
    if (task.status === "FAILURE" && output.state !== "failed") {
      output.state = "failed";
      output.err_code = output.err_code || task.fail_reason || "task failed";
    }
    return output;
  },
  error: function (ctx, error) {
    return { code: error.code, message: error.message };
  },
};

// The duration and resolution the task is reserved for, for the model the
// channel sends.
function submitSettings(ctx, action) {
  const req = ctx.requestBody || {};
  const model = ctx.upstreamModel || req.model;
  return req.vendorBody ? nativeSettings(action, model, req.vendorBody) : requestSettings(req, action, model);
}

// A native request reaches Vidu as the client sent it. The host protocols
// put the prompt and images in Vidu's fields and their other Vidu fields in
// metadata, which cannot replace the billed model, duration and resolution.
export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody;
  const action = actionFor(req);
  const model = ctx.upstreamModel || req.model;
  let body;
  if (req.vendorBody) body = Object.assign({}, req.vendorBody, { model: model });
  else {
    body = Object.assign({}, req.metadata || {}, { model: model }, requestSettings(req, action, model));
    if (trimmed(req.prompt)) body.prompt = req.prompt;
    if (Array.isArray(req.images) && req.images.length) body.images = req.images;
    delete body.action;
  }
  if (Array.isArray(body.images)) body.images = body.images.map(filePlaceholder);
  return {
    url: apiRoot(ctx) + pathFor(action),
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authorization(ctx) },
    body: body,
    action: action,
  };
}

export function parseSubmitResponse(ctx, resp) {
  if (!resp.body || resp.body.state === "failed") throw new Error("task failed");
  if (!resp.body.task_id) throw new Error("missing task_id");
  return { taskId: resp.body.task_id, taskData: resp.body };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  return submitSettings(ctx, actionFor(ctx.requestBody || {}));
}

export function buildQueryRequest(ctx) {
  return {
    url: apiRoot(ctx) + "/tasks/" + ctx.taskId + "/creations",
    method: "GET",
    headers: { Accept: "application/json", Authorization: authorization(ctx) },
  };
}

export function parseTaskResult(ctx, body) {
  const statuses = { created: "SUBMITTED", queueing: "SUBMITTED", processing: "IN_PROGRESS", success: "SUCCESS", failed: "FAILURE" };
  const status = statuses[body.state];
  if (!status) return { status: "UNKNOWN", reason: "unknown task state: " + String(body.state || "") };
  const url = body.creations && body.creations.length ? body.creations[0].url || "" : "";
  const result = { status: status, reason: body.state === "failed" ? body.err_code || "" : "" };
  if (url) result.url = url;
  return result;
}

function artifactData(ctx) {
  const data = (ctx && ctx.data) || {};
  if (data.data && typeof data.data === "object" && data.data.task_id && Object.prototype.hasOwnProperty.call(data.data, "data")) return data.data.data || {};
  return data;
}

function artifactVideoURL(ctx) {
  const creations = artifactData(ctx).creations;
  return Array.isArray(creations) && creations.length ? String(creations[0].url || "").trim() : "";
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
  if (!body || !Object.prototype.hasOwnProperty.call(body, "credits") || body.credits === undefined || body.credits === null) return null;
  const credits = Number(body.credits);
  if (!Number.isFinite(credits)) return null;
  return { credits: credits };
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
      const images = [];
      for (const image of [req.image, req.input_reference].concat(req.images || [], input.images)) {
        if (trimmed(image) && !images.includes(trimmed(image))) images.push(trimmed(image));
      }
      if (!prompt && images.length === 0) throw new Error("input is required");
      const requestBody = { model: model, prompt: prompt };
      if (images.length) requestBody.images = images;
      if (Object.prototype.hasOwnProperty.call(req, "seconds")) requestBody.duration = req.seconds;
      else if (Object.prototype.hasOwnProperty.call(req, "duration")) requestBody.duration = req.duration;
      if (Object.prototype.hasOwnProperty.call(req, "size")) requestBody.size = req.size;
      if (Object.prototype.hasOwnProperty.call(req, "metadata")) requestBody.metadata = req.metadata;
      const action = actionFor(requestBody);
      requestSettings(requestBody, action, ctx.upstreamModel || model);
      return { kind: "submit", model: model, action: action, requestBody: requestBody };
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
        metadata: { vendor: "vidu" },
      };
    },
  },
};

const legacyRenderers = {
  openai_video: function (task) {
    const statusMap = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
    const output = {
      id: task.task_id,
      object: "video",
      model: "",
      status: statusMap[task.status] || "unknown",
      progress: Number(String(task.progress || "0").replace("%", "")),
      created_at: task.created_at,
    };
    if (task.updated_at) output.completed_at = task.updated_at;
    if (task.data && task.data.state === "failed" && task.data.err_code) output.error = { message: task.data.err_code, code: task.data.err_code };
    return output;
  },
};

protocols.openai_video = {
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
    // vendorBody carries a native request's own body; clients of this protocol cannot set it.
    delete req.vendorBody;
    const model = ctx.upstreamModel || ctx.model || req.model;
    const seconds = req.seconds === undefined ? req.duration : req.seconds;
    if (seconds !== undefined) req.duration = Number(seconds);
    if (hasInputReferenceFile) {
      req.images = [{ __fileRef: "request_file:input_reference", encoding: "dataUrl", maxBytes: 15728640 }];
    } else {
      const image = trimmed(req.input_reference || req.image);
      if (image && (!Array.isArray(req.images) || req.images.length === 0)) req.images = [image];
    }
    const action = actionFor(req);
    const settings = requestSettings(req, action, model);
    req.duration = settings.duration;
    req.resolution = settings.resolution;
    return {
      kind: "submit",
      model: ctx.model,
      action: action,
      requestBody: Object.assign({}, req, { model: ctx.model }),
    };
  },
  render: function (ctx, task) {
    return legacyRenderers.openai_video(task);
  },
};
