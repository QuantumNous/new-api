export const meta = {
  apiVersion: 1,
  key: "request-filter",
  name: { en: "Request filter", zh: "请求过滤" },
  description: {
    en: "Rejects requests whose text matches a keyword or regular expression",
    zh: "拒绝文本命中关键词或正则表达式的请求",
  },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  configSchema: {
    type: "object",
    properties: {
      rules: {
        type: "array",
        title: { en: "Rules", zh: "规则" },
        description: { en: "The request is rejected when any rule matches", zh: "命中任一规则时拒绝请求" },
        default: [],
        maxItems: 500,
        items: {
          type: "object",
          title: { en: "Rule", zh: "规则" },
          description: { en: "Text that causes a rejection", zh: "会导致拒绝的文本" },
          required: ["pattern"],
          properties: {
            pattern: {
              type: "string",
              title: { en: "Keyword or expression", zh: "关键词或表达式" },
              description: { en: "Keyword or regular expression to match", zh: "要匹配的关键词或正则表达式" },
              minLength: 1,
              maxLength: 1024,
              examples: ["internal use only"],
            },
            type: {
              type: "string",
              title: { en: "Match type", zh: "匹配方式" },
              description: { en: "How the pattern is matched", zh: "匹配内容的方式" },
              enum: ["keyword", "regex"],
              enumTitles: [
                { en: "Keyword", zh: "关键词" },
                { en: "Regular expression", zh: "正则表达式" },
              ],
              default: "keyword",
            },
            caseSensitive: {
              type: "boolean",
              title: { en: "Case sensitive", zh: "区分大小写" },
              description: { en: "Whether letter case must match", zh: "是否区分大小写" },
              default: false,
            },
            id: {
              type: "string",
              title: { en: "Rule ID", zh: "规则 ID" },
              description: {
                en: "Recorded in logs when the rule matches; leave empty to number rules in order",
                zh: "命中时记录在日志中，留空时按顺序编号",
              },
              maxLength: 64,
              examples: ["internal-docs"],
            },
          },
        },
      },
      keywords: {
        type: "string",
        format: "keywords",
        title: { en: "Keyword list", zh: "关键词列表" },
        description: {
          en: "One per line; the request is rejected when any of them appears",
          zh: "每行一个，请求中出现任意一个时拒绝",
        },
        default: "",
        maxLength: 1048576,
      },
      keywordsCaseSensitive: {
        type: "boolean",
        title: { en: "Keywords are case sensitive", zh: "关键词区分大小写" },
        default: false,
      },
      message: {
        type: "string",
        title: { en: "Rejection message", zh: "拒绝提示" },
        description: {
          en: "Shown to the client; leave empty for the default message",
          zh: "返回给客户端，留空时使用默认提示",
        },
        default: "",
        maxLength: 256,
        examples: ["This request contains content that is not allowed"],
      },
      replies: {
        type: "boolean",
        title: { en: "Check replies", zh: "检查回复" },
        description: {
          en: "Also stop model replies that match a rule",
          zh: "同时中止命中规则的模型回复",
        },
        default: false,
      },
    },
  },
  samples: [
    {
      name: { en: "Internal memo", zh: "内部备忘录" },
      lang: "en",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Summarize this memo. It is marked internal use only: Q3 revenue grew 12 percent." }],
      },
      reply: "This memo is for internal use only. It reports that Q3 revenue grew 12 percent.",
    },
    {
      name: { en: "Internal memo", zh: "内部备忘录" },
      lang: "zh",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "总结这份备忘录，它标注了仅限内部使用：第三季度收入增长 12%。" }],
      },
      reply: "这份备忘录仅限内部使用，内容是第三季度收入增长 12%。",
    },
  ],
};

const TEXT_PART_TYPES = ["text", "input_text", "output_text"];
const MEDIA_PLACEHOLDER = /^\[media:\d+\]$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushText(texts, value) {
  if (typeof value === "string" && value !== "" && !MEDIA_PLACEHOLDER.test(value)) texts.push(value);
}

// pushJSON adds a string as it is and any other value, such as a parameter
// schema or the arguments of a tool call, as its JSON text.
function pushJSON(texts, value) {
  if (typeof value === "string") pushText(texts, value);
  else if (value !== undefined && value !== null) pushText(texts, JSON.stringify(value));
}

// Message content: a string, or parts in the OpenAI, Responses, Claude or
// Gemini shape. Claude tool calls and results and Gemini function calls and
// responses count too; a tool result block other than text or a file counts
// as its JSON. A Claude document may carry its text in the body.
function collectContent(texts, content, inToolResult) {
  if (typeof content === "string") {
    pushText(texts, content);
    return;
  }
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (typeof part === "string") {
      pushText(texts, part);
      continue;
    }
    if (!isObject(part) || part.thought === true) continue;
    const call = part.functionCall || part.function_call;
    const response = part.functionResponse || part.function_response;
    if (typeof part.text === "string" && (part.type === undefined || TEXT_PART_TYPES.includes(part.type))) {
      pushText(texts, part.text);
    } else if (part.type === "tool_use") {
      pushText(texts, part.name);
      pushJSON(texts, part.input);
    } else if (part.type === "tool_result") {
      collectContent(texts, part.content, true);
    } else if (part.type === "document" && isObject(part.source)) {
      if (part.source.type === "text") pushText(texts, part.source.data);
      else if (part.source.type === "content") collectContent(texts, part.source.content);
    } else if (isObject(call)) {
      pushText(texts, call.name);
      pushJSON(texts, call.args);
    } else if (isObject(response)) {
      pushText(texts, response.name);
      if (isObject(response.response)) {
        for (const value of Object.values(response.response)) pushJSON(texts, value);
      }
    } else if (inToolResult && part.type !== "image") {
      pushJSON(texts, part);
    }
  }
}

// Responses input items: messages, tool calls with their names, arguments or
// input, and tool outputs.
const OUTPUT_ITEM_TYPES = ["function_call_output", "custom_tool_call_output", "local_shell_call_output"];

function collectInputItems(texts, items) {
  for (const item of items) {
    if (typeof item === "string") {
      pushText(texts, item);
      continue;
    }
    if (!isObject(item)) continue;
    pushText(texts, item.name);
    if (item.content !== undefined) collectContent(texts, item.content);
    else if (item.type === "function_call") pushJSON(texts, item.arguments);
    else if (item.type === "custom_tool_call") pushJSON(texts, item.input);
    else if (OUTPUT_ITEM_TYPES.includes(item.type)) collectContent(texts, item.output);
    else if (TEXT_PART_TYPES.includes(item.type)) pushText(texts, item.text);
  }
}

// Task text fields beside prompt: negative prompts, and song lyrics and
// descriptions.
const TASK_TEXT_KEYS = ["negative_prompt", "negativePrompt", "lyrics", "gpt_description_prompt"];
// Members of a Responses request that hold text as JSON.
const RESPONSES_JSON_KEYS = ["metadata", "text", "tool_choice"];
// Formats whose whole body is text to check: Codex web search, and DeepSeek
// search and fetch.
const WHOLE_BODY_FORMATS = ["openai_alpha_search", "deepseek_tools"];

// The text of a request in any format: chat messages with their names and
// tool calls, Claude system, Responses instructions and input items, Gemini
// contents and system instruction, tool declarations, the prompt of image
// and completion requests, embedding inputs and rerank queries and
// documents. A Responses compaction is checked as the JSON of its
// instructions and input. Task submissions add their prompts: at the top
// level, under input or parameters, in instances and in content parts.
function collectTexts(body, format) {
  const texts = [];
  if (!isObject(body)) return texts;
  if (WHOLE_BODY_FORMATS.includes(format)) {
    pushJSON(texts, body);
    return texts;
  }
  if (format === "openai_responses_compaction") {
    pushJSON(texts, body.instructions);
    pushJSON(texts, body.input);
    return texts;
  }
  if (Array.isArray(body.messages)) {
    for (const message of body.messages) {
      if (!isObject(message)) continue;
      collectContent(texts, message.content);
      pushText(texts, message.name);
      // Tools a message declares count as top-level tools do.
      pushJSON(texts, message.tools);
      if (!Array.isArray(message.tool_calls)) continue;
      for (const call of message.tool_calls) {
        if (!isObject(call)) continue;
        if (call.custom !== undefined) {
          pushJSON(texts, call.custom);
        } else if (isObject(call.function)) {
          pushText(texts, call.function.name);
          pushJSON(texts, call.function.arguments);
        }
      }
    }
  }
  collectContent(texts, body.system);
  if (Array.isArray(body.instructions)) collectInputItems(texts, body.instructions);
  else pushText(texts, body.instructions);
  if (isObject(body.prompt)) pushJSON(texts, body.prompt);
  else collectContent(texts, body.prompt);
  if (typeof body.input === "string") pushText(texts, body.input);
  else if (Array.isArray(body.input)) collectInputItems(texts, body.input);
  if (Array.isArray(body.contents)) {
    for (const content of body.contents) {
      if (isObject(content)) collectContent(texts, content.parts);
    }
  }
  for (const instruction of [body.systemInstruction, body.system_instruction]) {
    if (isObject(instruction)) collectContent(texts, instruction.parts);
  }
  // Tool names, descriptions and parameter schemas, in every format.
  pushJSON(texts, body.tools);
  if (format === "openai_responses") {
    for (const key of RESPONSES_JSON_KEYS) pushJSON(texts, body[key]);
  }
  // Gemini embedding requests: one content, or a batch of requests.
  if (isObject(body.content)) collectContent(texts, body.content.parts);
  if (Array.isArray(body.requests)) {
    for (const request of body.requests) {
      if (isObject(request) && isObject(request.content)) collectContent(texts, request.content.parts);
    }
  }
  pushText(texts, body.query);
  if (Array.isArray(body.documents)) {
    for (const document of body.documents) pushJSON(texts, document);
  }
  for (const key of TASK_TEXT_KEYS) collectContent(texts, body[key]);
  if (isObject(body.input)) {
    collectContent(texts, body.input.prompt);
    pushText(texts, body.input.negative_prompt);
    if (Array.isArray(body.input.messages)) {
      for (const message of body.input.messages) {
        if (isObject(message)) collectContent(texts, message.content);
      }
    }
  }
  if (isObject(body.parameters)) pushText(texts, body.parameters.negative_prompt);
  if (Array.isArray(body.instances)) {
    for (const instance of body.instances) {
      if (isObject(instance)) pushText(texts, instance.prompt);
    }
  }
  if (Array.isArray(body.content)) collectContent(texts, body.content);
  return texts;
}

// Go-style patterns often start with (?i); JavaScript takes it as a flag.
function compileRule(rule, id) {
  const caseSensitive = rule.caseSensitive === true;
  if (rule.type !== "regex") {
    return {
      id: id,
      keyword: caseSensitive ? rule.pattern : rule.pattern.toLowerCase(),
      caseSensitive: caseSensitive,
    };
  }
  let source = rule.pattern;
  let insensitive = !caseSensitive;
  if (source.startsWith("(?i)")) {
    source = source.slice(4);
    insensitive = true;
  }
  try {
    return { id: id, regex: new RegExp(source, insensitive ? "i" : "") };
  } catch (error) {
    throw new Error('Rule "' + id + '" has an invalid regular expression');
  }
}

// A rule without an id is named by its position in the list: rule-1, rule-2.
function compileRules(config) {
  const rules = config.rules || [];
  const compiled = [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (isObject(rule) && rule.pattern) compiled.push(compileRule(rule, rule.id || "rule-" + (i + 1)));
  }
  return compiled;
}

function matches(rule, text, lowered) {
  if (rule.regex) return rule.regex.test(text);
  return (rule.caseSensitive ? text : lowered).includes(rule.keyword);
}

// The keyword list stays in Go: a hook reads ctx.config.keywords as
// {count, longest}, and utils.keywords finds the words in a text.
function hasKeywords(config) {
  return isObject(config.keywords) && config.keywords.count > 0;
}

// firstMatch returns the id of the first rule that matches one of texts,
// "keywords" when only the keyword list does, or "".
function firstMatch(config, rules, texts) {
  if (rules.length > 0) {
    const lowered = texts.map((text) => text.toLowerCase());
    for (const rule of rules) {
      for (let i = 0; i < texts.length; i++) {
        if (matches(rule, texts[i], lowered[i])) return rule.id;
      }
    }
  }
  // A keyword is one line, so joining the texts by line breaks finds no
  // keyword that none of them holds.
  if (hasKeywords(config) && texts.length > 0) {
    const found = utils.keywords("keywords", texts.join("\n"), { caseSensitive: config.keywordsCaseSensitive === true });
    if (found.length > 0) return "keywords";
  }
  return "";
}

// The text of the request's documents: text, PDF and DOCX files, as far as
// the host reads them. Images, and files the request only names by id or
// URL, are not read.
function attachmentTexts() {
  const texts = [];
  for (const attachment of utils.attachments()) {
    if (!attachment.ref || attachment.kind !== "document") continue;
    const read = utils.mediaText(attachment.ref);
    if (read && typeof read.text === "string") pushText(texts, read.text);
  }
  return texts;
}

// check reads the attachments only when the text passed, and only when
// asked: at ingress.
function check(ctx, req, attachments) {
  const config = ctx.config || {};
  const rules = compileRules(config);
  if (rules.length === 0 && !hasKeywords(config)) return { action: "continue" };
  let ruleId = firstMatch(config, rules, collectTexts(req.body, ctx.format));
  if (ruleId === "" && attachments) ruleId = firstMatch(config, rules, attachmentTexts());
  if (ruleId === "") return { action: "continue" };
  const result = { action: "reject", code: "request_filtered", ruleId: ruleId };
  if (config.message) result.message = config.message;
  return result;
}

// Runs when an instance is saved, so a rule that cannot compile is refused
// there instead of failing every request.
export function validateConfig(config) {
  compileRules(config || {});
}

export function ingress(ctx, req) {
  return check(ctx, req, true);
}

// The final body may carry text added after ingress, such as a channel's
// parameter override. Attachments are as ingress read them.
export function egress(ctx, req) {
  return check(ctx, req, false);
}

// A regular expression can match text of any length; a stream holds back
// this much text for it.
const REGEX_HOLD = 256;

// A stream holds back enough text for the longest keyword to be found when
// it is split across two chunks.
function replyHold(config, rules) {
  let hold = hasKeywords(config) ? config.keywords.longest - 1 : 0;
  for (const rule of rules) hold = Math.max(hold, rule.regex ? REGEX_HOLD : rule.keyword.length - 1);
  return hold;
}

// With replies checked, a reply that matches a rule or the keyword list is
// stopped.
export function reply(ctx, res) {
  const config = ctx.config || {};
  if (config.replies !== true) return { action: "pass" };
  const rules = compileRules(config);
  if (rules.length === 0 && !hasKeywords(config)) return { action: "pass" };
  for (const output of res.outputs) {
    if (output.text === "") continue;
    const ruleId = firstMatch(config, rules, [output.text]);
    if (ruleId === "") continue;
    const result = { action: "stop", code: "request_filtered", findings: [{ rule: ruleId, count: 1 }] };
    if (config.message) result.message = config.message;
    return result;
  }
  return { action: "continue", hold: res.stream ? replyHold(config, rules) : 0 };
}
