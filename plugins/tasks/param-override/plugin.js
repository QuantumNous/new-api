export const meta = {
  apiVersion: 1,
  key: "param-override",
  name: { en: "Global parameter override", zh: "全局参数覆盖" },
  description: {
    en: "Applies parameter override rules to all requests or to chosen groups, with the same syntax as a channel's parameter override. To change a single channel, use that channel's own parameter override; on the same parameter, the channel's setting wins",
    zh: "对全部请求或指定分组应用参数覆盖规则，语法与渠道的参数覆盖相同。只修改单个渠道时，请使用该渠道自己的参数覆盖；同一参数以渠道的设置为准",
  },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  configSchema: {
    type: "object",
    properties: {
      override: {
        type: "object",
        format: "json",
        title: { en: "Parameter override", zh: "参数覆盖" },
        description: { en: "Same syntax as the channel parameter override", zh: "语法与渠道参数覆盖相同" },
        default: {},
        examples: [
          {
            operations: [
              {
                path: "temperature",
                mode: "set",
                value: 0.7,
                conditions: [{ path: "model", mode: "prefix", value: "gpt-" }],
              },
              { path: "metadata", mode: "delete" },
              { path: "X-Request-Source", mode: "set_header", value: "new-api" },
            ],
          },
        ],
      },
    },
  },
  samples: [
    {
      name: { en: "Plain chat", zh: "普通对话" },
      lang: "en",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Explain what an API rate limit is in two sentences." }],
      },
    },
    {
      name: { en: "Plain chat", zh: "普通对话" },
      lang: "zh",
      format: "openai",
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "用两句话解释什么是 API 限流。" }],
      },
    },
  ],
};

const REJECT_CODE = /^[a-z0-9_.-]{1,64}$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameValue(left, right) {
  if (left === right) return true;
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (!sameValue(left[i], right[i])) return false;
    }
    return true;
  }
  if (!isObject(left) || !isObject(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(right, key) || !sameValue(left[key], right[key])) return false;
  }
  return true;
}

function pointer(path, key) {
  return path + "/" + String(key).replace(/~/g, "~0").replace(/\//g, "~1");
}

// Patch operations that turn before into after, touching only what changed.
// The body seen here has "[media:N]" in place of inline media, and a patch
// value may not carry one, so unchanged subtrees are never rewritten. Arrays
// keep their common head and tail, which covers prepending, appending and
// removing items.
function diff(path, before, after, ops) {
  if (sameValue(before, after)) return;
  if (isObject(before) && isObject(after)) {
    for (const key of Object.keys(before)) {
      if (!Object.prototype.hasOwnProperty.call(after, key)) ops.push({ op: "remove", path: pointer(path, key) });
    }
    for (const key of Object.keys(after)) {
      if (Object.prototype.hasOwnProperty.call(before, key)) diff(pointer(path, key), before[key], after[key], ops);
      else ops.push({ op: "add", path: pointer(path, key), value: after[key] });
    }
    return;
  }
  if (!Array.isArray(before) || !Array.isArray(after)) {
    ops.push({ op: "replace", path: path, value: after });
    return;
  }
  let start = 0;
  while (start < before.length && start < after.length && sameValue(before[start], after[start])) start++;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && sameValue(before[beforeEnd - 1], after[afterEnd - 1])) {
    beforeEnd--;
    afterEnd--;
  }
  const paired = Math.min(beforeEnd, afterEnd) - start;
  for (let i = start; i < start + paired; i++) diff(pointer(path, i), before[i], after[i], ops);
  for (let i = beforeEnd - 1; i >= start + paired; i--) ops.push({ op: "remove", path: pointer(path, i) });
  for (let i = start + paired; i < afterEnd; i++) ops.push({ op: "add", path: pointer(path, i), value: after[i] });
}

export function outbound(ctx, req) {
  const override = (ctx.config || {}).override;
  if (!isObject(override) || Object.keys(override).length === 0) return { action: "continue" };

  const result = utils.paramOverride(req.body, override);
  if (result.reject) {
    // An override's own error code may use any spelling; the result code
    // may not.
    const code = String(result.reject.code || "").toLowerCase();
    const rejected = { action: "reject", code: REJECT_CODE.test(code) ? code : "param_override_rejected" };
    if (result.reject.message) rejected.message = String(result.reject.message).slice(0, 256);
    return rejected;
  }

  const effects = [];
  const ops = [];
  diff("", req.body, result.body, ops);
  if (ops.length > 0) effects.push({ type: "json.patch", ops: ops });
  const headers = result.headers || {};
  const set = isObject(headers.set) ? headers.set : {};
  const remove = Array.isArray(headers.remove) ? headers.remove : [];
  if (Object.keys(set).length > 0 || remove.length > 0) effects.push({ type: "header.patch", set: set, remove: remove });
  return { action: "continue", effects: effects };
}
