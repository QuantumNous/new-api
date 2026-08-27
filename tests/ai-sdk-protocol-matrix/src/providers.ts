import { createRequire } from "node:module"
import { createAnthropic, VERSION as ANTHROPIC_VERSION } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI, VERSION as GOOGLE_VERSION } from "@ai-sdk/google"
import { createOpenAI, VERSION as OPENAI_VERSION } from "@ai-sdk/openai"
import { createOpenAICompatible, VERSION as OPENAI_COMPATIBLE_VERSION } from "@ai-sdk/openai-compatible"
import { VERSION as PROVIDER_UTILS_VERSION, type ProviderOptions } from "@ai-sdk/provider-utils"
import type { LanguageModel, ModelMessage } from "ai"
import type { MatrixConfig, SourceFormat, TargetSpec } from "./types.js"

const require = createRequire(import.meta.url)
const AI_VERSION = (require("ai/package.json") as { version: string }).version
const PROVIDER_VERSION = (require("@ai-sdk/provider/package.json") as { version: string }).version

export const PACKAGE_VERSIONS: Record<string, string> = {
  ai: AI_VERSION,
  "@ai-sdk/openai-compatible": OPENAI_COMPATIBLE_VERSION,
  "@ai-sdk/provider": PROVIDER_VERSION,
  "@ai-sdk/provider-utils": PROVIDER_UTILS_VERSION,
  "@ai-sdk/openai": OPENAI_VERSION,
  "@ai-sdk/anthropic": ANTHROPIC_VERSION,
  "@ai-sdk/google": GOOGLE_VERSION,
}

export interface ModelRuntime {
  model: LanguageModel
  providerOptions: ProviderOptions
  temperature?: number
  topP?: number
  topK?: number
}

function providerHeaders(runId: string): Record<string, string> {
  return {
    "User-Agent": "opencode/1.18.23 ai-sdk-protocol-matrix/1.0",
    "X-AI-SDK-Matrix-Run": runId,
  }
}

function samplingForModel(model: string): Pick<ModelRuntime, "temperature" | "topP" | "topK"> {
  const id = model.toLowerCase()
  if (id.includes("gemini-3")) return { temperature: 1, topP: 0.95, topK: 64 }
  if (id.includes("kimi-k2") && ["k2.", "k2p", "k2-5", "thinking"].some((fragment) => id.includes(fragment))) {
    return { temperature: 1 }
  }
  return {}
}

function reasoningOptions(source: SourceFormat, targetModel: string): ProviderOptions {
  switch (source) {
    case "chat":
      return {
        openaiCompatible: {
          reasoningEffort: "high",
        },
      }
    case "responses":
      return {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "high",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      }
    case "claude":
      return {
        anthropic: targetModel.toLowerCase().includes("minimax-m3")
          ? {
              thinking: { type: "adaptive", display: "summarized" },
              effort: "high",
            }
          : {
              thinking: { type: "enabled", budgetTokens: 1024 },
            },
      }
    case "gemini":
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
            thinkingLevel: "high",
          },
        },
      }
  }
}

export function createModelRuntime(
  source: SourceFormat,
  target: TargetSpec,
  config: MatrixConfig,
  tracedFetch: typeof fetch,
): ModelRuntime {
  const headers = providerHeaders(config.runId)
  let model: LanguageModel

  switch (source) {
    case "chat": {
      const provider = createOpenAICompatible({
        name: "openaiCompatible",
        apiKey: config.apiKey,
        baseURL: `${config.baseUrl}/v1`,
        includeUsage: true,
        headers,
        fetch: tracedFetch,
      })
      model = provider.languageModel(target.model)
      break
    }
    case "responses": {
      const provider = createOpenAI({
        name: "openai",
        apiKey: config.apiKey,
        baseURL: `${config.baseUrl}/v1`,
        headers,
        fetch: tracedFetch,
      })
      model = provider.responses(target.model)
      break
    }
    case "claude": {
      const provider = createAnthropic({
        name: "anthropic",
        apiKey: config.apiKey,
        baseURL: `${config.baseUrl}/v1`,
        headers,
        fetch: tracedFetch,
      })
      model = provider.languageModel(target.model)
      break
    }
    case "gemini": {
      const provider = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        baseURL: `${config.baseUrl}/v1beta`,
        headers,
        fetch: tracedFetch,
      })
      model = provider.languageModel(target.model)
      break
    }
  }

  return {
    model,
    providerOptions: reasoningOptions(source, target.model),
    ...samplingForModel(target.model),
  }
}

function sanitizeSurrogates(value: string): string {
  return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD")
}

function stripOpenAIItemId(providerOptions: ProviderOptions | undefined): ProviderOptions | undefined {
  if (!providerOptions?.openai || typeof providerOptions.openai !== "object") return providerOptions
  if (!("itemId" in providerOptions.openai)) return providerOptions
  const openai = { ...providerOptions.openai }
  delete openai.itemId
  return { ...providerOptions, openai }
}

function transformProviderOptions<T extends object>(value: T, source: SourceFormat): T {
  if (source !== "responses" || !("providerOptions" in value)) return value
  const current = (value as T & { providerOptions?: ProviderOptions }).providerOptions
  const transformed = stripOpenAIItemId(current)
  const result = { ...value } as T & { providerOptions?: ProviderOptions }
  if (transformed === undefined) delete result.providerOptions
  else result.providerOptions = transformed
  return result
}

function transformContentPart<T extends { type: string }>(part: T, source: SourceFormat): T {
  const transformed = transformProviderOptions(part, source)
  if ((transformed.type === "text" || transformed.type === "reasoning") && "text" in transformed) {
    return { ...transformed, text: sanitizeSurrogates(String(transformed.text)) }
  }
  return transformed
}

function hasAnthropicReasoningSignature(part: { type: string }): boolean {
  if (part.type !== "reasoning" || !("providerOptions" in part)) return false
  const providerOptions = (part as { providerOptions?: ProviderOptions }).providerOptions
  const anthropic = providerOptions?.anthropic
  return Boolean(
    anthropic && typeof anthropic === "object" && ("signature" in anthropic || "redactedData" in anthropic),
  )
}

export function prepareMessagesForSource(messages: ModelMessage[], source: SourceFormat): ModelMessage[] {
  const cloned = structuredClone(messages) as ModelMessage[]
  const prepared: ModelMessage[] = []

  for (const originalMessage of cloned) {
    const message = transformProviderOptions(originalMessage, source)
    if (message.role === "system") {
      prepared.push({ ...message, content: sanitizeSurrogates(message.content) })
      continue
    }

    if (message.role === "user") {
      prepared.push({
        ...message,
        content:
          typeof message.content === "string"
            ? sanitizeSurrogates(message.content)
            : message.content.map((part) => transformContentPart(part, source)),
      })
      continue
    }

    if (message.role === "assistant") {
      const content = typeof message.content === "string" ? sanitizeSurrogates(message.content) : message.content
      if (typeof content === "string") {
        if (source === "claude" && content === "") continue
        prepared.push({ ...message, content })
        continue
      }
      const filtered = content.map((part) => transformContentPart(part, source)).filter((part) => {
        if (source !== "claude") return true
        if (part.type === "text" && "text" in part) return part.text !== ""
        if (part.type !== "reasoning" || !("text" in part)) return true
        return String(part.text).trim() !== "" || hasAnthropicReasoningSignature(part)
      })
      if (source === "claude" && filtered.length === 0) continue
      prepared.push({ ...message, content: filtered })
      continue
    }

    prepared.push({
      ...message,
      content: message.content.map((part) => transformContentPart(part, source)),
    })
  }

  return prepared
}
