export const meta = {
  apiVersion: 1,
  key: "sls-seedance",
  name: "SLS Seedance",
  icon: "Doubao.Color",
  description: {
    en: "Seedance video generation through the SLS Volcengine-compatible API",
    zh: "通过 SLS 火山兼容 API 接入 Seedance 视频生成",
  },
  version: "1.0.0",
  author: { name: "yowaimono" },
  models: [
    "doubao-seedance-2-0",
    "doubao-seedance-2-0-fast",
    "doubao-seedance-2-0-mini",
    "doubao-seedance-2-5",
  ],
  fetchMode: "per_task",
  usageSchema: {
    tokens: {
      type: "number",
      unit: "token",
      description: { en: "Video generation usage tokens", zh: "视频生成用量 Token" },
    },
    resolution: {
      enum: ["480p", "720p", "1080p", "4k"],
      description: { en: "Output video resolution", zh: "输出视频分辨率" },
    },
  },
  usageExamples: [
    { label: "720p · 5s", facts: { tokens: 1080000, resolution: "720p" } },
    { label: "1080p · 5s", facts: { tokens: 2430000, resolution: "1080p" } },
  ],
  routes: [],
  protocols: ["openai_video"],
};

function trimmed(value) {
  return String(value || "").trim();
}

function apiURL(baseUrl, path) {
  const root = trimmed(baseUrl).replace(/\/+$/, "");
  return root.endsWith("/v1") && path.startsWith("/v1/") ? root + path.slice(3) : root + path;
}

function taskData(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  return body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : body;
}

function normalizeStatus(status) {
  const value = trimmed(status).toUpperCase();
  if (["NOT_START", "SUBMITTED", "QUEUED", "PENDING"].includes(value)) return "QUEUED";
  if (["IN_PROGRESS", "PROCESSING", "RUNNING"].includes(value)) return "IN_PROGRESS";
  if (["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(value)) return "SUCCESS";
  if (["FAILURE", "FAILED", "EXPIRED", "CANCELLED"].includes(value)) return "FAILURE";
  return "UNKNOWN";
}

export function buildSubmitRequest(ctx) {
  const body = Object.assign({}, ctx.requestBody || {});
  body.model = ctx.upstreamModel || body.model || ctx.model;
  return {
    url: apiURL(ctx.baseUrl, "/v1/video/generations"),
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
    body: body,
    rewriteModel: body.model,
  };
}

export function parseSubmitResponse(ctx, response) {
  const body = taskData(response && response.body);
  const taskId = trimmed(body.task_id || body.id);
  if (!taskId) throw new Error("upstream task_id is empty");
  return { taskId: taskId, taskData: body };
}

export function extractUsage(ctx) {
  const request = ctx.requestBody || {};
  const frames = Number(request.frames || 0);
  let duration = Number(request.duration || request.seconds || (frames > 0 ? frames / 24 : 5));
  if (duration === -1 && request.omni_reference_task_type === "edit") duration = 15;
  if (!Number.isFinite(duration) || duration <= 0) duration = 5;
  duration = Math.min(duration, 3600);
  const resolution = trimmed(request.resolution || "720p").toLowerCase();
  const dimensions = { "480p": [854, 480], "720p": [1280, 720], "1080p": [1920, 1080], "4k": [3840, 2160] };
  const [width, height] = dimensions[resolution] || dimensions["720p"];
  return { tokens: Math.max(1, duration) * width * height * 24 / 1024, resolution: dimensions[resolution] ? resolution : "720p" };
}

export function buildQueryRequest(ctx) {
  return {
    url: apiURL(ctx.baseUrl, "/v1/video/generations") + "/" + encodeURIComponent(ctx.taskId),
    method: "GET",
    headers: { Accept: "application/json", Authorization: "Bearer " + ctx.apiKey },
  };
}

export function parseTaskResult(ctx, responseBody) {
  const body = taskData(responseBody);
  const status = normalizeStatus(body.status);
  if (status === "UNKNOWN") return { status: "UNKNOWN", reason: "unrecognized SLS task status" };
  let progress = body.progress;
  if (progress === undefined || progress === null || progress === "") progress = status === "SUCCESS" || status === "FAILURE" ? "100%" : "50%";
  else if (typeof progress === "number") progress = String(progress) + "%";
  const result = {
    status: status,
    progress: String(progress),
    url: trimmed(body.result_url),
  };
  if (body.fail_reason) result.reason = String(body.fail_reason);
  if (body.task_id) result.taskId = String(body.task_id);
  if (body.total_tokens !== undefined) {
    const tokens = Number(body.total_tokens);
    if (Number.isFinite(tokens) && tokens > 0) result.totalTokens = tokens;
  }
  return result;
}

export function extractUsageOnComplete(task, taskResult, responseBody) {
  const body = taskData(responseBody);
  const tokens = Number(body.total_tokens);
  const facts = {};
  if (Number.isFinite(tokens) && tokens > 0) facts.tokens = tokens;
  const resolution = trimmed(body.resolution).toLowerCase();
  if (["480p", "720p", "1080p", "4k"].includes(resolution)) facts.resolution = resolution;
  return facts;
}

export function listArtifacts(task) {
  if (!task || task.status !== "SUCCESS") return [];
  const body = taskData(task.data || {});
  const artifacts = [];
  if (trimmed(body.result_url)) artifacts.push({ key: "video", type: "video" });
  if (trimmed(body.last_frame_url)) artifacts.push({ key: "last_frame", type: "image", mimeType: "image/png" });
  return artifacts;
}

export function buildContentRequest(ctx) {
  const body = taskData(ctx.data || {});
  const urls = { video: body.result_url, last_frame: body.last_frame_url };
  const url = trimmed(urls[ctx.artifactKey]);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

function renderVideo(task) {
  const status = normalizeStatus(task.status);
  const body = taskData(task.data || {});
  const output = {
    id: task.task_id,
    object: "video",
    model: task.properties ? task.properties.origin_model_name || "" : "",
    status: status === "SUCCESS" ? "completed" : status === "FAILURE" ? "failed" : status === "IN_PROGRESS" ? "in_progress" : "queued",
    progress: Number(String(task.progress || "0").replace("%", "")),
    created_at: task.created_at,
    completed_at: task.updated_at,
  };
  if (status === "FAILURE") output.error = { message: task.fail_reason || body.fail_reason || "task failed" };
  if (status === "SUCCESS" && body.result_url) output.url = body.result_url;
  return output;
}

export const protocols = {
  openai_video: {
    decodeRequest: function (ctx) {
      if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
      const request = ctx.body.value;
      if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("request body must be an object");
      const model = trimmed(request.model || ctx.model);
      if (!model) throw new Error("model is required");
      const hasDuration = request.duration !== undefined || request.seconds !== undefined;
      const duration = Number(request.duration === undefined ? request.seconds : request.duration);
      const isSeedanceEdit = model.startsWith("doubao-seedance-2-5") && request.omni_reference_task_type === "edit" && duration === -1;
      if (hasDuration && (!Number.isFinite(duration) || (!isSeedanceEdit && (duration < 1 || duration > 3600)))) throw new Error("duration must be between 1 and 3600 seconds");
      if (request.frames !== undefined && (!Number.isInteger(Number(request.frames)) || Number(request.frames) < 1 || Number(request.frames) > 86400))
        throw new Error("frames must be between 1 and 86400");
      if (request.resolution !== undefined && !["480p", "720p", "1080p", "4k"].includes(trimmed(request.resolution).toLowerCase()))
        throw new Error("resolution must be 480p, 720p, 1080p, or 4k");
      return {
        kind: "submit",
        model: model,
        action: Array.isArray(request.content) && request.content.some((item) => item && item.type !== "text") ? "image_to_video" : "text_to_video",
        requestBody: Object.assign({}, request, { model: model }),
      };
    },
    render: function (ctx, task) {
      return renderVideo(task);
    },
  },
};
