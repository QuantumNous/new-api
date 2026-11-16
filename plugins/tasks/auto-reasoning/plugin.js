// Efforts in ascending strength; "none" turns thinking off.
const EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
const EFFORT_TITLES = [
  { en: "Off" },
  { en: "Minimal" },
  { en: "Low" },
  { en: "Medium" },
  { en: "High" },
  { en: "Extra high" },
  { en: "Max" },
];
const NOT_SET_TITLE = { en: "Not set" };

export const meta = {
  apiVersion: 1,
  key: "auto-reasoning",
  name: { en: "Automatic reasoning effort" },
  description: { en: "Sets the reasoning effort from the size of each request; under Where it runs, choose models that support reasoning, as other models may refuse the request" },
  version: "1.0.0",
  author: { name: "QuantumNous" },
  // A failure keeps the effort the request has, which is safe.
  optional: true,
  configSchema: {
    type: "object",
    properties: {
      rules: {
        type: "array",
        title: { en: "Rules" },
        description: { en: "Checked in order; the first matching rule sets the effort" },
        // Requests with tools or long text think harder; others keep the
        // effort they have.
        default: [
          { minTools: 1, effort: "high" },
          { minTotalChars: 4000, effort: "high" },
        ],
        maxItems: 50,
        items: {
          type: "object",
          title: { en: "Rule" },
          description: { en: "Conditions and the effort they set" },
          required: ["effort"],
          properties: {
            minMessages: {
              type: "integer",
              title: { en: "Minimum messages" },
              description: { en: "Matches requests with at least this many messages" },
              minimum: 0,
            },
            minTools: {
              type: "integer",
              title: { en: "Minimum tools" },
              description: { en: "Matches requests with at least this many tools" },
              minimum: 0,
            },
            minLastUserChars: {
              type: "integer",
              title: { en: "Last user message length" },
              description: { en: "Matches when the last user message has at least this many characters" },
              unit: "character",
              minimum: 0,
            },
            minTotalChars: {
              type: "integer",
              title: { en: "Total text length" },
              description: { en: "Matches when all text together has at least this many characters" },
              unit: "character",
              minimum: 0,
            },
            hasImages: {
              type: "boolean",
              title: { en: "Images only" },
              description: { en: "Whether only requests with images match" },
            },
            effort: {
              type: "string",
              title: { en: "Reasoning effort" },
              description: { en: "Effort set when the rule matches" },
              enum: EFFORTS,
              enumTitles: EFFORT_TITLES,
            },
          },
        },
      },
      defaultEffort: {
        type: "string",
        title: { en: "Default effort" },
        description: { en: "Effort set when no rule matches" },
        enum: [""].concat(EFFORTS),
        enumTitles: [NOT_SET_TITLE].concat(EFFORT_TITLES),
        default: "",
      },
      minEffort: {
        type: "string",
        title: { en: "Lowest effort" },
        description: { en: "Lower efforts are raised to this one" },
        enum: [""].concat(EFFORTS),
        enumTitles: [NOT_SET_TITLE].concat(EFFORT_TITLES),
        default: "",
      },
      maxEffort: {
        type: "string",
        title: { en: "Highest effort" },
        description: { en: "Higher efforts are lowered to this one" },
        enum: [""].concat(EFFORTS),
        enumTitles: [NOT_SET_TITLE].concat(EFFORT_TITLES),
        default: "",
      },
      overrideClient: {
        type: "boolean",
        title: { en: "Replace the request's effort" },
        description: { en: "Whether an effort already set in the request is replaced" },
        default: false,
      },
    },
  },
  samples: [
{
      name: { en: "Trip planning with a tool" },
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
    }
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
