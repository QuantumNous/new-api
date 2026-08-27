import path from "node:path"
import {
  streamText,
  type LanguageModel,
  type ModelMessage,
  type PrepareStepFunction,
  type StopCondition,
  type ToolSet,
} from "ai"
import type { ProviderOptions } from "@ai-sdk/provider-utils"
import type { GenerationOutcome, MatrixConfig, SettledValue, SourceFormat } from "./types.js"
import { prepareMessagesForSource } from "./providers.js"
import type { TraceRecorder } from "./trace-recorder.js"
import { toSerializable, writeJson, writeText } from "./util.js"

export interface GenerationInvocation<TOOLS extends ToolSet = Record<string, never>> {
  source: SourceFormat
  relativeCellDirectory: string
  operationName: string
  model: LanguageModel
  messages: ModelMessage[]
  providerOptions: ProviderOptions
  temperature?: number
  topP?: number
  topK?: number
  tools?: TOOLS
  prepareStep?: PrepareStepFunction<TOOLS>
  stopWhen?: StopCondition<TOOLS>
}

const FINALIZATION_TIMEOUT_MS = 15_000

export async function settleWithin<T>(
  value: PromiseLike<T>,
  label: string,
  timeoutMs: number,
): Promise<SettledValue<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      Promise.resolve(value),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error(
            `AI SDK result promise "${label}" did not settle within ${timeoutMs}ms after fullStream completed`,
          )
          error.name = "AISDKResultTimeoutError"
          reject(error)
        }, timeoutMs)
      }),
    ])
    return { status: "fulfilled", value: result }
  } catch (reason) {
    return { status: "rejected", reason }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function fulfilled<T>(value: SettledValue<T> | undefined): T | undefined {
  return value?.status === "fulfilled" ? value.value : undefined
}

function aggregateStepItems(steps: unknown, key: "toolCalls" | "toolResults"): unknown[] {
  if (!Array.isArray(steps)) return []
  const result: unknown[] = []
  for (const step of steps) {
    if (typeof step !== "object" || step === null) continue
    const items = (step as Record<string, unknown>)[key]
    if (Array.isArray(items)) result.push(...items)
  }
  return result
}

function reasoningDetected(settled: Record<string, SettledValue>, streamEvents: unknown[]): boolean {
  const reasoningText = fulfilled(settled.reasoningText)
  if (typeof reasoningText === "string" && reasoningText.trim() !== "") return true
  const reasoning = fulfilled(settled.reasoning)
  if (Array.isArray(reasoning) && reasoning.length > 0) return true
  return streamEvents.some((event) => {
    if (typeof event !== "object" || event === null) return false
    const type = (event as Record<string, unknown>).type
    return typeof type === "string" && type.startsWith("reasoning-")
  })
}

export async function runGeneration<TOOLS extends ToolSet = Record<string, never>>(
  recorder: TraceRecorder,
  config: MatrixConfig,
  invocation: GenerationInvocation<TOOLS>,
): Promise<GenerationOutcome> {
  const preparedMessages = prepareMessagesForSource(invocation.messages, invocation.source)
  const execution = await recorder.withOperation(
    invocation.relativeCellDirectory,
    invocation.operationName,
    async (): Promise<Omit<GenerationOutcome, "trace">> => {
      const streamEvents: unknown[] = []
      const onErrorEvents: unknown[] = []
      let streamError: unknown
      let result: ReturnType<typeof streamText<TOOLS>> | undefined

      try {
        const { maxOutputTokens } = config
        result = streamText({
          model: invocation.model,
          messages: preparedMessages,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(config.timeoutMs),
          ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
          providerOptions: invocation.providerOptions,
          ...(invocation.temperature === undefined ? {} : { temperature: invocation.temperature }),
          ...(invocation.topP === undefined ? {} : { topP: invocation.topP }),
          ...(invocation.topK === undefined ? {} : { topK: invocation.topK }),
          ...(invocation.tools === undefined ? {} : { tools: invocation.tools }),
          ...(invocation.prepareStep === undefined ? {} : { prepareStep: invocation.prepareStep }),
          ...(invocation.stopWhen === undefined ? {} : { stopWhen: invocation.stopWhen }),
          onError: ({ error }) => {
            onErrorEvents.push(error)
          },
        })

        for await (const event of result.fullStream) {
          streamEvents.push(event)
        }
      } catch (error) {
        streamError = error
      }

      const settled: Record<string, SettledValue> = {}
      if (result) {
        const finalizationTimeoutMs = Math.min(FINALIZATION_TIMEOUT_MS, Math.max(1_000, config.timeoutMs))
        const entries = await Promise.all([
          settleWithin(result.text, "text", finalizationTimeoutMs),
          settleWithin(result.reasoning, "reasoning", finalizationTimeoutMs),
          settleWithin(result.reasoningText, "reasoningText", finalizationTimeoutMs),
          settleWithin(result.toolCalls, "toolCalls", finalizationTimeoutMs),
          settleWithin(result.toolResults, "toolResults", finalizationTimeoutMs),
          settleWithin(result.finishReason, "finishReason", finalizationTimeoutMs),
          settleWithin(result.rawFinishReason, "rawFinishReason", finalizationTimeoutMs),
          settleWithin(result.usage, "usage", finalizationTimeoutMs),
          settleWithin(result.totalUsage, "totalUsage", finalizationTimeoutMs),
          settleWithin(result.warnings, "warnings", finalizationTimeoutMs),
          settleWithin(result.steps, "steps", finalizationTimeoutMs),
          settleWithin(result.request, "request", finalizationTimeoutMs),
          settleWithin(result.response, "response", finalizationTimeoutMs),
          settleWithin(result.providerMetadata, "providerMetadata", finalizationTimeoutMs),
        ])
        const names = [
          "text",
          "reasoning",
          "reasoningText",
          "toolCalls",
          "toolResults",
          "finishReason",
          "rawFinishReason",
          "usage",
          "totalUsage",
          "warnings",
          "steps",
          "request",
          "response",
          "providerMetadata",
        ] as const
        for (const [index, name] of names.entries()) settled[name] = entries[index] ?? { status: "rejected" }
      }

      const response = fulfilled(settled.response) as { messages?: ModelMessage[] } | undefined
      const steps = fulfilled(settled.steps)
      const text = fulfilled(settled.text)
      const reasoningText = fulfilled(settled.reasoningText)
      const criticalRejected = ["text", "steps", "response"].some((name) => settled[name]?.status === "rejected")

      return {
        ok: streamError === undefined && onErrorEvents.length === 0 && !criticalRejected,
        text: typeof text === "string" ? text : "",
        ...(typeof reasoningText === "string" ? { reasoningText } : {}),
        reasoningPresent: reasoningDetected(settled, streamEvents),
        responseMessages: response?.messages ?? [],
        streamEvents,
        onErrorEvents,
        ...(streamError === undefined ? {} : { streamError }),
        settled,
        toolCalls: aggregateStepItems(steps, "toolCalls"),
        toolResults: aggregateStepItems(steps, "toolResults"),
      }
    },
  )

  const outcome: GenerationOutcome = {
    ...execution.value,
    trace: execution.trace,
  }
  const operationDirectory = path.join(config.outputRoot, execution.trace.relativeDirectory)
  const modelMetadata = invocation.model as unknown as { modelId?: string; provider?: string }
  const { maxOutputTokens } = config
  const input = {
    source: invocation.source,
    operationName: invocation.operationName,
    modelId: modelMetadata.modelId ?? String(invocation.model),
    provider: modelMetadata.provider ?? "unknown",
    settings: {
      maxOutputTokens: maxOutputTokens ?? null,
      outputTokenLimitMode: maxOutputTokens === undefined ? "provider-default" : "explicit",
      temperature: invocation.temperature,
      topP: invocation.topP,
      topK: invocation.topK,
      hasTools: invocation.tools !== undefined,
      hasPrepareStep: invocation.prepareStep !== undefined,
      hasStopCondition: invocation.stopWhen !== undefined,
      providerOptions: invocation.providerOptions,
    },
    messages: preparedMessages,
  }
  await Promise.all([
    writeJson(path.join(operationDirectory, "sdk-input.json"), input, [config.apiKey]),
    writeJson(path.join(operationDirectory, "sdk-result.json"), outcome, [config.apiKey]),
    writeText(
      path.join(operationDirectory, "sdk-full-stream.jsonl"),
      outcome.streamEvents.map((event) => JSON.stringify(toSerializable(event, [config.apiKey]))).join("\n") + "\n",
      [config.apiKey],
    ),
  ])
  return outcome
}
