import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

async function reservePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(port, child) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`sidecar exited with ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // Startup has not bound the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("sidecar did not become healthy");
}

test("routes a tool result back to the sidecar instance encoded in its id", async (t) => {
  let captured;
  const peer = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    captured = { authorization: req.headers.authorization, body: JSON.parse(raw) };
    res.writeHead(201, { "content-type": "application/json" });
    res.end(JSON.stringify({ routed: true }));
  });
  await new Promise((resolve, reject) => {
    peer.once("error", reject);
    peer.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => peer.close(resolve)));

  const peerPort = peer.address().port;
  const sourcePort = await reservePort();
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL(".", import.meta.url),
    env: {
      ...process.env,
      CURSOR_AGENT_SIDECAR_HOST: "127.0.0.1",
      CURSOR_AGENT_SIDECAR_PORT: String(sourcePort),
      CURSOR_AGENT_INSTANCE_ID: "source",
      CURSOR_AGENT_PEER_BASE_URL_TEMPLATE: "http://127.0.0.1:{instance}",
      CURSOR_AGENT_PEER_INSTANCE_IDS: String(peerPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode !== null) return;
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    });
  });
  await waitForHealth(sourcePort, child);

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 128,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: `toolu_bf_${peerPort}_0123456789abcdef0123456789abcdef`,
            content: "done",
          },
        ],
      },
    ],
  };
  const response = await fetch(`http://127.0.0.1:${sourcePort}/v1/messages`, {
    method: "POST",
    headers: {
      authorization: "Bearer cursor-test-key",
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { routed: true });
  assert.equal(response.headers.get("x-cursor-agent-routed-instance"), String(peerPort));
  assert.equal(captured.authorization, "Bearer cursor-test-key");
  assert.deepEqual(captured.body, body);
});

test("tries the only blue-green peer once for a legacy tool id", async (t) => {
  let captured;
  const peer = http.createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    captured = {
      url: req.url,
      hop: req.headers["x-cursor-agent-peer-hop"],
      body: JSON.parse(raw),
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ legacyRouted: true }));
  });
  await new Promise((resolve, reject) => {
    peer.once("error", reject);
    peer.listen(0, "127.0.0.1", resolve);
  });
  t.after(() => new Promise((resolve) => peer.close(resolve)));

  const peerPort = peer.address().port;
  const sourcePort = await reservePort();
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL(".", import.meta.url),
    env: {
      ...process.env,
      CURSOR_AGENT_SIDECAR_HOST: "127.0.0.1",
      CURSOR_AGENT_SIDECAR_PORT: String(sourcePort),
      CURSOR_AGENT_INSTANCE_ID: "blue",
      CURSOR_AGENT_PEER_BASE_URL_TEMPLATE: `http://127.0.0.1:${peerPort}/{instance}`,
      CURSOR_AGENT_PEER_INSTANCE_IDS: "green",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode !== null) return;
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    });
  });
  await waitForHealth(sourcePort, child);

  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 128,
    messages: [
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_legacy_sdk_id", content: "done" },
        ],
      },
    ],
  };
  const response = await fetch(`http://127.0.0.1:${sourcePort}/v1/messages`, {
    method: "POST",
    headers: { authorization: "Bearer cursor-test-key", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { legacyRouted: true });
  assert.equal(captured.url, "/green/v1/messages");
  assert.equal(captured.hop, "1");
  assert.deepEqual(captured.body, body);

  captured = undefined;
  const hoppedResponse = await fetch(`http://127.0.0.1:${sourcePort}/v1/messages`, {
    method: "POST",
    headers: {
      authorization: "Bearer cursor-test-key",
      "content-type": "application/json",
      "x-cursor-agent-peer-hop": "1",
    },
    body: JSON.stringify(body),
  });
  assert.equal(hoppedResponse.status, 409);
  assert.equal(captured, undefined);
});

test("SIGUSR2 drain makes the worker reject new sessions with Retry-After", async (t) => {
  const port = await reservePort();
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL(".", import.meta.url),
    env: {
      ...process.env,
      CURSOR_AGENT_SIDECAR_HOST: "127.0.0.1",
      CURSOR_AGENT_SIDECAR_PORT: String(port),
      CURSOR_AGENT_INSTANCE_ID: "drain-test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode !== null) return;
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    });
  });
  await waitForHealth(port, child);
  child.kill("SIGUSR2");
  let accepting = true;
  for (let attempt = 0; attempt < 40 && accepting; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    accepting = (await (await fetch(`http://127.0.0.1:${port}/health`)).json()).accepting;
  }
  assert.equal(accepting, false);

  const response = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
    method: "POST",
    headers: { authorization: "Bearer cursor-test-key", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "new session" }],
    }),
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "2");
  assert.match((await response.json()).error.message, /draining/);
});
