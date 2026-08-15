import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CursorHarnessMessagesBridge,
  cursorHarnessInstanceFromToolUseId,
  cursorHarnessRouteFromRequest,
  cursorSdkModelSelection,
} from "./harness_messages.mjs";
import { CursorHarnessSessionState } from "./session_state.mjs";

function fakeAgentFactory({ emptyFinal = false } = {}) {
  return async (options) => ({
    agentId: "agent-test",
    close() {},
    async send() {
      let result;
      let runError;
      let releaseDone;
      const done = new Promise((resolve) => {
        releaseDone = resolve;
      });
      return {
        id: "run-test",
        status: "running",
        async *stream() {
          try {
            yield { type: "status", status: "RUNNING" };
            result = await options.local.customTools.lookup_opaque_value.execute(
              {},
              { toolCallId: "toolu_test_1" },
            );
            if (!emptyFinal) {
              yield {
                type: "assistant",
                message: {
                  content: [{ type: "text", text: result.content[0].text }],
                },
              };
            }
            this.status = "finished";
            yield { type: "status", status: "FINISHED" };
          } catch (error) {
            runError = error;
            this.status = "error";
          } finally {
            releaseDone();
          }
        },
        async wait() {
          await done;
          if (runError) {
            return { status: "error", error: { message: runError.message } };
          }
          return { status: "finished" };
        },
        async cancel() {
          this.status = "cancelled";
          releaseDone();
        },
      };
    },
  });
}

function plainAgentFactory(text = "PLAIN_OK") {
  return async (options) => ({
    close() {},
    async send() {
      let releaseDone;
      const done = new Promise((resolve) => {
        releaseDone = resolve;
      });
      return {
        status: "running",
        async *stream() {
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text }] },
          };
          this.status = "finished";
          releaseDone();
        },
        async wait() {
          await done;
          return { status: "finished" };
        },
        async cancel() {
          releaseDone();
        },
        agentOptions: options,
      };
    },
  });
}

function incrementalTextAgentFactory(releaseFinal) {
  return async () => ({
    close() {},
    async send() {
      return {
        status: "running",
        async *stream() {
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: "EARLY_" }] },
          };
          await releaseFinal.promise;
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: "FINAL" }] },
          };
          this.status = "finished";
        },
        async wait() {
          await releaseFinal.promise;
          return { status: "finished" };
        },
        async cancel() {
          this.status = "cancelled";
          releaseFinal.resolve();
        },
      };
    },
  });
}

function sdkDeltaAgentFactory(releaseFinal) {
  return async () => ({
    close() {},
    async send(_message, options) {
      await options.onDelta({
        update: { type: "text-delta", text: "EARLY_" },
      });
      await releaseFinal.promise;
      await options.onDelta({
        update: { type: "text-delta", text: "FINAL" },
      });
      return {
        status: "running",
        async *stream() {
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: "EARLY_" }] },
          };
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: "FINAL" }] },
          };
          this.status = "finished";
        },
        async wait() {
          await releaseFinal.promise;
          return { status: "finished" };
        },
        async cancel() {
          this.status = "cancelled";
          releaseFinal.resolve();
        },
      };
    },
  });
}

function sdkThinkingDeltaAgentFactory(releaseFinal) {
  return async () => ({
    close() {},
    async send(_message, options) {
      await options.onDelta({
        update: { type: "thinking-delta", text: "CHECKING_" },
      });
      await releaseFinal.promise;
      await options.onDelta({
        update: { type: "text-delta", text: "ANSWER" },
      });
      return {
        status: "running",
        async *stream() {
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: "ANSWER" }] },
          };
          this.status = "finished";
        },
        async wait() {
          await releaseFinal.promise;
          return { status: "finished" };
        },
        async cancel() {
          this.status = "cancelled";
          releaseFinal.resolve();
        },
      };
    },
  });
}

function sdkDeltaToolAgentFactory() {
  return async (agentOptions) => ({
    close() {},
    async send(_message, sendOptions) {
      await sendOptions.onDelta({
        update: { type: "text-delta", text: "DELTA_PREAMBLE" },
      });
      let releaseDone;
      const done = new Promise((resolve) => {
        releaseDone = resolve;
      });
      return {
        status: "running",
        async *stream() {
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: "DELTA_PREAMBLE" }] },
          };
          const result = await agentOptions.local.customTools.lookup_opaque_value.execute(
            {},
            { toolCallId: "toolu_delta_resume" },
          );
          await sendOptions.onDelta({
            update: { type: "thinking-delta", text: "DELTA_CHECKING" },
          });
          await sendOptions.onDelta({
            update: { type: "text-delta", text: result.content[0].text },
          });
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: result.content[0].text }] },
          };
          this.status = "finished";
          releaseDone();
        },
        async wait() {
          await done;
          return { status: "finished" };
        },
        async cancel() {
          this.status = "cancelled";
          releaseDone();
        },
      };
    },
  });
}

function usageAgentFactory() {
  return async () => ({
    close() {},
    async send() {
      return {
        status: "running",
        async *stream() {
          yield {
            type: "usage",
            usage: {
              inputTokens: 11,
              outputTokens: 7,
              cacheReadTokens: 101,
              cacheWriteTokens: 13,
              totalTokens: 132,
            },
          };
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: "USAGE_OK" }] },
          };
        },
        async wait() {
          return { status: "finished" };
        },
      };
    },
  });
}

function toolUsageAtTurnEndAgentFactory() {
  return async (options) => ({
    close() {},
    async send() {
      let releaseDone;
      const done = new Promise((resolve) => {
        releaseDone = resolve;
      });
      return {
        status: "running",
        async *stream() {
          const result = await options.local.customTools.lookup_opaque_value.execute(
            {},
            { toolCallId: "toolu_usage_turn" },
          );
          yield {
            type: "usage",
            usage: {
              inputTokens: 11,
              outputTokens: 7,
              cacheReadTokens: 101,
              cacheWriteTokens: 13,
              totalTokens: 132,
            },
          };
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: result.content[0].text }] },
          };
          this.status = "finished";
          releaseDone();
        },
        async wait() {
          await done;
          return { status: "finished" };
        },
        async cancel() {
          this.status = "cancelled";
          releaseDone();
        },
      };
    },
  });
}

function preToolTextAgentFactory({ emitFinal = true, waitResult = "" } = {}) {
  return async (options) => ({
    close() {},
    async send() {
      let releaseDone;
      const done = new Promise((resolve) => {
        releaseDone = resolve;
      });
      return {
        status: "running",
        async *stream() {
          yield {
            type: "assistant",
            message: {
              content: [{ type: "text", text: "I will use the lookup tool." }],
            },
          };
          const result = await options.local.customTools.lookup_opaque_value.execute(
            {},
            { toolCallId: "toolu_preamble_1" },
          );
          if (emitFinal) {
            yield {
              type: "assistant",
              message: { content: [{ type: "text", text: result.content[0].text }] },
            };
          }
          this.status = "finished";
          releaseDone();
        },
        async wait() {
          await done;
          return { status: "finished", result: waitResult };
        },
        async cancel() {
          releaseDone();
        },
      };
    },
  });
}

function multiToolAgentFactory({ preambles = [] } = {}) {
  return async (options) => ({
    close() {},
    async send() {
      let releaseDone;
      const done = new Promise((resolve) => {
        releaseDone = resolve;
      });
      return {
        status: "running",
        async *stream() {
          if (preambles[0]) {
            yield {
              type: "assistant",
              message: { content: [{ type: "text", text: preambles[0] }] },
            };
          }
          const first = await options.local.customTools.lookup_opaque_value.execute(
            { turn: 1 },
            { toolCallId: "toolu_multi_1" },
          );
          if (preambles[1]) {
            yield {
              type: "assistant",
              message: { content: [{ type: "text", text: preambles[1] }] },
            };
          }
          const second = await options.local.customTools.lookup_opaque_value.execute(
            { turn: 2 },
            { toolCallId: "toolu_multi_2" },
          );
          yield {
            type: "assistant",
            message: {
              content: [
                {
                  type: "text",
                  text: `${first.content[0].text}:${second.content[0].text}`,
                },
              ],
            },
          };
          this.status = "finished";
          releaseDone();
        },
        async wait() {
          await done;
          return { status: "finished" };
        },
        async cancel() {
          releaseDone();
        },
      };
    },
  });
}

function parallelToolAgentFactory({ preamble = "" } = {}) {
  return async (options) => ({
    close() {},
    async send() {
      let releaseDone;
      const done = new Promise((resolve) => {
        releaseDone = resolve;
      });
      return {
        status: "running",
        async *stream() {
          if (preamble) {
            yield {
              type: "assistant",
              message: { content: [{ type: "text", text: preamble }] },
            };
          }
          const firstResult = options.local.customTools.lookup_opaque_value.execute(
              { slot: "alpha" },
              { toolCallId: "toolu_parallel_alpha" },
            );
          const secondResult = new Promise((resolve, reject) => {
            setTimeout(() => {
              options.local.customTools.lookup_opaque_value
                .execute(
                  { slot: "beta" },
                  { toolCallId: "toolu_parallel_beta" },
                )
                .then(resolve, reject);
            }, 40);
          });
          const [first, second] = await Promise.all([firstResult, secondResult]);
          yield {
            type: "assistant",
            message: {
              content: [
                {
                  type: "text",
                  text: `${first.content[0].text}:${second.content[0].text}`,
                },
              ],
            },
          };
          this.status = "finished";
          releaseDone();
        },
        async wait() {
          await done;
          return { status: "finished" };
        },
        async cancel() {
          releaseDone();
        },
      };
    },
  });
}

function hangingAgentFactory() {
  return async () => ({
    close() {},
    async send() {
      let release;
      const blocked = new Promise((resolve) => {
        release = resolve;
      });
      return {
        status: "running",
        async *stream() {
          await blocked;
        },
        async wait() {
          await blocked;
          return { status: "cancelled" };
        },
        async cancel() {
          this.status = "cancelled";
          release();
        },
      };
    },
  });
}

function concurrentToolAgentFactory() {
  let nextId = 0;
  return async (options) => {
    const toolUseId = `toolu_concurrent_${++nextId}`;
    return {
      close() {},
      async send() {
        let releaseDone;
        const done = new Promise((resolve) => {
          releaseDone = resolve;
        });
        return {
          status: "running",
          async *stream() {
            const result = await options.local.customTools.lookup_opaque_value.execute(
              {},
              { toolCallId: toolUseId },
            );
            yield {
              type: "assistant",
              message: { content: [{ type: "text", text: result.content[0].text }] },
            };
            this.status = "finished";
            releaseDone();
          },
          async wait() {
            await done;
            return { status: "finished" };
          },
          async cancel() {
            releaseDone();
          },
        };
      },
    };
  };
}

function delayedSendAgentFactory(onCancel) {
  return async () => ({
    close() {},
    async send() {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        status: "running",
        async *stream() {},
        async wait() {
          return { status: "cancelled" };
        },
        async cancel() {
          this.status = "cancelled";
          onCancel();
        },
      };
    },
  });
}

function hangingAfterToolResultAgentFactory() {
  return async (options) => ({
    close() {},
    async send() {
      let release;
      const blocked = new Promise((resolve) => {
        release = resolve;
      });
      return {
        status: "running",
        async *stream() {
          await options.local.customTools.lookup_opaque_value.execute(
            {},
            { toolCallId: "toolu_resume_abort" },
          );
          await blocked;
        },
        async wait() {
          await blocked;
          return { status: "cancelled" };
        },
        async cancel() {
          this.status = "cancelled";
          release();
        },
      };
    },
  });
}

function firstRequest() {
  return {
    model: "claude-sonnet-4-6",
    messages: [{ role: "user", content: "Use the tool." }],
    tools: [
      {
        name: "lookup_opaque_value",
        description: "Return the opaque value.",
        input_schema: { type: "object", properties: {} },
      },
    ],
  };
}

function resumeRequest(toolUseId, value) {
  return {
    model: "claude-sonnet-4-6",
    messages: [
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUseId, content: value }],
      },
    ],
  };
}

function resumeBatchRequest(entries) {
  return {
    model: "claude-sonnet-4-6",
    messages: [
      {
        role: "user",
        content: entries.map(([toolUseId, value]) => ({
          type: "tool_result",
          tool_use_id: toolUseId,
          content: value,
        })),
      },
    ],
  };
}

test("parks an SDK custom tool and resumes it from a second Messages request", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });

  const first = await bridge.handle(firstRequest(), "test-key");
  assert.equal(first.stop_reason, "tool_use");
  assert.deepEqual(first.content, [
    {
      type: "tool_use",
      id: "toolu_test_1",
      name: "lookup_opaque_value",
      input: {},
    },
  ]);

  const second = await bridge.handle(
    resumeRequest("toolu_test_1", "BRIDGE_OK"),
    "test-key",
  );
  assert.equal(second.stop_reason, "end_turn");
  assert.equal(second.content[0].text, "BRIDGE_OK");
});

test("keeps pre-tool assistant text in its tool-use turn instead of the final turn", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: preToolTextAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });

  const first = await bridge.handle(firstRequest(), "test-key");
  assert.equal(first.stop_reason, "tool_use");
  assert.deepEqual(first.content, [
    { type: "text", text: "I will use the lookup tool." },
    {
      type: "tool_use",
      id: "toolu_preamble_1",
      name: "lookup_opaque_value",
      input: {},
    },
  ]);

  const second = await bridge.handle(
    resumeRequest("toolu_preamble_1", "PREAMBLE_BRIDGE_OK"),
    "test-key",
  );
  assert.equal(second.stop_reason, "end_turn");
  assert.deepEqual(second.content, [
    { type: "text", text: "PREAMBLE_BRIDGE_OK" },
  ]);
});

test("does not resurrect emitted pre-tool text from Run.wait when no final text exists", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: preToolTextAgentFactory({
      emitFinal: false,
      waitResult: "I will use the lookup tool.",
    }),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });

  const first = await bridge.handle(firstRequest(), "test-key");
  assert.deepEqual(first.content, [
    { type: "text", text: "I will use the lookup tool." },
    {
      type: "tool_use",
      id: "toolu_preamble_1",
      name: "lookup_opaque_value",
      input: {},
    },
  ]);
  await assert.rejects(
    bridge.handle(
      resumeRequest("toolu_preamble_1", "PREAMBLE_BRIDGE_OK"),
      "test-key",
    ),
    (error) => error.status === 502 && /empty final turn/.test(error.message),
  );
});

test("serves a plain Messages request without requiring tools", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: plainAgentFactory(),
    firstEventTimeoutMs: 1000,
  });
  const response = await bridge.handle(
    {
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Reply plainly." }],
    },
    "test-key",
  );
  assert.equal(response.stop_reason, "end_turn");
  assert.equal(response.content[0].text, "PLAIN_OK");
});

test("forwards incremental text before the turn completes", async () => {
  let resolveFinal;
  const releaseFinal = {
    promise: new Promise((resolve) => {
      resolveFinal = resolve;
    }),
    resolve: () => resolveFinal(),
  };
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: incrementalTextAgentFactory(releaseFinal),
    firstEventTimeoutMs: 20,
    sessionTtlMs: 1000,
  });
  const deltas = [];
  let firstDeltaResolve;
  const firstDelta = new Promise((resolve) => {
    firstDeltaResolve = resolve;
  });
  let handleSettled = false;
  const handlePromise = bridge
    .handle(
      {
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: "Stream incrementally." }],
      },
      "test-key",
      {
        onTextDelta(text, meta) {
          deltas.push({ text, meta });
          firstDeltaResolve();
        },
      },
    )
    .finally(() => {
      handleSettled = true;
    });

  await firstDelta;
  assert.equal(handleSettled, false);
  assert.equal(deltas[0].text, "EARLY_");
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(handleSettled, false, "first-event timeout must not cap the full turn");

  releaseFinal.resolve();
  const response = await handlePromise;
  assert.equal(response.content[0].text, "EARLY_FINAL");
  assert.deepEqual(deltas.map((delta) => delta.text), ["EARLY_", "FINAL"]);
  assert.equal(deltas[0].meta.id, response.id);
  assert.equal(deltas[0].meta.model, response.model);
});

test("uses Cursor SDK text-delta callbacks without duplicating assistant frames", async () => {
  let resolveFinal;
  const releaseFinal = {
    promise: new Promise((resolve) => {
      resolveFinal = resolve;
    }),
    resolve: () => resolveFinal(),
  };
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: sdkDeltaAgentFactory(releaseFinal),
    firstEventTimeoutMs: 1000,
  });
  const deltas = [];
  let firstDeltaResolve;
  const firstDelta = new Promise((resolve) => {
    firstDeltaResolve = resolve;
  });
  let handleSettled = false;
  const handlePromise = bridge
    .handle(
      {
        model: "cursor-grok-4.6-xhigh",
        messages: [{ role: "user", content: "Stream through SDK deltas." }],
      },
      "test-key",
      {
        onTextDelta(text) {
          deltas.push(text);
          firstDeltaResolve();
        },
      },
    )
    .finally(() => {
      handleSettled = true;
    });

  await firstDelta;
  assert.equal(handleSettled, false);
  assert.deepEqual(deltas, ["EARLY_"]);

  releaseFinal.resolve();
  const response = await handlePromise;
  assert.equal(response.content[0].text, "EARLY_FINAL");
  assert.deepEqual(deltas, ["EARLY_", "FINAL"]);
});

test("forwards Cursor SDK thinking-delta before answer text", async () => {
  let resolveFinal;
  const releaseFinal = {
    promise: new Promise((resolve) => {
      resolveFinal = resolve;
    }),
    resolve: () => resolveFinal(),
  };
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: sdkThinkingDeltaAgentFactory(releaseFinal),
    firstEventTimeoutMs: 1000,
  });
  const thinkingDeltas = [];
  const textDeltas = [];
  let firstThinkingResolve;
  const firstThinking = new Promise((resolve) => {
    firstThinkingResolve = resolve;
  });
  let handleSettled = false;
  const handlePromise = bridge
    .handle(
      {
        model: "cursor-grok-4.6-xhigh",
        messages: [{ role: "user", content: "Think, then answer." }],
      },
      "test-key",
      {
        onThinkingDelta(text, meta) {
          thinkingDeltas.push({ text, meta });
          firstThinkingResolve();
        },
        onTextDelta: (text) => textDeltas.push(text),
      },
    )
    .finally(() => {
      handleSettled = true;
    });

  await firstThinking;
  assert.equal(handleSettled, false);
  assert.equal(thinkingDeltas[0].text, "CHECKING_");

  releaseFinal.resolve();
  const response = await handlePromise;
  assert.deepEqual(textDeltas, ["ANSWER"]);
  assert.equal(response.content[0].text, "ANSWER");
  assert.equal(thinkingDeltas[0].meta.id, response.id);
  assert.equal(thinkingDeltas[0].meta.model, response.model);
});

test("binds SDK text-delta callbacks to each tool continuation HTTP turn", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: sdkDeltaToolAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const firstDeltas = [];
  const first = await bridge.handle(firstRequest(), "test-key", {
    onTextDelta: (text, meta) => firstDeltas.push({ text, meta }),
  });
  assert.deepEqual(first.content, [
    { type: "text", text: "DELTA_PREAMBLE" },
    {
      type: "tool_use",
      id: "toolu_delta_resume",
      name: "lookup_opaque_value",
      input: {},
    },
  ]);
  assert.deepEqual(firstDeltas.map((delta) => delta.text), ["DELTA_PREAMBLE"]);
  assert.equal(firstDeltas[0].meta.id, first.id);

  const resumedDeltas = [];
  const resumedThinkingDeltas = [];
  const resumed = await bridge.handle(
    resumeRequest("toolu_delta_resume", "DELTA_FINAL"),
    "test-key",
    {
      onTextDelta: (text, meta) => resumedDeltas.push({ text, meta }),
      onThinkingDelta: (text, meta) =>
        resumedThinkingDeltas.push({ text, meta }),
    },
  );
  assert.deepEqual(resumed.content, [{ type: "text", text: "DELTA_FINAL" }]);
  assert.deepEqual(resumedDeltas.map((delta) => delta.text), ["DELTA_FINAL"]);
  assert.deepEqual(
    resumedThinkingDeltas.map((delta) => delta.text),
    ["DELTA_CHECKING"],
  );
  assert.equal(resumedDeltas[0].meta.id, resumed.id);
  assert.equal(resumedThinkingDeltas[0].meta.id, resumed.id);
  assert.notEqual(resumed.id, first.id);
});

test("binds streamed text to the correct HTTP turn across tool continuation", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: preToolTextAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const firstDeltas = [];
  const first = await bridge.handle(firstRequest(), "test-key", {
    onTextDelta: (text, meta) => firstDeltas.push({ text, meta }),
  });
  assert.equal(firstDeltas[0].text, "I will use the lookup tool.");
  assert.equal(firstDeltas[0].meta.id, first.id);

  const resumedDeltas = [];
  const resumed = await bridge.handle(
    resumeRequest("toolu_preamble_1", "STREAMED_FINAL"),
    "test-key",
    { onTextDelta: (text, meta) => resumedDeltas.push({ text, meta }) },
  );
  assert.equal(resumedDeltas[0].text, "STREAMED_FINAL");
  assert.equal(resumedDeltas[0].meta.id, resumed.id);
  assert.notEqual(resumed.id, first.id);
});

test("preserves Cursor SDK input and cache token usage in Anthropic fields", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: usageAgentFactory(),
    firstEventTimeoutMs: 1000,
  });
  const response = await bridge.handle(
    {
      model: "cursor-grok-4.6-medium",
      messages: [{ role: "user", content: "Report usage." }],
    },
    "test-key",
  );
  assert.deepEqual(response.usage, {
    input_tokens: 11,
    output_tokens: 7,
    cache_read_input_tokens: 101,
    cache_creation_input_tokens: 13,
  });
});

test("records one authoritative usage snapshot when the logical SDK Run completes", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: toolUsageAtTurnEndAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  assert.deepEqual(first.usage, {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  });

  const resumed = await bridge.handle(
    resumeRequest(first.content[0].id, "CACHE_USAGE_OK"),
    "test-key",
  );
  assert.deepEqual(resumed.usage, {
    input_tokens: 11,
    output_tokens: 7,
    cache_read_input_tokens: 101,
    cache_creation_input_tokens: 13,
  });
});

test("embeds and parses the sidecar instance in externally visible tool ids", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
    instanceId: "blue",
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  const toolUseId = first.content[0].id;
  assert.match(toolUseId, /^toolu_bf_blue_[a-f0-9]{32}$/);
  assert.equal(cursorHarnessInstanceFromToolUseId(toolUseId), "blue");
  assert.equal(cursorHarnessRouteFromRequest(resumeRequest(toolUseId, "OK")), "blue");

  const resumed = await bridge.handle(resumeRequest(toolUseId, "OK"), "test-key");
  assert.equal(resumed.content[0].text, "OK");
});

test("rejects tool result batches that span routed and legacy instances", () => {
  assert.throws(
    () =>
      cursorHarnessRouteFromRequest({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_bf_blue_0123456789abcdef0123456789abcdef",
                content: "A",
              },
              { type: "tool_result", tool_use_id: "toolu_legacy", content: "B" },
            ],
          },
        ],
      }),
    /multiple harness instances/,
  );
});

test("uses Run.wait result when the stream has no assistant text", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    firstEventTimeoutMs: 1000,
    agentFactory: async () => ({
      close() {},
      async send() {
        return {
          status: "finished",
          async *stream() {},
          async wait() {
            return { status: "finished", result: "WAIT_RESULT_OK" };
          },
        };
      },
    }),
  });
  const response = await bridge.handle(
    { model: "claude-fable-5", messages: [{ role: "user", content: "Reply." }] },
    "test-key",
  );
  assert.equal(response.content[0].text, "WAIT_RESULT_OK");
});

test("passes Anthropic image blocks through the SDK user message", async () => {
  let sentMessage;
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    firstEventTimeoutMs: 1000,
    agentFactory: async () => ({
      close() {},
      async send(message) {
        sentMessage = message;
        return {
          status: "finished",
          async *stream() {
            yield {
              type: "assistant",
              message: { content: [{ type: "text", text: "IMAGE_OK" }] },
            };
          },
          async wait() {
            return { status: "finished" };
          },
        };
      },
    }),
  });
  const response = await bridge.handle(
    {
      model: "claude-fable-5",
      messages: [{
        role: "user",
        content: [{
          type: "image",
          source: { type: "base64", media_type: "image/png", data: "aW1hZ2U=" },
        }],
      }],
    },
    "test-key",
  );
  assert.equal(response.content[0].text, "IMAGE_OK");
  assert.match(sentMessage.text, /IMAGE_ATTACHMENT/);
  assert.deepEqual(sentMessage.images, [{ data: "aW1hZ2U=", mimeType: "image/png" }]);
});

test("allows a tool-capable request to finish with text without a tool call", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: plainAgentFactory("NO_TOOL_NEEDED"),
    firstEventTimeoutMs: 1000,
  });
  const response = await bridge.handle(firstRequest(), "test-key");
  assert.equal(response.stop_reason, "end_turn");
  assert.equal(response.content[0].text, "NO_TOOL_NEEDED");
});

test("continues the same SDK run across multiple sequential tool turns", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: multiToolAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  assert.equal(first.content[0].id, "toolu_multi_1");

  const second = await bridge.handle(
    resumeRequest("toolu_multi_1", "ONE"),
    "test-key",
  );
  assert.equal(second.stop_reason, "tool_use");
  assert.equal(second.content[0].id, "toolu_multi_2");

  const thirdRequest = resumeRequest("toolu_multi_2", "TWO");
  thirdRequest.messages.unshift({
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "toolu_multi_1", content: "ONE" },
    ],
  });
  const third = await bridge.handle(thirdRequest, "test-key");
  assert.equal(third.stop_reason, "end_turn");
  assert.equal(third.content[0].text, "ONE:TWO");

  const replay = await bridge.handle(thirdRequest, "test-key");
  assert.deepEqual(replay, third);

  const conflicting = structuredClone(thirdRequest);
  conflicting.messages[1].content[0].content = "DIFFERENT";
  await assert.rejects(
    bridge.handle(conflicting, "test-key"),
    (error) => error.status === 409 && /conflicting duplicate/.test(error.message),
  );
});

test("keeps each sequential pre-tool text in its own tool-use turn", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: multiToolAgentFactory({ preambles: ["FIRST.", "SECOND."] }),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });

  const first = await bridge.handle(firstRequest(), "test-key");
  assert.deepEqual(first.content.map((block) => block.type), ["text", "tool_use"]);
  assert.equal(first.content[0].text, "FIRST.");

  const second = await bridge.handle(
    resumeRequest("toolu_multi_1", "ONE"),
    "test-key",
  );
  assert.deepEqual(second.content.map((block) => block.type), ["text", "tool_use"]);
  assert.equal(second.content[0].text, "SECOND.");

  const final = await bridge.handle(
    resumeRequest("toolu_multi_2", "TWO"),
    "test-key",
  );
  assert.deepEqual(final.content, [{ type: "text", text: "ONE:TWO" }]);
});

test("returns and resumes a complete parallel tool batch", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: parallelToolAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  assert.equal(first.stop_reason, "tool_use");
  assert.deepEqual(
    first.content.map((block) => block.id),
    ["toolu_parallel_alpha", "toolu_parallel_beta"],
  );

  await assert.rejects(
    bridge.handle(
      resumeBatchRequest([["toolu_parallel_alpha", "ALPHA"]]),
      "test-key",
    ),
    (error) => error.status === 409 && /exactly match/.test(error.message),
  );

  const final = await bridge.handle(
    resumeBatchRequest([
      ["toolu_parallel_alpha", "ALPHA"],
      ["toolu_parallel_beta", "BETA"],
    ]),
    "test-key",
  );
  assert.equal(final.stop_reason, "end_turn");
  assert.equal(final.content[0].text, "ALPHA:BETA");
});

test("returns one pre-tool text block before a parallel tool batch", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: parallelToolAgentFactory({ preamble: "BATCH." }),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  assert.deepEqual(first.content.map((block) => block.type), [
    "text",
    "tool_use",
    "tool_use",
  ]);
  assert.equal(first.content[0].text, "BATCH.");
});

test("passes Claude catalog ids through without hidden parameter overrides", () => {
  assert.deepEqual(cursorSdkModelSelection("claude-sonnet-4-6"), {
    id: "claude-sonnet-4-6",
  });
  assert.deepEqual(cursorSdkModelSelection("claude-fable-5"), {
    id: "claude-fable-5",
  });
});

test("maps Anthropic thinking controls to the official SDK effort parameter", () => {
  assert.deepEqual(
    cursorSdkModelSelection("claude-fable-5", {
      thinking: { type: "enabled", budget_tokens: 12000 },
    }),
    { id: "claude-fable-5", params: [{ id: "effort", value: "high" }] },
  );
  assert.deepEqual(
    cursorSdkModelSelection("claude-sonnet-4-6", {
      output_config: { effort: "low" },
    }),
    { id: "claude-sonnet-4-6", params: [{ id: "effort", value: "low" }] },
  );
});

test("maps Cursor Grok effort ids to official SDK model selections", () => {
  assert.deepEqual(cursorSdkModelSelection("cursor-grok-4.5-high"), {
    id: "grok-4.5",
    params: [{ id: "effort", value: "high" }],
  });
  assert.deepEqual(cursorSdkModelSelection("cursor-grok-4.6-xhigh"), {
    id: "grok-4.6",
    params: [{ id: "effort", value: "xhigh" }],
  });
});

test("serializes tool_choice any as at-least-one with independent parallel batching", async () => {
  let capturedPrompt = "";
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    firstEventTimeoutMs: 1000,
    agentFactory: async () => ({
      async send(prompt) {
        capturedPrompt = prompt;
        return {
          status: "completed",
          async *stream() {
            yield { type: "assistant", message: { content: [{ type: "text", text: "OK" }] } };
          },
          async wait() {
            return { status: "completed" };
          },
        };
      },
      close() {},
    }),
  });

  const response = await bridge.handle(
    {
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Use both tools." }],
      tools: [
        { name: "alpha", input_schema: { type: "object", properties: {} } },
        { name: "beta", input_schema: { type: "object", properties: {} } },
      ],
      tool_choice: { type: "any" },
    },
    "test-key",
  );
  assert.equal(response.content[0].text, "OK");
  assert.match(capturedPrompt, /at least one available custom MCP tool/);
  assert.match(capturedPrompt, /multiple independent tools/);
  assert.match(capturedPrompt, /call all of them together in the same turn/);
  assert.doesNotMatch(capturedPrompt, /call one of the available/);
});

test("serializes disabled parallel tool_choice any as exactly one tool", async () => {
  let capturedPrompt = "";
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    firstEventTimeoutMs: 1000,
    agentFactory: async () => ({
      async send(prompt) {
        capturedPrompt = prompt;
        return {
          status: "completed",
          async *stream() {
            yield { type: "assistant", message: { content: [{ type: "text", text: "OK" }] } };
          },
          async wait() {
            return { status: "completed" };
          },
        };
      },
      close() {},
    }),
  });

  const response = await bridge.handle(
    {
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: "Use a tool." }],
      tools: [
        { name: "alpha", input_schema: { type: "object", properties: {} } },
        { name: "beta", input_schema: { type: "object", properties: {} } },
      ],
      tool_choice: { type: "any", disable_parallel_tool_use: true },
    },
    "test-key",
  );
  assert.equal(response.content[0].text, "OK");
  assert.match(capturedPrompt, /exactly one available custom MCP tool/);
  assert.match(capturedPrompt, /Do not call tools in parallel/);
  assert.doesNotMatch(capturedPrompt, /multiple independent tools/);
});

test("starts a new run when old tool history is followed by ordinary user text", async () => {
  const prompts = [];
  let creates = 0;
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
    parallelCollectMs: 0,
    agentFactory: async (options) => {
      creates += 1;
      const factory = creates === 1 ? fakeAgentFactory() : plainAgentFactory("NEW_TURN_OK");
      const agent = await factory(options);
      const originalSend = agent.send.bind(agent);
      agent.send = async (prompt) => {
        prompts.push(prompt);
        return originalSend(prompt);
      };
      return agent;
    },
  });

  const first = await bridge.handle(firstRequest(), "test-key");
  const final = await bridge.handle(
    resumeRequest(first.content[0].id, "OLD_RESULT"),
    "test-key",
  );
  assert.equal(final.content[0].text, "OLD_RESULT");

  const next = await bridge.handle(
    {
      ...firstRequest(),
      messages: [
        { role: "user", content: "Use the tool." },
        { role: "assistant", content: first.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: first.content[0].id,
              content: "OLD_RESULT",
            },
          ],
        },
        { role: "assistant", content: final.content },
        { role: "user", content: "This is a fresh turn." },
      ],
    },
    "test-key",
  );
  assert.equal(next.content[0].text, "NEW_TURN_OK");
  assert.equal(creates, 2);
  assert.match(prompts[1], /TOOL_USE id=toolu_test_1/);
  assert.match(prompts[1], /TOOL_RESULT tool_use_id=toolu_test_1/);
  assert.match(prompts[1], /This is a fresh turn/);
});

test("rejects tool results mixed with new user instructions", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  const mixed = resumeRequest(first.content[0].id, "RESULT");
  mixed.messages[0].content.push({ type: "text", text: "also start another task" });
  await assert.rejects(
    bridge.handle(mixed, "test-key"),
    (error) => error.status === 422 && /separate turns/.test(error.message),
  );
  const final = await bridge.handle(
    resumeRequest(first.content[0].id, "RESULT"),
    "test-key",
  );
  assert.equal(final.content[0].text, "RESULT");
});

test("isolates concurrent runs that share one Cursor credential", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: concurrentToolAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
    parallelCollectMs: 0,
  });
  const [first, second] = await Promise.all([
    bridge.handle(firstRequest(), "shared-key"),
    bridge.handle(firstRequest(), "shared-key"),
  ]);
  assert.notEqual(first.content[0].id, second.content[0].id);
  const [firstFinal, secondFinal] = await Promise.all([
    bridge.handle(resumeRequest(first.content[0].id, "FIRST"), "shared-key"),
    bridge.handle(resumeRequest(second.content[0].id, "SECOND"), "shared-key"),
  ]);
  assert.equal(firstFinal.content[0].text, "FIRST");
  assert.equal(secondFinal.content[0].text, "SECOND");
});

test("client abort closes a run without blocking the next request", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: hangingAgentFactory(),
    firstEventTimeoutMs: 1000,
  });
  const firstAbort = new AbortController();
  const first = bridge.handle(
    { model: "composer-2.5", messages: [{ role: "user", content: "wait" }] },
    "test-key",
    { signal: firstAbort.signal },
  );
  setTimeout(() => firstAbort.abort(), 10);
  await assert.rejects(first, (error) => error.status === 499);

  const secondAbort = new AbortController();
  const second = bridge.handle(
    { model: "composer-2.5", messages: [{ role: "user", content: "wait again" }] },
    "test-key",
    { signal: secondAbort.signal },
  );
  setTimeout(() => secondAbort.abort(), 10);
  await assert.rejects(second, (error) => error.status === 499);
});

test("client abort while agent send is pending cancels the late SDK run", async () => {
  let cancelCount = 0;
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: delayedSendAgentFactory(() => {
      cancelCount += 1;
    }),
    firstEventTimeoutMs: 1000,
  });
  const controller = new AbortController();
  const request = bridge.handle(
    { model: "composer-2.5", messages: [{ role: "user", content: "wait" }] },
    "test-key",
    { signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(request, (error) => error.status === 499);
  assert.equal(cancelCount, 1);
});

test("client abort during tool-result continuation closes the parked run", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: hangingAfterToolResultAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  const controller = new AbortController();
  const resumed = bridge.handle(
    resumeRequest(first.content[0].id, "RESULT"),
    "test-key",
    { signal: controller.signal },
  );
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(resumed, (error) => error.status === 499);
});

test("fails closed for an unknown tool result id", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
  });
  await assert.rejects(
    bridge.handle(resumeRequest("toolu_missing", "x"), "test-key"),
    (error) => error.status === 409 && /unknown or expired/.test(error.message),
  );
});

test("binds tool result resume to the original Cursor credential", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "first-key");
  await assert.rejects(
    bridge.handle(resumeRequest(first.content[0].id, "x"), "different-key"),
    (error) => error.status === 409 && /credential changed/.test(error.message),
  );
});

test("binds tool result resume to the original gateway tenant", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "shared-key", {
    tenantId: "user:1:token:10:channel:61",
  });
  await assert.rejects(
    bridge.handle(resumeRequest(first.content[0].id, "x"), "shared-key", {
      tenantId: "user:2:token:11:channel:61",
    }),
    (error) => error.status === 409 && /tenant changed/.test(error.message),
  );
});

test("caps active sessions per Cursor credential", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: concurrentToolAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
    parallelCollectMs: 0,
    maxSessionsPerCredential: 1,
  });
  await bridge.handle(firstRequest(), "shared-key");
  await assert.rejects(
    bridge.handle(firstRequest(), "shared-key"),
    (error) => error.status === 429 && /credential session limit/.test(error.message),
  );
});

test("expires an idle awaiting-tool session and fails resume closed", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 20,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  await new Promise((resolve) => setTimeout(resolve, 50));
  await assert.rejects(
    bridge.handle(resumeRequest(first.content[0].id, "late"), "test-key"),
    (error) => error.status === 409 && /unknown or expired/.test(error.message),
  );
});

test("shutdown rejects and forgets unresolved harness sessions", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  await bridge.shutdown();
  await assert.rejects(
    bridge.handle(resumeRequest(first.content[0].id, "after-shutdown"), "test-key"),
    (error) => error.status === 409 && /unknown or expired/.test(error.message),
  );
});

test("drain rejects new sessions while allowing an existing tool continuation", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
    replayTtlMs: 20,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  assert.equal(bridge.beginDrain().drainSessions, 1);
  await assert.rejects(
    bridge.handle(firstRequest(), "test-key"),
    (error) => error.status === 503 && error.retryAfter === 2,
  );
  const final = await bridge.handle(
    resumeRequest(first.content[0].id, "DRAIN_OK"),
    "test-key",
  );
  assert.equal(final.content[0].text, "DRAIN_OK");
  assert.equal(await bridge.waitForDrain(200), true);
  assert.equal(bridge.status().drainSessions, 0);
});

test("cold-recovers a persisted tool result through Agent.resume and force send", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cursor-bridge-recovery-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const state = new CursorHarnessSessionState(join(root, "sessions.json"));
  const sdkStore = {};
  const firstBridge = new CursorHarnessMessagesBridge({
    workspace: root,
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 10_000,
    instanceId: "blue",
    sdkStore,
    sessionState: state,
  });
  const first = await firstBridge.handle(firstRequest(), "test-key");
  const toolUseId = first.content[0].id;
  assert.deepEqual(state.counts(), { awaiting: 1, replay: 0, total: 1 });

  let resumedAgentId = "";
  let resumeCount = 0;
  let recoveryPrompt = "";
  let forced = false;
  const recoveredBridge = new CursorHarnessMessagesBridge({
    workspace: root,
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
    replayTtlMs: 1000,
    instanceId: "blue",
    sdkStore,
    sessionState: new CursorHarnessSessionState(join(root, "sessions.json")),
    agentResumer: async (agentId) => {
      resumeCount += 1;
      resumedAgentId = agentId;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        agentId,
        close() {},
        async send(prompt, options) {
          recoveryPrompt = prompt;
          forced = options.local.force;
          return {
            id: "run-recovered",
            status: "running",
            async *stream() {
              yield {
                type: "assistant",
                message: { content: [{ type: "text", text: "RECOVERED_OK" }] },
              };
              this.status = "finished";
            },
            async wait() {
              return { status: "finished" };
            },
            async cancel() {},
          };
        },
      };
    },
  });
  const recoveredRequest = resumeRequest(toolUseId, "RECOVERED_RESULT");
  recoveredRequest.tools = firstRequest().tools;
  const [recovered, concurrentReplay] = await Promise.all([
    recoveredBridge.handle(recoveredRequest, "test-key"),
    recoveredBridge.handle(structuredClone(recoveredRequest), "test-key"),
  ]);
  assert.equal(recovered.content[0].text, "RECOVERED_OK");
  assert.deepEqual(concurrentReplay, recovered);
  assert.equal(resumeCount, 1);
  assert.equal(resumedAgentId, "agent-test");
  assert.equal(forced, true);
  assert.match(recoveryPrompt, /RECOVERED_RESULT/);
  assert.match(recoveryPrompt, /Do not repeat the completed tool calls/);

  const replay = await recoveredBridge.handle(recoveredRequest, "test-key");
  assert.deepEqual(replay, recovered);
  const conflicting = structuredClone(recoveredRequest);
  conflicting.messages[0].content[0].content = "DIFFERENT";
  await assert.rejects(
    recoveredBridge.handle(conflicting, "test-key"),
    (error) => error.status === 409 && /conflicting duplicate persisted/.test(error.message),
  );
});

test("preserves a persisted checkpoint after a transient cold-recovery failure", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cursor-bridge-retry-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const stateFile = join(root, "sessions.json");
  const state = new CursorHarnessSessionState(stateFile);
  const sdkStore = {};
  const firstBridge = new CursorHarnessMessagesBridge({
    workspace: root,
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 10_000,
    instanceId: "blue",
    sdkStore,
    sessionState: state,
  });
  const first = await firstBridge.handle(firstRequest(), "test-key");
  const recoveredRequest = resumeRequest(first.content[0].id, "RETRY_RESULT");
  recoveredRequest.tools = firstRequest().tools;
  let attempts = 0;
  const recoveredState = new CursorHarnessSessionState(stateFile);
  const bridge = new CursorHarnessMessagesBridge({
    workspace: root,
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 10_000,
    instanceId: "blue",
    sdkStore,
    sessionState: recoveredState,
    agentResumer: async (agentId) => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary SDK outage");
      return {
        agentId,
        close() {},
        async send() {
          return {
            id: "run-retry",
            status: "running",
            async *stream() {
              yield {
                type: "assistant",
                message: { content: [{ type: "text", text: "RETRY_OK" }] },
              };
              this.status = "finished";
            },
            async wait() { return { status: "finished" }; },
            async cancel() {},
          };
        },
      };
    },
  });
  await assert.rejects(
    bridge.handle(recoveredRequest, "test-key"),
    (error) => error.status === 502 && /temporary SDK outage/.test(error.message),
  );
  assert.deepEqual(recoveredState.counts(), { awaiting: 1, replay: 0, total: 1 });
  const recovered = await bridge.handle(recoveredRequest, "test-key");
  assert.equal(recovered.content[0].text, "RETRY_OK");
  assert.equal(attempts, 2);
});

test("cleanup failure cannot leave a closed session blocking drain", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory(),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
    sdkStore: { runs: { async list() { throw new Error("cleanup failed"); } } },
  });
  await bridge.handle(firstRequest(), "test-key");
  await bridge.shutdown();
  assert.equal(bridge.status().drainSessions, 0);
});

test("fails closed when the harness finishes without semantic output", async () => {
  const bridge = new CursorHarnessMessagesBridge({
    workspace: process.cwd(),
    agentFactory: fakeAgentFactory({ emptyFinal: true }),
    firstEventTimeoutMs: 1000,
    sessionTtlMs: 1000,
  });
  const first = await bridge.handle(firstRequest(), "test-key");
  await assert.rejects(
    bridge.handle(resumeRequest(first.content[0].id, "x"), "test-key"),
    (error) => error.status === 502 && /empty final turn/.test(error.message),
  );
});
