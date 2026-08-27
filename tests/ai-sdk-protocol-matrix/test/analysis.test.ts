import { describe, expect, it } from "vitest"
import { diagnoseToolCallId, evaluatePuzzleAnswer, scenarioStatus, transportCheck } from "../src/analysis.js"
import type { GenerationOutcome } from "../src/types.js"

const correctAnswer =
  "逐笔算完后双方现金净额都是0。不过停车费没有真正支付，司机获得了价值40的停车服务，所以司机获益40，停车场一方损失40。"

describe("matrix result analysis", () => {
  it("recognizes the parking puzzle's cash and economic conclusions", () => {
    expect(evaluatePuzzleAnswer(correctAnswer)).toEqual({
      economicConclusion: true,
      cashLedgerNuance: true,
    })
  })

  it("diagnoses portable and malformed tool call IDs", () => {
    expect(diagnoseToolCallId("call_ABC-123")).toMatchObject({
      nonEmpty: true,
      hasControlOrWhitespace: false,
      portable: true,
    })
    expect(diagnoseToolCallId("call bad\n")).toMatchObject({
      nonEmpty: true,
      hasControlOrWhitespace: true,
      portable: false,
    })
  })

  it("classifies gateway capability errors separately from transport failures", () => {
    const outcome = {
      ok: false,
      text: "",
      reasoningPresent: false,
      responseMessages: [],
      streamEvents: [],
      onErrorEvents: [],
      settled: {
        result: {
          status: "rejected",
          reason: { code: "capability_unsupported", message: "PDF is not supported" },
        },
      },
      toolCalls: [],
      toolResults: [],
      trace: { relativeDirectory: "cell/file", exchangeCount: 1 },
    } satisfies GenerationOutcome

    expect(transportCheck("file-upload-pdf", outcome).status).toBe("capability_unsupported")
  })

  it("uses failure-first scenario aggregation", () => {
    expect(
      scenarioStatus([
        { id: "a", status: "pass", category: "model", message: "ok" },
        { id: "b", status: "warn", category: "reasoning", message: "warning" },
      ]),
    ).toBe("warn")
    expect(
      scenarioStatus([
        { id: "a", status: "unsupported", category: "sdk", message: "unsupported" },
        { id: "b", status: "fail", category: "transport", message: "failed" },
      ]),
    ).toBe("fail")
    expect(
      scenarioStatus([
        { id: "a", status: "capability_unsupported", category: "conversion", message: "known boundary" },
      ]),
    ).toBe("capability_unsupported")
  })
})
