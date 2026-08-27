import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { stepCountIs, tool, type ModelMessage, type ToolSet } from "ai"
import { z } from "zod"
import {
  check,
  containsExact,
  diagnoseToolCallId,
  evaluatePuzzleAnswer,
  scenarioStatus,
  transportCheck,
} from "./analysis.js"
import { runGeneration } from "./generation.js"
import type { ModelRuntime } from "./providers.js"
import type {
  CheckResult,
  GenerationOutcome,
  MatrixConfig,
  ScenarioName,
  ScenarioResult,
  SourceFormat,
  TargetSpec,
} from "./types.js"
import type { TraceRecorder } from "./trace-recorder.js"
import { nowIso } from "./util.js"

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PUZZLE =
  "去一个小区停车停车费40我给了保安100，他找了我60。但我现在觉得我有零钱了我就给了他40，他就把那100还给了我。之后他仔细算了一下说我玩他套路他说他亏了20叫我补还给他，我同意了就掏了20给他，事情就了了他就放我走了。我俩谁亏谁赚？"

interface ScenarioContext {
  recorder: TraceRecorder
  config: MatrixConfig
  source: SourceFormat
  target: TargetSpec
  runtime: ModelRuntime
  relativeCellDirectory: string
}

function appendResponse(history: ModelMessage[], outcome: GenerationOutcome): void {
  history.push(...outcome.responseMessages)
}

function createScenarioResult(
  name: ScenarioName,
  startedAt: string,
  checks: CheckResult[],
  operations: ScenarioResult["operations"],
): ScenarioResult {
  return {
    name,
    status: scenarioStatus(checks),
    checks,
    operations,
    startedAt,
    finishedAt: nowIso(),
  }
}

function generationSettings(context: ScenarioContext) {
  return {
    model: context.runtime.model,
    providerOptions: context.runtime.providerOptions,
    ...(context.runtime.temperature === undefined ? {} : { temperature: context.runtime.temperature }),
    ...(context.runtime.topP === undefined ? {} : { topP: context.runtime.topP }),
    ...(context.runtime.topK === undefined ? {} : { topK: context.runtime.topK }),
  }
}

export async function runConversationScenario(context: ScenarioContext): Promise<ScenarioResult> {
  const startedAt = nowIso()
  const checks: CheckResult[] = []
  const operations: ScenarioResult["operations"] = []
  const marker = `CTX_${context.source.toUpperCase()}_TO_${context.target.format.toUpperCase()}_7319`
  const receipt = `TOOL_RECEIPT_${context.source.toUpperCase()}_${context.target.format.toUpperCase()}_8842`
  const history: ModelMessage[] = [
    {
      role: "system",
      content:
        "你是协议转换回归测试中的助手。严格保留上下文中的标记、工具结果和数值。不要声称展示私有思维链；如果接口允许，可返回供应商公开的 reasoning summary/thought。",
    },
  ]

  const seedOperation = "turn-01-context-seed"
  const seedUserMessage: ModelMessage = {
    role: "user",
    content: `请记住以下会话事实，后续我会检查：CONTEXT_MARKER=${marker}；PROJECT=CEDAR；CHECKSUM=7319。现在只回复 ACK 和完整 CONTEXT_MARKER。`,
  }
  const seedOutcome = await runGeneration(context.recorder, context.config, {
    source: context.source,
    relativeCellDirectory: path.join(context.relativeCellDirectory, "conversation"),
    operationName: seedOperation,
    ...generationSettings(context),
    messages: [...history, seedUserMessage],
  })
  operations.push({ name: seedOperation, outcome: seedOutcome })
  checks.push(transportCheck(seedOperation, seedOutcome))
  if (!seedOutcome.ok) return createScenarioResult("conversation", startedAt, checks, operations)
  checks.push(
    check(
      "conversation.seed-marker",
      containsExact(seedOutcome.text, marker) ? "pass" : "fail",
      "context",
      containsExact(seedOutcome.text, marker) ? "Initial context marker was acknowledged" : "Initial context marker was not echoed",
      { expected: marker, text: seedOutcome.text },
    ),
  )
  history.push(seedUserMessage)
  appendResponse(history, seedOutcome)

  const puzzleOperation = "turn-02-reasoning-puzzle"
  const puzzleUserMessage: ModelMessage = {
    role: "user",
    content: `${PUZZLE}\n\n请逐笔核对现金流，在最终答案中区分“现金净额”和“停车服务/停车费的经济结果”，并在末尾原样写出 ${marker}。`,
  }
  const puzzleOutcome = await runGeneration(context.recorder, context.config, {
    source: context.source,
    relativeCellDirectory: path.join(context.relativeCellDirectory, "conversation"),
    operationName: puzzleOperation,
    ...generationSettings(context),
    messages: [...history, puzzleUserMessage],
  })
  operations.push({ name: puzzleOperation, outcome: puzzleOutcome })
  checks.push(transportCheck(puzzleOperation, puzzleOutcome))
  if (!puzzleOutcome.ok) return createScenarioResult("conversation", startedAt, checks, operations)
  checks.push(
    check(
      "conversation.reasoning-visible",
      puzzleOutcome.reasoningPresent ? "pass" : "warn",
      "reasoning",
      puzzleOutcome.reasoningPresent
        ? "AI SDK exposed reasoning/thought content for the complex puzzle"
        : "No provider-exposed reasoning summary/thought was visible; this does not prove that the model did not reason internally",
      { reasoningText: puzzleOutcome.reasoningText },
    ),
  )
  checks.push(
    check(
      "conversation.puzzle-context",
      containsExact(puzzleOutcome.text, marker) ? "pass" : "fail",
      "context",
      containsExact(puzzleOutcome.text, marker)
        ? "The second turn retained the seeded context marker"
        : "The second turn lost the seeded context marker",
      { expected: marker, text: puzzleOutcome.text },
    ),
  )
  const puzzle = evaluatePuzzleAnswer(puzzleOutcome.text)
  checks.push(
    check(
      "conversation.puzzle-economic-result",
      puzzle.economicConclusion ? "pass" : "fail",
      "model",
      puzzle.economicConclusion
        ? "The answer recognized that the driver received an unpaid 40-unit parking service and the parking side lost that revenue"
        : "The answer did not clearly identify the 40-unit unpaid parking-service result",
      { evaluation: puzzle, text: puzzleOutcome.text },
    ),
  )
  checks.push(
    check(
      "conversation.puzzle-cash-ledger",
      puzzle.cashLedgerNuance ? "pass" : "warn",
      "model",
      puzzle.cashLedgerNuance
        ? "The answer also distinguished the final zero cash-transfer balance"
        : "The answer did not clearly state the final zero cash-transfer balance",
      { evaluation: puzzle, text: puzzleOutcome.text },
    ),
  )
  history.push(puzzleUserMessage)
  appendResponse(history, puzzleOutcome)

  const expectedTransactions = [
    { from: "driver", to: "guard", amount: 100, note: "initial payment" },
    { from: "guard", to: "driver", amount: 60, note: "first change" },
    { from: "driver", to: "guard", amount: 40, note: "second payment" },
    { from: "guard", to: "driver", amount: 100, note: "returned banknote" },
    { from: "driver", to: "guard", amount: 20, note: "final compensation" },
  ] as const
  const toolExecutions: Array<{ input: unknown; toolCallId: string; output: unknown }> = []
  const ledgerInput = z.object({
    parkingFee: z.number().int().positive(),
    contextMarker: z.string().min(1),
    receiptRequest: z.string().min(1),
    transactions: z
      .array(
        z.object({
          from: z.enum(["driver", "guard"]),
          to: z.enum(["driver", "guard"]),
          amount: z.number().int().positive(),
          note: z.string().min(1),
        }),
      )
      .length(5),
  })
  const tools = {
    analyze_parking_ledger: tool({
      description:
        "Validate the five parking-cash transactions and return the final cash balance, unpaid fee, economic winner/loser, and a receipt token.",
      inputSchema: ledgerInput,
      execute: async (input, options) => {
        const transactionMatch =
          input.transactions.length === expectedTransactions.length &&
          input.transactions.every((transaction, index) => {
            const expected = expectedTransactions[index]
            return (
              expected !== undefined &&
              transaction.from === expected.from &&
              transaction.to === expected.to &&
              transaction.amount === expected.amount &&
              transaction.note === expected.note
            )
          })
        let driverNet = 0
        let guardNet = 0
        for (const transaction of input.transactions) {
          const amount = transaction.amount
          if (transaction.from === "driver") driverNet -= amount
          if (transaction.from === "guard") guardNet -= amount
          if (transaction.to === "driver") driverNet += amount
          if (transaction.to === "guard") guardNet += amount
        }
        const output = {
          receipt,
          inputValid:
            transactionMatch &&
            input.parkingFee === 40 &&
            input.contextMarker === marker &&
            input.receiptRequest === receipt,
          driverCashNet: driverNet,
          guardCashNet: guardNet,
          parkingFeePaid: guardNet,
          unpaidParkingFee: input.parkingFee - guardNet,
          economicWinner: "driver gains parking service worth 40",
          economicLoser: "parking side loses parking revenue worth 40",
        }
        toolExecutions.push({ input, toolCallId: options.toolCallId, output })
        return output
      },
    }),
  } satisfies ToolSet

  const toolOperation = "turn-03-streaming-tool-lifecycle"
  const toolUserMessage: ModelMessage = {
    role: "user",
    content: `必须先且只调用一次 analyze_parking_ledger，不能心算。参数必须逐字采用：parkingFee=40，contextMarker=${marker}，receiptRequest=${receipt}，transactions=${JSON.stringify(expectedTransactions)}。工具返回后，用两句话总结并原样包含 receipt。`,
  }
  const toolOutcome = await runGeneration(context.recorder, context.config, {
    source: context.source,
    relativeCellDirectory: path.join(context.relativeCellDirectory, "conversation"),
    operationName: toolOperation,
    ...generationSettings(context),
    messages: [...history, toolUserMessage],
    tools,
    prepareStep: ({ stepNumber }) => ({
      toolChoice: stepNumber === 0 ? "auto" : "none",
    }),
    stopWhen: stepCountIs(2),
  })
  operations.push({ name: toolOperation, outcome: toolOutcome })
  checks.push(transportCheck(toolOperation, toolOutcome))
  if (!toolOutcome.ok) return createScenarioResult("conversation", startedAt, checks, operations)
  checks.push(
    check(
      "conversation.tool-execution-count",
      toolExecutions.length === 1 ? "pass" : "fail",
      "tool",
      toolExecutions.length === 1
        ? "The tool executed exactly once"
        : `Expected exactly one tool execution, observed ${toolExecutions.length}`,
      { executions: toolExecutions, sdkToolCalls: toolOutcome.toolCalls },
    ),
  )
  const execution = toolExecutions[0]
  const outputValid =
    execution !== undefined &&
    typeof execution.output === "object" &&
    execution.output !== null &&
    (execution.output as Record<string, unknown>).inputValid === true
  checks.push(
    check(
      "conversation.tool-input",
      outputValid ? "pass" : "fail",
      "tool",
      outputValid ? "The streamed tool arguments survived conversion intact" : "The tool arguments were missing, duplicated, or changed",
      execution,
    ),
  )
  const idDiagnostic = diagnoseToolCallId(execution?.toolCallId)
  checks.push(
    check(
      "conversation.tool-call-id",
      idDiagnostic.nonEmpty && !idDiagnostic.hasControlOrWhitespace ? "pass" : "fail",
      "tool",
      idDiagnostic.nonEmpty && !idDiagnostic.hasControlOrWhitespace
        ? "The replayed tool call ID was non-empty and free of whitespace/control characters"
        : "The tool call ID was missing or structurally unsafe",
      idDiagnostic,
    ),
  )
  if (idDiagnostic.nonEmpty && !idDiagnostic.portable) {
    checks.push(
      check(
        "conversation.tool-call-id-portability",
        "warn",
        "tool",
        "The tool call ID contains characters outside the conservative [A-Za-z0-9_-] portability set",
        idDiagnostic,
      ),
    )
  }
  checks.push(
    check(
      "conversation.tool-result-visible",
      containsExact(toolOutcome.text, receipt) ? "pass" : "fail",
      "tool",
      containsExact(toolOutcome.text, receipt)
        ? "The post-tool model step received and repeated the tool receipt"
        : "The post-tool model step did not receive or repeat the tool receipt",
      { expected: receipt, text: toolOutcome.text },
    ),
  )
  history.push(toolUserMessage)
  appendResponse(history, toolOutcome)

  const recallOperation = "turn-04-context-recall"
  const recallOutcome = await runGeneration(context.recorder, context.config, {
    source: context.source,
    relativeCellDirectory: path.join(context.relativeCellDirectory, "conversation"),
    operationName: recallOperation,
    ...generationSettings(context),
    messages: [
      ...history,
      {
        role: "user",
        content: `不再调用工具。请从整个会话历史中同时给出：(1) CONTEXT_MARKER；(2) 工具 receipt；(3) 停车题最终谁在经济上获益/损失以及金额。必须包含 ${marker} 和 ${receipt}。`,
      },
    ],
    tools,
    prepareStep: () => ({ toolChoice: "none" }),
  })
  operations.push({ name: recallOperation, outcome: recallOutcome })
  checks.push(transportCheck(recallOperation, recallOutcome))
  if (recallOutcome.ok) {
    checks.push(
      check(
        "conversation.final-marker-recall",
        containsExact(recallOutcome.text, marker) ? "pass" : "fail",
        "context",
        containsExact(recallOutcome.text, marker) ? "Final turn retained the original marker" : "Final turn lost the original marker",
        { expected: marker, text: recallOutcome.text },
      ),
    )
    checks.push(
      check(
        "conversation.final-tool-recall",
        containsExact(recallOutcome.text, receipt) ? "pass" : "fail",
        "context",
        containsExact(recallOutcome.text, receipt)
          ? "Final turn retained the tool result across turns"
          : "Final turn lost the tool result across turns",
        { expected: receipt, text: recallOutcome.text },
      ),
    )
    const recallPuzzle = evaluatePuzzleAnswer(recallOutcome.text)
    checks.push(
      check(
        "conversation.final-puzzle-recall",
        recallPuzzle.economicConclusion ? "pass" : "fail",
        "context",
        recallPuzzle.economicConclusion
          ? "Final turn retained the puzzle conclusion"
          : "Final turn lost or changed the puzzle conclusion",
        { evaluation: recallPuzzle, text: recallOutcome.text },
      ),
    )
  }

  return createScenarioResult("conversation", startedAt, checks, operations)
}

export async function runFileScenario(context: ScenarioContext): Promise<ScenarioResult> {
  const startedAt = nowIso()
  const checks: CheckResult[] = []
  const operations: ScenarioResult["operations"] = []
  const operationName = "file-upload-pdf"
  const pdf = await readFile(path.join(PACKAGE_ROOT, "fixtures", "matrix-document.pdf"))
  const outcome = await runGeneration(context.recorder, context.config, {
    source: context.source,
    relativeCellDirectory: path.join(context.relativeCellDirectory, "file"),
    operationName,
    ...generationSettings(context),
    messages: [
      {
        role: "system",
        content: "Read attached documents exactly. Do not guess missing fields.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "读取附件并原样返回 FILE_TOKEN、ROW_TOTAL、OWNER 三个字段。不要改写值。",
          },
          {
            type: "file",
            data: pdf,
            mediaType: "application/pdf",
            filename: "matrix-document.pdf",
          },
        ],
      },
    ],
  })
  operations.push({ name: operationName, outcome })
  const transport = transportCheck(operationName, outcome)
  checks.push(transport)
  if (outcome.ok) {
    for (const [id, expected] of [
      ["file-token", "CEDAR-48291"],
      ["row-total", "137"],
      ["owner", "SHUANGHUA"],
    ] as const) {
      checks.push(
        check(
          `file.${id}`,
          containsExact(outcome.text, expected) ? "pass" : "fail",
          "file",
          containsExact(outcome.text, expected)
            ? `The uploaded PDF field ${expected} was read correctly`
            : `The uploaded PDF field ${expected} was missing or altered`,
          { expected, text: outcome.text },
        ),
      )
    }
  }
  return createScenarioResult("file", startedAt, checks, operations)
}

export async function runImageScenario(context: ScenarioContext): Promise<ScenarioResult> {
  const startedAt = nowIso()
  const checks: CheckResult[] = []
  const operations: ScenarioResult["operations"] = []
  const operationName = "image-upload-png"
  const image = await readFile(path.join(PACKAGE_ROOT, "fixtures", "matrix-vision.png"))
  const outcome = await runGeneration(context.recorder, context.config, {
    source: context.source,
    relativeCellDirectory: path.join(context.relativeCellDirectory, "image"),
    operationName,
    ...generationSettings(context),
    messages: [
      {
        role: "system",
        content: "Inspect the attached image carefully and return exact visible values.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "识别图片顶部代码，并数出橙色圆形和蓝色方形的数量。回答必须包含代码、orange_circles=3、blue_squares=2。",
          },
          {
            type: "image",
            image,
            mediaType: "image/png",
          },
        ],
      },
    ],
  })
  operations.push({ name: operationName, outcome })
  checks.push(transportCheck(operationName, outcome))
  if (outcome.ok) {
    const countText = outcome.text.replace(/IMG-ORANGE-7391/gi, "")
    const expectations = [
      {
        id: "code",
        matched: containsExact(outcome.text, "IMG-ORANGE-7391"),
        expectation: "IMG-ORANGE-7391",
      },
      {
        id: "orange-circles",
        matched:
          /(?:orange.{0,20}(?:circle|circles).{0,20}(?:3|three)|(?:3|three).{0,20}orange.{0,20}(?:circle|circles)|橙色.{0,20}(?:圆形|圆).{0,20}(?:3|三)|(?:3|三).{0,20}橙色.{0,20}(?:圆形|圆))/i.test(
            countText,
          ),
        expectation: "3 orange circles",
      },
      {
        id: "blue-squares",
        matched:
          /(?:blue.{0,20}(?:square|squares).{0,20}(?:2|two)|(?:2|two).{0,20}blue.{0,20}(?:square|squares)|蓝色.{0,20}(?:方形|正方形).{0,20}(?:2|二|两)|(?:2|二|两).{0,20}蓝色.{0,20}(?:方形|正方形))/i.test(
            countText,
          ),
        expectation: "2 blue squares",
      },
    ]
    for (const expectation of expectations) {
      checks.push(
        check(
          `image.${expectation.id}`,
          expectation.matched ? "pass" : "fail",
          "image",
          expectation.matched ? `Image assertion ${expectation.id} passed` : `Image assertion ${expectation.id} failed`,
          { expectation: expectation.expectation, text: outcome.text },
        ),
      )
    }
  }
  return createScenarioResult("image", startedAt, checks, operations)
}
