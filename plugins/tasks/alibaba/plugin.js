export const meta = {
  apiVersion: 1,
  key: "alibaba",
  name: "Alibaba Bailian",
  icon: "Bailian.Color",
  description: {
    en: "Alibaba Cloud Bailian Wanxiang video generation (text-to-video and image-to-video)",
    zh: "阿里云百炼万相视频生成（文生视频、图生视频）",
  },
  version: "1.1.0",
  author: { name: "QuantumNous" },
  channelTypes: [17],
  models: [
    "wan3.0-video",
    "wan3.0-video-prime",
    "wan2.7-i2v",
    "wan2.7-t2v",
    "wan2.5-t2v-preview",
    "wan2.5-i2v-preview",
    "wan2.2-i2v-flash",
    "wan2.2-i2v-plus",
    "wanx2.1-i2v-plus",
    "wanx2.1-i2v-turbo",
  ],
  fetchMode: "per_task",
  usageSchema: {
    seconds: {
      type: "number",
      unit: "second",
      description: { en: "Requested video duration in seconds.", zh: "请求的视频时长，单位为秒。" },
    },
    resolution: {
      enum: ["480P", "720P", "1080P"],
      description: { en: "Requested output video resolution.", zh: "请求的输出视频分辨率。" },
    },
  },
  routes: [
    { method: "POST", path: "/ali/api/v1/services/aigc/video-generation/video-synthesis", type: "submit", decode: "createVideoTask", render: "taskCreated" },
    { method: "GET", path: "/ali/api/v1/tasks/:task_id", type: "query", render: "taskStatus" },
  ],
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
};

function trimmed(value) {
  return String(value || "").trim();
}

function firstImage(req) {
  if (trimmed(req.image)) return trimmed(req.image);
  for (const image of req.images || []) if (trimmed(image)) return trimmed(image);
  return trimmed(req.input_reference);
}

function secondImage(req) {
  let count = 0;
  for (const image of req.images || []) {
    if (!trimmed(image)) continue;
    count++;
    if (count === 2) return trimmed(image);
  }
  return "";
}

const SIZE_TO_RESOLUTION = {
  "832*480": "480P",
  "480*832": "480P",
  "624*624": "480P",
  "1280*720": "720P",
  "720*1280": "720P",
  "960*960": "720P",
  "1088*832": "720P",
  "832*1088": "720P",
  "1920*1080": "1080P",
  "1080*1920": "1080P",
  "1440*1440": "1080P",
  "1632*1248": "1080P",
  "1248*1632": "1080P",
};

// The host rejects negative canonical duration/seconds facts before any hook
// runs, so wan3.0's "-1 = smart duration" sentinel travels as a boolean marker.
function normalizeAutoDuration(req) {
  let auto = req.auto_duration === true;
  for (const key of ["duration", "seconds"]) {
    if (Number(req[key]) === -1) {
      auto = true;
      delete req[key];
    }
  }
  const parameters = req.metadata && req.metadata.parameters;
  if (parameters && Number(parameters.duration) === -1) {
    auto = true;
    delete parameters.duration;
  }
  if (auto) req.auto_duration = true;
  return req;
}

function normalizeResolution(value) {
  let resolution = String(value || "").toUpperCase();
  if (!resolution.endsWith("P")) resolution += "P";
  return resolution;
}

function convert(ctx) {
  const req = ctx.requestBody;
  const upstreamModel = ctx.upstreamModel || req.model;
  const input = { prompt: req.prompt || "" };
  const image = firstImage(req);
  if (image) input.img_url = image;
  const parameters = { prompt_extend: true, duration: 5 };

  if (req.size) {
    if (String(upstreamModel).includes("t2v") && !String(req.size).includes("*")) throw new Error("invalid size: " + req.size + ", example: 1920*1080");
    if (String(req.size).includes("*")) parameters.size = req.size;
    else parameters.resolution = normalizeResolution(req.size);
  } else if (String(upstreamModel).includes("t2v")) {
    parameters.size = String(upstreamModel).startsWith("wan2.5") || String(upstreamModel).startsWith("wan2.2") ? "1920*1080" : "1280*720";
  } else if (
    String(upstreamModel).startsWith("wan2.6") ||
    String(upstreamModel).startsWith("wan2.5") ||
    String(upstreamModel).startsWith("wan2.2-i2v-plus") ||
    String(upstreamModel).startsWith("wan3.0")
  ) {
    parameters.resolution = "1080P";
  } else {
    parameters.resolution = "720P";
  }

  if (req.auto_duration === true) {
    if (!String(upstreamModel).startsWith("wan3.0")) throw new Error("duration -1 (smart duration) is only supported by wan3.0 models");
    parameters.duration = -1;
  } else if (Number(req.duration) > 0) parameters.duration = Number(req.duration);
  else if (req.seconds) {
    const seconds = Number(req.seconds);
    if (!Number.isInteger(seconds)) throw new Error("convert seconds to int failed");
    parameters.duration = seconds > 0 ? seconds : 5;
  }

  const metadata = req.metadata || {};
  Object.assign(input, metadata.input || {});
  Object.assign(parameters, metadata.parameters || {});
  const model = metadata.model === undefined ? upstreamModel : metadata.model;
  if (model !== upstreamModel) throw new Error("can't change model with metadata");
  const body = { model: model, input: input, parameters: parameters };

  if (String(model).startsWith("wan2.7-i2v") || String(model).startsWith("wan3.0-video")) {
    if (!Array.isArray(input.media) || input.media.length === 0) {
      input.media = [];
      const first = trimmed(input.first_frame_url) || trimmed(input.img_url) || firstImage(req);
      const last = trimmed(input.last_frame_url) || secondImage(req);
      if (first) input.media.push({ type: "first_frame", url: first });
      if (last) input.media.push({ type: "last_frame", url: last });
      if (String(model).startsWith("wan2.7-i2v") && trimmed(input.audio_url)) input.media.push({ type: "driving_audio", url: input.audio_url });
    }
    if (String(model).startsWith("wan2.7-i2v") && input.media.length === 0)
      throw new Error("wan2.7-i2v requires image, images, input_reference, or input.media");
    if (String(model).startsWith("wan3.0-video")) {
      if (input.media.length === 0) delete input.media;
      if (!trimmed(input.prompt) && !(Array.isArray(input.media) && input.media.length)) throw new Error("wan3.0-video requires prompt or input.media");
      if (parameters.size) {
        const mapped = SIZE_TO_RESOLUTION[parameters.size];
        if (!mapped) throw new Error("invalid size: " + parameters.size + ", wan3.0 accepts resolution 480P, 720P, or 1080P");
        parameters.resolution = mapped;
        delete parameters.size;
      }
      if (!parameters.resolution) parameters.resolution = "1080P";
      if (!parameters.ratio) parameters.ratio = "adaptive";
      const duration = Number(parameters.duration);
      if (duration !== -1 && (!Number.isInteger(duration) || duration < 2 || duration > 30))
        throw new Error("wan3.0 duration must be -1 or an integer between 2 and 30");
    }
    delete input.img_url;
    delete input.first_frame_url;
    delete input.last_frame_url;
    delete input.audio_url;
  }
  if (!parameters.prompt_extend) delete parameters.prompt_extend;
  if (!parameters.watermark) delete parameters.watermark;
  if (!parameters.seed) delete parameters.seed;
  for (const key of ["resolution", "size", "ratio"]) if (!parameters[key]) delete parameters[key];
  return body;
}

function resolutionRatio(body) {
  let resolution = body.parameters.size ? SIZE_TO_RESOLUTION[body.parameters.size] : normalizeResolution(body.parameters.resolution);
  const ratios = {
    "wan3.0-video": { "480P": 1, "720P": 2, "1080P": 4 },
    "wan3.0-video-prime": { "480P": 1, "720P": 2, "1080P": 4 },
    "wan2.6-i2v": { "720P": 1, "1080P": 1 / 0.6 },
    "wan2.5-t2v-preview": { "480P": 1, "720P": 2, "1080P": 1 / 0.3 },
    "wan2.2-t2v-plus": { "480P": 1, "1080P": 5 },
    "wan2.5-i2v-preview": { "480P": 1, "720P": 2, "1080P": 1 / 0.3 },
    "wan2.2-i2v-plus": { "480P": 1, "1080P": 5 },
    "wan2.2-kf2v-flash": { "480P": 1, "720P": 2, "1080P": 4.8 },
    "wan2.2-i2v-flash": { "480P": 1, "720P": 2 },
    "wan2.2-s2v": { "480P": 1, "720P": 1.8 },
  };
  return ratios[body.model] ? { key: "resolution-" + resolution, value: ratios[body.model][resolution] } : null;
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

export function buildSubmitRequest(ctx) {
  const body = convert(ctx);
  return {
    url: ctx.baseUrl + "/api/v1/services/aigc/video-generation/video-synthesis",
    method: "POST",
    headers: { Authorization: "Bearer " + ctx.apiKey, "Content-Type": "application/json", "X-DashScope-Async": "enable" },
    body: body,
    action: firstImage(ctx.requestBody) || (body.input && Array.isArray(body.input.media) && body.input.media.length) ? "image_to_video" : "text_to_video",
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  if (body.code) throw new Error(body.code + ": " + (body.message || ""));
  if (!body.output || !body.output.task_id) throw new Error("task_id is empty");
  return { taskId: body.output.task_id, taskData: body };
}

export function extractUsage(ctx) {
  const body = convert(ctx);
  const duration = Number(body.parameters.duration);
  const seconds = Math.min(duration === -1 ? 30 : duration, 3600);
  if (ctx.usagePurpose === "billing_ratios") {
    const ratios = { seconds: seconds };
    const resolution = resolutionRatio(body);
    if (resolution && resolution.value !== undefined) ratios[resolution.key] = resolution.value;
    return ratios;
  }
  let resolution = body.parameters.size ? SIZE_TO_RESOLUTION[body.parameters.size] : normalizeResolution(body.parameters.resolution);
  if (!["480P", "720P", "1080P"].includes(resolution)) resolution = String(body.model).startsWith("wan3.0") ? "1080P" : "720P";
  return { seconds: seconds, resolution: resolution };
}

export function extractUsageOnComplete(task, taskResult, body) {
  const output = (body && body.output) || {};
  const usage = (body && body.usage) || {};
  const facts = {};
  const seconds = Number(usage.output_video_duration || usage.duration || output.duration || output.duration_seconds || 0);
  if (Number.isFinite(seconds) && seconds > 0) facts.seconds = Math.min(seconds, 3600);
  const resolution = normalizeResolution(usage.SR || output.resolution || "");
  if (["480P", "720P", "1080P"].includes(resolution)) facts.resolution = resolution;
  return facts;
}

export function buildQueryRequest(ctx) {
  return { url: ctx.baseUrl + "/api/v1/tasks/" + ctx.taskId, method: "GET", headers: { Authorization: "Bearer " + ctx.apiKey } };
}

export function parseTaskResult(ctx, body) {
  const output = body.output || {};
  if (output.task_status === "PENDING") return { status: "QUEUED" };
  if (output.task_status === "RUNNING") return { status: "IN_PROGRESS" };
  if (output.task_status === "SUCCEEDED") return { status: "SUCCESS", url: output.video_url || "" };
  if (["FAILED", "CANCELED", "UNKNOWN"].includes(output.task_status)) {
    let reason = body.message || "";
    if (!reason && output.message) reason = "task failed, code: " + (output.code || "") + " , message: " + output.message;
    if (!reason) reason = "task failed";
    return { status: "FAILURE", reason: reason };
  }
  return { status: "UNKNOWN", reason: "unrecognized status: " + String(output.task_status || "") };
}

function artifactData(ctx) {
  const data = (ctx && ctx.data) || {};
  if (data.data && typeof data.data === "object" && data.data.task_id && Object.prototype.hasOwnProperty.call(data.data, "data")) return data.data.data || {};
  return data;
}

export function listArtifacts(task) {
  const output = artifactData(task).output || {};
  return task.status === "SUCCESS" && trimmed(output.video_url) ? [{ key: "video", type: "video" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = trimmed((artifactData(ctx).output || {}).video_url);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

export const native = {
  createVideoTask: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json" || !ctx.body.value || Array.isArray(ctx.body.value)) throw new Error("JSON object required");
    const req = ctx.body.value,
      input = req.input || {},
      parameters = req.parameters || {};
    const requestBody = {
      model: req.model,
      prompt: input.prompt || "",
      image: input.img_url,
      duration: parameters.duration,
      size: parameters.size || parameters.resolution,
    };
    const hasMedia = Array.isArray(input.media) && input.media.length > 0;
    if (hasMedia || String(req.model).startsWith("wan3.0")) {
      requestBody.metadata = { input: hasMedia ? { media: input.media } : {}, parameters: Object.assign({}, parameters) };
    }
    normalizeAutoDuration(requestBody);
    return {
      kind: "submit",
      model: req.model,
      action: input.img_url || hasMedia ? "image_to_video" : "text_to_video",
      requestBody: requestBody,
    };
  },
  taskCreated: function (ctx, task) {
    const data = task.data || {};
    return { request_id: data.request_id || "", output: { task_id: task.task_id, task_status: "PENDING" } };
  },
  taskStatus: function (ctx, task) {
    const data = task.data || {},
      output = Object.assign({}, data.output || {}, { task_id: task.task_id });
    return Object.assign({}, data, { output: output });
  },
  error: function (ctx, error) {
    return { code: error.code, message: error.message, request_id: "" };
  },
};

export const protocols = {
  openai_responses: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const req = ctx.body.value;
      if (!req || typeof req !== "object" || Array.isArray(req)) throw new Error("request body must be an object");
      const model = trimmed(ctx.model);
      if (!model) throw new Error("model is required");
      if (req.input !== undefined && typeof req.input !== "string" && !Array.isArray(req.input)) throw new Error("input must be a string or array");
      const input = responsesInput(req);
      const prompt = input.prompt || trimmed(req.prompt);
      const requestBody = { model: model, prompt: prompt };
      if (trimmed(req.image)) requestBody.image = trimmed(req.image);
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      const images = [];
      for (const image of req.images || []) if (trimmed(image) && !images.includes(trimmed(image))) images.push(trimmed(image));
      for (const image of input.images) if (!images.includes(image)) images.push(image);
      if (images.length) requestBody.images = images;
      if (trimmed(req.input_reference)) requestBody.input_reference = trimmed(req.input_reference);
      for (const key of ["size", "duration", "seconds"]) {
        if (Object.prototype.hasOwnProperty.call(req, key)) requestBody[key] = req[key];
      }
      if (Object.prototype.hasOwnProperty.call(req, "metadata")) requestBody.metadata = req.metadata;
      normalizeAutoDuration(requestBody);
      const hasMetaMedia = req.metadata && req.metadata.input && Array.isArray(req.metadata.input.media) && req.metadata.input.media.length > 0;
      const upstream = String(ctx.upstreamModel || model);
      const acceptsImageOnly = upstream.includes("i2v") || upstream.startsWith("wan3.0");
      if (!prompt && !hasMetaMedia && !(acceptsImageOnly && firstImage(requestBody))) throw new Error("input is required");
      return { kind: "submit", model: model, action: firstImage(requestBody) || hasMetaMedia ? "image_to_video" : "text_to_video", requestBody: requestBody };
    },
    renderEvents: function (ctx, task, previousState) {
      const status = String(task.status || "UNKNOWN").toUpperCase();
      const value = Number(String(task.progress || "").replace("%", ""));
      const progress = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const state = { status: status, progress: progress };
      if (status === "SUCCESS") {
        const text = responsesVideoText(ctx);
        const events = previousState && previousState.status === status ? [] : text ? [{ type: "output", data: text }] : [];
        return { events: events, state: state, done: true };
      }
      if (status === "FAILURE") {
        return { events: [{ type: "error", code: "task_failed", message: "task failed" }], state: state, done: true };
      }
      if (previousState && previousState.status === status && previousState.progress === progress) {
        return { events: [], state: state, done: false };
      }
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
            content: [
              {
                type: "output_text",
                text: responsesVideoText(ctx),
                annotations: [],
                logprobs: [],
              },
            ],
          },
        ],
        metadata: { vendor: "ali" },
      };
    },
  },
  openai_video: {
    decodeRequest: function (ctx) {
      let req;
      if (ctx.body && ctx.body.kind === "json") req = ctx.body.value;
      else if (ctx.body && ctx.body.kind === "multipart") {
        if ((ctx.body.files || []).length) throw new Error("Alibaba requires image references to be URLs");
        const first = function (name) {
          const values = (ctx.body.fields || {})[name] || [];
          if (values.length > 1) throw new Error(name + " must be provided once");
          return values[0];
        };
        req = {};
        const fields = ctx.body.fields || {};
        for (const name of Object.keys(fields)) {
          if (name === "images") req.images = fields[name] || [];
          else req[name] = first(name);
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
        if (req.duration !== undefined) req.duration = Number(req.duration);
      } else throw new Error("JSON or multipart body required");
      const requestBody = normalizeAutoDuration(Object.assign({}, req, { model: ctx.model }));
      return {
        kind: "submit",
        model: ctx.model,
        action: firstImage(requestBody) ? "image_to_video" : "text_to_video",
        requestBody: requestBody,
      };
    },
    render: function (ctx, task) {
      const data = task.data || {},
        outputData = data.output || {};
      const statuses = {
        PENDING: "queued",
        RUNNING: "in_progress",
        SUCCEEDED: "completed",
        FAILED: "failed",
        CANCELED: "failed",
        UNKNOWN: "failed",
      };
      const output = {
        id: task.task_id,
        object: "video",
        model: task.properties ? task.properties.origin_model_name || "" : "",
        status: statuses[outputData.task_status] || "unknown",
        progress: Number(String(task.progress || "0").replace("%", "")),
        created_at: task.created_at,
        completed_at: task.updated_at,
      };
      if (data.code) output.error = { code: data.code, message: data.message || "" };
      else if (outputData.code) output.error = { code: outputData.code, message: outputData.message || "" };
      return output;
    },
  },
};
