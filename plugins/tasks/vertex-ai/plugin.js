export const meta = {
  apiVersion: 1,
  key: "vertex-ai",
  name: "Google Veo (Vertex AI)",
  icon: "VertexAI.Color",
  description: {
    en: "Google Veo video generation on Vertex AI (text-to-video and image-to-video)",
    zh: "Google Veo 视频生成（文生视频、图生视频），Vertex AI 版本",
  },
  version: "1.2.0",
  channelTypes: [41],
  author: { name: "QuantumNous" },
  models: ["veo-3.0-generate-001", "veo-3.0-fast-generate-001", "veo-3.1-generate-preview", "veo-3.1-fast-generate-preview"],
  fetchMode: "per_task",
  auth: { type: "oauth2_jwt" },
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    // Requested video duration in seconds. Allowed values: 4, 6, 8.
    seconds: {
      type: "number",
      unit: "second",
      description: { en: "Video generation unit price", zh: "视频生成单价" },
    },
    // Requested video output resolution.
    resolution: {
      enum: ["720p", "1080p", "4k"],
      enumLabels: { "720p": { en: "720p", zh: "720p" }, "1080p": { en: "1080p", zh: "1080p" }, "4k": { en: "4k", zh: "4k" } },
      description: { en: "Output video resolution", zh: "输出视频分辨率" },
    },
    // Whether audio is generated. Default true. Audio and muted tiers have different prices.
    generate_audio: {
      type: "boolean",
      description: { en: "Whether audio is generated", zh: "是否生成音频" },
    },
  },
  usageExamples: [
    { label: "8s 720p audio", facts: { seconds: 8, resolution: "720p", generate_audio: true } },
    { label: "8s 720p muted", facts: { seconds: 8, resolution: "720p", generate_audio: false } },
    { label: "8s 1080p audio", facts: { seconds: 8, resolution: "1080p", generate_audio: true } },
    { label: "8s 4k audio", facts: { seconds: 8, resolution: "4k", generate_audio: true } },
  ],
  // Vertex AI request and response bodies, for clients and for a downstream New
  // API gateway, at both API versions Vertex serves them (google-genai defaults
  // to v1beta1); the gateway also serves each under /vertex-ai. The model
  // segment carries the method: predictLongRunning submits and
  // fetchPredictOperation polls. The gateway runs every request in its own
  // channel's project; the operation names it returns echo the path's project
  // and location and end with the gateway task id.
  routes: [
    {
      method: "POST",
      path: "/v1/projects/:project/locations/:location/publishers/google/models/:model",
      type: "dynamic",
      decode: "modelMethod",
      render: "operation",
    },
    {
      method: "POST",
      path: "/v1beta1/projects/:project/locations/:location/publishers/google/models/:model",
      type: "dynamic",
      decode: "modelMethod",
      render: "operation",
    },
  ],
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
};

function trimmed(value) {
  return String(value || "").trim();
}
function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
// On a New API channel the same plugin answers on another gateway, which
// serves the Vertex AI wire format under /vertex-ai, the form every gateway
// release serves, takes its own token as a Bearer header and runs the request
// in its own project.
function viaGateway(ctx) {
  return Boolean(ctx.upstream && ctx.upstream.kind === "new_api");
}
function requestHeaders(ctx) {
  const headers = { "Content-Type": "application/json", Accept: "application/json", Authorization: ctx.authHeader };
  if (!viaGateway(ctx)) headers["x-goog-user-project"] = ctx.auth.projectId;
  return headers;
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

function validImageInput(value) {
  value = trimmed(value);
  if (!value) return false;
  if (value.startsWith("data:")) {
    const comma = value.indexOf(",");
    return comma >= 0 && Boolean(value.slice(comma + 1));
  }
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function sizeParts(size) {
  const p = String(size || "")
    .toLowerCase()
    .split("x");
  return p.length === 2 ? [Number(p[0]), Number(p[1])] : null;
}
function resolution(size) {
  const p = sizeParts(size);
  if (!p) return "720p";
  const m = Math.max(p[0], p[1]);
  return m >= 3840 ? "4k" : m >= 1920 ? "1080p" : "720p";
}
function aspect(size) {
  const p = sizeParts(size);
  return !p || p[0] <= 0 || p[1] <= 0 ? "16:9" : p[1] > p[0] ? "9:16" : "16:9";
}
function duration(req) {
  let n = Number(req.duration);
  if (!Number.isFinite(n) || n <= 0) n = 8;
  return n;
}
function region(ctx, model) {
  const setting = ctx.userSetting || {};
  const configured = setting.vertexRegion || setting.apiVersion || "global";
  if (configured && typeof configured === "object") return configured[model] || configured.default || "global";
  return String(configured || "global");
}
function apiBase(baseUrl, project, location) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  if (base) return base + (base.endsWith("/v1") ? "" : "/v1") + "/projects/" + project + "/locations/" + location;
  return "https://" + (location === "global" ? "" : location + "-") + "aiplatform.googleapis.com/v1/projects/" + project + "/locations/" + location;
}
function modelURL(ctx, project, location, model, action) {
  return apiBase(ctx.baseUrl + (viaGateway(ctx) ? "/vertex-ai" : ""), project, location) + "/publishers/google/models/" + model + ":" + action;
}
function decodeTaskId(value) {
  return utils.base64URLDecode(value);
}
function operationPart(name, marker) {
  const start = name.indexOf(marker);
  if (start < 0) return "";
  return name.slice(start + marker.length).split("/")[0];
}
// firstVideo is the first video of a finished operation: written to Cloud
// Storage (gcsUri) or returned inline (bytesBase64Encoded).
function firstVideo(operation) {
  return plainObject((((plainObject(operation) || {}).response || {}).videos || [])[0]) || {};
}
// fetchOperation reads a long-running operation by name, for the poller and
// for a video download.
function fetchOperation(ctx, name) {
  const project = operationPart(name, "projects/"),
    location = operationPart(name, "locations/"),
    model = operationPart(name, "models/");
  if (!project || !model) throw new Error("cannot extract project or model from operation name");
  return {
    url: modelURL(ctx, project, location || "us-central1", model, "fetchPredictOperation"),
    method: "POST",
    headers: requestHeaders(ctx),
    body: { operationName: name },
  };
}

export const native = {
  modelMethod: function (ctx) {
    const segment = String((ctx.params || {}).model || "");
    const separator = segment.lastIndexOf(":");
    const method = separator > 0 ? segment.slice(separator + 1) : "";
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const body = plainObject(ctx.body.value);
    if (!body) throw new Error("request body must be an object");
    if (method === "fetchPredictOperation") {
      const name = String(body.operationName || "");
      const marker = name.lastIndexOf("/operations/");
      if (marker < 0) throw new Error("operationName must name an operation");
      return { kind: "query", taskIds: [name.slice(marker + "/operations/".length)] };
    }
    if (method !== "predictLongRunning") throw new Error("the path must name models/{model}:predictLongRunning or :fetchPredictOperation");
    const model = segment.slice(0, separator);
    const instances = Array.isArray(body.instances) ? body.instances : [];
    const instance = plainObject(instances[0]);
    if (instances.length !== 1 || !instance) throw new Error("instances must hold exactly one instance");
    // buildSubmitRequest sends only the prompt and the first frame.
    for (const key of Object.keys(instance)) {
      if (key !== "prompt" && key !== "image") throw new Error("instances[0]." + key + " is not supported");
    }
    const metadata = Object.assign({}, plainObject(body.parameters) || {});
    const requestBody = { model: model, prompt: instance.prompt, metadata: metadata };
    if (metadata.durationSeconds !== undefined) {
      requestBody.duration = metadata.durationSeconds;
      delete metadata.durationSeconds;
      if ([4, 6, 8].indexOf(Number(requestBody.duration)) < 0) throw new Error("durationSeconds must be one of 4, 6, or 8");
    }
    if (metadata.resolution !== undefined && ["720p", "1080p", "4k"].indexOf(String(metadata.resolution).toLowerCase()) < 0)
      throw new Error("resolution must be one of 720p, 1080p, or 4k");
    if (instance.image !== undefined) {
      const image = plainObject(instance.image) || {};
      const mime = trimmed(image.mimeType).toLowerCase();
      if (!trimmed(image.bytesBase64Encoded)) throw new Error("instances[0].image must carry bytesBase64Encoded");
      if (mime !== "image/jpeg" && mime !== "image/png") throw new Error("input image must be image/jpeg or image/png");
      requestBody.images = ["data:" + mime + ";base64," + image.bytesBase64Encoded];
    }
    return { kind: "submit", model: model, action: requestBody.images ? "image_to_video" : "text_to_video", requestBody: requestBody };
  },
  // Submission renders one task and fetchPredictOperation a list of one. The
  // poller can fail a task whose operation was still running; that operation
  // is rendered done with the failure.
  operation: function (ctx, tasks) {
    const task = Array.isArray(tasks) ? tasks[0] : tasks;
    const params = ctx.params || {};
    const data = plainObject(task.data) || {};
    const named = /\/models\/([^/]+)\/operations\//.exec(String(data.name || ""));
    const model = named ? named[1] : String(params.model || "").split(":")[0];
    const output = Object.assign({}, data, {
      name: "projects/" + params.project + "/locations/" + params.location + "/publishers/google/models/" + model + "/operations/" + task.task_id,
    });
    if (task.status === "FAILURE" && !(plainObject(data.error) && data.error.message)) {
      output.done = true;
      output.error = { message: task.fail_reason || "task failed" };
      delete output.response;
    }
    return output;
  },
  error: function (ctx, error) {
    return { error: { code: error.httpStatus, message: error.message } };
  },
};

export function buildSubmitRequest(ctx) {
  if (ctx.authError) throw new Error(ctx.authError);
  const req = ctx.requestBody || {},
    metadata = Object.assign({}, req.metadata || {}),
    model = ctx.upstreamModel || "veo-3.0-generate-001";
  if (Number(req.duration) > 0) metadata.durationSeconds = Number(req.duration);
  if (!metadata.resolution && req.size) metadata.resolution = resolution(req.size);
  if (!metadata.aspectRatio && req.size) metadata.aspectRatio = aspect(req.size);
  if (metadata.resolution) metadata.resolution = String(metadata.resolution).toLowerCase();
  metadata.sampleCount = 1;
  const instance = { prompt: req.prompt };
  const image = (req.images || [])[0];
  if (image && typeof image === "object" && !Array.isArray(image) && image.__fileRef) {
    let mime = String(image.mimeType || "").toLowerCase();
    if (mime !== "image/jpeg" && mime !== "image/png") {
      const files = ctx.files || [];
      for (const file of files) {
        if (file.ref === image.__fileRef || file.field === "input_reference") {
          mime = String(file.mimeType || "").toLowerCase();
          break;
        }
      }
    }
    if (mime !== "image/jpeg" && mime !== "image/png") throw new Error("input image must be image/jpeg or image/png");
    instance.image = { bytesBase64Encoded: image, mimeType: mime };
  } else if (image) {
    const text = String(image);
    const comma = text.indexOf(",");
    let mime = "";
    let data = text;
    if (text.startsWith("data:")) {
      mime = text.slice(5, comma).split(";")[0].toLowerCase();
      data = text.slice(comma + 1);
    } else if (text.startsWith("iVBORw0KGgo")) mime = "image/png";
    else if (text.startsWith("/9j/")) mime = "image/jpeg";
    if (mime !== "image/jpeg" && mime !== "image/png") throw new Error("input image must be image/jpeg or image/png");
    instance.image = { bytesBase64Encoded: data, mimeType: mime };
  }
  return {
    // A gateway runs the request in its own project, so the path names none.
    url: modelURL(ctx, viaGateway(ctx) ? "-" : ctx.auth.projectId, region(ctx, model), model, "predictLongRunning"),
    method: "POST",
    headers: requestHeaders(ctx),
    body: { instances: [instance], parameters: metadata },
    action: image ? "image_to_video" : "text_to_video",
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  if (!String(body.name || "").trim()) throw new Error("missing operation name");
  return { taskId: utils.base64URL(body.name), taskData: body };
}
export function extractUsage(ctx) {
  const req = ctx.requestBody || {};
  const metadata = req.metadata || {};
  return {
    seconds: duration(req),
    resolution: String(metadata.resolution || resolution(req.size) || "720p").toLowerCase(),
    generate_audio: metadata.generateAudio !== false,
  };
}
export function extractUsageOnComplete() {
  return null;
}
export function buildQueryRequest(ctx) {
  return fetchOperation(ctx, decodeTaskId(ctx.taskId));
}
export function parseTaskResult(ctx, body) {
  if (body.error && body.error.message) return { status: "FAILURE", progress: "100%", reason: body.error.message };
  // Google long-running operations omit `done` (proto3 default) while still
  // running, so a missing key means in-progress; only a non-operation shape is
  // unrecognized.
  if (!body || typeof body !== "object" || !String(body.name || "").trim()) return { status: "UNKNOWN", reason: "unrecognized operation state" };
  if (body.done !== true) return { status: "IN_PROGRESS", progress: "50%" };
  const result = { status: "SUCCESS", progress: "100%" };
  const gcsUri = trimmed(firstVideo(body).gcsUri);
  if (gcsUri) result.remoteUrl = gcsUri;
  return result;
}
// A video written to Cloud Storage stays there. An inline video is too large
// for the stored operation, which keeps its media type only, so a download
// fetches the operation again.
export function listArtifacts(task) {
  const video = firstVideo(task.data);
  if (task.status !== "SUCCESS" || !Object.keys(video).length || trimmed(video.gcsUri)) return [];
  return [{ key: "video", type: "video", mimeType: trimmed(video.mimeType) || "video/mp4" }];
}
export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  // Another gateway serves the video as the artifact of its task, the last
  // segment of the operation name.
  if (viaGateway(ctx)) {
    const taskID = decodeTaskId(ctx.upstreamTaskId).split("/").pop();
    return {
      url: ctx.baseUrl + "/v1/tasks/" + encodeURIComponent(taskID) + "/artifacts/video/content",
      method: ctx.clientRequest.method,
      headers: { Authorization: "Bearer " + ctx.apiKey },
    };
  }
  return Object.assign(fetchOperation(ctx, decodeTaskId(ctx.upstreamTaskId)), {
    responseType: "json",
    contentPath: ["response", "videos", 0, "bytesBase64Encoded"],
    mimeType: trimmed(firstVideo(ctx.data).mimeType) || "video/mp4",
  });
}
function completionMessage(ctx, task) {
  const request = (ctx && ctx.requestBody) || {};
  const model = trimmed(request.model) || trimmed((task.properties || {}).origin_model_name) || "veo-3.0-generate-001";
  const status = String(task.status || "SUCCESS").toUpperCase();
  return (
    "Video generation for " +
    model +
    " completed (" +
    duration(request) +
    " seconds, status " +
    status +
    "). Retrieve the video through the native /v1/videos task flow."
  );
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
      if (images.length && !validImageInput(images[0])) throw new Error("input image must be a data URL or base64 value");
      const metadata = Object.assign({}, req.metadata || {});
      if (Object.prototype.hasOwnProperty.call(req, "resolution")) metadata.resolution = req.resolution;
      const requestBody = { model: model, prompt: prompt, metadata: metadata };
      if (images.length) requestBody.images = images;
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
        const events = previousState && previousState.status === status ? [] : [{ type: "output", data: completionMessage(ctx, task) }];
        return { events: events, state: state, done: true };
      }
      if (status === "FAILURE")
        return { events: [{ type: "error", code: "task_failed", message: task.fail_reason || "task failed" }], state: state, done: true };
      if (previousState && previousState.status === status && previousState.progress === progress) return { events: [], state: state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state: state, done: false };
    },
    renderFinal: function (ctx, task) {
      return {
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: completionMessage(ctx, task), annotations: [], logprobs: [] }],
          },
        ],
        metadata: { vendor: "vertex", artifact_mode: "native_videos" },
      };
    },
  },
};

const legacyRenderers = {
  openai_video: function (task) {
    const model = (task.properties || {}).origin_model_name || "veo-3.0-generate-001";
    const statuses = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
    const out = {
      id: task.task_id,
      object: "video",
      model,
      status: statuses[task.status] || "unknown",
      progress: Number(String(task.progress || "0").replace("%", "")),
      created_at: task.created_at,
    };
    if (Number(task.updated_at) > 0) out.completed_at = Number(task.updated_at);
    return out;
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
        const mime = String(file.mimeType || "").toLowerCase();
        if (mime !== "image/jpeg" && mime !== "image/png") throw new Error("input_reference must be image/jpeg or image/png");
        hasInputReferenceFile = true;
      }
      if (req.metadata !== undefined) {
        let parsed;
        try {
          parsed = JSON.parse(req.metadata);
        } catch {
          throw new Error("metadata must be a JSON object string");
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("metadata must be a JSON object string");
        req.metadata = parsed;
      }
      if (req.seconds !== undefined) req.seconds = Number(req.seconds);
      else if (req.duration !== undefined) req.seconds = Number(req.duration);
    }
    const seconds = req.seconds === undefined ? req.duration : req.seconds;
    if (seconds !== undefined) {
      const n = Number(seconds);
      if (n !== 4 && n !== 6 && n !== 8) throw new Error("seconds must be one of 4, 6, or 8");
      req.duration = n;
    }
    const providedResolution = req.resolution !== undefined ? req.resolution : req.metadata && req.metadata.resolution;
    if (providedResolution !== undefined && providedResolution !== "") {
      const value = String(providedResolution).toLowerCase();
      if (value !== "720p" && value !== "1080p" && value !== "4k") throw new Error("resolution must be one of 720p, 1080p, or 4k");
    }
    if (hasInputReferenceFile) {
      req.images = [{ __fileRef: "request_file:input_reference", encoding: "base64", maxBytes: 20971520 }];
    }
    return {
      kind: "submit",
      model: ctx.model,
      action: hasInputReferenceFile || req.input_reference || req.image ? "image_to_video" : "text_to_video",
      requestBody: Object.assign({}, req, { model: ctx.model }),
    };
  },
  render: function (ctx, task) {
    return legacyRenderers.openai_video(task);
  },
};
