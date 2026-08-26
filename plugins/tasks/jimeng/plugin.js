export const meta = {
  apiVersion: 1,
  key: "jimeng",
  name: "Jimeng",
  icon: "Jimeng.Color",
  version: "1.0.0",
  author: { name: "QuantumNous" },
  channelTypes: [51],
  models: ["jimeng_vgfm_t2v_l20"],
  fetchMode: "per_task",
  usageSchema: {
    seconds: { type: "number", unit: "second", description: "Requested video duration in seconds." },
  },
  protocols: ["openai_responses", "openai_video"],
  routes: [{ method: "POST", path: "/jimeng/", type: "dynamic", decode: "decodeRequest", render: "renderTask" }],
};

function trimmed(value) {
  return String(value || "").trim();
}

function responsesInput(req) {
  const texts = [];
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
        if (["input_image", "image_url"].includes(part.type)) throw new Error("Jimeng Responses supports text input only");
      }
    }
  }
  return texts
    .filter(function (text) {
      return trimmed(text);
    })
    .join("\n");
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

function imageValues(body) {
  const images = [];
  if (Array.isArray(body.image_urls)) {
    body.image_urls.forEach(function (image) {
      images.push(image);
    });
  }
  if (Array.isArray(body.binary_data_base64)) {
    body.binary_data_base64.forEach(function (image) {
      images.push(image);
    });
  }
  if (images.length > 0) return images;
  if (Array.isArray(body.images)) {
    body.images.forEach(function (image) {
      images.push(image);
    });
  }
  if (images.length === 0 && typeof body.image === "string" && body.image.trim() !== "") {
    images.push(body.image);
  }
  return images;
}

function actionForImageCount(imageCount) {
  if (imageCount > 1) return "first_tail_to_video";
  if (imageCount === 1) return "image_to_video";
  return "text_to_video";
}

function decodeNativeRequest(ctx) {
  if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
  const requestBody = ctx.body.value;
  const query = ctx.query || {};
  const actions = query.Action || [];
  const action = actions.length ? actions[0] : "";
  if (!action) throw new Error("Action query parameter is required");

  const body = requestBody && typeof requestBody === "object" ? requestBody : {};
  if (action === "CVSync2AsyncGetResult") {
    if (typeof body.task_id !== "string" || body.task_id.trim() === "") {
      throw new Error("task_id is required for CVSync2AsyncGetResult");
    }
    return { kind: "query", taskIds: [body.task_id] };
  }
  if (action !== "CVSync2AsyncSubmitTask") {
    throw new Error("unsupported Jimeng Action");
  }

  const images = imageValues(body);
  return {
    kind: "submit",
    model: typeof body.req_key === "string" ? body.req_key : "",
    action: actionForImageCount(images.length),
    requestBody: {
      model: typeof body.req_key === "string" ? body.req_key : "",
      prompt: typeof body.prompt === "string" ? body.prompt : "",
      images: images,
      metadata: body,
    },
  };
}

function endpoint(baseUrl, apiKey, action) {
  return baseUrl + (isRelay(apiKey) ? "/jimeng/" : "/") + "?Action=" + action + "&Version=2022-08-31";
}

function requestHeaders(ctx, method, url, bodyText) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (isRelay(ctx.apiKey)) {
    headers.Authorization = "Bearer " + ctx.apiKey;
    return headers;
  }
  const parts = ctx.apiKey.split("|");
  if (parts.length !== 2) throw new Error("invalid api key format for jimeng: expected 'ak|sk'");
  const signed = utils.volcSignV4({
    Method: method,
    URL: url,
    Headers: { "Content-Type": "application/json" },
    Body: bodyText,
    AccessKey: parts[0].trim(),
    SecretKey: parts[1].trim(),
    Region: "cn-north-1",
    Service: "cv",
  });
  Object.keys(signed).forEach(function (key) {
    headers[key] = signed[key];
  });
  return headers;
}

function convertedReqKey(reqKey, imageCount) {
  if (!reqKey.includes("jimeng_v30")) return reqKey;
  if (reqKey === "jimeng_v30_pro") return "jimeng_ti2v_v30_pro";
  if (imageCount > 1) return reqKey.replace("jimeng_v30", "jimeng_i2v_first_tail_v30").replace(/p$/, "");
  if (imageCount === 1) return reqKey.replace("jimeng_v30", "jimeng_i2v_first_v30").replace(/p$/, "");
  return reqKey.replace("jimeng_v30", "jimeng_t2v_v30");
}

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody;
  const metadata = req.metadata || {};
  const images = req.images || [];
  const body = {
    req_key: ctx.upstreamModel,
    prompt: req.prompt || undefined,
    seed: 0,
    aspect_ratio: "",
    frames: req.duration === 10 ? 241 : 121,
  };
  if (images.length) {
    if (String(images[0]).startsWith("http")) body.image_urls = images;
    else body.binary_data_base64 = images;
  }
  ["req_key", "binary_data_base64", "image_urls", "prompt", "seed", "aspect_ratio", "frames"].forEach(function (key) {
    if (metadata[key] !== undefined && metadata[key] !== null) body[key] = metadata[key];
  });
  const binaryCount = Array.isArray(body.binary_data_base64) ? body.binary_data_base64.length : 0;
  const urlCount = Array.isArray(body.image_urls) ? body.image_urls.length : 0;
  const metadataImageCount = binaryCount + urlCount;
  const imageCount = metadataImageCount > 0 ? metadataImageCount : images.length;
  body.req_key = convertedReqKey(body.req_key, imageCount);

  const ordered = { req_key: body.req_key };
  if (body.binary_data_base64 && body.binary_data_base64.length) ordered.binary_data_base64 = body.binary_data_base64;
  if (body.image_urls && body.image_urls.length) ordered.image_urls = body.image_urls;
  if (body.prompt) ordered.prompt = body.prompt;
  ordered.seed = body.seed;
  ordered.aspect_ratio = body.aspect_ratio;
  if (body.frames) ordered.frames = body.frames;
  const url = endpoint(ctx.baseUrl, ctx.apiKey, "CVSync2AsyncSubmitTask");
  const bodyText = JSON.stringify(ordered);
  return {
    url: url,
    method: "POST",
    headers: requestHeaders(ctx, "POST", url, bodyText),
    body: bodyText,
    action: actionForImageCount(imageCount),
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  if (body.code !== 10000) throw new Error(body.message || "jimeng submit failed");
  if (!body.data || !body.data.task_id) throw new Error("missing task_id");
  return { taskId: body.data.task_id, taskData: body };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  const req = ctx.requestBody || {};
  const metadata = req.metadata || {};
  let seconds = Number(req.duration || req.seconds || 0);
  if ((!Number.isFinite(seconds) || seconds <= 0) && Number(metadata.frames) > 0) seconds = Number(metadata.frames) > 121 ? 10 : 5;
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = 5;
  return { seconds: Math.min(seconds, 3600) };
}

export function buildQueryRequest(ctx) {
  const body = JSON.stringify({ req_key: "jimeng_vgfm_t2v_l20", task_id: ctx.taskId });
  const url = endpoint(ctx.baseUrl, ctx.apiKey, "CVSync2AsyncGetResult");
  return { url: url, method: "POST", headers: requestHeaders(ctx, "POST", url, body), body: body };
}

export function parseTaskResult(ctx, body) {
  const data = body.data || {};
  let status = "";
  let progress = "";
  if (body.code !== 10000) {
    status = "FAILURE";
    progress = "100%";
  }
  if (data.status === "in_queue") {
    status = "QUEUED";
    progress = "10%";
  } else if (data.status === "done") {
    status = "SUCCESS";
    progress = "100%";
  }
  const result = { code: body.code === 10000 ? 0 : body.code || 0, status: status, progress: progress, reason: body.code === 10000 ? "" : body.message || "" };
  if (data.video_url) result.url = data.video_url;
  return result;
}

function artifactData(ctx) {
  const data = (ctx && ctx.data) || {};
  if (data.data && typeof data.data === "object" && data.data.task_id && Object.prototype.hasOwnProperty.call(data.data, "data")) return data.data.data || {};
  return data;
}

export function listArtifacts(task) {
  const url = (artifactData(task).data || {}).video_url;
  return task.status === "SUCCESS" && String(url || "").trim() ? [{ key: "video", type: "video" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = String((artifactData(ctx).data || {}).video_url || "").trim();
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

export function extractUsageOnComplete(task, taskResult, body) {
  const data = (body && body.data) || {};
  let seconds = Number(data.duration || data.seconds || 0);
  if ((!Number.isFinite(seconds) || seconds <= 0) && Number(data.frames) > 0) seconds = Number(data.frames) > 121 ? 10 : 5;
  return Number.isFinite(seconds) && seconds > 0 ? { seconds: Math.min(seconds, 3600) } : {};
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
      if (req.metadata !== undefined && (!req.metadata || typeof req.metadata !== "object" || Array.isArray(req.metadata)))
        throw new Error("metadata must be an object");
      const prompt = responsesInput(req) || trimmed(req.prompt);
      if (!prompt) throw new Error("input is required");
      const metadata = Object.assign({}, req.metadata || {});
      delete metadata.binary_data_base64;
      delete metadata.image_urls;
      delete metadata.images;
      delete metadata.image;
      const requestBody = { model: model, prompt: prompt, metadata: metadata };
      if (Object.prototype.hasOwnProperty.call(req, "seconds")) requestBody.duration = req.seconds;
      else if (Object.prototype.hasOwnProperty.call(req, "duration")) requestBody.duration = req.duration;
      return { kind: "submit", model: model, action: "text_to_video", requestBody: requestBody };
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
        metadata: { vendor: "jimeng" },
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
      model: "",
      status: statuses[task.status] || "unknown",
      progress: Number(String(task.progress || "0").replace("%", "")),
      created_at: task.created_at,
    };
    if (task.updated_at) output.completed_at = task.updated_at;
    if (task.data && task.data.code !== 10000) output.error = { message: task.data.message || "", code: String(task.data.code || 0) };
    return output;
  },
  jimeng_native: function (tasks) {
    const task = Array.isArray(tasks) ? tasks[0] : tasks;
    const stored = task && task.data && typeof task.data === "object" ? task.data : {};
    const response = Object.assign({}, stored);
    const data = stored.data && typeof stored.data === "object" ? stored.data : {};
    response.code = stored.code === undefined ? 10000 : stored.code;
    response.data = Object.assign({}, data, { task_id: task.task_id });
    return response;
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

export const native = {
  decodeRequest: decodeNativeRequest,
  renderTask: function (ctx, tasks) {
    return legacyRenderers.jimeng_native(tasks);
  },
  error: function (ctx, error) {
    return { code: error.httpStatus, message: error.message };
  },
};
