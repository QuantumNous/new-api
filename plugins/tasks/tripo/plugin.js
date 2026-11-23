export const meta = {
  apiVersion: 1,
  key: "tripo",
  name: "Tripo",
  icon: "text:Tr",
  description: {
    en: "Tripo 3D generation, model processing, and file upload",
    zh: "Tripo 三维生成、模型加工和文件上传",
  },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  website: "https://developers.tripo3d.ai",
  baseUrl: "https://openapi.tripo3d.ai/v3",
  models: ["tripo"],
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    // Estimated credits before the call, then Tripo's credits_consumed after it finishes.
    credits: {
      type: "number",
      unit: "credit",
      description: { en: "Tripo credit unit price", zh: "Tripo 积分单价" },
    },
  },
  usageExamples: [{ label: "text to 3D, standard texture", facts: { credits: 20 } }],
  routes: [
    { method: "POST", path: "/v3/generation/text-to-model", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/generation/image-to-model", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/generation/multiview-to-model", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/generation/image-to-splat", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/generation/text-to-image", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/generation/image-to-image", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/generation/image-to-multiview", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/generation/edit-multiview", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/generation/image-to-depth", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/models/texture", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/models/convert", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/models/import", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/mesh/segment", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/mesh/smartsegment", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/mesh/complete", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/mesh/decimate", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/mesh/uv", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/animations/rig-check", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/animations/rig", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "POST", path: "/v3/animations/retarget", type: "submit", decode: "createTask", render: "taskCreated", upstreamError: "passthrough" },
    { method: "GET", path: "/v3/tasks/:task_id", type: "query", render: "taskStatus" },
    { method: "POST", path: "/v3/tasks/list", type: "dynamic", decode: "listTasks", render: "taskList", missing: "collect" },
    { method: "POST", path: "/v3/files", type: "submit", decode: "uploadFile", render: "fileResult", retainResult: false, upstreamError: "passthrough" },
    { method: "POST", path: "/v3/files/presign", type: "submit", decode: "presignFile", render: "fileResult", retainResult: false, upstreamError: "passthrough" },
  ],
};

// Highest published hold is P2 8K texture: 130 credits for text, image, and
// multiview (developers.tripo3d.ai/en/models/p2). P2 does not add the H-series
// geometry, quad, smart-low-poly, or generate-parts surcharges. H-series image
// to 3D at 8K plus those addons is 105. Other prices are from
// developers.tripo3d.ai/en/pricing and the H3.1 / P1 model pages. A request
// whose route is not in those tables holds this amount, then settlement uses
// credits_consumed.
const MAX_CREDITS = 130;
const GATEWAY_TASK_ID = /^task_[0-9A-Za-z]{32}$/;

const TASK_STATUS = {
  queued: "QUEUED",
  running: "IN_PROGRESS",
  success: "SUCCESS",
  failed: "FAILURE",
  cancelled: "FAILURE",
  banned: "FAILURE",
  expired: "FAILURE",
};

const GATEWAY_STATUS = {
  NOT_START: "queued",
  SUBMITTED: "queued",
  QUEUED: "queued",
  IN_PROGRESS: "running",
  SUCCESS: "success",
  FAILURE: "failed",
};

function trimmed(value) {
  return String(value || "").trim();
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function routeOf(path) {
  const value = String(path || "");
  const marker = "/v3/";
  const index = value.lastIndexOf(marker);
  if (index >= 0) return value.slice(index + marker.length - 1);
  return value;
}

function actionOf(route) {
  const parts = String(route || "").split("/");
  return parts[parts.length - 1] || "tripo";
}

function gatewayTaskId(value) {
  return GATEWAY_TASK_ID.test(value);
}

function collectTaskIds(value, ids) {
  if (typeof value === "string") {
    if (gatewayTaskId(value) && ids.indexOf(value) < 0) ids.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTaskIds(item, ids);
    return;
  }
  const object = plainObject(value);
  if (!object) return;
  for (const key of Object.keys(object)) collectTaskIds(object[key], ids);
}

function upstreamTaskId(publicId, originTasks) {
  if (!Array.isArray(originTasks)) return "";
  for (const task of originTasks) {
    if (task && task.taskId === publicId) return trimmed(task.upstreamTaskId);
  }
  return "";
}

function rewriteTaskIds(value, originTasks) {
  if (typeof value === "string") {
    if (!gatewayTaskId(value)) return value;
    const upstream = upstreamTaskId(value, originTasks);
    if (!upstream) throw new Error("origin task is unavailable");
    return upstream;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteTaskIds(item, originTasks));
  const object = plainObject(value);
  if (!object) return value;
  const copy = {};
  for (const key of Object.keys(object)) copy[key] = rewriteTaskIds(object[key], originTasks);
  return copy;
}

function modelSeries(model) {
  const raw = trimmed(model);
  if (!raw || /^v/i.test(raw)) return "h";
  if (/^p2(?:$|[^0-9])/i.test(raw)) return "p2";
  if (/^p/i.test(raw)) return "p";
  return "unknown";
}

function textureState(body) {
  // Tripo defaults an omitted pbr to true, and pbr true forces texture on.
  if (body.pbr === true || body.pbr === undefined || body.pbr === null) return "on";
  if (body.texture === false) return "off";
  if (body.texture === true || body.texture === undefined || body.texture === null) return "on";
  return "unknown";
}

function textureQuality(body) {
  const raw = trimmed(body.texture_quality).toLowerCase();
  if (!raw || raw === "fast" || raw === "standard") return "standard";
  if (raw === "detailed" || raw === "extreme") return raw;
  return "unknown";
}

function generationAddons(body, series) {
  if (series === "p" || series === "p2") return 0;
  let extra = 0;
  if (body.geometry_quality === "detailed") extra += 20;
  else if (body.geometry_quality !== undefined && body.geometry_quality !== null && trimmed(body.geometry_quality) !== "" && trimmed(body.geometry_quality) !== "standard") extra += 20;
  if (body.quad === true) extra += 5;
  if (body.smart_low_poly === true) extra += 10;
  if (body.generate_parts === true) extra += 20;
  return extra;
}

function generationCredits(kind, body) {
  const series = modelSeries(body.model);
  const textured = textureState(body);
  const quality = textureQuality(body);
  const text = kind === "text";
  const h = text
    ? { off: 10, standard: 20, detailed: 30, extreme: 40 }
    : { off: 20, standard: 30, detailed: 40, extreme: 50 };
  const p = text
    ? { off: 30, standard: 40, detailed: 50, extreme: 50 }
    : { off: 40, standard: 50, detailed: 60, extreme: 60 };
  // P2 text, image, and multiview share one published table.
  const p2 = { off: 100, standard: 110, detailed: 120, extreme: 130 };
  let tier = "standard";
  if (textured === "off") tier = "off";
  else if (textured === "unknown" || quality === "unknown") tier = "extreme";
  else tier = quality;
  const base = series === "p2" ? p2[tier] : series === "p" ? p[tier] : series === "h" ? h[tier] : Math.max(h[tier], p[tier]);
  return base + generationAddons(body, series);
}

function imageSizeTier(size) {
  const raw = trimmed(size).toLowerCase();
  if (!raw || raw === "auto") return "2k";
  if (raw.indexOf("4k") >= 0) return "4k";
  if (raw.indexOf("2k") >= 0) return "2k";
  if (raw.indexOf("1k") >= 0) return "1k";
  const parts = raw.replace("*", "x").split("x");
  if (parts.length === 2) {
    const longer = Math.max(Number(parts[0]), Number(parts[1]));
    if (longer >= 3840) return "4k";
    if (longer >= 2048) return "2k";
    if (longer > 0) return "1k";
  }
  return "unknown";
}

function imageCredits(route, body) {
  // An omitted model is seedream_v4 for text-to-image and seedream_v5 for image-to-image.
  let model = trimmed(body.model).toLowerCase();
  if (!model && route === "/generation/text-to-image") model = "seedream_v4";
  if (!model && route === "/generation/image-to-image") model = "seedream_v5";
  const tier = imageSizeTier(body.size || body.resolution);
  const quality = trimmed(body.quality).toLowerCase();
  const knownQuality = !quality || quality === "low" || quality === "medium" || quality === "high" || quality === "xhigh" || quality === "max";
  if (!model || tier === "unknown" || !knownQuality) return 50;
  const fourK = tier === "4k";
  const baseQuality = !quality || quality === "low" || quality === "medium";
  if (model === "seedream_v5" || model === "seedream_v4" || model === "banana" || model === "chat_image_1") return baseQuality ? 5 : 50;
  if (model === "banana_pro") return baseQuality ? (fourK ? 20 : 15) : 50;
  if (model === "chat_image_1.5") return baseQuality && tier === "1k" ? 10 : 50;
  if (model === "banana2") return baseQuality ? (fourK ? 15 : 10) : 50;
  if (model.indexOf("chat_image_2") === 0) {
    if (baseQuality) return fourK ? 15 : 10;
    const table = {
      high: { "1k": 20, "2k": 25, "4k": 40 },
      xhigh: { "1k": 25, "2k": 30, "4k": 45 },
      max: { "1k": 30, "2k": 50, "4k": 50 },
    };
    return table[quality][tier];
  }
  return 50;
}

function decimateCredits(body) {
  const label = (trimmed(body.model) + " " + trimmed(body.version) + " " + trimmed(body.topology)).toLowerCase();
  if (body.quad === true || label.indexOf("quad") >= 0) return 40;
  if (label.indexOf("v2") >= 0 || label.indexOf("smart") >= 0) return 30;
  if (label.indexOf("v1") >= 0 || label.indexOf("basic") >= 0) return 10;
  if (label.indexOf("triangle") >= 0) return 35;
  return 40;
}

// Published credit for the request Tripo will receive. Unlisted options hold
// MAX_CREDITS; the completed task settles on credits_consumed.
function estimateCredits(route, body) {
  const value = plainObject(body) || {};
  switch (route) {
    case "/generation/text-to-model":
      return generationCredits("text", value);
    case "/generation/image-to-model":
    case "/generation/multiview-to-model":
      return generationCredits("image", value);
    case "/generation/image-to-splat":
      return 30;
    case "/generation/text-to-image":
    case "/generation/image-to-image":
      return imageCredits(route, value);
    case "/generation/image-to-multiview":
      return 10;
    case "/generation/edit-multiview": {
      const prompts = value.prompts;
      if (Array.isArray(prompts) && prompts.length >= 1 && prompts.length <= 4) return prompts.length * 5;
      return 20;
    }
    case "/models/texture": {
      const quality = textureQuality(value);
      if (quality === "detailed") return 20;
      if (quality === "extreme" || quality === "unknown") return 30;
      return 10;
    }
    case "/models/convert":
      return 10;
    case "/mesh/segment":
      return 40;
    case "/mesh/smartsegment":
      if (trimmed(value.seg_type).toLowerCase() === "model") return 55;
      return 85;
    case "/mesh/complete":
      if ((trimmed(value.mode) + " " + trimmed(value.method)).toLowerCase().indexOf("quick") >= 0) return 30;
      return 50;
    case "/mesh/decimate":
      return decimateCredits(value);
    case "/mesh/uv":
      return 20;
    case "/animations/rig-check":
      return 0;
    case "/animations/rig":
      return 25;
    case "/animations/retarget":
      if (Array.isArray(value.animations) && value.animations.length >= 1 && value.animations.length <= 5) return value.animations.length * 10;
      if (trimmed(value.animation)) return 10;
      return 50;
    case "/files":
    case "/files/presign":
      return 0;
    default:
      return MAX_CREDITS;
  }
}

function endpoint(ctx, route) {
  const root = String(ctx.baseUrl || "").replace(/\/+$/, "");
  if (ctx.upstream && ctx.upstream.kind === "new_api") return root + "/tripo/v3" + route;
  return root + route;
}

function authorization(ctx) {
  return "Bearer " + ctx.apiKey;
}

function tripoFailure(body) {
  const message = trimmed(body.message) || "Tripo request failed";
  const suggestion = trimmed(body.suggestion);
  return suggestion ? message + ": " + suggestion : message;
}

function tripoData(body) {
  if (!plainObject(body)) throw new Error("invalid Tripo response");
  if (Object.prototype.hasOwnProperty.call(body, "code") && body.code !== 0) throw new Error(tripoFailure(body));
  return plainObject(body.data);
}

function taskDetail(body) {
  const envelope = plainObject(body);
  if (!envelope) return null;
  if (plainObject(envelope.data) && (envelope.data.status || envelope.data.task_id)) return envelope.data;
  if (envelope.status || envelope.task_id) return envelope;
  return null;
}

function progressText(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) return "";
  return Math.round(number) + "%";
}

function submitIntent(route, body) {
  const ids = [];
  collectTaskIds(body, ids);
  const intent = { kind: "submit", model: "tripo", action: actionOf(route), requestBody: { route: route, vendorBody: body } };
  if (ids.length) intent.originTaskIds = ids;
  return intent;
}

export const native = {
  createTask: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const body = plainObject(ctx.body.value);
    if (!body) throw new Error("request body must be an object");
    return submitIntent(routeOf(ctx.path), body);
  },
  uploadFile: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "multipart") throw new Error("multipart body required");
    const files = (ctx.body.files || []).filter((file) => file && file.field === "file");
    if (files.length !== 1) throw new Error("file is required");
    const file = files[0];
    return {
      kind: "submit",
      model: "tripo",
      action: "files",
      requestBody: { route: "/files", fileRef: file.ref, filename: file.filename || "upload" },
    };
  },
  presignFile: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const body = plainObject(ctx.body.value);
    if (!body) throw new Error("request body must be an object");
    if (!trimmed(body.format)) throw new Error("format is required");
    return { kind: "submit", model: "tripo", action: "presign", requestBody: { route: "/files/presign", vendorBody: body } };
  },
  listTasks: function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const body = plainObject(ctx.body.value);
    if (!body || !Array.isArray(body.task_ids)) throw new Error("task_ids must be an array");
    if (body.task_ids.length < 1 || body.task_ids.length > 100) throw new Error("task_ids must contain 1 to 100 task ids");
    const ids = [];
    for (const id of body.task_ids) {
      const value = trimmed(id);
      if (!gatewayTaskId(value)) throw new Error("task_ids must be gateway task ids");
      if (ids.indexOf(value) < 0) ids.push(value);
    }
    return { kind: "query", taskIds: ids };
  },
  taskCreated: function (ctx, task) {
    return taskEnvelope(task);
  },
  taskStatus: function (ctx, task) {
    return taskEnvelope(task);
  },
  taskList: function (ctx, tasks) {
    const listed = {};
    for (const task of tasks || []) {
      const envelope = taskEnvelope(task);
      listed[task.task_id] = envelope.data;
    }
    const missed = Array.isArray(ctx && ctx.missedTaskIds) && ctx.missedTaskIds.length > 0 ? ctx.missedTaskIds : null;
    return { code: 0, data: { tasks: listed, missed: missed } };
  },
  fileResult: function (ctx, task) {
    const data = plainObject(task.data);
    return data || { code: 0, data: {} };
  },
  error: function (ctx, error) {
    const upstream = plainObject(error && error.upstream);
    if (upstream) {
      const status = Number(upstream.status);
      const reply = { __status: status >= 400 && status <= 599 ? status : 502 };
      reply.__body = upstream.body === undefined ? null : upstream.body;
      const retryAfter = trimmed(upstream.retryAfter);
      if (retryAfter) reply.__headers = { "Retry-After": retryAfter };
      return reply;
    }
    const status = Number(error && error.httpStatus);
    return { code: status >= 400 && status <= 599 ? status : 1, message: trimmed(error && error.message) || "request failed" };
  },
};

function taskEnvelope(task) {
  const stored = plainObject(task && task.data) || {};
  const detail = Object.assign({}, plainObject(stored.data) || {}, { task_id: task.task_id });
  if (typeof detail.status !== "string" || !detail.status) detail.status = GATEWAY_STATUS[task.status] || "queued";
  if (task.status === "FAILURE" && detail.status !== "failed" && detail.status !== "cancelled") {
    detail.status = "failed";
    if (!trimmed(detail.error_message)) detail.error_message = task.fail_reason || "task failed";
  }
  return { code: stored.code === undefined ? 0 : stored.code, data: detail };
}

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  const headers = { Accept: "application/json", Authorization: authorization(ctx) };
  if (req.fileRef) {
    return {
      url: endpoint(ctx, req.route),
      method: "POST",
      headers: headers,
      bodyType: "multipart",
      parts: [{ name: "file", fileRef: req.fileRef, filename: req.filename || "upload" }],
      action: "files",
    };
  }
  const body = rewriteTaskIds(plainObject(req.vendorBody) || {}, ctx.originTasks);
  headers["Content-Type"] = "application/json";
  return {
    url: endpoint(ctx, req.route),
    method: "POST",
    headers: headers,
    body: body,
    action: actionOf(req.route),
  };
}

export function parseSubmitResponse(ctx, resp) {
  const req = (ctx && ctx.requestBody) || {};
  const data = tripoData(resp && resp.body);
  if (req.route === "/files" || req.route === "/files/presign") {
    if (!data || !trimmed(data.file_token)) throw new Error("missing file_token");
    if (req.route === "/files/presign" && !trimmed(data.presigned_url)) throw new Error("missing presigned_url");
    const taskId = trimmed(ctx.publicTaskId);
    if (!taskId) throw new Error("missing gateway task id");
    return { taskId: taskId, taskData: resp.body, immediate: { status: "SUCCESS", progress: "100%" } };
  }
  if (!data || !trimmed(data.task_id)) throw new Error("missing task_id");
  return { taskId: trimmed(data.task_id), taskData: resp.body };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  const req = ctx.requestBody || {};
  if (req.fileRef) return { credits: 0 };
  return { credits: estimateCredits(req.route, req.vendorBody || {}) };
}

export function buildQueryRequest(ctx) {
  return {
    url: endpoint(ctx, "/tasks/" + encodeURIComponent(ctx.taskId)),
    method: "GET",
    headers: { Accept: "application/json", Authorization: authorization(ctx) },
  };
}

export function parseTaskResult(ctx, body) {
  const detail = taskDetail(body);
  if (!detail) return { status: "UNKNOWN", reason: "invalid task response" };
  const status = TASK_STATUS[String(detail.status || "").toLowerCase()];
  if (!status) return { status: "UNKNOWN", reason: "unknown task state: " + String(detail.status || "") };
  const result = { status: status, progress: progressText(detail.progress) };
  if (status === "FAILURE") result.reason = trimmed(detail.error_message) || (detail.error_code === undefined ? "" : String(detail.error_code));
  const output = plainObject(detail.output);
  const url = trimmed(output && (output.model_url || output.image_url || output.rendered_image_url || output.generated_image_url));
  if (url) result.url = url;
  return result;
}

export function extractUsageOnComplete(ctx, taskResult, body) {
  const detail = taskDetail(body);
  if (!detail) return null;
  const status = String(detail.status || "").toLowerCase();
  if (status === "failed" || status === "cancelled" || status === "banned" || status === "expired") return { credits: 0 };
  if (!Object.prototype.hasOwnProperty.call(detail, "credits_consumed") || detail.credits_consumed === undefined || detail.credits_consumed === null) return null;
  const credits = Number(detail.credits_consumed);
  if (!Number.isFinite(credits) || credits < 0) return null;
  return { credits: credits };
}
