export const meta = {
  apiVersion: 1,
  key: "google",
  name: "Google Veo (Gemini API)",
  icon: "Gemini.Color",
  version: "1.0.0",
  author: { name: "QuantumNous" },
  channelTypes: [24],
  models: ["veo-3.0-generate-001", "veo-3.0-fast-generate-001", "veo-3.1-generate-preview", "veo-3.1-fast-generate-preview"],
  fetchMode: "per_task",
  usageSchema: {
    seconds: { type: "number", unit: "second", description: "Requested video duration in seconds." },
  },
  protocols: ["openai_responses", "openai_video"],
};

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

function sizeParts(size) {
  const parts = String(size || "")
    .toLowerCase()
    .split("x");
  if (parts.length !== 2) return null;
  return [Number(parts[0]), Number(parts[1])];
}

function resolutionForSize(size) {
  const parts = sizeParts(size);
  if (!parts) return "720p";
  const max = Math.max(parts[0], parts[1]);
  if (max >= 3840) return "4k";
  if (max >= 1920) return "1080p";
  return "720p";
}

function aspectForSize(size) {
  const parts = sizeParts(size);
  if (!parts || parts[0] <= 0 || parts[1] <= 0) return "16:9";
  return parts[1] > parts[0] ? "9:16" : "16:9";
}

function imageInput(value) {
  value = String(value || "").trim();
  if (!value) return null;
  if (value.startsWith("data:")) {
    const comma = value.indexOf(",");
    if (comma < 0 || !value.slice(comma + 1)) return null;
    const mediaType = value.slice(5, comma).split(";")[0];
    return { bytesBase64Encoded: value.slice(comma + 1), mimeType: mediaType || "application/octet-stream" };
  }
  // Raw base64 input is accepted by the Go adaptor. The common fixtures use
  // PNG data; browser-free plugins cannot invoke net/http DetectContentType.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  let mime = "application/octet-stream";
  if (value.startsWith("iVBORw0KGgo")) mime = "image/png";
  else if (value.startsWith("/9j/")) mime = "image/jpeg";
  else if (value.startsWith("R0lGOD")) mime = "image/gif";
  else if (value.startsWith("UklGR")) mime = "image/webp";
  return { bytesBase64Encoded: value, mimeType: mime };
}

function converted(ctx) {
  const req = ctx.requestBody || {};
  const metadata = Object.assign({}, req.metadata || {});
  const params = Object.assign({}, metadata);
  if (!params.durationSeconds && Number(req.duration) > 0) params.durationSeconds = Number(req.duration);
  if (!params.resolution && req.size) params.resolution = resolutionForSize(req.size);
  if (!params.aspectRatio && req.size) params.aspectRatio = aspectForSize(req.size);
  if (params.resolution) params.resolution = String(params.resolution).toLowerCase();
  params.sampleCount = 1;
  const instance = { prompt: req.prompt };
  const image = imageInput((req.images || [])[0]);
  if (image) instance.image = image;
  return { body: { instances: [instance], parameters: params }, action: image ? "image_to_video" : "text_to_video" };
}

function version(ctx) {
  const settings = ctx.userSetting || {};
  return settings.geminiVersion || "v1beta";
}

export function buildSubmitRequest(ctx) {
  const result = converted(ctx);
  return {
    url: ctx.baseUrl + "/" + version(ctx) + "/models/" + ctx.upstreamModel + ":predictLongRunning",
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-goog-api-key": ctx.apiKey },
    body: result.body,
    action: result.action,
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  if (!String(body.name || "").trim()) throw new Error("missing operation name");
  const result = { taskId: utils.base64URL(body.name), taskData: body };
  if (body.done && !(body.error && body.error.message)) {
    const videos = ((body.response || {}).generateVideoResponse || {}).generatedVideos || [];
    const uri = videos.length && videos[0].video ? videos[0].video.uri || "" : "";
    result.immediate = { taskId: result.taskId, status: "SUCCESS", progress: "100%", remoteUrl: uri };
  }
  return result;
}

export function extractUsage(ctx) {
  const req = ctx.requestBody || {};
  const metadata = req.metadata || {};
  let seconds = Number(metadata.durationSeconds || req.duration || req.seconds || 8);
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = 8;
  seconds = Math.min(seconds, 3600);
  if (ctx.usagePurpose === "billing_ratios") {
    const resolution = String(metadata.resolution || resolutionForSize(req.size) || "720p").toLowerCase();
    let ratio = 1;
    if (resolution === "4k" && String(ctx.upstreamModel).includes("3.1-fast-generate")) ratio = 2.333333;
    else if (resolution === "4k" && String(ctx.upstreamModel).includes("3.1")) ratio = 1.5;
    return { seconds: seconds, resolution: ratio };
  }
  return { seconds: seconds };
}

export function extractUsageOnComplete(task, taskResult, body) {
  const videos = (((body || {}).response || {}).generateVideoResponse || {}).generatedVideos || [];
  const video = videos.length ? videos[0].video || {} : {};
  const seconds = Number(video.durationSeconds || video.duration || 0);
  return Number.isFinite(seconds) && seconds > 0 ? { seconds: Math.min(seconds, 3600) } : {};
}

export function buildQueryRequest(ctx) {
  return {
    url: ctx.baseUrl + "/v1beta/" + utils.base64URLDecode(ctx.taskId),
    method: "GET",
    headers: { Accept: "application/json", "x-goog-api-key": ctx.apiKey },
  };
}

export function parseTaskResult(ctx, body) {
  if (body.error && body.error.message) return { status: "FAILURE", progress: "100%", reason: body.error.message };
  if (!body.done) return { status: "IN_PROGRESS", progress: "50%" };
  const videos = ((body.response || {}).generateVideoResponse || {}).generatedVideos || [];
  const uri = videos.length && videos[0].video ? videos[0].video.uri || "" : "";
  return { taskId: utils.base64URL(body.name || ""), status: "SUCCESS", progress: "100%", remoteUrl: uri };
}

function artifactData(ctx) {
  const data = (ctx && ctx.data) || {};
  if (data.data && typeof data.data === "object" && data.data.task_id && Object.prototype.hasOwnProperty.call(data.data, "data")) return data.data.data || {};
  return data;
}

function artifactVideoURL(ctx) {
  const videos = ((artifactData(ctx).response || {}).generateVideoResponse || {}).generatedVideos || [];
  return videos.length && videos[0].video ? String(videos[0].video.uri || "").trim() : "";
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" && artifactVideoURL(task) ? [{ key: "video", type: "video" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = artifactVideoURL(ctx);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, headers: { "x-goog-api-key": ctx.apiKey } };
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
      if (images.length && !imageInput(images[0])) throw new Error("input image must be a data URL or base64 value");
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
        metadata: { vendor: "gemini" },
      };
    },
  },
};

const legacyRenderers = {
  openai_video: function (task) {
    const model = (task.properties || {}).origin_model_name || "veo-3.0-generate-001";
    const statuses = { SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
    const output = {
      id: task.task_id,
      object: "video",
      model: model,
      status: statuses[task.status] || "unknown",
      progress: Number(String(task.progress || "0").replace("%", "")),
      created_at: task.created_at,
    };
    if (Number(task.finish_time) > 0) output.completed_at = Number(task.finish_time);
    else if (Number(task.updated_at) > 0) output.completed_at = Number(task.updated_at);
    return output;
  },
};

protocols.openai_video = {
  decodeRequest: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json" || !ctx.body.value || Array.isArray(ctx.body.value)) throw new Error("JSON object required");
    const req = ctx.body.value;
    const seconds = req.seconds === undefined ? req.duration : req.seconds;
    if (seconds !== undefined && (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0 || Number(seconds) > 3600))
      throw new Error("seconds must be between 1 and 3600");
    return {
      kind: "submit",
      model: ctx.model,
      action: req.input_reference || req.image ? "image_to_video" : "text_to_video",
      requestBody: Object.assign({}, req, { model: ctx.model }),
    };
  },
  render: function (ctx, task) {
    return legacyRenderers.openai_video(task);
  },
};
