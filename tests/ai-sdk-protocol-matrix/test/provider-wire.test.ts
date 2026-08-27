import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { runGeneration } from "../src/generation.js"
import { createModelRuntime } from "../src/providers.js"
import { TraceRecorder } from "../src/trace-recorder.js"
import type { MatrixConfig, SourceFormat, TargetSpec } from "../src/types.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

function errorResponse(url: string): Response {
  if (url.includes("/messages")) {
    return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "stop" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }
  if (url.includes("/v1beta/")) {
    return new Response(JSON.stringify({ error: { code: 400, message: "stop", status: "INVALID_ARGUMENT" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }
  return new Response(JSON.stringify({ error: { message: "stop", type: "test_error" } }), {
    status: 400,
    headers: { "content-type": "application/json" },
  })
}

describe("provider wire routing", () => {
  const cases: Array<{ source: SourceFormat; expectedPath: string }> = [
    { source: "chat", expectedPath: "/v1/chat/completions" },
    { source: "responses", expectedPath: "/v1/responses" },
    { source: "claude", expectedPath: "/v1/messages" },
    { source: "gemini", expectedPath: "/v1beta/models/gemini-3.7-flash:streamGenerateContent" },
  ]

  it("uses provider defaults when the app-level output limit is disabled", async () => {
    for (const testCase of cases) {
      const directory = await mkdtemp(path.join(os.tmpdir(), `ai-sdk-provider-default-${testCase.source}-`))
      temporaryDirectories.push(directory)
      vi.stubGlobal(
        "fetch",
        vi.fn(async (request: Request) => errorResponse(request.url)),
      )
      const config: MatrixConfig = {
        apiKey: "sk-local-test",
        baseUrl: "https://newapi.example",
        outputRoot: directory,
        runId: "provider-default-test",
        timeoutMs: 5_000,
        sourceFormats: [testCase.source],
        targets: [],
        scenarios: [],
        confirmLive: false,
        dryRun: true,
      }
      const target: TargetSpec = { format: "gemini", model: "gemini-3.7-flash" }
      const recorder = new TraceRecorder(directory, config.apiKey)
      const runtime = createModelRuntime(testCase.source, target, config, recorder.fetch)

      await runGeneration(recorder, config, {
        source: testCase.source,
        relativeCellDirectory: "cell",
        operationName: "provider-default",
        model: runtime.model,
        providerOptions: runtime.providerOptions,
        messages: [{ role: "user", content: "hello" }],
      })

      const metadata = JSON.parse(
        await readFile(path.join(directory, "cell", "provider-default", "http-001.request.json"), "utf8"),
      ) as { parsedBody: Record<string, unknown> }
      switch (testCase.source) {
        case "chat":
          expect(metadata.parsedBody).not.toHaveProperty("max_tokens")
          break
        case "responses":
          expect(metadata.parsedBody).not.toHaveProperty("max_output_tokens")
          break
        case "claude":
          // Anthropic Messages requires max_tokens. The provider chooses 4096
          // output tokens plus the configured 1024-token thinking budget.
          expect(metadata.parsedBody).toHaveProperty("max_tokens", 5120)
          break
        case "gemini":
          expect(metadata.parsedBody).not.toHaveProperty("generationConfig.maxOutputTokens")
          break
      }
    }
  })

  for (const testCase of cases) {
    it(`uses the ${testCase.source} native client endpoint`, async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), `ai-sdk-${testCase.source}-`))
      temporaryDirectories.push(directory)
      vi.stubGlobal(
        "fetch",
        vi.fn(async (request: Request) => errorResponse(request.url)),
      )
      const config: MatrixConfig = {
        apiKey: "sk-local-test",
        baseUrl: "https://newapi.example",
        outputRoot: directory,
        runId: "wire-test",
        timeoutMs: 5_000,
        maxOutputTokens: 256,
        sourceFormats: [testCase.source],
        targets: [],
        scenarios: [],
        confirmLive: false,
        dryRun: true,
      }
      const target: TargetSpec = { format: "gemini", model: "gemini-3.7-flash" }
      const recorder = new TraceRecorder(directory, config.apiKey)
      const runtime = createModelRuntime(testCase.source, target, config, recorder.fetch)

      const outcome = await runGeneration(recorder, config, {
        source: testCase.source,
        relativeCellDirectory: "cell",
        operationName: "wire",
        model: runtime.model,
        providerOptions: runtime.providerOptions,
        messages: [{ role: "user", content: "hello" }],
      })

      expect(outcome.trace.exchangeCount).toBe(1)
      const metadata = JSON.parse(await readFile(path.join(directory, "cell", "wire", "http-001.request.json"), "utf8")) as {
        url: string
        parsedBody: Record<string, unknown>
      }
      expect(new URL(metadata.url).pathname).toBe(testCase.expectedPath)
      expect(metadata.parsedBody).toBeTypeOf("object")
      switch (testCase.source) {
        case "chat":
          expect(metadata.parsedBody).toMatchObject({
            model: "gemini-3.7-flash",
            stream: true,
            max_tokens: 256,
            reasoning_effort: "high",
          })
          break
        case "responses":
          expect(metadata.parsedBody).toMatchObject({
            model: "gemini-3.7-flash",
            stream: true,
            store: false,
            max_output_tokens: 256,
            reasoning: { effort: "high", summary: "auto" },
          })
          break
        case "claude":
          expect(metadata.parsedBody).toMatchObject({
            model: "gemini-3.7-flash",
            stream: true,
            max_tokens: 1280,
            thinking: { type: "enabled", budget_tokens: 1024 },
          })
          break
        case "gemini":
          expect(metadata.parsedBody).toMatchObject({
            generationConfig: {
              maxOutputTokens: 256,
              thinkingConfig: { includeThoughts: true, thinkingLevel: "high" },
            },
          })
          break
      }
    })
  }
})
