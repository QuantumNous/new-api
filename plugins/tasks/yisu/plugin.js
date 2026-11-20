export const meta = {
  apiVersion: 1,
  key: "yisu",
  name: "YiSu",
  description: {
    en: "YiSu video generation from text and reference inputs",
    zh: "一粟视频生成（文本与参考输入）",
  },
  version: "1.0.0",
  channelTypes: [64],
  author: { name: "QuantumNous" },
  models: ["YiSu-1-1-Flash", "YiSu-1-1-Pro"],
  fetchMode: "per_task",
  // Prefills the Base URL of Task Plugin (61) channels bound to this plugin.
  // Ignored on legacy type-64 channels, which keep the built-in per-type default.
  baseUrl: "https://yisu-api.gigaai.cc",
  // YiSu serves the same /v1/videos host-protocol paths the gateway serves,
  // so a New API upstream is addressed with the same URLs.
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    // Requested video duration in seconds. The upstream bills per task; the
    // fact only supports per-second pricing expressions if an admin opts in.
    seconds: {
      type: "number",
      unit: "second",
      description: { en: "Video generation unit price", zh: "视频生成单价" },
    },
  },
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
};

function trimmed(value) {
  return String(value || "").trim();
}

function plainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isHTTPURL(value) {
  return /^https?:\/\/\S+$/.test(trimmed(value));
}

const VIDEO_SIZES = ["16:9", "9:16", "1:1", "3:4", "4:3"];
const VIDEO_QUALITIES = ["480p", "720p", "1080p"];
const MAX_IMAGE_REFS = 9;
const MAX_VIDEO_REFS = 3;
const MAX_AUDIO_REFS = 3;
const MAX_TOTAL_REFS = 12;
const MIN_DURATION = 5;
const MAX_DURATION = 14;
const DEFAULT_DURATION = 5;

// videoRequest validates a client request against the YiSu API contract and
// returns the normalized upstream body. Defaults stay omitted so the platform
// applies them; the image / input_reference aliases merge into images; explicit
// null on a known optional field is rejected.
function videoRequest(req) {
  const request = req || {};
  const model = trimmed(request.model);
  if (!model) throw new Error("model / prompt is required and must be a non-empty string");
  const prompt = trimmed(request.prompt);
  if (!prompt) throw new Error("model / prompt is required and must be a non-empty string");

  const images = [];
  if (request.images !== undefined) {
    if (!Array.isArray(request.images)) throw new Error("images must be an array of HTTP(S) URLs");
    for (const value of request.images) {
      if (!isHTTPURL(value)) throw new Error("images must contain HTTP(S) URLs");
      images.push(trimmed(value));
    }
  }
  // Compatibility aliases: each supplied URL counts as one image.
  for (const alias of ["image", "input_reference"]) {
    if (request[alias] === undefined) continue;
    if (!isHTTPURL(request[alias])) throw new Error(alias + " must be an HTTP(S) URL");
    images.push(trimmed(request[alias]));
  }

  const body = { model: model, prompt: prompt };
  if (request.size !== undefined) {
    if (request.size === null || !VIDEO_SIZES.includes(String(request.size))) {
      throw new Error("size must be one of 16:9,9:16,1:1,3:4,4:3");
    }
    body.size = String(request.size);
  }
  if (request.duration !== undefined) {
    if (
      request.duration === null ||
      typeof request.duration !== "number" ||
      !Number.isInteger(request.duration) ||
      request.duration < MIN_DURATION ||
      request.duration > MAX_DURATION
    ) {
      throw new Error("duration must be an integer between 5 and 14 (seconds)");
    }
    body.duration = request.duration;
  }

  let videoCount = 0;
  let audioCount = 0;
  if (request.metadata !== undefined) {
    if (!plainObject(request.metadata)) throw new Error("metadata must be a JSON object");
    const metadata = Object.assign({}, request.metadata);
    if (metadata.quality !== undefined) {
      if (metadata.quality === null || !VIDEO_QUALITIES.includes(String(metadata.quality))) {
        throw new Error("metadata.quality must be 480p, 720p or 1080p");
      }
      metadata.quality = String(metadata.quality);
    }
    if (metadata.seed !== undefined) {
      if (
        metadata.seed === null ||
        typeof metadata.seed !== "number" ||
        !Number.isInteger(metadata.seed) ||
        metadata.seed < -9223372036854775808 ||
        metadata.seed > 9223372036854775807
      ) {
        throw new Error("metadata.seed must be a signed 64-bit JSON integer");
      }
    }
    if (metadata.references !== undefined) {
      if (!Array.isArray(metadata.references)) throw new Error("metadata.references must be an array of {type, url} objects");
      for (const reference of metadata.references) {
        if (!plainObject(reference)) throw new Error("metadata.references entries must be {type, url} objects");
        const type = trimmed(reference.type);
        if (type !== "image" && type !== "video" && type !== "audio") {
          throw new Error("metadata.references entries must declare type image, video or audio");
        }
        if (!isHTTPURL(reference.url)) throw new Error("metadata.references entries must declare an HTTP(S) url");
        if (type === "image") images.push(trimmed(reference.url));
        else if (type === "video") videoCount += 1;
        else audioCount += 1;
      }
    }
    body.metadata = metadata;
  }

  // The platform checks the reference totals before creating or billing a task.
  if (images.length > MAX_IMAGE_REFS) throw new Error("images: at most 9 images across all reference fields");
  if (videoCount > MAX_VIDEO_REFS) throw new Error("metadata.references: at most 3 video references");
  if (audioCount > MAX_AUDIO_REFS) throw new Error("metadata.references: at most 3 audio references");
  if (images.length + videoCount + audioCount > MAX_TOTAL_REFS) throw new Error("at most 12 reference files in total");
  if (audioCount > 0 && images.length === 0 && videoCount === 0) throw new Error("audio cannot be the only reference type");
  if (images.length) body.images = images;
  return body;
}

function hasReferences(body) {
  return Boolean((body.images && body.images.length) || (body.metadata && body.metadata.references && body.metadata.references.length));
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
  const req = ctx.requestBody || {};
  const body = videoRequest(Object.assign({}, req, { model: ctx.upstreamModel || ctx.model }));
  return {
    url: ctx.baseUrl + "/v1/videos",
    method: "POST",
    headers: { Authorization: "Bearer " + ctx.apiKey, "Content-Type": "application/json" },
    body: body,
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  const taskId = body.id || body.task_id;
  if (!taskId) throw new Error("task_id is empty");
  return { taskId, taskData: body };
}

export function extractUsage(ctx) {
  const req = ctx.requestBody || {};
  const duration = req.duration !== undefined ? req.duration : req.seconds;
  let seconds = Number(duration !== undefined ? duration : DEFAULT_DURATION);
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = DEFAULT_DURATION;
  return { seconds: Math.min(seconds, 3600) };
}

export function extractUsageOnComplete(task, taskResult, body) {
  const facts = {};
  const seconds = Number((body || {}).seconds || (body || {}).duration || 0);
  if (Number.isFinite(seconds) && seconds > 0) facts.seconds = Math.min(seconds, 3600);
  return facts;
}

export function buildQueryRequest(ctx) {
  return { url: ctx.baseUrl + "/v1/videos/" + encodeURIComponent(ctx.taskId), method: "GET", headers: { Authorization: "Bearer " + ctx.apiKey } };
}

export function parseTaskResult(ctx, body) {
  const statuses = {
    queued: "QUEUED",
    running: "IN_PROGRESS",
    uploading: "IN_PROGRESS",
    succeeded: "SUCCESS",
    failed: "FAILURE",
  };
  const mapped = statuses[body.status];
  const result = { status: mapped || "UNKNOWN" };
  if (!mapped) result.reason = "unrecognized status: " + String(body.status || "");
  if (body.progress > 0 && body.progress < 100) result.progress = body.progress + "%";
  if (result.status === "FAILURE") {
    if (body.error && typeof body.error === "object" && body.error.message) result.reason = body.error.message;
    else if (typeof body.error === "string" && trimmed(body.error)) result.reason = trimmed(body.error);
    else result.reason = "task failed";
  }
  return result;
}

export function listArtifacts(task) {
  const url = trimmed(task && task.data && task.data.output_url);
  return task.status === "SUCCESS" && url ? [{ key: "video", type: "video", mimeType: "video/mp4" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = trimmed(ctx.data && ctx.data.output_url);
  if (!url) throw new Error("artifact_not_found");
  // The platform publishes finished videos on its CDN; the gateway proxies
  // the file without forwarding channel credentials.
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
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
      if (req.images !== undefined && req.images !== null && !Array.isArray(req.images)) throw new Error("images must be an array");
      const input = responsesInput(req);
      const prompt = input.prompt || trimmed(req.prompt);
      if (!prompt) throw new Error("input is required");
      const images = [];
      for (const image of [req.image, req.input_reference].concat(req.images || [], input.images)) {
        if (trimmed(image) && !images.includes(trimmed(image))) images.push(trimmed(image));
      }
      const merged = Object.assign({}, req, { prompt: prompt });
      if (images.length) merged.images = images;
      if (merged.duration === undefined && merged.seconds !== undefined) merged.duration = merged.seconds;
      const requestBody = videoRequest(merged);
      return { kind: "submit", model: model, action: hasReferences(requestBody) ? "image_to_video" : "text_to_video", requestBody: requestBody };
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
        metadata: { vendor: "yisu" },
      };
    },
  },
};

const legacyRenderers = {
  openai_video: function (task) {
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
    if (task.status === "FAILURE") {
      output.error = { code: "video_generation_failed", message: "The video generation task failed." };
    }
    return output;
  },
};

protocols.openai_video = {
  decodeRequest: function (ctx) {
    if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
    if (ctx.body.kind === "json") {
      const value = ctx.body.value;
      if (!value || Array.isArray(value)) throw new Error("JSON object required");
      const req = Object.assign({}, value);
      if (req.duration === undefined && req.seconds !== undefined) req.duration = req.seconds;
      const requestBody = videoRequest(req);
      return { kind: "submit", model: ctx.model, action: hasReferences(requestBody) ? "image_to_video" : "text_to_video", requestBody: requestBody };
    }
    const fields = ctx.body.fields || {};
    const first = function (name) {
      const values = fields[name] || [];
      if (values.length > 1) throw new Error(name + " must be provided once");
      return values[0];
    };
    if ((ctx.body.files || []).length) throw new Error("file uploads are not supported; pass HTTP(S) URLs instead");
    const req = {};
    for (const name of Object.keys(fields)) {
      if (name === "images") continue;
      req[name] = first(name);
    }
    const imageValues = fields["images"] || [];
    if (imageValues.length) req.images = imageValues.slice();
    if (req.metadata !== undefined) {
      let parsed;
      try {
        parsed = JSON.parse(req.metadata);
      } catch (e) {
        throw new Error("metadata must be a JSON object");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("metadata must be a JSON object");
      req.metadata = parsed;
    }
    if (req.duration !== undefined) req.duration = Number(req.duration);
    else if (req.seconds !== undefined) req.duration = Number(req.seconds);
    const requestBody = videoRequest(req);
    return { kind: "submit", model: ctx.model, action: hasReferences(requestBody) ? "image_to_video" : "text_to_video", requestBody: requestBody };
  },
  render: function (ctx, task) {
    if (task.data && typeof task.data === "object" && !Array.isArray(task.data)) {
      const data = Object.assign({}, task.data);
      // Clients that read a video link field (video_url / url) instead of the
      // vendor's output_url get the finished file's CDN address.
      const url = trimmed(task.data.output_url);
      if (url) {
        data.video_url = url;
        data.url = url;
      }
      return data;
    }
    return legacyRenderers.openai_video(task);
  },
};
