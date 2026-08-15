/**
 * Verify that the official Cursor SDK harness can drive a custom MCP tool with
 * Sonnet, execute the host callback, and continue to a final answer.
 */
import "./force_proxy.mjs";
import { Agent } from "@cursor/sdk";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(__dirname, "empty-workspace");
mkdirSync(cwd, { recursive: true });

function readApiKey() {
  if (process.env.CURSOR_API_KEY) return process.env.CURSOR_API_KEY;
  try {
    const auth = JSON.parse(
      readFileSync(resolve(process.env.HOME, ".cursor/sdk/auth.json"), "utf8"),
    );
    return auth.apiKey || "";
  } catch {
    return "";
  }
}

const apiKey = readApiKey();
if (!apiKey) {
  console.error("missing CURSOR_API_KEY / ~/.cursor/sdk/auth.json");
  process.exit(2);
}

const model = process.env.CURSOR_SMOKE_MODEL || "claude-sonnet-4-6";
let executions = 0;
const expected = "H2_MCP_HARNESS_OK_847291";

const agent = await Agent.create({
  apiKey,
  model: { id: model },
  tools: ["mcp"],
  local: {
    cwd,
    settingSources: [],
    sandboxOptions: { enabled: false },
    customTools: {
      lookup_opaque_value: {
        description:
          "Returns a private opaque verification value. Always call this tool when the user asks for the verification value.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          executions += 1;
          return {
            content: [{ type: "text", text: expected }],
            structuredContent: { value: expected },
          };
        },
      },
    },
  },
});

const run = await agent.send(
  "Call lookup_opaque_value exactly once. Then reply with only the value returned by the tool.",
);
const eventSummary = [];
let finalText = "";
let runError = null;

for await (const event of run.stream()) {
  if (event?.type === "tool_call") {
    eventSummary.push({
      type: event.type,
      name: event.name,
      status: event.status,
    });
  } else if (event?.type === "assistant") {
    eventSummary.push({ type: event.type });
    finalText += (event.message?.content || [])
      .filter((block) => block?.type === "text")
      .map((block) => block.text || "")
      .join("");
  } else if (event?.type === "status") {
    eventSummary.push({ type: event.type, status: event.status });
    if (event.status === "ERROR") runError = event.message || "run error";
  }
}

const waited = await run.wait();
if (waited?.status === "error") {
  runError = waited.error?.message || runError || "run error";
}

const passed =
  !runError && executions === 1 && finalText.trim() === expected;
console.log(
  JSON.stringify(
    {
      model,
      status: waited?.status,
      executions,
      finalText: finalText.trim(),
      eventSummary,
      error: runError,
      passed,
    },
    null,
    2,
  ),
);

agent.close?.();
process.exit(passed ? 0 : 1);
