export const meta = {
  apiVersion: 1,
  key: "vidu",
  name: "Vidu",
  icon: "Vidu.Color",
  version: "1.0.0",
  author: { name: "QuantumNous" },
  channelTypes: [52],
  models: ["viduq2", "viduq1", "vidu2.0", "vidu1.5"],
  fetchMode: "per_task",
  usageSchema: {
    seconds: { type: "number", unit: "second", description: "Requested video duration in seconds." },
    resolution: { enum: ["360p", "540p", "720p", "1080p"], description: "Requested output video resolution." },
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

function actionFor(req) {
  if (req.metadata && req.metadata.action) {
    const aliases = {
      generate: "image_to_video",
      textGenerate: "text_to_video",
      firstTailGenerate: "first_tail_to_video",
      referenceGenerate: "reference_to_video",
      remixGenerate: "remix",
    };
    return aliases[req.metadata.action] || req.metadata.action;
  }
  if (!req.images || req.images.length === 0) return "text_to_video";
  if (req.images.length === 2) return "first_tail_to_video";
  if (req.images.length > 2) return "reference_to_video";
  return "image_to_video";
}

function pathFor(action) {
  if (action === "image_to_video") return "/img2video";
  if (action === "first_tail_to_video") return "/start-end2video";
  if (action === "reference_to_video") return "/reference2video";
  return "/text2video";
}

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody;
  const action = actionFor(req);
  const metadata = req.metadata || {};
  let model = ctx.upstreamModel || "viduq1";
  if (action === "reference_to_video" && model.includes("viduq2")) model = "viduq2";
  const body = Object.assign(
    {
      model: model,
      images: req.images || null,
      prompt: req.prompt || null,
      duration: req.duration || 5,
      resolution: req.size || "1080p",
      movement_amplitude: "auto",
    },
    metadata
  );
  delete body.action;
  if (!body.prompt) delete body.prompt;
  if (!body.bgm) delete body.bgm;
  return {
    url: ctx.baseUrl + "/ent/v2" + pathFor(action),
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: "Token " + ctx.apiKey },
    body: body,
    action: action,
  };
}

export function parseSubmitResponse(ctx, resp) {
  if (!resp.body || resp.body.state === "failed") throw new Error("task failed");
  if (!resp.body.task_id) throw new Error("missing task_id");
  return { taskId: resp.body.task_id, taskData: resp.body };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  const req = ctx.requestBody || {};
  const metadata = req.metadata || {};
  let seconds = Number(req.duration || req.seconds || metadata.duration || 5);
  if (!Number.isFinite(seconds) || seconds <= 0) seconds = 5;
  let resolution = trimmed(req.size || metadata.resolution || "1080p").toLowerCase();
  if (!["360p", "540p", "720p", "1080p"].includes(resolution)) resolution = "1080p";
  return { seconds: Math.min(seconds, 3600), resolution: resolution };
}

export function buildQueryRequest(ctx) {
  return {
    url: ctx.baseUrl + "/ent/v2/tasks/" + ctx.taskId + "/creations",
    method: "GET",
    headers: { Accept: "application/json", Authorization: "Token " + ctx.apiKey },
  };
}

export function parseTaskResult(ctx, body) {
  const statuses = { created: "SUBMITTED", queueing: "SUBMITTED", processing: "IN_PROGRESS", success: "SUCCESS", failed: "FAILURE" };
  const status = statuses[body.state];
  if (!status) throw new Error("unknown task state: " + body.state);
  const url = body.creations && body.creations.length ? body.creations[0].url || "" : "";
  const result = { status: status, reason: body.state === "failed" ? body.err_code || "" : "" };
  if (url) result.url = url;
  return result;
}

function artifactData(ctx) {
  const data = (ctx && ctx.data) || {};
  if (data.data && typeof data.data === "object" && data.data.task_id && Object.prototype.hasOwnProperty.call(data.data, "data")) return data.data.data || {};
  return data;
}

function artifactVideoURL(ctx) {
  const creations = artifactData(ctx).creations;
  return Array.isArray(creations) && creations.length ? String(creations[0].url || "").trim() : "";
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" && artifactVideoURL(task) ? [{ key: "video", type: "video" }] : [];
}

export function buildContentRequest(ctx) {
  if (ctx.artifactKey !== "video") throw new Error("artifact_not_found");
  const url = artifactVideoURL(ctx);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

export function extractUsageOnComplete(task, taskResult, body) {
  const creations = body && Array.isArray(body.creations) ? body.creations : [];
  const creation = creations.length ? creations[0] || {} : {};
  const facts = {};
  const seconds = Number(creation.duration || (body || {}).duration || 0);
  if (Number.isFinite(seconds) && seconds > 0) facts.seconds = Math.min(seconds, 3600);
  const resolution = trimmed(creation.resolution || (body || {}).resolution).toLowerCase();
  if (["360p", "540p", "720p", "1080p"].includes(resolution)) facts.resolution = resolution;
  return facts;
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
      const requestBody = { model: model, prompt: prompt };
      if (images.length) requestBody.images = images;
      if (Object.prototype.hasOwnProperty.call(req, "seconds")) requestBody.duration = req.seconds;
      else if (Object.prototype.hasOwnProperty.call(req, "duration")) requestBody.duration = req.duration;
      if (Object.prototype.hasOwnProperty.call(req, "size")) requestBody.size = req.size;
      if (Object.prototype.hasOwnProperty.call(req, "metadata")) requestBody.metadata = req.metadata;
      return { kind: "submit", model: model, action: actionFor(requestBody), requestBody: requestBody };
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
        metadata: { vendor: "vidu" },
      };
    },
  },
};

const legacyRenderers = {
  openai_video: function (task) {
    const statusMap = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
    const output = {
      id: task.task_id,
      object: "video",
      model: "",
      status: statusMap[task.status] || "unknown",
      progress: Number(String(task.progress || "0").replace("%", "")),
      created_at: task.created_at,
    };
    if (task.updated_at) output.completed_at = task.updated_at;
    if (task.data && task.data.state === "failed" && task.data.err_code) output.error = { message: task.data.err_code, code: task.data.err_code };
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
