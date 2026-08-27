import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TraceRecorder } from "../src/trace-recorder.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("TraceRecorder", () => {
  it("records complete bodies while redacting credentials", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ai-sdk-matrix-"))
    temporaryDirectories.push(directory)
    const apiKey = "sk-test-super-secret"
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response('data: {"type":"text-delta","delta":"ok"}\n\ndata: [DONE]\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    )
    const recorder = new TraceRecorder(directory, apiKey)

    const execution = await recorder.withOperation("cells/chat-to-gemini", "turn", async () => {
      const response = await recorder.fetch("https://example.test/v1/chat/completions?key=" + apiKey, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: "gemini", prompt: `contains ${apiKey}` }),
      })
      return response.text()
    })

    expect(execution.trace.exchangeCount).toBe(1)
    const operation = path.join(directory, "cells", "chat-to-gemini", "turn")
    const requestMetadata = await readFile(path.join(operation, "http-001.request.json"), "utf8")
    const requestBody = await readFile(path.join(operation, "http-001.request.body.txt"), "utf8")
    const responseBody = await readFile(path.join(operation, "http-001.response.body.txt"), "utf8")

    expect(requestMetadata).not.toContain(apiKey)
    expect(requestMetadata).toContain("[REDACTED]")
    expect(requestBody).not.toContain(apiKey)
    expect(responseBody).toContain("text-delta")
  })
})
