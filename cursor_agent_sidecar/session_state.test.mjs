import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CursorHarnessSessionState, deleteSdkAgentState } from "./session_state.mjs";

function record(overrides = {}) {
  return {
    kind: "awaiting",
    sessionId: "session-1",
    model: "claude-sonnet-4-6",
    credentialFingerprint: "fingerprint-only",
    agentId: "agent-1",
    runId: "run-1",
    toolUseIds: ["toolu_bf_blue_0123456789abcdef0123456789abcdef"],
    pending: [{ toolUseId: "toolu_bf_blue_0123456789abcdef0123456789abcdef", name: "lookup" }],
    updatedAt: 1_000,
    expiresAt: 10_000,
    ...overrides,
  };
}

test("persists only restart-safe Cursor session metadata", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cursor-session-state-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "sessions.json");
  const state = new CursorHarnessSessionState(file, { now: () => 2_000 });
  state.upsert(record());

  const reloaded = new CursorHarnessSessionState(file, { now: () => 2_000 });
  assert.deepEqual(reloaded.counts(), { awaiting: 1, replay: 0, total: 1 });
  assert.equal(
    reloaded.findByToolUseIds(["toolu_bf_blue_0123456789abcdef0123456789abcdef"]).agentId,
    "agent-1",
  );
  const raw = readFileSync(file, "utf8");
  assert.doesNotMatch(raw, /cursor api key|Bearer|crsr_|sk-/i);
});

test("expires stale records and persists replay responses", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cursor-session-state-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, "sessions.json");
  let now = 2_000;
  const state = new CursorHarnessSessionState(file, { now: () => now });
  state.upsert(record({
    kind: "replay",
    requestDigest: "digest",
    response: { type: "message", content: [{ type: "text", text: "DONE" }] },
  }));
  assert.deepEqual(state.counts(), { awaiting: 0, replay: 1, total: 1 });
  now = 10_001;
  assert.equal(state.findByToolUseIds(record().toolUseIds), null);
  assert.deepEqual(state.counts(), { awaiting: 0, replay: 0, total: 0 });
});

test("removes run events, checkpoints, runs, and agent rows in dependency order", async () => {
  const calls = [];
  let listPage = 0;
  const store = {
    runs: {
      async list(input) {
        calls.push(["list", input]);
        listPage += 1;
        if (listPage === 1) {
          return { items: [{ runId: "run-1" }], nextCursor: "cursor-1" };
        }
        return { items: [{ runId: "run-2" }] };
      },
      async delete(input) {
        calls.push(["runs", input]);
      },
    },
    runEvents: {
      async delete(input) {
        calls.push(["events", input]);
      },
    },
    checkpoints: {
      async delete(input) {
        calls.push(["checkpoints", input]);
      },
    },
    agents: {
      async delete(input) {
        calls.push(["agents", input]);
      },
    },
  };
  await deleteSdkAgentState(store, "agent-1");
  assert.deepEqual(calls, [
    ["list", { filter: { agentIds: ["agent-1"], limit: 50 } }],
    ["list", { filter: { agentIds: ["agent-1"], limit: 50, cursor: "cursor-1" } }],
    ["events", { filter: { runIds: ["run-1", "run-2"] } }],
    ["checkpoints", { filter: { agentIds: ["agent-1"] } }],
    ["runs", { filter: { agentIds: ["agent-1"] } }],
    ["agents", { filter: { agentIds: ["agent-1"] } }],
  ]);
});

test("reports ambiguous persisted tool ids as a fail-closed conflict", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cursor-session-state-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const state = new CursorHarnessSessionState(join(root, "sessions.json"), {
    now: () => 2_000,
  });
  state.upsert(record());
  state.upsert(record({ sessionId: "session-2" }));
  assert.throws(
    () => state.findByToolUseIds(record().toolUseIds),
    (error) => error.status === 409,
  );
});

test("pins an accepted recovery against TTL sweep and expires it after unpin", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cursor-session-state-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  let now = 2_000;
  let expired = 0;
  const state = new CursorHarnessSessionState(join(root, "sessions.json"), {
    now: () => now,
    onExpire: () => { expired += 1; },
  });
  state.upsert(record({ expiresAt: 2_100 }));
  state.pin("session-1");
  now = 2_200;
  assert.deepEqual(state.counts(), { awaiting: 1, replay: 0, total: 1 });
  assert.equal(expired, 0);
  assert.equal(state.touch("session-1", 3_000), true);
  state.unpin("session-1");
  assert.deepEqual(state.counts(), { awaiting: 1, replay: 0, total: 1 });
  now = 3_001;
  assert.deepEqual(state.counts(), { awaiting: 0, replay: 0, total: 0 });
  assert.equal(expired, 1);
});
