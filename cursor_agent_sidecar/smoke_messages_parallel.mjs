/** Live parallel-tool, replay, and fresh-turn smoke for the SDK Messages bridge. */
const apiKey = process.env.CURSOR_API_KEY || "";
const baseURL = process.env.CURSOR_AGENT_SMOKE_BASE_URL || "http://127.0.0.1:3927";
const model = process.env.CURSOR_AGENT_SMOKE_MODEL || "cursor-grok-4.6-xhigh";
if (!apiKey) {
  console.error("missing CURSOR_API_KEY");
  process.exit(2);
}

const nonce = Date.now();
const alpha = `ALPHA_${nonce}`;
const beta = `BETA_${nonce}`;
const fresh = `FRESH_${nonce}`;
const headers = {
  "content-type": "application/json",
  authorization: `Bearer ${apiKey}`,
};
const tools = [
  {
    name: "probe_alpha",
    description: "Look up an alpha record by its alpha_query. This lookup is independent of probe_beta.",
    input_schema: {
      type: "object",
      properties: { alpha_query: { type: "string" } },
      required: ["alpha_query"],
      additionalProperties: false,
    },
  },
  {
    name: "probe_beta",
    description: "Look up a beta record by its beta_query. This lookup is independent of probe_alpha.",
    input_schema: {
      type: "object",
      properties: { beta_query: { type: "string" } },
      required: ["beta_query"],
      additionalProperties: false,
    },
  },
];

async function request(body) {
  const response = await fetch(`${baseURL}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    return { status: response.status, body: await response.json() };
  }
  const message = { content: [], stop_reason: null };
  const inputJson = new Map();
  for (const line of (await response.text()).split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const event = JSON.parse(line.slice(6));
    if (event.type === "message_start") Object.assign(message, event.message);
    if (event.type === "content_block_start") {
      message.content[event.index] = event.content_block;
    }
    if (event.type === "content_block_delta") {
      if (event.delta?.type === "text_delta") {
        message.content[event.index].text =
          (message.content[event.index].text || "") + event.delta.text;
      } else if (event.delta?.type === "input_json_delta") {
        inputJson.set(
          event.index,
          (inputJson.get(event.index) || "") + event.delta.partial_json,
        );
      }
    }
    if (event.type === "content_block_stop" && inputJson.has(event.index)) {
      message.content[event.index].input = JSON.parse(inputJson.get(event.index));
    }
    if (event.type === "message_delta") {
      message.stop_reason = event.delta?.stop_reason || message.stop_reason;
      message.usage = { ...(message.usage || {}), ...(event.usage || {}) };
    }
  }
  return { status: response.status, body: message };
}

const initialUser = {
  role: "user",
  content:
    "For maximum efficiency, call probe_alpha with alpha_query=alpha and probe_beta with beta_query=beta simultaneously in the same turn. These are two required independent operations. After both results arrive, reply with both result strings and no other text.",
};
const first = await request({
  model,
  max_tokens: 256,
  stream: true,
  messages: [initialUser],
  tools,
  tool_choice: { type: "any" },
});
const calls = (first.body.content || []).filter((block) => block?.type === "tool_use");
const callByName = new Map(calls.map((call) => [call.name, call]));
if (
  first.status !== 200 ||
  first.body.stop_reason !== "tool_use" ||
  calls.length !== 2 ||
  !callByName.has("probe_alpha") ||
  !callByName.has("probe_beta")
) {
  console.log(
    JSON.stringify({
      model,
      firstStatus: first.status,
      firstStop: first.body.stop_reason,
      toolCalls: calls.map((call) => call.name),
      error: first.body.error?.message || "parallel tool batch missing",
      passed: false,
    }),
  );
  process.exit(1);
}

const resultBlocks = [
  {
    type: "tool_result",
    tool_use_id: callByName.get("probe_alpha").id,
    content: alpha,
  },
  {
    type: "tool_result",
    tool_use_id: callByName.get("probe_beta").id,
    content: beta,
  },
];
const resumeBody = {
  model,
  max_tokens: 256,
  stream: true,
  messages: [
    initialUser,
    { role: "assistant", content: first.body.content },
    { role: "user", content: resultBlocks },
  ],
  tools,
};
const second = await request(resumeBody);
const finalText = (second.body.content || []).map((block) => block?.text || "").join("");
const replay = await request(resumeBody);

const freshTurn = await request({
  model,
  max_tokens: 128,
  stream: true,
  messages: [
    ...resumeBody.messages,
    { role: "assistant", content: second.body.content },
    { role: "user", content: `Reply exactly ${fresh}` },
  ],
});
const freshText = (freshTurn.body.content || [])
  .map((block) => block?.text || "")
  .join("")
  .trim();

const passed =
  second.status === 200 &&
  second.body.stop_reason === "end_turn" &&
  finalText.includes(alpha) &&
  finalText.includes(beta) &&
  replay.status === 200 &&
  replay.body.id === second.body.id &&
  freshTurn.status === 200 &&
  freshTurn.body.stop_reason === "end_turn" &&
  freshText === fresh;
console.log(
  JSON.stringify({
    model,
    firstStatus: first.status,
    firstStop: first.body.stop_reason,
    parallelToolCalls: calls.length,
    secondStatus: second.status,
    secondStop: second.body.stop_reason,
    alphaReturned: finalText.includes(alpha),
    betaReturned: finalText.includes(beta),
    replayStatus: replay.status,
    replaySameMessage: replay.body.id === second.body.id,
    freshStatus: freshTurn.status,
    freshStop: freshTurn.body.stop_reason,
    freshExact: freshText === fresh,
    passed,
  }),
);
process.exit(passed ? 0 : 1);
