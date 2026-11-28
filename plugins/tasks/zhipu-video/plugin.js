const MODEL = "cogvideox-flash";
const SUBMIT_PATH = "/api/paas/v4/videos/generations";
const QUERY_PATH = "/api/paas/v4/async-result/";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SIZES = ["720x480", "1024x1024", "1280x960", "960x1280", "1920x1080", "1080x1920", "2048x1080", "3840x2160"];
const OPTIONS = ["quality", "size", "fps", "with_audio", "watermark_enabled"];
const REQUEST_FIELDS = ["model", "prompt", "image_url", ...OPTIONS];
const HTTP_URL = /^https?:\/\/(?:[a-z0-9.-]+|\[[a-f0-9:.]+\])(?::[0-9]{1,5})?(?:[/?][^\s\\#]*)?$/i;
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g);base64,/i;

export const meta = {
  apiVersion: 1,
  key: "zhipu-video",
  name: "Zhipu Video",
  version: "1.0.0",
  author: { name: "lijinhai255" },
  description: { en: "Zhipu CogVideoX Flash video generation from text or images", zh: "智谱 CogVideoX Flash 文生视频与图生视频" },
  baseUrl: "https://open.bigmodel.cn",
  models: [MODEL],
  channelTypes: [26],
  fetchMode: "per_task",
  routes: [
    { method: "POST", path: SUBMIT_PATH, type: "submit", models: [MODEL], decode: "createTask", render: "taskCreated" },
    { method: "GET", path: QUERY_PATH + ":id", type: "query", taskIdParam: "id", render: "taskStatus" },
  ],
  protocols: ["openai_video"],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFlash(value) {
  return typeof value === "string" && value.toLowerCase() === MODEL;
}

function isHttpURL(value) {
  return typeof value === "string" && value.length <= 65536 && HTTP_URL.test(value);
}

function imageInput(value) {
  if (isHttpURL(value)) return value;
  if (typeof value === "string" && value.length <= 4 * Math.ceil(MAX_IMAGE_BYTES / 3) + 32) {
    const mime = value.match(IMAGE_DATA_URL);
    const encoded = mime ? value.slice(mime[0].length) : value;
    const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
    const imageType = encoded.startsWith("iVBORw0KGgo") ? "png" : encoded.startsWith("/9j/") ? "jpeg" : "";
    if (
      imageType &&
      (!mime || (mime[1].toLowerCase() === "png") === (imageType === "png")) &&
      encoded.length % 4 === 0 &&
      (encoded.length / 4) * 3 - padding <= MAX_IMAGE_BYTES &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    )
      return value;
  }
  throw new Error("image_url must be one HTTP(S) image URL or a Base64 PNG or JPEG up to 5 MiB");
}

function uploadedImage(file) {
  const mime = String(file.mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (file.field !== "input_reference" || typeof file.ref !== "string") throw new Error("Only one input_reference image is supported");
  if (mime !== "image/png" && mime !== "image/jpeg") throw new Error("input_reference must be a PNG or JPEG image");
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("input_reference must be between 1 byte and 5 MiB");
  return { __fileRef: file.ref, encoding: "dataUrl", mimeType: mime, maxBytes: MAX_IMAGE_BYTES };
}

function normalizeVendorRequest(source, file) {
  if (!isObject(source)) throw new Error("JSON object required");
  for (const field of Object.keys(source)) {
    if (!REQUEST_FIELDS.includes(field)) throw new Error("Unsupported video field: " + field);
  }
  if (!isFlash(source.model)) throw new Error("Only " + MODEL + " is supported");
  const body = { model: MODEL };
  if (source.prompt !== undefined) {
    if (typeof source.prompt !== "string") throw new Error("prompt must be a string");
    if (source.prompt.length > 1024 || (source.prompt.length > 512 && [...source.prompt].length > 512))
      throw new Error("prompt must be at most 512 Unicode characters");
    if (source.prompt.trim()) body.prompt = source.prompt;
  }
  if (source.image_url !== undefined) body.image_url = file ? uploadedImage(file) : imageInput(source.image_url);
  if (!body.prompt && !body.image_url) throw new Error("Provide a prompt or image_url");
  if (source.quality !== undefined && source.quality !== "speed" && source.quality !== "quality") throw new Error("quality must be speed or quality");
  if (source.size !== undefined && !SIZES.includes(source.size)) throw new Error("Unsupported size for " + MODEL);
  if (source.fps !== undefined && source.fps !== 30 && source.fps !== 60) throw new Error("fps must be 30 or 60");
  for (const field of ["with_audio", "watermark_enabled"]) {
    if (source[field] !== undefined && typeof source[field] !== "boolean") throw new Error(field + " must be a boolean");
  }
  for (const field of OPTIONS) {
    if (source[field] !== undefined) body[field] = source[field];
  }
  return body;
}

function submitIntent(model, requestBody) {
  return { kind: "submit", model, action: requestBody.image_url ? "image_to_video" : "text_to_video", requestBody };
}

function protocolFields(body) {
  if (body?.kind === "json" && isObject(body.value)) return body.value;
  if (body?.kind !== "multipart") throw new Error("JSON object or multipart body required");
  const fields = Object.create(null);
  for (const [name, values] of Object.entries(body.fields || {})) {
    if (values.length !== 1) throw new Error(name + " must be provided once");
    fields[name] = values[0];
  }
  if (fields.metadata !== undefined) {
    try {
      fields.metadata = JSON.parse(fields.metadata);
    } catch {
      throw new Error("metadata must be a JSON object string");
    }
  }
  if (fields.fps === "30" || fields.fps === "60") fields.fps = Number(fields.fps);
  for (const field of ["with_audio", "watermark_enabled"]) {
    if (fields[field] === "true" || fields[field] === "false") fields[field] = fields[field] === "true";
  }
  return fields;
}

function isTaskID(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value !== "." && value !== ".." && !/\s/.test(value);
}

function videoResult(data) {
  return Array.isArray(data?.video_result) ? data.video_result.find((result) => isHttpURL(result?.url)) : undefined;
}

function failureReason(data) {
  const message = data?.error?.message;
  return typeof message === "string" && message.trim() ? message.trim().slice(0, 256) : "Zhipu video generation failed";
}

function taskResult(data) {
  if (data?.task_status === "FAIL") return { status: "FAILURE", progress: "100%", reason: failureReason(data) };
  if (data?.error != null) return { status: "UNKNOWN" };
  if (data?.task_status === "PROCESSING") return { status: "IN_PROGRESS" };
  const video = videoResult(data);
  if (data?.task_status === "SUCCESS" && video) return { status: "SUCCESS", progress: "100%", url: video.url };
  return { status: "UNKNOWN" };
}

function nativeTask(task) {
  const data = task.data;
  const taskStatus = task.status === "SUCCESS" ? "SUCCESS" : task.status === "FAILURE" ? "FAIL" : "PROCESSING";
  const result = { id: task.task_id, model: MODEL, task_status: taskStatus };
  if (typeof data?.request_id === "string") result.request_id = data.request_id;
  if (taskStatus === "FAIL") result.error = { code: "video_generation_failed", message: task.fail_reason || failureReason(data) };
  return result;
}

export const native = {
  createTask(ctx) {
    if (ctx.body?.kind !== "json") throw new Error("JSON body required");
    const body = normalizeVendorRequest(ctx.body.value);
    return submitIntent(body.model, body);
  },
  taskCreated(_ctx, task) {
    return nativeTask(task);
  },
  taskStatus(ctx, task) {
    const result = nativeTask(task);
    if (result.task_status !== "SUCCESS") return result;
    const video = videoResult(task.data);
    if (!video) return result;
    const artifact = { url: ctx.artifacts?.video?.url || video.url };
    if (isHttpURL(video.cover_image_url)) artifact.cover_image_url = ctx.artifacts?.cover?.url || video.cover_image_url;
    result.video_result = [artifact];
    return result;
  },
  error(_ctx, error) {
    return { error: { code: error.code, message: error.message } };
  },
};

export const protocols = {
  openai_video: {
    decodeRequest(ctx) {
      const fields = protocolFields(ctx.body);
      if (!isFlash(ctx.upstreamModel || ctx.model) || (!isFlash(fields.model) && fields.model !== ctx.model))
        throw new Error("Only " + MODEL + " is supported");
      for (const field of Object.keys(fields)) {
        if (!REQUEST_FIELDS.includes(field) && field !== "metadata" && field !== "input_reference") throw new Error("Unsupported video field: " + field);
      }
      const metadata = fields.metadata === undefined ? {} : fields.metadata;
      if (!isObject(metadata)) throw new Error("metadata must be a JSON object");
      const source = { model: MODEL, prompt: fields.prompt };
      for (const field of Object.keys(metadata)) {
        if (!OPTIONS.includes(field)) throw new Error("Unsupported video metadata field: " + field);
        if (fields[field] !== undefined && fields[field] !== metadata[field]) throw new Error("Conflicting video option: " + field);
        source[field] = metadata[field];
      }
      for (const field of OPTIONS) {
        if (fields[field] !== undefined) source[field] = fields[field];
      }
      const files = ctx.body.kind === "multipart" ? ctx.body.files || [] : [];
      const images = [fields.image_url, fields.input_reference, ...files].filter((value) => value !== undefined);
      if (images.length > 1) throw new Error("Only one input image is supported");
      source.image_url = images[0];
      return submitIntent(ctx.model, normalizeVendorRequest(source, files[0]));
    },
    render(_ctx, task) {
      if (task.status === "FAILURE") return { error: { code: "video_generation_failed", message: task.fail_reason || failureReason(task.data) } };
      return {};
    },
  },
};

export function buildSubmitRequest(ctx) {
  if (!isFlash(ctx.upstreamModel || ctx.model)) throw new Error("Only " + MODEL + " is supported");
  const source = ctx.requestBody;
  const files = ctx.files || [];
  if (files.length > 0 && (files.length !== 1 || source?.image_url?.__fileRef !== files[0].ref)) throw new Error("Only one input_reference image is supported");
  const body = normalizeVendorRequest(source, files[0]);
  return {
    method: "POST",
    url: ctx.baseUrl.replace(/\/+$/, "") + SUBMIT_PATH,
    headers: { Authorization: "Bearer " + ctx.apiKey, "Content-Type": "application/json" },
    body,
  };
}

export function parseSubmitResponse(_ctx, response) {
  const data = response.body;
  if (!isObject(data) || (data.model !== undefined && !isFlash(data.model))) throw new Error("Invalid Zhipu video submit response");
  if (data.error != null && data.task_status !== "FAIL") throw new Error(failureReason(data));
  if (!isTaskID(data.id)) throw new Error("Zhipu video submit response is missing a valid task ID");
  if (data.task_status !== "PROCESSING" && data.task_status !== "SUCCESS" && data.task_status !== "FAIL")
    throw new Error("Zhipu video submit returned an unrecognized task status");
  const result = { taskId: data.id, taskData: data };
  const parsed = taskResult(data);
  // A successful submit acknowledgment can still require a query for the video.
  if (parsed.status === "SUCCESS" || parsed.status === "FAILURE") result.immediate = parsed;
  return result;
}

export function buildQueryRequest(ctx) {
  if (!isTaskID(ctx.taskId)) throw new Error("Invalid Zhipu video task ID");
  return {
    method: "GET",
    url: ctx.baseUrl.replace(/\/+$/, "") + QUERY_PATH + encodeURIComponent(ctx.taskId),
    headers: { Authorization: "Bearer " + ctx.apiKey },
  };
}

export function parseTaskResult(ctx, data, response) {
  if (!isObject(data) || (data.id !== undefined && data.id !== ctx.taskId) || (data.model !== undefined && !isFlash(data.model))) return { status: "UNKNOWN" };
  if (response && (response.status < 200 || response.status >= 300) && data.task_status !== "FAIL") return { status: "UNKNOWN" };
  return taskResult(data);
}

export function listArtifacts(task) {
  const result = videoResult(task.data);
  if (!result) return [];
  const artifacts = [{ key: "video", type: "video", mimeType: "video/mp4" }];
  if (isHttpURL(result.cover_image_url)) artifacts.push({ key: "cover", type: "image" });
  return artifacts;
}

export function buildContentRequest(ctx) {
  const result = videoResult(ctx.data);
  const url = ctx.artifactKey === "video" ? result?.url : ctx.artifactKey === "cover" ? result?.cover_image_url : undefined;
  if (!isHttpURL(url)) throw new Error("Zhipu video artifact is not available");
  return { url, method: ctx.clientRequest?.method === "HEAD" ? "HEAD" : "GET", credentialless: true };
}
