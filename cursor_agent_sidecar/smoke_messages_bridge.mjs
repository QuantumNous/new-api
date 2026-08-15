/** Live two-request Anthropic tool loop against the running SDK sidecar. */
const apiKey = process.env.CURSOR_API_KEY || "";
const baseURL = process.env.CURSOR_AGENT_SMOKE_BASE_URL || "http://127.0.0.1:3927";
if (!apiKey) {
  console.error("missing CURSOR_API_KEY");
  process.exit(2);
}

const marker = `PROD_HARNESS_OK_${Date.now()}`;
const headers = {
  "content-type": "application/json",
  authorization: `Bearer ${apiKey}`,
};
const tool = {
  name: "lookup_opaque_value",
  description: "Return a private opaque verification value.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
};

async function readAnthropicMessage(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) return response.json();
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
      }
      if (event.delta?.type === "input_json_delta") {
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
  return message;
}

const firstResponse = await fetch(`${baseURL}/v1/messages`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 128,
    stream: false,
    messages: [
      {
        role: "user",
        content:
          "Call lookup_opaque_value exactly once, then return only its result.",
      },
    ],
    tools: [tool],
  }),
});
const first = await readAnthropicMessage(firstResponse);
const toolUse = first.content?.find((block) => block?.type === "tool_use");
if (firstResponse.status !== 200 || first.stop_reason !== "tool_use" || !toolUse?.id) {
  console.log(
    JSON.stringify({
      firstStatus: firstResponse.status,
      firstStop: first.stop_reason,
      error: first.error?.message || "missing tool_use",
      passed: false,
    }),
  );
  process.exit(1);
}

const secondResponse = await fetch(`${baseURL}/v1/messages`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 128,
    stream: false,
    messages: [
      { role: "assistant", content: first.content },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUse.id, content: marker },
        ],
      },
    ],
    tools: [tool],
  }),
});
const second = await readAnthropicMessage(secondResponse);
const text = (second.content || []).map((block) => block?.text || "").join("");
const replayResponse = await fetch(`${baseURL}/v1/messages`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 128,
    stream: false,
    messages: [
      { role: "assistant", content: first.content },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUse.id, content: marker },
        ],
      },
    ],
    tools: [tool],
  }),
});
const replay = await readAnthropicMessage(replayResponse);
const replayText = (replay.content || [])
  .map((block) => block?.text || "")
  .join("");
const passed =
  secondResponse.status === 200 &&
  second.stop_reason === "end_turn" &&
  text.trim() === marker &&
  replayResponse.status === 200 &&
  replay.stop_reason === "end_turn" &&
  replayText.trim() === marker &&
  replay.id === second.id;
console.log(
  JSON.stringify({
    firstStatus: firstResponse.status,
    firstStop: first.stop_reason,
    secondStatus: secondResponse.status,
    secondStop: second.stop_reason,
    exactMarker: text.trim() === marker,
    replayStatus: replayResponse.status,
    replayStop: replay.stop_reason,
    replayExact: replayText.trim() === marker,
    replaySameMessage: replay.id === second.id,
    passed,
  }),
);
process.exit(passed ? 0 : 1);
