// Efforts in ascending strength; "none" turns thinking off.
const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
const EFFORT_TITLES = [
  { en: "Off", zh: "关闭" },
  { en: "Minimal", zh: "极低" },
  { en: "Low", zh: "低" },
  { en: "Medium", zh: "中" },
  { en: "High", zh: "高" },
  { en: "Extra high", zh: "极高" },
  { en: "Max", zh: "最高" },
];
const NOT_SET_TITLE = { en: "Not set", zh: "不设置" };

export const meta = {
  apiVersion: 1,
  key: "auto-reasoning",
  name: { en: "Automatic reasoning effort", zh: "自动推理强度" },
  description: {
    en: "Sets the reasoning effort from the size of each request; under Where it runs, choose models that support reasoning, as other models may refuse the request",
    zh: "根据每个请求的规模设置推理强度；请在“用在哪里”指定支持推理的模型，其他模型可能拒绝请求",
  },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  // A failure keeps the effort the request has, which is safe.
  optional: true,
  configSchema: {
    type: "object",
    properties: {
      rules: {
        type: "array",
        title: { en: "Rules", zh: "规则" },
        description: {
          en: "Checked in order; the first matching rule sets the effort",
          zh: "按顺序检查，第一条命中的规则决定推理强度",
        },
        // Requests with tools or long text think harder; others keep the
        // effort they have.
        default: [
          { minTools: 1, effort: "high" },
          { minTotalChars: 4000, effort: "high" },
        ],
        maxItems: 50,
        items: {
          type: "object",
          title: { en: "Rule", zh: "规则" },
          description: { en: "Conditions and the effort they set", zh: "命中条件及对应的推理强度" },
          required: ["effort"],
          properties: {
            minMessages: {
              type: "integer",
              title: { en: "Minimum messages", zh: "最少消息数" },
              description: { en: "Matches requests with at least this many messages", zh: "消息数不少于此值时命中" },
              minimum: 0,
            },
            minTools: {
              type: "integer",
              title: { en: "Minimum tools", zh: "最少工具数" },
              description: { en: "Matches requests with at least this many tools", zh: "工具数不少于此值时命中" },
              minimum: 0,
            },
            minLastUserChars: {
              type: "integer",
              title: { en: "Last user message length", zh: "最后一条用户消息长度" },
              description: {
                en: "Matches when the last user message has at least this many characters",
                zh: "最后一条用户消息的字数不少于此值时命中",
              },
              unit: "character",
              minimum: 0,
            },
            minTotalChars: {
              type: "integer",
              title: { en: "Total text length", zh: "文本总长度" },
              description: {
                en: "Matches when all text together has at least this many characters",
                zh: "全部文本的字数不少于此值时命中",
              },
              unit: "character",
              minimum: 0,
            },
            hasImages: {
              type: "boolean",
              title: { en: "Images only", zh: "仅限含图片" },
              description: { en: "Whether only requests with images match", zh: "是否仅在请求含图片时命中" },
            },
            effort: {
              type: "string",
              title: { en: "Reasoning effort", zh: "推理强度" },
              description: { en: "Effort set when the rule matches", zh: "规则命中时设置的推理强度" },
              enum: EFFORTS,
              enumTitles: EFFORT_TITLES,
            },
          },
        },
      },
      defaultEffort: {
        type: "string",
        title: { en: "Default effort", zh: "默认推理强度" },
        description: { en: "Effort set when no rule matches", zh: "没有规则命中时设置的推理强度" },
        enum: [""].concat(EFFORTS),
        enumTitles: [NOT_SET_TITLE].concat(EFFORT_TITLES),
        default: "",
      },
      minEffort: {
        type: "string",
        title: { en: "Lowest effort", zh: "最低推理强度" },
        description: { en: "Lower efforts are raised to this one", zh: "低于此强度时提高到此强度" },
        enum: [""].concat(EFFORTS),
        enumTitles: [NOT_SET_TITLE].concat(EFFORT_TITLES),
        default: "",
      },
      maxEffort: {
        type: "string",
        title: { en: "Highest effort", zh: "最高推理强度" },
        description: { en: "Higher efforts are lowered to this one", zh: "高于此强度时降低到此强度" },
        enum: [""].concat(EFFORTS),
        enumTitles: [NOT_SET_TITLE].concat(EFFORT_TITLES),
        default: "",
      },
      overrideClient: {
        type: "boolean",
        title: { en: "Replace the request's effort", zh: "覆盖请求中的推理强度" },
        description: {
          en: "Whether an effort already set in the request is replaced",
          zh: "是否替换请求中已设置的推理强度",
        },
        default: false,
      },
    },
  },
  samples: [
    {
      name: { en: "Trip planning with a tool", zh: "借助工具规划行程" },
      lang: "en",
      format: "openai",
      body: {
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "You are a travel assistant." },
          { role: "user", content: "I am planning a three-day trip to Kyoto in April." },
          { role: "assistant", content: "Great choice. Do you want temples, food or day trips?" },
          { role: "user", content: "Temples and food. Check the weather for the first day and suggest an itinerary." },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "Get the weather forecast for a city on a date",
              parameters: {
                type: "object",
                properties: { city: { type: "string" }, date: { type: "string" } },
                required: ["city", "date"],
              },
            },
          },
        ],
      },
    },
    {
      name: { en: "Trip planning with a tool", zh: "借助工具规划行程" },
      lang: "zh",
      format: "openai",
      body: {
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: "你是一名旅行助手。" },
          { role: "user", content: "我打算四月去京都玩三天。" },
          { role: "assistant", content: "不错的选择。你更想看寺庙、吃美食，还是去周边一日游？" },
          { role: "user", content: "寺庙和美食。查一下第一天的天气，再帮我排个行程。" },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              description: "查询某个城市某天的天气预报",
              parameters: {
                type: "object",
                properties: { city: { type: "string" }, date: { type: "string" } },
                required: ["city", "date"],
              },
            },
          },
        ],
      },
    },
  ],
};

// Every condition a rule sets must hold; a rule without conditions always
// matches. hasImages only narrows: false and absent both match any request.
function ruleMatches(rule, summary) {
  if (rule.minMessages !== undefined && (summary.messageCount || 0) < rule.minMessages) return false;
  if (rule.minTools !== undefined && (summary.toolCount || 0) < rule.minTools) return false;
  if (rule.minLastUserChars !== undefined && (summary.lastUserTextLength || 0) < rule.minLastUserChars) return false;
  if (rule.minTotalChars !== undefined && (summary.totalTextLength || 0) < rule.minTotalChars) return false;
  if (rule.hasImages === true && summary.hasImages !== true) return false;
  return true;
}

export function request(ctx, req) {
  const config = ctx.config || {};
  const summary = req.summary || {};
  const overrideClient = config.overrideClient === true;
  if (summary.reasoningEffort && !overrideClient) return { action: "continue" };

  let effort = config.defaultEffort || "";
  for (const rule of config.rules || []) {
    if (rule && ruleMatches(rule, summary)) {
      effort = rule.effort;
      break;
    }
  }
  let level = EFFORTS.indexOf(effort);
  if (level < 0) return { action: "continue" };
  if (config.minEffort) level = Math.max(level, EFFORTS.indexOf(config.minEffort));
  if (config.maxEffort) level = Math.min(level, EFFORTS.indexOf(config.maxEffort));
  return {
    action: "continue",
    effects: [{ type: "reasoning.set", effort: EFFORTS[level], override: overrideClient }],
  };
}
