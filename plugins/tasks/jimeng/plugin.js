export const meta = {
  apiVersion: 1,
  key: "jimeng",
  name: "Jimeng",
  icon: "Jimeng.Color",
  description: {
    en: "Volcengine Jimeng video generation (text-to-video, image-to-video, and first-and-last-frame)",
    zh: "火山引擎即梦视频生成（文生视频、图生视频、首尾帧）",
  },
  version: "1.2.0",
  author: { name: "QuantumNous" },
  channelTypes: [51],
  models: ["jimeng_vgfm_t2v_l20"],
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    // Requested video duration in seconds. S2.0 Pro is fixed at 5; 3.0 req_keys allow 5 or 10.
    seconds: {
      type: "number",
      unit: "second",
      description: { en: "Video generation unit price", zh: "视频生成单价" },
    },
    // Product tier derived from the final outbound req_key.
    product: {
      enum: ["s2_pro", "v30_720p", "v30_1080p", "v30_pro"],
      enumLabels: {
        s2_pro: { en: "S2.0 Pro", zh: "S2.0 Pro" },
        v30_720p: { en: "3.0 720p", zh: "3.0 720p" },
        v30_1080p: { en: "3.0 1080p", zh: "3.0 1080p" },
        v30_pro: { en: "3.0 Pro", zh: "3.0 Pro" },
      },
      description: { en: "Product tier", zh: "产品档位" },
    },
  },
  usageExamples: [
    { label: "S2.0 Pro 5s", facts: { seconds: 5, product: "s2_pro" } },
    { label: "3.0 720P 5s", facts: { seconds: 5, product: "v30_720p" } },
    { label: "3.0 720P 10s", facts: { seconds: 10, product: "v30_720p" } },
    { label: "3.0 1080P 5s", facts: { seconds: 5, product: "v30_1080p" } },
    { label: "3.0 1080P 10s", facts: { seconds: 10, product: "v30_1080p" } },
    { label: "3.0 Pro 5s", facts: { seconds: 5, product: "v30_pro" } },
    { label: "3.0 Pro 10s", facts: { seconds: 10, product: "v30_pro" } },
  ],
  protocols: [{ name: "openai_responses", supports: ["stream", "sync", "background"] }, "openai_video"],
  // Jimeng's Bearer API, which takes the bodies of the signed
  // CVSync2AsyncSubmitTask and CVSync2AsyncGetResult actions; the gateway also
  // serves each route under /jimeng.
  routes: [
    { method: "POST", path: "/api/common/v3/submit_task_v2", type: "submit", decode: "submitTask", render: "taskSubmitted" },
    { method: "POST", path: "/api/common/v3/get_result_v2", type: "dynamic", decode: "getResult", render: "taskResult" },
  ],
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

// The host signal is authoritative on New API channels; the sk- key prefix
// stays as the heuristic for legacy type-51 channels pointed at a gateway.
function viaGateway(ctx) {
  return !!(ctx.upstream && ctx.upstream.kind === "new_api") || isRelay(ctx.apiKey);
}

// Jimeng's common error codes for the statuses the gateway answers with
// (volcengine.com/docs/6444/69728).
const ERROR_CODES = { 400: 50200, 401: 50400, 403: 50400, 404: 50402, 413: 50213, 429: 50429 };

function vendorImageCount(body) {
  return (Array.isArray(body.image_urls) ? body.image_urls.length : 0) + (Array.isArray(body.binary_data_base64) ? body.binary_data_base64.length : 0);
}

function actionForImageCount(imageCount) {
  if (imageCount > 1) return "first_tail_to_video";
  if (imageCount === 1) return "image_to_video";
  return "text_to_video";
}

function nativeBody(ctx) {
  if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
  const requestBody = ctx.body.value;
  return requestBody && typeof requestBody === "object" ? requestBody : {};
}

// Jimeng's own submit body, which the driver sends as is with the channel's
// req_key for Jimeng to check.
function submitTask(ctx) {
  const body = nativeBody(ctx);
  const reqKey = typeof body.req_key === "string" ? body.req_key.trim() : "";
  if (!reqKey) throw new Error("req_key is required");
  return {
    kind: "submit",
    model: reqKey,
    action: actionForImageCount(vendorImageCount(body)),
    requestBody: { model: reqKey, vendorBody: body },
  };
}

// Jimeng itself is called at the site root with a V4 signature; another New
// API gateway serves the Bearer API under /jimeng instead.
function endpoint(ctx, action) {
  if (viaGateway(ctx)) return ctx.baseUrl + "/jimeng/api/common/v3/" + (action === "CVSync2AsyncGetResult" ? "get_result_v2" : "submit_task_v2");
  return ctx.baseUrl + "/?Action=" + action + "&Version=2022-08-31";
}

function requestHeaders(ctx, method, url, bodyText) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (viaGateway(ctx)) {
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

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
const ASPECT_RATIO_VALUES = [
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
  ["1:1", 1],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["21:9", 21 / 9],
];

function isV3ReqKey(reqKey) {
  return String(reqKey || "").includes("v30");
}

function convertedReqKey(reqKey, imageCount) {
  if (reqKey === "jimeng_vgfm_t2v_l20" && imageCount > 0) return "jimeng_vgfm_i2v_l20";
  if (!reqKey.includes("jimeng_v30")) return reqKey;
  if (reqKey === "jimeng_v30_pro") return "jimeng_ti2v_v30_pro";
  if (imageCount > 1) return reqKey.replace("jimeng_v30", "jimeng_i2v_first_tail_v30").replace(/p$/, "");
  if (imageCount === 1) return reqKey.replace("jimeng_v30", "jimeng_i2v_first_v30").replace(/p$/, "");
  return reqKey.replace("jimeng_v30", "jimeng_t2v_v30");
}

function productForReqKey(reqKey) {
  const key = String(reqKey || "");
  if (key.includes("vgfm") && key.endsWith("_l20")) return "s2_pro";
  if (key === "jimeng_ti2v_v30_pro" || key.includes("v30_pro")) return "v30_pro";
  if (key.includes("1080")) return "v30_1080p";
  if (key.includes("v30")) return "v30_720p";
  throw new Error("unsupported req_key " + key);
}

function submitImageCount(req) {
  const metadata = (req && req.metadata) || {};
  const binaryCount = Array.isArray(metadata.binary_data_base64) ? metadata.binary_data_base64.length : 0;
  const urlCount = Array.isArray(metadata.image_urls) ? metadata.image_urls.length : 0;
  if (binaryCount + urlCount > 0) return binaryCount + urlCount;
  return Array.isArray(req && req.images) ? req.images.length : 0;
}

// The req_key Jimeng receives: a native body's own, through the channel's
// model mapping, or the one the host protocols derive from the model and the
// images.
function submitReqKey(ctx) {
  const req = (ctx && ctx.requestBody) || {};
  if (req.vendorBody) return trimmed((ctx && ctx.upstreamModel) || req.model);
  const metadata = req.metadata || {};
  const base = metadata.req_key || (ctx && ctx.upstreamModel) || req.model || "";
  const resolved = convertedReqKey(String(base), submitImageCount(req));
  if (!resolved) throw new Error("req_key is required");
  return resolved;
}

// 3.0 req_keys render 121 frames (5 s) or 241 (10 s); S2.0 Pro is fixed at 5 s.
function outboundSeconds(req, reqKey) {
  if (!isV3ReqKey(reqKey)) return 5;
  const source = (req && (req.vendorBody || req.metadata)) || {};
  if (source.frames !== undefined && source.frames !== null) {
    if (Number(source.frames) === 241) return 10;
    if (Number(source.frames) === 121) return 5;
    throw new Error("frames must be 121 or 241");
  }
  const seconds = Number(req && req.duration);
  return seconds === 10 ? 10 : 5;
}

function aspectRatioFromSize(size) {
  const raw = String(size || "").trim();
  if (ASPECT_RATIOS.indexOf(raw) >= 0) return raw;
  const parts = raw.toLowerCase().split("x");
  if (parts.length !== 2) return "";
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (!(width > 0) || !(height > 0)) return "";
  const value = width / height;
  let best = "";
  let bestDiff = Infinity;
  for (let i = 0; i < ASPECT_RATIO_VALUES.length; i++) {
    const diff = Math.abs(value - ASPECT_RATIO_VALUES[i][1]);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ASPECT_RATIO_VALUES[i][0];
    }
  }
  return best;
}

function outboundAspectRatio(req) {
  const metadata = (req && req.metadata) || {};
  if (ASPECT_RATIOS.indexOf(metadata.aspect_ratio) >= 0) return metadata.aspect_ratio;
  if (ASPECT_RATIOS.indexOf(req && req.aspect_ratio) >= 0) return req.aspect_ratio;
  if (req && req.size) return aspectRatioFromSize(req.size);
  return "";
}

function filePlaceholder(image) {
  if (!image || typeof image !== "object" || Array.isArray(image) || !image.__fileRef) return image;
  const placeholder = { __fileRef: image.__fileRef, encoding: image.encoding };
  if (image.mimeType) placeholder.mimeType = image.mimeType;
  if (image.maxBytes !== undefined && image.maxBytes !== null) placeholder.maxBytes = image.maxBytes;
  return placeholder;
}

function queryReqKey(ctx) {
  const state = (ctx && ctx.state) || {};
  if (typeof state.req_key === "string" && state.req_key.trim()) return state.req_key.trim();
  if (ctx && ctx.action === "image_to_video") return "jimeng_vgfm_i2v_l20";
  if (ctx && ctx.action === "first_tail_to_video") return "jimeng_i2v_first_tail_v30";
  return "jimeng_vgfm_t2v_l20";
}

function validateSecondsForReqKey(reqKey, seconds) {
  const n = Number(seconds);
  if (isV3ReqKey(reqKey)) {
    if (n !== 5 && n !== 10) throw new Error("seconds must be 5 or 10");
    return n;
  }
  if (n !== 5) throw new Error("seconds must be 5");
  return n;
}

function decodeImageCount(req, hasInputReferenceFile) {
  if (hasInputReferenceFile) return Math.max(1, Array.isArray(req.images) ? req.images.length : 0);
  if (Array.isArray(req.images) && req.images.length) return req.images.length;
  if (trimmed(req.input_reference) || trimmed(req.image)) return 1;
  return submitImageCount(req);
}

// The body is signed, so it is sent as the text the signature covers.
// Jimeng reports no usage, so the request is the bill: a req_key the plugin
// cannot price is refused before it is sent.
export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  const url = endpoint(ctx, "CVSync2AsyncSubmitTask");
  if (req.vendorBody) {
    const sent = Object.assign({}, req.vendorBody, { req_key: submitReqKey(ctx) });
    productForReqKey(sent.req_key);
    outboundSeconds(req, sent.req_key);
    const vendorText = JSON.stringify(sent);
    return {
      url: url,
      method: "POST",
      headers: requestHeaders(ctx, "POST", url, vendorText),
      body: vendorText,
      action: actionForImageCount(vendorImageCount(sent)),
    };
  }
  // The host protocols map the model, images and size onto Jimeng's fields;
  // an omitted seed stays Jimeng's random default.
  const metadata = req.metadata || {};
  const images = req.images || [];
  const body = {
    req_key: ctx.upstreamModel,
    prompt: req.prompt || undefined,
  };
  const aspectRatio = outboundAspectRatio(req);
  if (aspectRatio) body.aspect_ratio = aspectRatio;
  if (images.length) {
    if (String(images[0]).startsWith("http")) body.image_urls = images;
    else body.binary_data_base64 = images.map(filePlaceholder);
  }
  ["req_key", "binary_data_base64", "image_urls", "prompt", "seed", "aspect_ratio", "frames"].forEach(function (key) {
    if (metadata[key] === undefined || metadata[key] === null) return;
    if (key === "aspect_ratio" && !String(metadata[key]).trim()) return;
    body[key] = metadata[key];
  });
  if (Array.isArray(body.binary_data_base64)) body.binary_data_base64 = body.binary_data_base64.map(filePlaceholder);
  const binaryCount = Array.isArray(body.binary_data_base64) ? body.binary_data_base64.length : 0;
  const urlCount = Array.isArray(body.image_urls) ? body.image_urls.length : 0;
  const metadataImageCount = binaryCount + urlCount;
  const imageCount = metadataImageCount > 0 ? metadataImageCount : images.length;
  const converted = convertedReqKey(body.req_key, imageCount);
  if (!converted) throw new Error("req_key is required");
  body.req_key = converted;
  productForReqKey(body.req_key);
  if (isV3ReqKey(body.req_key) && (body.frames === undefined || body.frames === null)) {
    body.frames = outboundSeconds(req, body.req_key) === 10 ? 241 : 121;
  }
  if (!isV3ReqKey(body.req_key)) delete body.frames;

  const ordered = { req_key: body.req_key };
  if (body.binary_data_base64 && body.binary_data_base64.length) ordered.binary_data_base64 = body.binary_data_base64;
  if (body.image_urls && body.image_urls.length) ordered.image_urls = body.image_urls;
  if (body.prompt) ordered.prompt = body.prompt;
  if (body.seed !== undefined) ordered.seed = body.seed;
  if (body.aspect_ratio) ordered.aspect_ratio = body.aspect_ratio;
  if (body.frames) ordered.frames = body.frames;
  const bodyText = JSON.stringify(ordered);
  return {
    url: url,
    method: "POST",
    headers: requestHeaders(ctx, "POST", url, bodyText),
    body: bodyText,
    action: actionForImageCount(imageCount),
  };
}

// The query needs the req_key, which is kept in the plugin state.
export function parseSubmitResponse(ctx, resp) {
  const body = resp.body || {};
  if (body.code !== 10000) throw new Error(body.message || "jimeng submit failed");
  if (!body.data || !body.data.task_id) throw new Error("missing task_id");
  return { taskId: body.data.task_id, taskData: body, state: { req_key: submitReqKey(ctx) } };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  const reqKey = submitReqKey(ctx);
  return { seconds: outboundSeconds(ctx.requestBody || {}, reqKey), product: productForReqKey(reqKey) };
}

export function buildQueryRequest(ctx) {
  const body = JSON.stringify({ req_key: queryReqKey(ctx), task_id: ctx.taskId });
  const url = endpoint(ctx, "CVSync2AsyncGetResult");
  return { url: url, method: "POST", headers: requestHeaders(ctx, "POST", url, body), body: body };
}

// done only ends the task; the outer code tells success from failure.
export function parseTaskResult(ctx, body) {
  const data = body.data || {};
  if (body.code !== 10000) {
    return { code: body.code || 0, status: "FAILURE", progress: "100%", reason: body.message || "" };
  }
  if (data.status === "in_queue") {
    const result = { code: 0, status: "QUEUED", progress: "10%", reason: "" };
    if (data.video_url) result.url = data.video_url;
    return result;
  }
  if (data.status === "generating") return { code: 0, status: "IN_PROGRESS", progress: "50%", reason: "" };
  if (data.status === "not_found") return { code: 0, status: "FAILURE", progress: "100%", reason: "the task was not found or has expired" };
  if (data.status === "expired") return { code: 0, status: "FAILURE", progress: "100%", reason: "the task has expired" };
  if (data.status === "done") {
    const result = { code: 0, status: "SUCCESS", progress: "100%", reason: "" };
    if (data.video_url) result.url = data.video_url;
    return result;
  }
  return { code: 0, status: "UNKNOWN", reason: "unrecognized status: " + String(data.status || "") };
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

export function extractUsageOnComplete() {
  return null;
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
    if (hasInputReferenceFile) {
      req.images = [{ __fileRef: "request_file:input_reference", encoding: "base64", maxBytes: 4928307 }];
    } else {
      const image = trimmed(req.input_reference || req.image);
      if (image && (!Array.isArray(req.images) || req.images.length === 0)) req.images = [image];
    }
    const seconds = req.seconds === undefined ? req.duration : req.seconds;
    if (seconds !== undefined) {
      req.duration = validateSecondsForReqKey(
        convertedReqKey(String(ctx.upstreamModel || ctx.model || req.model || ""), decodeImageCount(req, hasInputReferenceFile)),
        seconds
      );
    }
    // vendorBody carries a native request's own body; clients of this protocol cannot set it.
    delete req.vendorBody;
    return {
      kind: "submit",
      model: ctx.model,
      action: actionForImageCount(decodeImageCount(req, hasInputReferenceFile)),
      requestBody: Object.assign({}, req, { model: ctx.model }),
    };
  },
  render: function (ctx, task) {
    return legacyRenderers.openai_video(task);
  },
};

export const native = {
  submitTask: submitTask,
  // The gateway answers from its last poll and cannot pass req_json, the
  // watermark settings of a live query, to Jimeng.
  getResult: function (ctx) {
    const body = nativeBody(ctx);
    if (typeof body.req_key !== "string" || body.req_key.trim() === "") throw new Error("req_key is required");
    if (typeof body.task_id !== "string" || body.task_id.trim() === "") throw new Error("task_id is required");
    if (body.req_json !== undefined && body.req_json !== null) throw new Error("req_json is not supported");
    return { kind: "query", taskIds: [body.task_id] };
  },
  // Jimeng's create reply.
  taskSubmitted: function (ctx, task) {
    return task.data && typeof task.data === "object" && !Array.isArray(task.data) ? task.data : {};
  },
  // Jimeng's last query reply; the dynamic route passes the queried task in a
  // list. Before the first poll the task holds the create reply, which has no
  // status yet; a task the gateway failed while Jimeng still reported it
  // running reads as an internal error.
  taskResult: function (ctx, tasks) {
    const task = Array.isArray(tasks) ? tasks[0] : tasks;
    const stored = task.data && typeof task.data === "object" && !Array.isArray(task.data) ? task.data : {};
    const data = stored.data && typeof stored.data === "object" ? stored.data : null;
    const running = stored.code === 10000 && !(data && ["done", "not_found", "expired"].includes(data.status));
    if (task.status === "FAILURE" && running)
      return Object.assign({}, stored, { code: 50500, status: 50500, message: task.fail_reason || "Internal Error", data: null });
    if (stored.code === 10000 && !(data && data.status))
      return Object.assign({}, stored, { data: { status: task.status === "IN_PROGRESS" ? "generating" : "in_queue" } });
    return stored;
  },
  // Jimeng reports a task it does not have as not_found with a success code.
  error: function (ctx, error) {
    if (error.httpStatus === 404 && String(ctx.path || "").endsWith("/get_result_v2"))
      return { __status: 200, __body: { code: 10000, data: { status: "not_found" }, message: "Success", request_id: error.requestId || "", status: 10000 } };
    const code = ERROR_CODES[error.httpStatus] || 50500;
    return { code: code, data: null, message: error.message, request_id: error.requestId || "", status: code };
  },
};
