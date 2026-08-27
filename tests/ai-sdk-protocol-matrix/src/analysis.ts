import type { CellResult, CheckResult, CheckStatus, GenerationOutcome, ScenarioResult, ScenarioStatus } from "./types.js"
import { toSerializable } from "./util.js"

export function check(
  id: string,
  status: CheckStatus,
  category: CheckResult["category"],
  message: string,
  evidence?: unknown,
): CheckResult {
  return {
    id,
    status,
    category,
    message,
    ...(evidence === undefined ? {} : { evidence }),
  }
}

export function scenarioStatus(checks: CheckResult[]): ScenarioStatus {
  if (checks.some((item) => item.status === "fail")) return "fail"
  if (checks.some((item) => item.status === "warn")) return "warn"
  if (checks.some((item) => item.status === "capability_unsupported")) return "capability_unsupported"
  if (checks.some((item) => item.status === "unsupported")) return "unsupported"
  return "pass"
}

export function cellStatus(scenarios: ScenarioResult[]): ScenarioStatus {
  if (scenarios.some((item) => item.status === "fail")) return "fail"
  if (scenarios.some((item) => item.status === "warn")) return "warn"
  if (scenarios.length > 0 && scenarios.every((item) => item.status === "capability_unsupported")) {
    return "capability_unsupported"
  }
  if (scenarios.length > 0 && scenarios.every((item) => item.status === "unsupported")) return "unsupported"
  if (scenarios.some((item) => item.status === "unsupported")) return "warn"
  return "pass"
}

export function runStatus(cells: CellResult[]): ScenarioStatus {
  if (cells.some((item) => item.status === "fail")) return "fail"
  if (cells.some((item) => item.status === "warn")) return "warn"
  if (cells.length > 0 && cells.every((item) => item.status === "capability_unsupported")) {
    return "capability_unsupported"
  }
  if (cells.length > 0 && cells.every((item) => item.status === "unsupported")) return "unsupported"
  if (cells.some((item) => item.status === "unsupported")) return "warn"
  return "pass"
}

export function outcomeErrorText(outcome: GenerationOutcome): string {
  return JSON.stringify(
    toSerializable({
      streamError: outcome.streamError,
      onErrorEvents: outcome.onErrorEvents,
      settled: outcome.settled,
    }),
  ).toLowerCase()
}

export function isCapabilityUnsupported(outcome: GenerationOutcome): boolean {
  const text = outcomeErrorText(outcome)
  return text.includes("capability_unsupported") || text.includes("capability unsupported")
}

export function isLocalUnsupported(outcome: GenerationOutcome): boolean {
  if (outcome.trace.exchangeCount !== 0) return false
  const text = outcomeErrorText(outcome)
  return [
    "unsupportedfunctionality",
    "unsupported functionality",
    "unsupported file",
    "unsupported media",
    "file part",
    "image part",
    "does not support",
    "not supported",
  ].some((fragment) => text.includes(fragment))
}

export function transportCheck(operation: string, outcome: GenerationOutcome): CheckResult {
  if (outcome.ok) {
    return check(
      `${operation}.transport`,
      "pass",
      "transport",
      `${operation} completed with ${outcome.trace.exchangeCount} HTTP exchange(s)`,
      { trace: outcome.trace },
    )
  }
  if (isCapabilityUnsupported(outcome)) {
    return check(
      `${operation}.transport`,
      "capability_unsupported",
      "conversion",
      `${operation} was rejected before upstream dispatch because the target protocol does not support this capability`,
      { trace: outcome.trace, error: outcomeErrorText(outcome) },
    )
  }
  if (isLocalUnsupported(outcome)) {
    return check(
      `${operation}.transport`,
      "unsupported",
      "sdk",
      `${operation} was rejected by the source AI SDK before an HTTP request was sent`,
      { trace: outcome.trace, error: outcomeErrorText(outcome) },
    )
  }
  return check(
    `${operation}.transport`,
    "fail",
    "transport",
    `${operation} failed`,
    { trace: outcome.trace, error: outcomeErrorText(outcome) },
  )
}

export interface PuzzleEvaluation {
  economicConclusion: boolean
  cashLedgerNuance: boolean
}

export function evaluatePuzzleAnswer(text: string): PuzzleEvaluation {
  const normalized = text.replace(/\s+/g, " ").toLowerCase()
  const forty = "(?:40|四十)"
  const driverGain = new RegExp(`(?:司机|车主|你|driver|customer).{0,30}(?:赚|获益|占便宜|gain|benefit).{0,20}${forty}`, "i")
  const parkingLoss = new RegExp(`(?:保安|停车场|小区|物业|guard|parking|lot).{0,30}(?:亏|损失|少收|lose|lost).{0,20}${forty}`, "i")
  const unpaidFee = new RegExp(`(?:停车费|parking fee).{0,30}(?:没付|未付|未支付|没有支付|为零|是零|0|unpaid|not paid)`, "i")
  const cashBalanced =
    /(?:现金|cash).{0,30}(?:双方|两人|都|net).{0,30}(?:为?0|是零|零|balanced|even)/i.test(normalized) ||
    /(?:谁都没有|双方都没有|neither).{0,20}(?:现金|cash).{0,20}(?:赚|亏|gain|lose)/i.test(normalized)
  return {
    economicConclusion: driverGain.test(normalized) || parkingLoss.test(normalized) || unpaidFee.test(normalized),
    cashLedgerNuance: cashBalanced,
  }
}

export function containsExact(text: string, value: string): boolean {
  return text.toLowerCase().includes(value.toLowerCase())
}

export interface ToolIdDiagnostic {
  value?: string
  nonEmpty: boolean
  hasControlOrWhitespace: boolean
  portable: boolean
  length?: number
}

export function diagnoseToolCallId(value: unknown): ToolIdDiagnostic {
  if (typeof value !== "string") {
    return { nonEmpty: false, hasControlOrWhitespace: false, portable: false }
  }
  const hasControlOrWhitespace = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return /\s/.test(character) || codePoint < 32 || codePoint === 127
  })
  return {
    value,
    nonEmpty: value.length > 0,
    hasControlOrWhitespace,
    portable: /^[A-Za-z0-9_-]+$/.test(value),
    length: value.length,
  }
}
