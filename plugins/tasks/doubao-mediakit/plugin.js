// new-api fork: Ark generation followed by MediaKit enhancement. Secrets stay
// in channel configuration; durable state contains only task facts.
export const meta = {
  apiVersion: 1,
  key: "doubao-mediakit",
  name: "DoubaoVideoMediaKit",
  version: "1.0.0",
  requiredCapabilities: ["duration-auto@1"],
  author: { name: "QuantumNous" },
  icon: "Doubao.Color",
  fetchMode: "per_task",
  baseUrl: "https://ark.cn-beijing.volces.com",
  models: [
    "doubao-seedance-1-0-pro-250528",
    "doubao-seedance-1-0-lite-t2v",
    "doubao-seedance-1-0-lite-i2v",
    "doubao-seedance-1-5-pro-251215",
    "doubao-seedance-2-0-260128",
    "doubao-seedance-2-0-fast-260128",
    "doubao-seedance-2-5-260628",
  ],
  allowedHosts: ["amk.cn-beijing.volces.com"],
  routes: [
    { method: "POST", path: "/doubao-mediakit/api/v3/contents/generations/tasks", type: "submit", decode: "createTask", render: "taskStatus" },
    { method: "GET", path: "/doubao-mediakit/api/v3/contents/generations/tasks/:task_id", type: "query", render: "taskStatus" },
  ],
  protocols: [{ name: "openai_video" }],
};

function credentials(ctx) {
  const raw = String(ctx.apiKey || "").trim();
  let keys;
  if (raw.startsWith("{")) keys = JSON.parse(raw);
  else {
    const separator = raw.indexOf("|");
    keys = { ark_api_key: raw.slice(0, separator), mediakit_api_key: separator < 0 ? "" : raw.slice(separator + 1) };
  }
  if (!String(keys.ark_api_key || "").trim() || !String(keys.mediakit_api_key || "").trim()) throw new Error("both Ark and MediaKit API keys are required");
  return { ark_api_key: keys.ark_api_key.trim(), mediakit_api_key: keys.mediakit_api_key.trim() };
}

function resolutionPolicy(request) {
  const resolution = String((request.metadata || {}).resolution || request.resolution || "720p").toLowerCase();
  if (!["480p", "720p", "1080p"].includes(resolution)) throw new Error("resolution must be 480p, 720p, or 1080p");
  return { source: resolution === "1080p" ? "720p" : "480p", target: resolution === "480p" ? "720p" : "1080p" };
}

function duration(request) {
  const value = request.seconds ?? request.duration ?? (request.metadata || {}).duration ?? 5;
  if (typeof value !== "number" && typeof value !== "string") throw new Error("duration must be an integer");
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || (seconds !== -1 && seconds < 1) || seconds > 3600) throw new Error("duration must be -1 or an integer between 1 and 3600");
  return seconds;
}

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  const policy = resolutionPolicy(req);
  const body = Object.assign({}, req.metadata || {}, { model: ctx.upstreamModel || req.model, resolution: policy.source, duration: duration(req) });
  const content = Array.isArray(body.content) ? body.content.slice() : [];
  if (req.prompt && !content.some((item) => item.type === "text")) content.push({ type: "text", text: req.prompt });
  for (const url of req.images || []) content.push({ type: "image_url", image_url: { url: url } });
  if (!content.length) throw new Error("prompt or reference content is required");
  body.content = content;
  if (body.frames !== undefined) {
    const frames = Number(body.frames);
    if (!Number.isInteger(frames) || frames <= 0 || frames > 3600 * 24) throw new Error("frames must be between 1 and 86400");
    delete body.duration;
  }
  return {
    url: ctx.baseUrl + "/api/v3/contents/generations/tasks",
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + credentials(ctx).ark_api_key },
    body: body,
  };
}

export function parseSubmitResponse(ctx, resp) {
  if (!resp.body || !resp.body.id) throw new Error("Ark response has no task ID");
  return {
    taskId: resp.body.id,
    taskData: resp.body,
    state: { phase: "generation", arkTaskId: resp.body.id, resolution: resolutionPolicy(ctx.requestBody).target, clientToken: "new-api-" + ctx.publicTaskId },
  };
}

export function buildQueryRequest(ctx) {
  const state = ctx.state;
  if (!state || !state.arkTaskId) throw new Error("MediaKit task state is missing");
  const keys = credentials(ctx);
  const mediaRoot = String(ctx.mediaKitBaseUrl || "https://amk.cn-beijing.volces.com").replace(/\/+$/, "");
  if (state.phase === "generation")
    return {
      url: ctx.baseUrl + "/api/v3/contents/generations/tasks/" + encodeURIComponent(state.arkTaskId),
      method: "GET",
      headers: { Authorization: "Bearer " + keys.ark_api_key },
    };
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + keys.mediakit_api_key };
  if (state.phase === "enhance_submit")
    return {
      url: mediaRoot + "/api/v1/tools/enhance-video",
      method: "POST",
      headers: headers,
      body: { video_url: state.sourceUrl, scene: "aigc", tool_version: "standard", resolution: state.resolution, client_token: state.clientToken },
    };
  if (state.phase !== "enhancement" || !state.mediaTaskId) throw new Error("invalid MediaKit phase");
  return { url: mediaRoot + "/api/v1/tasks/" + encodeURIComponent(state.mediaTaskId), method: "GET", headers: headers };
}

function videoURL(value) {
  if (!value || typeof value !== "object") return "";
  for (const key of ["video_url", "output_url", "url"]) if (typeof value[key] === "string" && value[key].trim()) return value[key];
  for (const key of Object.keys(value)) {
    const found = videoURL(value[key]);
    if (found) return found;
  }
  return "";
}

function errorMessage(value) {
  if (typeof value === "string") return value;
  return (value && (value.message || value.msg || errorMessage(value.error))) || "upstream task failed";
}

export function parseTaskResult(ctx, body, response) {
  if (response && response.statusCode >= 400) throw new Error("upstream task query failed");
  const state = Object.assign({}, ctx.state);
  const status = String(body.status || "").toLowerCase();
  if (body.success === false || ["failed", "expired", "cancelled", "canceled"].includes(status))
    return { status: "FAILURE", progress: "100%", reason: errorMessage(body.error) };
  if (state.phase === "enhance_submit") {
    if (!body.task_id) throw new Error("MediaKit response has no task ID");
    state.phase = "enhancement";
    state.mediaTaskId = body.task_id;
    return { status: "IN_PROGRESS", progress: "75%", state: state };
  }
  if (state.phase === "generation" && status === "succeeded") {
    state.sourceUrl = videoURL(body.content);
    if (!state.sourceUrl) throw new Error("Ark task completed without a video URL");
    state.tokens = Number((body.usage || {}).total_tokens || (body.usage || {}).completion_tokens || 0);
    state.duration = Number(body.duration || (body.content || {}).duration || 0);
    state.phase = "enhance_submit";
    return { status: "IN_PROGRESS", progress: "65%", state: state, totalTokens: state.tokens, durationSeconds: state.duration };
  }
  if (state.phase === "enhancement" && ["completed", "succeeded", "success"].includes(status)) {
    state.resultUrl = videoURL(body.result);
    if (!state.resultUrl) return { status: "FAILURE", progress: "100%", reason: "MediaKit task completed without a video URL" };
    return { status: "SUCCESS", progress: "100%", url: state.resultUrl, totalTokens: state.tokens, durationSeconds: state.duration, state: state };
  }
  if (["queued", "pending", "running", "processing"].includes(status)) return { status: "IN_PROGRESS", progress: state.phase === "generation" ? "30%" : "85%" };
  return { status: "UNKNOWN", reason: "unrecognized upstream status" };
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" ? [{ key: "video", type: "video", mimeType: "video/mp4" }] : [];
}
export function buildContentRequest(ctx) {
  const url = (ctx.state || {}).resultUrl || videoURL((ctx.data || {}).result);
  if (!url || ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

export const native = {
  createTask: function (ctx) {
    const body = ctx.body && ctx.body.value;
    if (!body || !body.model || !Array.isArray(body.content)) throw new Error("model and content are required");
    duration({ metadata: body });
    resolutionPolicy({ metadata: body });
    return {
      kind: "submit",
      model: body.model,
      action: body.content.some((item) => item.type !== "text") ? "image_to_video" : "text_to_video",
      requestBody: {
        model: body.model,
        metadata: body,
        prompt: body.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n"),
      },
    };
  },
  taskStatus: function (ctx, task) {
    const statuses = { SUCCESS: "succeeded", FAILURE: "failed", IN_PROGRESS: "running" };
    const output = { id: task.task_id, model: ctx.model, status: statuses[task.status] || "queued", created_at: task.created_at, updated_at: task.updated_at };
    if (task.status === "SUCCESS") output.content = { video_url: videoURL((task.data || {}).result) };
    if (task.status === "FAILURE") output.error = { message: task.fail_reason };
    return output;
  },
};

export const protocols = {
  openai_video: {
    decodeRequest: function (ctx) {
      if (ctx.path === "/api/v3/contents/generations/tasks") return native.createTask(ctx);
      let req;
      if (ctx.body.kind === "json") req = Object.assign({}, ctx.body.value);
      else if (ctx.body.kind === "multipart") {
        req = {};
        for (const key of Object.keys(ctx.body.fields || {})) {
          const values = ctx.body.fields[key];
          if (values.length !== 1) throw new Error("duplicate field");
          req[key] = values[0];
        }
        if (req.metadata) req.metadata = JSON.parse(req.metadata);
        if ((ctx.body.files || []).length) throw new Error("use URLs in metadata.content for video references");
      } else throw new Error("JSON or multipart body required");
      req.model = ctx.model;
      duration(req);
      resolutionPolicy(req);
      return { kind: "submit", model: ctx.model, action: "text_to_video", requestBody: req };
    },
    render: function (ctx, task) {
      if (ctx.path === "/api/v3/contents/generations/tasks") return native.taskStatus(ctx, task);
      return {
        id: task.task_id,
        object: "video",
        model: ctx.model,
        status: { SUCCESS: "completed", FAILURE: "failed", IN_PROGRESS: "in_progress" }[task.status] || "queued",
        progress: Number(String(task.progress || "0").replace("%", "")),
        created_at: task.created_at,
        error: task.fail_reason ? { message: task.fail_reason } : undefined,
      };
    },
  },
};
