// Protocol capabilities, not prices. Keep defaults and validation shared by
// native requests, compatibility protocols, and submission billing facts.
const WAN_MODELS = {
  "wan3.0-video": { kind: "all", resolutions: ["480P", "720P", "1080P"], defaultResolution: "1080P", maxDuration: 30 },
  "wan3.0-video-prime": { kind: "all", resolutions: ["480P", "720P", "1080P"], defaultResolution: "1080P", maxDuration: 30 },
  "wan2.7-t2v": { kind: "t2v", resolutions: ["720P", "1080P"], defaultResolution: "1080P", maxDuration: 15 },
  "wan2.7-i2v": { kind: "media", resolutions: ["720P", "1080P"], defaultResolution: "1080P", maxDuration: 15 },
  "wan2.6-t2v": { kind: "size", resolutions: ["720P", "1080P"], defaultResolution: "1080P", maxDuration: 15 },
  "wan2.6-t2v-us": { kind: "size", resolutions: ["720P", "1080P"], defaultResolution: "1080P", durations: [5, 10, 15] },
  "wan2.6-i2v": { kind: "image", resolutions: ["720P", "1080P"], defaultResolution: "1080P", maxDuration: 15 },
  "wan2.6-i2v-flash": { kind: "image", resolutions: ["720P", "1080P"], defaultResolution: "1080P", maxDuration: 15 },
  "wan2.6-i2v-us": { kind: "image", resolutions: ["720P", "1080P"], defaultResolution: "1080P", durations: [5, 10, 15] },
  "wan2.5-t2v-preview": { kind: "size", resolutions: ["480P", "720P", "1080P"], defaultResolution: "1080P", durations: [5, 10] },
  "wan2.5-i2v-preview": { kind: "image", resolutions: ["480P", "720P", "1080P"], defaultResolution: "1080P", durations: [5, 10] },
  "wan2.2-t2v-plus": { kind: "size", resolutions: ["480P", "1080P"], defaultResolution: "1080P", durations: [5] },
  "wan2.2-i2v-flash": { kind: "image", resolutions: ["480P", "720P", "1080P"], defaultResolution: "720P", durations: [5] },
  "wan2.2-i2v-plus": { kind: "image", resolutions: ["480P", "1080P"], defaultResolution: "1080P", durations: [5] },
  "wan2.2-kf2v-flash": { kind: "frames", resolutions: ["480P", "720P", "1080P"], defaultResolution: "720P", durations: [5] },
  "wan2.2-s2v": { kind: "speech", resolutions: ["480P", "720P"], defaultResolution: "480P" },
  "wanx2.1-t2v-plus": { kind: "size", resolutions: ["720P"], defaultResolution: "720P", durations: [5] },
  "wanx2.1-t2v-turbo": { kind: "size", resolutions: ["480P", "720P"], defaultResolution: "720P", durations: [5] },
  "wanx2.1-i2v-plus": { kind: "image", resolutions: ["720P"], defaultResolution: "720P", durations: [5] },
  "wanx2.1-i2v-turbo": { kind: "image", resolutions: ["480P", "720P"], defaultResolution: "720P", durations: [3, 4, 5] },
};

export const meta = {
  apiVersion: 1,
  key: "alibaba",
  name: "Alibaba Bailian",
  icon: "Bailian.Color",
  description: {
    en: "Alibaba Cloud Bailian Wanxiang video generation (text-to-video and image-to-video)",
    zh: "阿里云百炼万相视频生成（文生视频、图生视频）",
  },
  version: "1.2.0",
  author: { name: "QuantumNous" },
  channelTypes: [17],
  // Literal metadata also supports the dashboard's static script preview.
  models: [
    "wan3.0-video",
    "wan3.0-video-prime",
    "wan2.7-t2v",
    "wan2.7-t2v-2026-04-25",
    "wan2.7-t2v-2026-06-12",
    "wan2.7-i2v",
    "wan2.7-i2v-2026-04-25",
    "wan2.6-t2v",
    "wan2.6-t2v-us",
    "wan2.6-i2v",
    "wan2.6-i2v-flash",
    "wan2.6-i2v-us",
    "wan2.5-t2v-preview",
    "wan2.5-i2v-preview",
    "wan2.2-t2v-plus",
    "wan2.2-i2v-flash",
    "wan2.2-i2v-plus",
    "wan2.2-kf2v-flash",
    "wan2.2-s2v",
    "wanx2.1-t2v-plus",
    "wanx2.1-t2v-turbo",
    "wanx2.1-i2v-plus",
    "wanx2.1-i2v-turbo",
  ],
  fetchMode: "per_task",
  usageSchema: {
    // Billable seconds: output duration, or input + output for Wan3.
    seconds: {
      type: "number",
      unit: "second",
      description: { en: "Video generation unit price", zh: "视频生成单价" },
    },
    // Requested output video resolution.
    resolution: {
      enum: ["480P", "720P", "1080P"],
      enumLabels: { "480P": { en: "480P", zh: "480P" }, "720P": { en: "720P", zh: "720P" }, "1080P": { en: "1080P", zh: "1080P" } },
      description: { en: "Output video resolution", zh: "输出视频分辨率" },
    },
  },
  routes: [
    { method: "POST", path: "/ali/api/v1/services/aigc/video-generation/video-synthesis", type: "submit", decode: "createVideoTask", render: "taskCreated" },
    { method: "POST", path: "/ali/api/v1/services/aigc/image2video/video-synthesis", type: "submit", decode: "createVideoTask", render: "taskCreated" },
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

const LEGACY_SIZES = {
  "480P": { "16:9": "832*480", "9:16": "480*832", "1:1": "624*624" },
  "720P": { "16:9": "1280*720", "9:16": "720*1280", "1:1": "960*960", "4:3": "1088*832", "3:4": "832*1088" },
  "1080P": { "16:9": "1920*1080", "9:16": "1080*1920", "1:1": "1440*1440", "4:3": "1632*1248", "3:4": "1248*1632" },
};

// Wan2.7 changed the pixel sizes for 4:3 and 3:4. Legacy sizes remain valid
// compatibility inputs, but never replace the target model's native sizes.
const MODERN_SIZES = {
  "720P": { "16:9": "1280*720", "9:16": "720*1280", "1:1": "960*960", "4:3": "1104*832", "3:4": "832*1104" },
  "1080P": { "16:9": "1920*1080", "9:16": "1080*1920", "1:1": "1440*1440", "4:3": "1648*1248", "3:4": "1248*1648" },
};

function modelKey(model) {
  return String(model || "").replace(/-\d{4}-\d{2}-\d{2}$/, "").replace(/^wan2\.1-/, "wanx2.1-");
}

function modelProfile(model) {
  const key = modelKey(model);
  if (!Object.prototype.hasOwnProperty.call(WAN_MODELS, key)) throw new Error("unsupported Wan model: " + model);
  return WAN_MODELS[key];
}

function objectValue(value, name) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(name + " must be an object");
  return value;
}

// The host rejects negative canonical duration/seconds facts before any hook
// runs, so wan3.0's "-1 = smart duration" sentinel travels as a boolean marker.
function normalizeRequest(value) {
  const req = Object.assign({}, value);
  const metadata = objectValue(req.metadata, "metadata");
  const parameters = Object.assign({}, objectValue(metadata.parameters, "metadata.parameters"));
  if (req.metadata !== undefined) {
    req.metadata = Object.assign({}, metadata, { parameters: parameters });
    objectValue(metadata.input, "metadata.input");
  }
  const duration = parameters.duration ?? req.duration ?? req.seconds ?? (req.auto_duration === true ? -1 : undefined);
  for (const key of ["duration", "seconds"]) {
    if (Number(req[key]) === -1) delete req[key];
  }
  if (Number(parameters.duration) === -1) delete parameters.duration;
  if (Number(duration) === -1) {
    req.auto_duration = true;
    delete req.duration;
    delete req.seconds;
  } else delete req.auto_duration;
  // These fields are checked against usageSchema before the converter runs.
  if (req.resolution != null) req.resolution = normalizeResolution(req.resolution);
  if (parameters.resolution != null) parameters.resolution = normalizeResolution(parameters.resolution);
  return req;
}

function normalizeResolution(value) {
  let resolution = trimmed(value).toUpperCase();
  if (!resolution) return "";
  if (!resolution.endsWith("P")) resolution += "P";
  return resolution;
}

function videoSize(value) {
  const size = trimmed(value).replace(/x/i, "*");
  if (!size.includes("*")) return { resolution: normalizeResolution(size) };
  for (const sizes of [LEGACY_SIZES, MODERN_SIZES]) {
    for (const resolution of Object.keys(sizes)) {
      for (const ratio of Object.keys(sizes[resolution])) {
        if (sizes[resolution][ratio] === size) return { resolution: resolution, ratio: ratio };
      }
    }
  }
  throw new Error("invalid size: " + size);
}

function videoAction(req) {
  const input = objectValue((req.metadata || {}).input, "metadata.input");
  for (const source of [req, input]) {
    if (firstImage(source) || trimmed(source.img_url) || trimmed(source.image_url) || trimmed(source.first_frame_url) || (Array.isArray(source.media) && source.media.length))
      return "image_to_video";
  }
  return "text_to_video";
}

function convert(ctx) {
  const req = ctx.requestBody;
  const upstreamModel = ctx.upstreamModel || req.model;
  const profile = modelProfile(upstreamModel);
  const metadata = objectValue(req.metadata, "metadata");
  if (metadata.model !== undefined && metadata.model !== upstreamModel) throw new Error("can't change model with metadata");
  const input = {};
  for (const key of ["prompt", "negative_prompt", "img_url", "image_url", "first_frame_url", "last_frame_url", "audio_url", "template", "media"]) {
    if (req[key] !== undefined) input[key] = req[key];
  }
  const image = firstImage(req);
  if (image && input.img_url === undefined) input.img_url = image;
  Object.assign(input, objectValue(metadata.input, "metadata.input"));
  const nativeParameters = objectValue(metadata.parameters, "metadata.parameters");
  const parameters = profile.kind === "speech" ? {} : { prompt_extend: true };
  for (const key of ["resolution", "ratio", "prompt_extend", "watermark", "audio", "seed", "shot_type"]) {
    if (req[key] !== undefined) parameters[key] = req[key];
  }
  Object.assign(parameters, nativeParameters);
  for (const key of ["prompt_extend", "watermark", "audio"]) {
    if (parameters[key] != null && typeof parameters[key] !== "boolean") throw new Error(key + " must be a boolean");
  }
  if (parameters.seed != null && (!Number.isInteger(parameters.seed) || parameters.seed < (profile.kind === "all" ? -1 : 0) || parameters.seed > 2147483647))
    throw new Error("seed must be an integer between " + (profile.kind === "all" ? -1 : 0) + " and 2147483647");

  const sizeValue = nativeParameters.size ?? req.size;
  const size = sizeValue == null || sizeValue === "" ? {} : videoSize(sizeValue);
  let resolution = normalizeResolution(parameters.resolution ?? size.resolution ?? profile.defaultResolution);
  let ratio = parameters.ratio ?? size.ratio ?? (profile.kind === "all" ? "adaptive" : "16:9");
  // In the legacy T2V protocol the explicit native size is authoritative.
  if (profile.kind === "size" && nativeParameters.size != null && nativeParameters.size !== "") {
    resolution = size.resolution;
    ratio = size.ratio ?? parameters.ratio ?? "16:9";
  }
  if (!profile.resolutions.includes(resolution)) throw new Error(upstreamModel + " resolution must be one of " + profile.resolutions.join(", "));
  if (profile.kind === "size" || profile.kind === "t2v" || profile.kind === "all") {
    const ratios = ["16:9", "9:16", "1:1", "4:3", "3:4"];
    if (profile.kind === "all") ratios.push("adaptive");
    if (!ratios.includes(ratio)) throw new Error(upstreamModel + " ratio must be one of " + ratios.join(", "));
  }
  if (profile.kind === "size") {
    const pixelSize = LEGACY_SIZES[resolution][ratio];
    if (!pixelSize) throw new Error("unsupported ratio for " + resolution + ": " + ratio);
    parameters.size = pixelSize;
    delete parameters.resolution;
    delete parameters.ratio;
  } else {
    parameters.resolution = resolution;
    delete parameters.size;
    if (profile.kind === "t2v" || profile.kind === "all") parameters.ratio = ratio;
    else delete parameters.ratio; // Image-derived aspect ratios are not configurable.
  }

  const rawDuration = nativeParameters.duration ?? (req.auto_duration === true ? -1 : (req.duration ?? req.seconds));
  if (rawDuration != null && ((typeof rawDuration !== "number" && typeof rawDuration !== "string") || String(rawDuration).trim() === ""))
    throw new Error("duration must be a number");
  const duration = rawDuration == null ? 5 : Number(rawDuration);
  if (duration === -1 && profile.kind !== "all") throw new Error("duration -1 (smart duration) is only supported by wan3.0 models");
  if (profile.kind === "speech") {
    if (rawDuration != null && (!Number.isFinite(duration) || duration <= 0 || duration >= 20)) throw new Error("wan2.2-s2v duration must be positive and less than 20 seconds; output follows the audio");
    delete parameters.duration;
  } else {
    if (profile.durations) {
      if (!profile.durations.includes(duration)) throw new Error(upstreamModel + " duration must be one of " + profile.durations.join(", "));
    } else if (!(profile.kind === "all" && duration === -1) && (!Number.isInteger(duration) || duration < 2 || duration > profile.maxDuration)) {
      throw new Error(upstreamModel + " duration must be " + (profile.kind === "all" ? "-1 or " : "") + "an integer between 2 and " + profile.maxDuration);
    }
    parameters.duration = duration;
  }

  if (profile.kind === "media" || profile.kind === "all") {
    if (input.media !== undefined && !Array.isArray(input.media)) throw new Error("input.media must be an array");
    if (!input.media || input.media.length === 0) {
      input.media = [];
      const first = trimmed(input.first_frame_url) || trimmed(input.img_url) || firstImage(req);
      const last = trimmed(input.last_frame_url) || secondImage(req);
      if (first) input.media.push({ type: "first_frame", url: first });
      if (last) input.media.push({ type: "last_frame", url: last });
      if (trimmed(input.audio_url)) input.media.push({ type: profile.kind === "media" ? "driving_audio" : "reference_audio", url: input.audio_url });
    }
    const counts = {};
    const limits =
      profile.kind === "media"
        ? { first_frame: 1, last_frame: 1, driving_audio: 1, first_clip: 1 }
        : { first_frame: 1, last_frame: 1, reference_image: 10, reference_video: 5, reference_audio: 5, file: 1, link: 1 };
    for (const media of input.media) {
      if (!media || !Object.prototype.hasOwnProperty.call(limits, media.type) || !trimmed(media.url)) throw new Error("invalid input.media type or url");
      counts[media.type] = (counts[media.type] || 0) + 1;
      if (counts[media.type] > limits[media.type]) throw new Error("too many input.media entries for " + media.type);
    }
    if (profile.kind === "media") {
      if ((!counts.first_frame && !counts.first_clip) || (counts.first_clip && (counts.first_frame || counts.driving_audio)))
        throw new Error("wan2.7-i2v requires first_frame or first_clip with a supported media combination");
    } else {
      const frames = counts.first_frame || counts.last_frame;
      const references = counts.reference_image || counts.reference_video || counts.reference_audio || counts.file || counts.link;
      if ((frames && references) || (counts.file && counts.link) || (counts.last_frame && !counts.first_frame)) throw new Error("unsupported wan3.0 input.media combination");
      if (!trimmed(input.prompt) && !input.media.length) throw new Error("wan3.0-video requires prompt or input.media");
    }
    if (!input.media.length) delete input.media;
    delete input.img_url;
    delete input.first_frame_url;
    delete input.last_frame_url;
    delete input.audio_url;
  } else if (profile.kind === "frames") {
    input.first_frame_url = trimmed(input.first_frame_url) || trimmed(input.img_url);
    if (!input.first_frame_url) throw new Error(upstreamModel + " requires first_frame_url or image");
    if (!input.last_frame_url && secondImage(req)) input.last_frame_url = secondImage(req);
    delete input.img_url;
  } else if (profile.kind === "speech") {
    input.image_url = trimmed(input.image_url) || trimmed(input.img_url);
    if (!input.image_url || !trimmed(input.audio_url)) throw new Error("wan2.2-s2v requires image_url and audio_url");
    delete input.img_url;
    if (!trimmed(input.prompt)) delete input.prompt;
  } else if (profile.kind === "image") {
    if (!trimmed(input.img_url)) throw new Error(upstreamModel + " requires img_url or image");
  } else if (!trimmed(input.prompt)) {
    throw new Error("input is required");
  }
  return { model: upstreamModel, input: input, parameters: parameters };
}

function resolutionRatio(body) {
  const resolution = body.parameters.size ? videoSize(body.parameters.size).resolution : body.parameters.resolution;
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
  const model = modelKey(body.model);
  return ratios[model] ? { key: "resolution-" + resolution, value: ratios[model][resolution] } : null;
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
  const kind = modelProfile(body.model).kind;
  const service = kind === "frames" || kind === "speech" ? "image2video" : "video-generation";
  return {
    url: ctx.baseUrl + "/api/v1/services/aigc/" + service + "/video-synthesis",
    method: "POST",
    headers: { Authorization: "Bearer " + ctx.apiKey, "Content-Type": "application/json", "X-DashScope-Async": "enable" },
    body: body,
    action: videoAction(body.input),
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
  const kind = modelProfile(body.model).kind;
  const hasVideo = (body.input.media || []).some(function (media) {
    return media.type === "reference_video";
  });
  let seconds = body.parameters.duration;
  if (kind === "speech") seconds = 20;
  else if (kind === "all" && (hasVideo || seconds === -1)) seconds = 30;
  if (ctx.usagePurpose === "billing_ratios") {
    const ratios = { seconds: seconds };
    const resolution = resolutionRatio(body);
    if (resolution && resolution.value !== undefined) ratios[resolution.key] = resolution.value;
    return ratios;
  }
  const resolution = body.parameters.size ? videoSize(body.parameters.size).resolution : body.parameters.resolution;
  return { seconds: seconds, resolution: resolution };
}

export function extractUsageOnComplete(task, taskResult, body) {
  const output = (body && body.output) || {};
  const usage = (body && body.usage) || {};
  const facts = {};
  const model = modelKey(task && (task.upstreamModel || task.model));
  if (model === "wan3.0-video" || model === "wan3.0-video-prime" || (!model && usage.input_video_duration != null)) {
    const inputSeconds = usage.input_video_duration;
    const outputSeconds = usage.output_video_duration ?? usage.duration;
    // Partial Wan3 statistics cannot establish the total billable duration.
    // Keep the reservation when either side is missing. Invalid supplied facts
    // reach the host validator unchanged, which logs and rejects them.
    if (inputSeconds != null && outputSeconds != null) {
      if (typeof inputSeconds !== "number" || !Number.isFinite(inputSeconds) || inputSeconds < 0) facts.seconds = inputSeconds;
      else if (typeof outputSeconds !== "number" || !Number.isFinite(outputSeconds) || outputSeconds < 0) facts.seconds = outputSeconds;
      else facts.seconds = inputSeconds + outputSeconds;
    }
  } else {
    const seconds = usage.duration ?? usage.output_video_duration ?? output.duration ?? output.duration_seconds;
    if (seconds != null) facts.seconds = seconds;
  }
  const resolution = usage.SR ?? output.resolution;
  if (resolution != null) facts.resolution = normalizeResolution(resolution);
  return facts;
}

export function buildQueryRequest(ctx) {
  return { url: ctx.baseUrl + "/api/v1/tasks/" + ctx.taskId, method: "GET", headers: { Authorization: "Bearer " + ctx.apiKey } };
}

export function parseTaskResult(ctx, body) {
  const output = body.output || {};
  if (output.task_status === "PENDING") return { status: "QUEUED" };
  if (output.task_status === "RUNNING") return { status: "IN_PROGRESS" };
  if (output.task_status === "SUCCEEDED") return { status: "SUCCESS", url: videoURL(body) };
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

function videoURL(body) {
  const output = (body && body.output) || {};
  return trimmed(output.video_url) || trimmed((output.results || {}).video_url);
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" && videoURL(artifactData(task)) ? [{ key: "video", type: "video" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = videoURL(artifactData(ctx));
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

export const native = {
  createVideoTask: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json" || !ctx.body.value || typeof ctx.body.value !== "object" || Array.isArray(ctx.body.value)) throw new Error("JSON object required");
    const req = ctx.body.value,
      input = objectValue(req.input, "input"),
      parameters = objectValue(req.parameters, "parameters");
    const requestBody = {
      model: req.model,
      metadata: { input: input, parameters: parameters },
    };
    if (input.prompt !== undefined) requestBody.prompt = input.prompt;
    const image = input.img_url || input.image_url || input.first_frame_url;
    if (image !== undefined) requestBody.image = image;
    return {
      kind: "submit",
      model: req.model,
      action: videoAction(requestBody),
      requestBody: normalizeRequest(requestBody),
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
      let requestBody = { model: model, prompt: prompt };
      if (trimmed(req.image)) requestBody.image = trimmed(req.image);
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      const images = [];
      for (const image of req.images || []) if (trimmed(image) && !images.includes(trimmed(image))) images.push(trimmed(image));
      for (const image of input.images) if (!images.includes(image)) images.push(image);
      if (images.length) requestBody.images = images;
      if (trimmed(req.input_reference)) requestBody.input_reference = trimmed(req.input_reference);
      for (const key of [
        "size", "resolution", "ratio", "duration", "seconds", "auto_duration",
        "prompt_extend", "watermark", "audio", "seed", "shot_type", "negative_prompt",
        "img_url", "image_url", "first_frame_url", "last_frame_url", "audio_url", "template", "media",
      ]) {
        if (Object.prototype.hasOwnProperty.call(req, key)) requestBody[key] = req[key];
      }
      if (Object.prototype.hasOwnProperty.call(req, "metadata")) requestBody.metadata = req.metadata;
      requestBody = normalizeRequest(requestBody);
      const action = videoAction(requestBody);
      const profile = WAN_MODELS[modelKey(ctx.upstreamModel || model)];
      const nativeInput = objectValue((requestBody.metadata || {}).input, "metadata.input");
      if (!trimmed(nativeInput.prompt ?? prompt) && (action === "text_to_video" || (profile && (profile.kind === "size" || profile.kind === "t2v"))))
        throw new Error("input is required");
      return { kind: "submit", model: model, action: action, requestBody: requestBody };
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
        if (req.seed !== undefined) req.seed = Number(req.seed);
        for (const key of ["prompt_extend", "watermark", "audio", "auto_duration"]) {
          if (req[key] === undefined) continue;
          if (req[key] !== "true" && req[key] !== "false") throw new Error(key + " must be true or false");
          req[key] = req[key] === "true";
        }
      } else throw new Error("JSON or multipart body required");
      if (!req || typeof req !== "object" || Array.isArray(req)) throw new Error("request body must be an object");
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      const requestBody = normalizeRequest(Object.assign({}, req, { model: ctx.model }));
      return {
        kind: "submit",
        model: ctx.model,
        action: videoAction(requestBody),
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
