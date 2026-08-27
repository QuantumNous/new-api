import type { ModelMessage } from "ai"
import { describe, expect, it } from "vitest"
import { prepareMessagesForSource } from "../src/providers.js"

describe("OpenCode-compatible history preparation", () => {
  it("strips OpenAI Responses item IDs but preserves encrypted reasoning state", () => {
    const messages: ModelMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "reasoning",
            text: "summary",
            providerOptions: {
              openai: {
                itemId: "rs_123",
                reasoningEncryptedContent: "encrypted-state",
              },
            },
          },
          {
            type: "text",
            text: "answer",
            providerOptions: {
              openai: {
                itemId: "msg_123",
              },
            },
          },
        ],
      },
    ]

    const [prepared] = prepareMessagesForSource(messages, "responses")
    expect(prepared?.role).toBe("assistant")
    if (prepared?.role !== "assistant" || typeof prepared.content === "string") throw new Error("unexpected message")
    const reasoning = prepared.content[0]
    const text = prepared.content[1]
    if (reasoning?.type !== "reasoning" || text?.type !== "text") throw new Error("unexpected content parts")
    expect(reasoning.providerOptions?.openai).toEqual({
      reasoningEncryptedContent: "encrypted-state",
    })
    expect(text.providerOptions?.openai).toEqual({})
  })

  it("removes empty Anthropic assistant content without signatures", () => {
    const messages: ModelMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "" },
          { type: "reasoning", text: "" },
        ],
      },
      { role: "user", content: "continue" },
    ]

    expect(prepareMessagesForSource(messages, "claude")).toEqual([{ role: "user", content: "continue" }])
  })
})
