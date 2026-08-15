/**
 * Quick Claude-via-Cursor check with force_proxy + optional connection audit.
 */
import "./force_proxy.mjs";
import { Agent } from "@cursor/sdk";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(__dirname, "empty-workspace");
mkdirSync(cwd, { recursive: true });

const apiKey =
  process.env.CURSOR_API_KEY ||
  (() => {
    try {
      const raw = execSync(
        `python3 -c 'import json;from pathlib import Path;print(json.loads((Path.home()/".cursor"/"sdk"/"auth.json").read_text())["apiKey"])'`,
        { encoding: "utf8" }
      ).trim();
      return raw;
    } catch {
      return "";
    }
  })();

if (!apiKey) {
  console.error("missing CURSOR_API_KEY / ~/.cursor/sdk/auth.json");
  process.exit(2);
}

// show exit IP via fetch (should be US if proxy works for fetch)
try {
  const r = await fetch("https://ipinfo.io/json");
  const d = await r.json();
  console.log("fetch_exit", d.ip, d.city, d.country, d.org);
} catch (e) {
  console.log("fetch_exit_err", e.message);
}

const model = process.env.CURSOR_SMOKE_MODEL || "claude-sonnet-4-6";
console.log("model", model);

const agent = await Agent.create({
  apiKey,
  model: { id: model },
  tools: [],
  local: { cwd, settingSources: [] },
});
console.log("agentId", agent.agentId);

// sample lsof mid-flight
const pid = process.pid;
setTimeout(() => {
  try {
    const out = execSync(
      `lsof -nP -p ${pid} -iTCP -sTCP:ESTABLISHED 2>/dev/null | head -25`,
      { encoding: "utf8" }
    );
    console.log("--- lsof ESTABLISHED ---\n" + out);
  } catch {
    /* ignore */
  }
}, 2000);

const run = await agent.send("Reply exactly: PROXY_CLAUDE_OK");
let err = null;
let text = "";
for await (const ev of run.stream()) {
  if (ev?.type === "status" && ev.status === "ERROR") {
    err = ev.message || ev.error || "error";
    console.log("status_error", err);
  }
  if (ev?.type === "assistant" && ev.message?.content) {
    text += (ev.message.content || []).map((b) => b?.text || "").join("");
  }
}
const waited = await run.wait();
if (waited?.status === "error") {
  err = waited?.error?.message || err;
}
if (!text && waited?.result) text = String(waited.result);
console.log(
  JSON.stringify(
    {
      status: waited?.status,
      text: (text || "").slice(0, 200),
      err: err || null,
      usage: waited?.usage || null,
    },
    null,
    2
  )
);
agent.close?.();
process.exit(err && !text ? 1 : 0);
