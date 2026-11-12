const CATEGORIES = ["email", "phone", "id_card", "bank_card", "api_key", "ipv4"];
// IPv4 is off by default: version numbers and sample addresses look the same.
const DEFAULT_CATEGORIES = ["email", "phone", "id_card", "bank_card", "api_key"];

export const meta = {
  apiVersion: 1,
  key: "request-redact",
  name: { en: "Request redaction", zh: "请求脱敏" },
  description: {
    en: "Replaces personal information and keys in request text before it is sent",
    zh: "发送前替换请求文本中的个人信息和密钥",
  },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  configSchema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        title: { en: "Built-in types", zh: "内置类型" },
        description: { en: "Types of information to replace", zh: "要替换的信息类型" },
        default: DEFAULT_CATEGORIES,
        uniqueItems: true,
        items: {
          type: "string",
          title: { en: "Type", zh: "类型" },
          description: { en: "Type of information", zh: "信息类型" },
          enum: CATEGORIES,
          enumTitles: [
            { en: "Email addresses", zh: "邮箱地址" },
            { en: "Phone numbers", zh: "电话号码" },
            { en: "ID card numbers", zh: "身份证号" },
            { en: "Bank card numbers", zh: "银行卡号" },
            { en: "API keys and tokens", zh: "API 密钥和令牌" },
            { en: "IPv4 addresses", zh: "IPv4 地址" },
          ],
        },
      },
      rules: {
        type: "array",
        title: { en: "Custom rules", zh: "自定义规则" },
        description: { en: "Regular expressions applied after the built-in types", zh: "在内置类型之后应用的正则表达式" },
        default: [],
        maxItems: 50,
        items: {
          type: "object",
          title: { en: "Rule", zh: "规则" },
          description: { en: "Text to replace", zh: "要替换的文本" },
          required: ["pattern"],
          properties: {
            pattern: {
              type: "string",
              format: "regex",
              title: { en: "Regular expression", zh: "正则表达式" },
              description: { en: "Text that matches is replaced", zh: "匹配到的文本会被替换" },
              minLength: 1,
              maxLength: 1024,
              examples: ["EMP-\\d{6}"],
            },
            replacement: {
              type: "string",
              title: { en: "Replacement text", zh: "替换文本" },
              description: { en: "Leave empty to use the default replacement text", zh: "留空时使用默认替换文本" },
              maxLength: 64,
              examples: ["[EMPLOYEE_ID]"],
            },
            id: {
              type: "string",
              title: { en: "Rule ID", zh: "规则 ID" },
              description: {
                en: "Recorded in logs when the rule matches; leave empty to number rules in order",
                zh: "命中时记录在日志中，留空时按顺序编号",
              },
              maxLength: 64,
              examples: ["employee-id"],
            },
          },
        },
      },
      replacement: {
        type: "string",
        title: { en: "Default replacement text", zh: "默认替换文本" },
        description: { en: "Text that replaces each match", zh: "替换每处匹配的文本" },
        default: "[REDACTED]",
        minLength: 1,
        maxLength: 64,
      },
      finalCheck: {
        type: "string",
        title: { en: "Check before sending", zh: "发送前检查" },
        description: {
          en: "Action when the request to be sent still contains such information",
          zh: "即将发送的请求仍含此类信息时的处理方式",
        },
        enum: ["reject", "off"],
        enumTitles: [
          { en: "Reject the request", zh: "拒绝请求" },
          { en: "Off", zh: "关闭" },
        ],
        default: "reject",
      },
      replies: {
        type: "boolean",
        title: { en: "Mask replies", zh: "遮盖回复" },
        description: {
          en: "Also mask these types and rules in model replies",
          zh: "同时遮盖模型回复中的这些类型和规则",
        },
        default: false,
      },
    },
  },
  samples: [
    {
      name: { en: "Email and phone number", zh: "邮箱和电话号码" },
      lang: "en",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: "Write a short note to jane.doe@example.com saying she can reach me at +14155550123 after 5 pm.",
          },
        ],
      },
      reply: "Hi Jane (jane.doe@example.com), feel free to call me at +14155550123 any time after 5 pm.",
    },
    {
      name: { en: "Email and phone number", zh: "邮箱和电话号码" },
      lang: "zh",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "帮我给 zhang.wei@example.cn 写一条消息，告诉他下午五点后可以打 13812345678 找我。" }],
      },
      reply: "张伟你好（zhang.wei@example.cn），下午五点后可以拨打 13812345678 联系我。",
    },
  ],
};

const ID_CARD_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ID_CARD_CHECK_CODES = "10X98765432";

// Mainland resident ID: area, birth date, sequence and the check code of
// GB 11643-1999.
function validIdCard(value) {
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += Number(value[i]) * ID_CARD_WEIGHTS[i];
  return ID_CARD_CHECK_CODES[sum % 11] === value[17].toUpperCase();
}

function passesLuhn(value) {
  const digits = value.replace(/[ -]/g, "");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// Real keys are random and carry digits; this keeps out prose such as a long
// hyphenated name after "sk-".
function looksRandom(value) {
  return /\d/.test(value) && /[A-Za-z]/.test(value);
}

// Asset names such as icon@2x.png have the shape of an address.
function isNotFileName(value) {
  return !/\.(?:png|jpe?g|gif|webp|svg)$/i.test(value);
}

// Loopback and unspecified addresses identify no one.
function isRoutableAddress(value) {
  return !/^(?:0|127)\./.test(value);
}

// Conservative shapes: each one needs a boundary on both sides, and numbers
// pass their check digit before anything is replaced. Order matters: an
// email such as 13812345678@qq.com is replaced whole before the phone rule
// runs.
const BUILT_IN_RULES = {
  api_key: {
    regex:
      /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|gh[opsur]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,}|xox[abposr]-[A-Za-z0-9-]{10,})(?![A-Za-z0-9_-])|\b([Bb]earer[ \t]+)[A-Za-z0-9._~+/-]{20,}=*/g,
    valid: looksRandom,
    keepPrefix: true,
  },
  email: {
    regex: /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}\b/g,
    valid: isNotFileName,
  },
  id_card: {
    regex: /\b[1-8]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
    valid: validIdCard,
  },
  // Payment cards start with 2-6, which also keeps out millisecond timestamps.
  bank_card: {
    regex: /\b[2-6]\d{12,18}\b|\b[2-6]\d{3}(?:[ -]\d{4}){3}(?:[ -]\d{1,3})?\b/g,
    valid: passesLuhn,
  },
  // Mainland mobile numbers, optionally grouped 3-4-4, and E.164 numbers
  // with their leading plus.
  phone: {
    regex: /(?<![A-Za-z0-9_+])\+[1-9]\d{7,14}\b|\b1[3-9]\d(?:[ -]?\d{4}){2}\b/g,
  },
  ipv4: {
    regex: /(?<![A-Za-z0-9_.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![A-Za-z0-9_]|\.\d)/g,
    valid: isRoutableAddress,
  },
};
const BUILT_IN_ORDER = ["api_key", "email", "id_card", "bank_card", "phone", "ipv4"];

const TEXT_PART_TYPES = ["text", "input_text", "output_text"];
const MEDIA_PLACEHOLDER = /^\[media:\d+\]$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushText(fields, path, value) {
  if (typeof value === "string" && value !== "" && !MEDIA_PLACEHOLDER.test(value)) {
    fields.push({ path: path, text: value });
  }
}

// Message content: a string, or parts in the OpenAI, Responses, Claude or
// Gemini shape. Claude tool results nest their own content, and a Claude
// document may carry its text in the body.
function collectContent(fields, path, content) {
  if (typeof content === "string") {
    pushText(fields, path, content);
    return;
  }
  if (!Array.isArray(content)) return;
  for (let i = 0; i < content.length; i++) {
    const part = content[i];
    const partPath = path + "/" + i;
    if (typeof part === "string") {
      pushText(fields, partPath, part);
      continue;
    }
    if (!isObject(part) || part.thought === true) continue;
    if (typeof part.text === "string" && (part.type === undefined || TEXT_PART_TYPES.includes(part.type))) {
      pushText(fields, partPath + "/text", part.text);
    } else if (part.type === "tool_result") {
      collectContent(fields, partPath + "/content", part.content);
    } else if (part.type === "document" && isObject(part.source)) {
      if (part.source.type === "text") pushText(fields, partPath + "/source/data", part.source.data);
      else if (part.source.type === "content") collectContent(fields, partPath + "/source/content", part.source.content);
    }
  }
}

// Task text fields beside prompt: negative prompts, and song lyrics and
// descriptions.
const TASK_TEXT_KEYS = ["negative_prompt", "negativePrompt", "lyrics", "gpt_description_prompt"];

// The user-visible text of a request in any of the four formats, with the
// JSON Pointer of each string: chat messages, Claude system, Responses
// instructions and input, Gemini contents and system instruction, and the
// prompt of image and completion requests. Task submissions add their
// prompts: at the top level, under input or parameters, in instances and in
// content parts.
function collectTexts(body) {
  const fields = [];
  if (!isObject(body)) return fields;
  if (Array.isArray(body.messages)) {
    for (let i = 0; i < body.messages.length; i++) {
      const message = body.messages[i];
      if (isObject(message)) collectContent(fields, "/messages/" + i + "/content", message.content);
    }
  }
  collectContent(fields, "/system", body.system);
  pushText(fields, "/instructions", body.instructions);
  collectContent(fields, "/prompt", body.prompt);
  if (typeof body.input === "string") pushText(fields, "/input", body.input);
  else if (Array.isArray(body.input)) {
    for (let i = 0; i < body.input.length; i++) {
      const item = body.input[i];
      const itemPath = "/input/" + i;
      if (typeof item === "string") {
        pushText(fields, itemPath, item);
        continue;
      }
      if (!isObject(item)) continue;
      if (item.content !== undefined) collectContent(fields, itemPath + "/content", item.content);
      else if (item.type === "function_call_output") collectContent(fields, itemPath + "/output", item.output);
      else if (TEXT_PART_TYPES.includes(item.type)) pushText(fields, itemPath + "/text", item.text);
    }
  }
  if (Array.isArray(body.contents)) {
    for (let i = 0; i < body.contents.length; i++) {
      const content = body.contents[i];
      if (isObject(content)) collectContent(fields, "/contents/" + i + "/parts", content.parts);
    }
  }
  for (const key of ["systemInstruction", "system_instruction"]) {
    if (isObject(body[key])) collectContent(fields, "/" + key + "/parts", body[key].parts);
  }
  for (const key of TASK_TEXT_KEYS) collectContent(fields, "/" + key, body[key]);
  if (isObject(body.input)) {
    collectContent(fields, "/input/prompt", body.input.prompt);
    pushText(fields, "/input/negative_prompt", body.input.negative_prompt);
    if (Array.isArray(body.input.messages)) {
      for (let i = 0; i < body.input.messages.length; i++) {
        const message = body.input.messages[i];
        if (isObject(message)) collectContent(fields, "/input/messages/" + i + "/content", message.content);
      }
    }
  }
  if (isObject(body.parameters)) pushText(fields, "/parameters/negative_prompt", body.parameters.negative_prompt);
  if (Array.isArray(body.instances)) {
    for (let i = 0; i < body.instances.length; i++) {
      if (isObject(body.instances[i])) pushText(fields, "/instances/" + i + "/prompt", body.instances[i].prompt);
    }
  }
  if (Array.isArray(body.content)) collectContent(fields, "/content", body.content);
  return fields;
}

// Built-in types in their fixed order, then the custom rules. A custom rule
// without an id is named by its position in the list: rule-1, rule-2. Go-style
// patterns often start with (?i); JavaScript takes it as a flag.
function activeRules(config) {
  const defaultReplacement = config.replacement || "[REDACTED]";
  const categories = config.categories || DEFAULT_CATEGORIES;
  const rules = [];
  for (const category of BUILT_IN_ORDER) {
    if (!categories.includes(category)) continue;
    const builtIn = BUILT_IN_RULES[category];
    rules.push({
      id: category,
      category: category,
      regex: builtIn.regex,
      valid: builtIn.valid,
      keepPrefix: builtIn.keepPrefix === true,
      replacement: defaultReplacement,
      count: 0,
    });
  }
  const customRules = config.rules || [];
  for (let i = 0; i < customRules.length; i++) {
    const rule = customRules[i];
    if (!isObject(rule) || !rule.pattern) continue;
    const id = rule.id || "rule-" + (i + 1);
    let source = rule.pattern;
    let flags = "g";
    if (source.startsWith("(?i)")) {
      source = source.slice(4);
      flags = "gi";
    }
    let regex;
    try {
      regex = new RegExp(source, flags);
    } catch (error) {
      throw new Error('Rule "' + id + '" has an invalid regular expression');
    }
    rules.push({
      id: id,
      category: "custom",
      regex: regex,
      keepPrefix: false,
      replacement: rule.replacement || defaultReplacement,
      count: 0,
    });
  }
  return rules;
}

function applyRule(text, rule) {
  let count = 0;
  const result = text.replace(rule.regex, function (match, prefix) {
    if (match === "" || (rule.valid && !rule.valid(match))) return match;
    count++;
    return (rule.keepPrefix && prefix ? prefix : "") + rule.replacement;
  });
  return { text: result, count: count };
}

// Runs when an instance is saved, so a rule that cannot compile is refused
// there instead of failing every request.
export function validateConfig(config) {
  activeRules(config || {});
}

// redact applies every rule to text and returns the new text and the id of
// the first rule that matched, "" when none did.
function redact(rules, text) {
  let first = "";
  for (const rule of rules) {
    const applied = applyRule(text, rule);
    if (applied.count > 0 && first === "") first = rule.id;
    text = applied.text;
    rule.count += applied.count;
  }
  return { text: text, ruleId: first };
}

// Documents go by the same rules: text, PDF and DOCX files, as far as the
// host reads them. A text file read whole takes the new text. Any other file
// that holds a match cannot be rewritten: with the check before sending on,
// that rejects the request; off, the file goes as it is and the record says
// it could not be rewritten. Images and files the request only names are
// left alone.
function redactAttachments(rules, finalCheck, effects) {
  for (const attachment of utils.attachments()) {
    if (!attachment.ref || attachment.kind !== "document") continue;
    const read = utils.mediaText(attachment.ref);
    if (!read || typeof read.text !== "string") continue;
    const redacted = redact(rules, read.text);
    if (redacted.ruleId === "") continue;
    if (finalCheck !== "off" && (attachment.rewritable !== true || read.truncated)) return redacted.ruleId;
    effects.push({ type: "media.text", media: Number(attachment.ref.slice(7, -1)), text: redacted.text });
  }
  return "";
}

// The host takes at most this many json.patch operations from one result.
const MAX_PATCH_OPS = 512;
// A json.patch value must not hold a file reference.
const FILE_REF = /\[media:\d+\]/;
// The body member that holds an array while its file items are moved into
// it.
const SCRATCH = "__request_redact";

// foldedOps returns the operations that write value, already changed, at
// path, as few as it can: a value without files is replaced whole, and
// otherwise the changed members or items below it are written on their own.
// A replace cannot carry a file, so an array held by an object member may
// instead go into the scratch member without its file items, take them back
// by move in their order and then replace the member.
function foldedOps(path, value, changed, inObject) {
  if (value === null || typeof value !== "object" || !FILE_REF.test(JSON.stringify(value))) {
    return [{ op: "replace", path: path, value: value }];
  }
  const isArray = Array.isArray(value);
  const separate = [];
  const fileItemOps = [];
  const fileItems = [];
  const rest = [];
  for (const key of Object.keys(value)) {
    const itemPath = path + "/" + key;
    const ops = changed.has(itemPath) ? foldedOps(itemPath, value[key], changed, !isArray) : [];
    separate.push(...ops);
    if (isArray && FILE_REF.test(JSON.stringify(value[key]))) {
      fileItems.push(Number(key));
      fileItemOps.push(...ops);
    } else if (isArray) {
      rest.push(value[key]);
    }
  }
  if (!isArray || !inObject || fileItems.length + fileItemOps.length + 2 >= separate.length) return separate;
  const merged = [{ op: "add", path: "/" + SCRATCH, value: rest }];
  // Each move takes an item out of the old array, which shifts the later
  // ones down by one.
  fileItems.forEach((index, moved) => merged.push({ op: "move", from: path + "/" + (index - moved), path: "/" + SCRATCH + "/" + index }));
  merged.push({ op: "move", from: "/" + SCRATCH, path: path });
  return merged.concat(fileItemOps);
}

export function ingress(ctx, req) {
  const config = ctx.config || {};
  const rules = activeRules(config);
  if (rules.length === 0) return { action: "continue" };
  const changes = [];
  for (const field of collectTexts(req.body)) {
    const text = redact(rules, field.text).text;
    if (text !== field.text) changes.push({ path: field.path, text: text });
  }
  let ops = changes.map((change) => ({ op: "replace", path: change.path, value: change.text }));
  // Past the host's limit the changes are written into the body and folded
  // into the members that hold them. A form body takes only replaces of its
  // text fields. When they still do not fit, the request is rejected, or with
  // the check before sending off the first changes are made and the rest
  // goes as it is.
  if (ops.length > MAX_PATCH_OPS) {
    let folded = null;
    if (req.form !== true && !(SCRATCH in req.body)) {
      const changed = new Set();
      for (const change of changes) {
        const keys = change.path.split("/").slice(1);
        let parent = req.body;
        for (let i = 0; i < keys.length - 1; i++) {
          changed.add("/" + keys.slice(0, i + 1).join("/"));
          parent = parent[keys[i]];
        }
        parent[keys[keys.length - 1]] = change.text;
        changed.add(change.path);
      }
      folded = [];
      for (const key of Object.keys(req.body)) {
        if (changed.has("/" + key)) folded.push(...foldedOps("/" + key, req.body[key], changed, true));
      }
    }
    if (folded !== null && folded.length <= MAX_PATCH_OPS) ops = folded;
    else if (config.finalCheck !== "off") return { action: "reject", code: "sensitive_content", ruleId: rules.find((rule) => rule.count > 0).id };
    else ops = ops.slice(0, MAX_PATCH_OPS);
  }
  const effects = ops.length > 0 ? [{ type: "json.patch", ops: ops }] : [];
  const ruleId = redactAttachments(rules, config.finalCheck, effects);
  if (ruleId !== "") return { action: "reject", code: "sensitive_content", ruleId: ruleId };
  const findings = rules.filter((rule) => rule.count > 0).map((rule) => ({ rule: rule.id, category: rule.category, count: rule.count }));
  return { action: "continue", effects: effects, findings: findings };
}

// The final body may carry text added after ingress, such as a channel's
// parameter override, or come from a channel whose instance never ran at
// ingress.
export function egress(ctx, req) {
  const config = ctx.config || {};
  if (config.finalCheck === "off") return { action: "continue" };
  const rules = activeRules(config);
  for (const field of collectTexts(req.body)) {
    for (const rule of rules) {
      if (applyRule(field.text, rule).count > 0) {
        return { action: "reject", code: "sensitive_content", ruleId: rule.id };
      }
    }
  }
  return { action: "continue" };
}

// A stream holds back this much text, so a match split across two chunks is
// still found whole.
const REPLY_HOLD = 128;

// With replies on, the same types and rules are masked in the reply.
export function reply(ctx, res) {
  const config = ctx.config || {};
  if (config.replies !== true) return { action: "pass" };
  const rules = activeRules(config);
  if (rules.length === 0) return { action: "pass" };
  const mask = [];
  for (const output of res.outputs) {
    for (const rule of rules) {
      for (const match of output.text.matchAll(rule.regex)) {
        if (match[0] === "" || (rule.valid && !rule.valid(match[0]))) continue;
        const start = match.index + (rule.keepPrefix && match[1] ? match[1].length : 0);
        mask.push({ index: output.index, start: start, end: match.index + match[0].length, category: rule.category });
      }
    }
  }
  return { action: "continue", mask: mask, hold: res.stream ? REPLY_HOLD : 0 };
}
