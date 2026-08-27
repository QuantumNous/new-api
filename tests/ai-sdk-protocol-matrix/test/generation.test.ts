import { describe, expect, it } from "vitest"
import { settleWithin } from "../src/generation.js"

describe("AI SDK result finalization", () => {
  it("records a deterministic error when an AI SDK result promise never settles", async () => {
    const never = new Promise<string>(() => undefined)

    const result = await settleWithin(never, "response", 5)

    expect(result.status).toBe("rejected")
    if (result.status === "fulfilled") throw new Error("expected timeout rejection")
    expect(result.reason).toMatchObject({
      name: "AISDKResultTimeoutError",
      message: expect.stringContaining('result promise "response" did not settle'),
    })
  })

  it("preserves fulfilled values", async () => {
    await expect(settleWithin(Promise.resolve("ok"), "text", 50)).resolves.toEqual({
      status: "fulfilled",
      value: "ok",
    })
  })
})
