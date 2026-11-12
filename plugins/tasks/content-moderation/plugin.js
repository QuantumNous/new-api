// The categories of the OpenAI moderation API, in the order of its reference.
const CATEGORIES = [
  "harassment",
  "harassment/threatening",
  "hate",
  "hate/threatening",
  "illicit",
  "illicit/violent",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "sexual",
  "sexual/minors",
  "violence",
  "violence/graphic",
];

export const meta = {
  apiVersion: 1,
  key: "content-moderation",
  name: { en: "Content moderation", zh: "内容审核" },
  description: {
    en: "Checks user text with an OpenAI-compatible moderation API and rejects flagged requests",
    zh: "使用 OpenAI 兼容的审核接口检查用户文本，拒绝被标记的请求",
  },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  configSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: {
        type: "string",
        format: "url",
        title: { en: "Moderation API URL", zh: "审核接口地址" },
        description: { en: "Endpoint that accepts OpenAI moderation requests", zh: "接受 OpenAI 审核请求的接口" },
        default: "https://api.openai.com/v1/moderations",
        minLength: 1,
        maxLength: 2048,
        examples: ["https://api.openai.com/v1/moderations"],
      },
      apiKey: {
        type: "string",
        format: "password",
        title: { en: "API key", zh: "API 密钥" },
        description: { en: "Sent as a Bearer token; leave empty when the API needs none", zh: "以 Bearer 令牌发送，接口无需密钥时留空" },
        maxLength: 1024,
        examples: ["sk-..."],
      },
      model: {
        type: "string",
        title: { en: "Moderation model", zh: "审核模型" },
        description: { en: "Leave empty to use the API's default model", zh: "留空时使用接口的默认模型" },
        default: "omni-moderation-latest",
        maxLength: 128,
        examples: ["omni-moderation-latest"],
      },
      scope: {
        type: "string",
        title: { en: "Text to check", zh: "检查的文本" },
        description: { en: "User messages sent to the moderation API", zh: "发送给审核接口的用户消息" },
        enum: ["last_user", "all_user"],
        enumTitles: [
          { en: "Last user message", zh: "最后一条用户消息" },
          { en: "All user messages", zh: "全部用户消息" },
        ],
        default: "last_user",
      },
      images: {
        type: "boolean",
        title: { en: "Check images", zh: "检查图片" },
        description: { en: "Also send images in user messages to the moderation API", zh: "同时把用户消息中的图片发给审核接口" },
        default: true,
      },
      categories: {
        type: "array",
        title: { en: "Blocked categories", zh: "拦截的类别" },
        description: { en: "Leave empty to reject every flagged request", zh: "留空时拒绝所有被标记的请求" },
        default: [],
        uniqueItems: true,
        items: {
          type: "string",
          title: { en: "Category", zh: "类别" },
          enum: CATEGORIES,
          enumTitles: [
            { en: "Harassment", zh: "骚扰" },
            { en: "Threatening harassment", zh: "威胁性骚扰" },
            { en: "Hate", zh: "仇恨" },
            { en: "Threatening hate", zh: "威胁性仇恨" },
            { en: "Illicit", zh: "违法" },
            { en: "Violent illicit", zh: "暴力违法" },
            { en: "Self-harm", zh: "自我伤害" },
            { en: "Self-harm intent", zh: "自我伤害意图" },
            { en: "Self-harm instructions", zh: "自我伤害指导" },
            { en: "Sexual", zh: "色情" },
            { en: "Sexual content involving minors", zh: "涉及未成年人的色情" },
            { en: "Violence", zh: "暴力" },
            { en: "Graphic violence", zh: "血腥暴力" },
          ],
        },
      },
      replies: {
        type: "boolean",
        title: { en: "Moderate replies", zh: "审核回复" },
        description: {
          en: "Also check model replies; streamed replies arrive in bursts of about 1000 characters",
          zh: "同时审核模型回复，流式回复约每 1000 字一次送达",
        },
        default: false,
      },
    },
  },
  samples: [
    {
      name: { en: "Houseplant tips", zh: "绿植养护建议" },
      lang: "en",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Give me three tips for keeping houseplants healthy." }],
      },
      reply: "Water only when the top of the soil is dry, give them bright indirect light, and wipe the dust off their leaves.",
    },
    {
      name: { en: "Houseplant tips", zh: "绿植养护建议" },
      lang: "zh",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "给我三个养好室内绿植的建议。" }],
      },
      reply: "土表干了再浇水，放在明亮的散射光处，定期擦去叶面的灰尘。",
    },
  ],
};

// The moderation endpoint itself is never checked, so pointing the URL at
// this gateway cannot loop.
const MODERATION_PATH = "/v1/moderations";

// textOf joins the text of a message content: a string, or the parts or
// blocks that carry text, a Claude document given as text included. Images
// and files reach plugins as "[media:N]" or as references; see
// utils.attachments.
function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const texts = [];
  for (const part of content) {
    if (part && typeof part.text === "string" && (part.type === undefined || part.type === "text" || part.type === "input_text")) {
      texts.push(part.text);
    } else if (part && part.type === "document" && part.source && part.source.type === "text" && typeof part.source.data === "string") {
      texts.push(part.source.data);
    }
  }
  return texts.join("\n");
}

// userMessages returns each user message in order: its text, and the JSON
// Pointer of the message, under which its attachments are. Prompt and input
// strings of completions, embeddings and image generation count as user
// messages too, as do the prompts of task and Midjourney submissions; their
// negative prompts name what to leave out and are not checked. These have
// the pointer "": every attachment of the request is theirs. Formats without
// user text give none.
function userMessages(format, body) {
  const messages = [];
  const push = (text, path) => messages.push({ text: text, path: path });
  const strings = (value) => {
    if (typeof value === "string") push(value, "");
    else if (Array.isArray(value)) value.filter((item) => typeof item === "string").forEach((item) => push(item, ""));
  };
  switch (format) {
    case "openai":
    case "claude":
      if (Array.isArray(body.messages)) {
        body.messages.forEach((m, i) => {
          if (m && m.role === "user") push(textOf(m.content), "/messages/" + i);
        });
      } else if (format === "openai") {
        strings(body.prompt);
      }
      break;
    case "openai_responses":
      if (typeof body.input === "string") push(body.input, "/input");
      else if (Array.isArray(body.input)) {
        body.input.forEach((item, i) => {
          if (item && item.role === "user" && (item.type === undefined || item.type === "message")) push(textOf(item.content), "/input/" + i);
        });
      }
      break;
    case "gemini":
      if (Array.isArray(body.contents)) {
        body.contents.forEach((content, i) => {
          if (content && (content.role === undefined || content.role === "user")) push(textOf(content.parts), "/contents/" + i);
        });
      }
      break;
    case "embedding":
      strings(body.input);
      break;
    case "openai_image":
      strings(body.prompt);
      break;
    case "task":
    case "mj_proxy": {
      // A submission is one user message made of its prompts.
      const prompts = [];
      const add = (value) => {
        if (typeof value === "string") prompts.push(value);
        else if (Array.isArray(value)) value.filter((item) => typeof item === "string").forEach((item) => prompts.push(item));
      };
      add(body.prompt);
      add(body.lyrics);
      add(body.gpt_description_prompt);
      if (body.input && typeof body.input === "object") {
        add(body.input.prompt);
        if (Array.isArray(body.input.messages)) {
          body.input.messages.filter((m) => m && m.role === "user").forEach((m) => prompts.push(textOf(m.content)));
        }
      }
      if (Array.isArray(body.instances)) body.instances.forEach((instance) => instance && add(instance.prompt));
      if (Array.isArray(body.content)) prompts.push(textOf(body.content));
      push(prompts.filter((text) => text.trim() !== "").join("\n"), "");
      break;
    }
  }
  return messages;
}

// blockingCategories counts, per category, the checked texts that block the
// request: every flagged one when no category is listed, otherwise those with
// a listed category. Known categories come first, in the reference order; a
// flagged text without a true category counts as "flagged".
function blockingCategories(results, listed) {
  const counts = new Map();
  const add = (name) => counts.set(name, (counts.get(name) || 0) + 1);
  for (const result of results) {
    if (!result || typeof result !== "object") throw new Error("moderation API returned an invalid result");
    if (listed.length === 0 && result.flagged !== true) continue;
    const categories = result.categories && typeof result.categories === "object" ? result.categories : {};
    const names = Object.keys(categories).filter((name) => categories[name] === true && (listed.length === 0 || listed.includes(name)));
    names.forEach(add);
    if (listed.length === 0 && names.length === 0) add("flagged");
  }
  const rank = (name) => (CATEGORIES.includes(name) ? CATEGORIES.indexOf(name) : CATEGORIES.length);
  return [...counts.keys()].sort((a, b) => rank(a) - rank(b)).map((name) => ({ name, count: counts.get(name) }));
}

// moderate sends input to the moderation API and returns the categories that
// block it.
function moderate(config, input) {
  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = "Bearer " + config.apiKey;
  const response = utils.fetch({ url: config.url, method: "POST", headers, body: requestBody(config, input) });
  if (response.status < 200 || response.status > 299) {
    throw new Error("moderation API returned HTTP " + response.status);
  }
  const results = response.body && typeof response.body === "object" ? response.body.results : undefined;
  if (!Array.isArray(results)) throw new Error("moderation API returned no results");

  return blockingCategories(results, config.categories || []).slice(0, 64);
}

// requestBody writes the moderation request for input.
function requestBody(config, input) {
  const request = { input: input };
  if (config.model) request.model = config.model;
  return JSON.stringify(request);
}

// utils.fetch sends a body of at most 1 MiB and makes at most 4 requests in
// one hook call.
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_FETCHES = 4;
const encoder = new TextEncoder();

// textInputs returns the inputs of the moderation requests that check texts,
// at most maxRequests of them, or null when they need more. Texts that fit
// in one request go as they are, the only one as a string when single.
// Longer texts are cut into pieces of DOCUMENT_CHARS characters, sent in
// order, as many to a request as fit.
function textInputs(config, texts, single, maxRequests) {
  const body = requestBody(config, single ? texts[0] : texts);
  if (body.length <= MAX_BODY_BYTES && encoder.encode(body).length <= MAX_BODY_BYTES) return [single ? texts[0] : texts];
  const room = MAX_BODY_BYTES - encoder.encode(requestBody(config, [])).length;
  const inputs = [];
  let input = [];
  let used = 0;
  for (const text of texts) {
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + DOCUMENT_CHARS, text.length);
      // A character outside the BMP is two code units; keep them together.
      const last = text.charCodeAt(end - 1);
      if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
      const piece = text.slice(start, end);
      start = end;
      // The piece, its quotes and escapes, and the comma before it.
      const size = encoder.encode(JSON.stringify(piece)).length + 1;
      if (input.length > 0 && used + size > room) {
        if (inputs.length + 1 === maxRequests) return null;
        inputs.push(input);
        input = [];
        used = 0;
      }
      input.push(piece);
      used += size;
    }
  }
  inputs.push(input);
  return inputs;
}

function findingsOf(blocking) {
  return blocking.map((item) => ({ rule: item.name.slice(0, 256), category: item.name.slice(0, 256), count: item.count }));
}

// Images go one per moderation request, at most MAX_IMAGES per request and
// each at most MAX_IMAGE_BYTES; an image in the request goes as data, one
// the request names by URL as that URL. A document goes as text, at most
// MAX_DOCUMENTS per request and DOCUMENT_CHARS characters each: moderation
// models read short texts best. Others are left alone.
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS = 4;
const DOCUMENT_CHARS = 10000;

function belongsTo(message, attachment) {
  return message.path === "" || attachment.path === message.path || attachment.path.startsWith(message.path + "/");
}

// sendable reports an attachment the instance sends. Gemini names its files
// by Files API or Cloud Storage URIs, which the moderation API cannot read.
function sendable(config, attachment) {
  if (attachment.kind === "document") return attachment.ref !== undefined;
  if (attachment.kind !== "image" || config.images === false) return false;
  if (attachment.ref !== undefined) return attachment.size <= MAX_IMAGE_BYTES;
  return typeof attachment.url === "string" && /^https?:\/\//.test(attachment.url) && !/\/(?:fileData|file_data)$/.test(attachment.path);
}

export function ingress(ctx, req) {
  const config = ctx.config;
  if (ctx.path === MODERATION_PATH || !req.body || typeof req.body !== "object") return { action: "continue" };
  const messages = userMessages(ctx.format, req.body);
  if (messages.length === 0) return { action: "continue" };
  const attachments = utils.attachments().filter((attachment) => sendable(config, attachment));
  const hasContent = (message) => message.text.trim() !== "" || attachments.some((attachment) => belongsTo(message, attachment));
  let selected = messages.filter(hasContent);
  if (config.scope !== "all_user") selected = selected.slice(-1);
  if (selected.length === 0) return { action: "continue" };

  const texts = selected.map((message) => message.text).filter((text) => text.trim() !== "");
  const images = [];
  let documents = 0;
  for (const attachment of attachments) {
    if (!selected.some((message) => belongsTo(message, attachment))) continue;
    if (attachment.kind === "image") {
      if (images.length < MAX_IMAGES) images.push(attachment.ref !== undefined ? attachment.ref : attachment.url);
    } else if (documents < MAX_DOCUMENTS) {
      documents++;
      const read = utils.mediaText(attachment.ref, { maxChars: DOCUMENT_CHARS });
      if (read && typeof read.text === "string" && read.text.trim() !== "") texts.push(read.text);
    }
  }
  let blocking = [];
  let requests = 0;
  if (texts.length > 0) {
    const inputs = textInputs(config, texts, config.scope !== "all_user" && texts.length === 1, MAX_FETCHES);
    if (inputs === null) {
      return { action: "reject", code: "moderation.too_long", message: "The request is too long for content moderation" };
    }
    for (; blocking.length === 0 && requests < inputs.length; requests++) blocking = moderate(config, inputs[requests]);
  }
  // Images take the requests the text left.
  for (let i = 0; blocking.length === 0 && i < images.length && requests < MAX_FETCHES; i++, requests++) {
    blocking = moderate(config, [{ type: "image_url", image_url: { url: images[i] } }]);
  }
  if (blocking.length === 0) return { action: "continue" };
  return {
    action: "reject",
    code: "moderation.flagged",
    ruleId: blocking[0].name.slice(0, 256),
    message: "The request was flagged by content moderation",
    findings: findingsOf(blocking),
  };
}

// A stream reaches the client in parts of about this many characters: each
// part is held back until the moderation API passed it.
const REPLY_PART = 1000;
const MAX_HOLD = 8192;

// With replies on, the reply is checked as well: a non-stream reply once, a
// stream part by part.
export function reply(ctx, res) {
  const config = ctx.config;
  if (config.replies !== true || ctx.path === MODERATION_PATH) return { action: "pass" };
  if (!res.outputs.some((output) => output.final || output.text.length >= REPLY_PART)) {
    return { action: "continue", hold: MAX_HOLD };
  }
  const texts = res.outputs.map((output) => output.text).filter((text) => text.trim() !== "");
  if (texts.length === 0) return { action: "continue" };
  const inputs = textInputs(config, texts, false, MAX_FETCHES);
  if (inputs === null) {
    return { action: "stop", code: "moderation.too_long", message: "The reply is too long for content moderation" };
  }
  let blocking = [];
  for (let i = 0; blocking.length === 0 && i < inputs.length; i++) blocking = moderate(config, inputs[i]);
  if (blocking.length === 0) return { action: "continue" };
  return {
    action: "stop",
    code: "moderation.flagged",
    message: "The reply was flagged by content moderation",
    findings: findingsOf(blocking),
  };
}
