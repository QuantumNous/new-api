import type { ModelMessage } from "ai"

export const SOURCE_FORMATS = ["chat", "responses", "claude", "gemini"] as const
export type SourceFormat = (typeof SOURCE_FORMATS)[number]

export const SCENARIOS = ["conversation", "file", "image"] as const
export type ScenarioName = (typeof SCENARIOS)[number]

export type CheckStatus = "pass" | "warn" | "fail" | "unsupported" | "capability_unsupported"
export type ScenarioStatus = CheckStatus

export interface TargetSpec {
  format: SourceFormat
  model: string
}

export interface MatrixConfig {
  apiKey: string
  baseUrl: string
  outputRoot: string
  runId: string
  timeoutMs: number
  maxOutputTokens?: number
  sourceFormats: SourceFormat[]
  targets: TargetSpec[]
  scenarios: ScenarioName[]
  confirmLive: boolean
  dryRun: boolean
}

export interface CheckResult {
  id: string
  status: CheckStatus
  category: "transport" | "sdk" | "conversion" | "reasoning" | "tool" | "context" | "file" | "image" | "model"
  message: string
  evidence?: unknown
}

export interface OperationTrace {
  relativeDirectory: string
  exchangeCount: number
}

export interface SettledValue<T = unknown> {
  status: "fulfilled" | "rejected"
  value?: T
  reason?: unknown
}

export interface GenerationOutcome {
  ok: boolean
  text: string
  reasoningText?: string
  reasoningPresent: boolean
  responseMessages: ModelMessage[]
  streamEvents: unknown[]
  onErrorEvents: unknown[]
  streamError?: unknown
  settled: Record<string, SettledValue>
  toolCalls: unknown[]
  toolResults: unknown[]
  trace: OperationTrace
}

export interface ScenarioResult {
  name: ScenarioName
  status: ScenarioStatus
  checks: CheckResult[]
  operations: Array<{
    name: string
    outcome: GenerationOutcome
  }>
  startedAt: string
  finishedAt: string
}

export interface CellResult {
  source: SourceFormat
  target: SourceFormat
  model: string
  status: ScenarioStatus
  scenarios: ScenarioResult[]
  startedAt: string
  finishedAt: string
}

export interface RunManifest {
  runId: string
  startedAt: string
  finishedAt?: string
  baseUrl: string
  keyFingerprint: string
  packageVersions: Record<string, string>
  sourceFormats: SourceFormat[]
  targets: TargetSpec[]
  scenarios: ScenarioName[]
  timeoutMs: number
  maxOutputTokens: number | null
}

export interface MatrixRunResult {
  manifest: RunManifest
  cells: CellResult[]
}
