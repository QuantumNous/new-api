import path from "node:path"
import { fileURLToPath } from "node:url"
import { SCENARIOS, SOURCE_FORMATS, type MatrixConfig, type ScenarioName, type SourceFormat, type TargetSpec } from "./types.js"
import { normalizeBaseUrl } from "./util.js"

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const DEFAULT_MODELS: Record<SourceFormat, string> = {
  chat: "kimi-k2.7-code",
  responses: "gpt-5.6-terra",
  claude: "minimax-m3",
  gemini: "gemini-3.7-flash",
}

interface ParsedArgs {
  confirmLive: boolean
  dryRun: boolean
  help: boolean
  noMaxOutputTokens: boolean
  mode: "deep" | "smoke"
  source?: string
  target?: string
  scenario?: string
  output?: string
  baseUrl?: string
  timeoutMs?: string
  maxOutputTokens?: string
}

function parseRawArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    confirmLive: false,
    dryRun: false,
    help: false,
    noMaxOutputTokens: false,
    mode: "deep",
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument) continue
    if (argument === "--confirm-live") {
      parsed.confirmLive = true
      continue
    }
    if (argument === "--dry-run") {
      parsed.dryRun = true
      continue
    }
    if (argument === "--no-max-output-tokens") {
      parsed.noMaxOutputTokens = true
      continue
    }
    if (argument === "--help" || argument === "-h") {
      parsed.help = true
      continue
    }

    const [rawName, inlineValue] = argument.split("=", 2)
    const name = rawName?.replace(/^--/, "")
    const value = inlineValue ?? argv[index + 1]
    if (!name || value === undefined || value.startsWith("--")) {
      throw new Error(`Unknown or valueless argument: ${argument}`)
    }
    if (inlineValue === undefined) index += 1

    switch (name) {
      case "mode":
        if (value !== "deep" && value !== "smoke") throw new Error(`Invalid --mode: ${value}`)
        parsed.mode = value
        break
      case "source":
        parsed.source = value
        break
      case "target":
        parsed.target = value
        break
      case "scenario":
        parsed.scenario = value
        break
      case "output":
        parsed.output = value
        break
      case "base-url":
        parsed.baseUrl = value
        break
      case "timeout-ms":
        parsed.timeoutMs = value
        break
      case "max-output-tokens":
        parsed.maxOutputTokens = value
        break
      default:
        throw new Error(`Unknown argument: --${name}`)
    }
  }

  return parsed
}

function parseEnumList<T extends string>(value: string | undefined, allowed: readonly T[], label: string): T[] | undefined {
  if (value === undefined) return undefined
  const requested = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  if (requested.length === 0) throw new Error(`${label} cannot be empty`)
  for (const item of requested) {
    if (!allowed.includes(item as T)) throw new Error(`Invalid ${label} value: ${item}`)
  }
  return [...new Set(requested)] as T[]
}

function positiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`)
  return parsed
}

function modelFor(format: SourceFormat): string {
  const envName = `MATRIX_${format.toUpperCase()}_MODEL`
  return process.env[envName]?.trim() || DEFAULT_MODELS[format]
}

function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

export function parseConfig(argv = process.argv.slice(2)): MatrixConfig & { help: boolean } {
  const args = parseRawArgs(argv)
  const explicitSources = parseEnumList(args.source, SOURCE_FORMATS, "--source")
  const explicitTargets = parseEnumList(args.target, SOURCE_FORMATS, "--target")
  const explicitScenarios = parseEnumList(args.scenario, SCENARIOS, "--scenario")

  const sourceFormats = explicitSources ?? (args.mode === "smoke" ? ["chat"] : [...SOURCE_FORMATS])
  const targetFormats = explicitTargets ?? (args.mode === "smoke" ? ["gemini"] : [...SOURCE_FORMATS])
  const scenarios = explicitScenarios ?? (args.mode === "smoke" ? ["conversation"] : [...SCENARIOS])
  if (args.noMaxOutputTokens && args.maxOutputTokens !== undefined) {
    throw new Error("--no-max-output-tokens cannot be combined with --max-output-tokens")
  }

  const runId = createRunId()
  const outputRoot = path.resolve(args.output ?? path.join(PACKAGE_ROOT, "artifacts", runId))
  const apiKey = process.env.NEWAPI_API_KEY?.trim() ?? ""
  const baseUrl = normalizeBaseUrl(args.baseUrl ?? process.env.NEWAPI_BASE_URL ?? "http://107.175.65.211:3000")

  const maxOutputTokens = args.noMaxOutputTokens
    ? undefined
    : positiveInteger(args.maxOutputTokens ?? process.env.MATRIX_MAX_OUTPUT_TOKENS, 8192, "max output tokens")

  return {
    apiKey,
    baseUrl,
    outputRoot,
    runId,
    timeoutMs: positiveInteger(args.timeoutMs ?? process.env.MATRIX_TIMEOUT_MS, 300_000, "timeout"),
    ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
    sourceFormats,
    targets: targetFormats.map((format): TargetSpec => ({ format, model: modelFor(format) })),
    scenarios: scenarios as ScenarioName[],
    confirmLive: args.confirmLive,
    dryRun: args.dryRun,
    help: args.help,
  }
}

export function helpText(): string {
  return `AI SDK 4x4 protocol conversion matrix\n\nUsage:\n  NEWAPI_API_KEY=... bun run matrix --confirm-live [options]\n\nOptions:\n  --mode deep|smoke               deep = 4x4 x all scenarios (default)\n  --source chat,responses,...     client wire formats to run\n  --target chat,responses,...     upstream-native target columns/models\n  --scenario conversation,file,image\n  --base-url URL                  default: http://107.175.65.211:3000\n  --output PATH                   artifact directory\n  --timeout-ms NUMBER             per generation timeout\n  --max-output-tokens NUMBER      per generation output limit\n  --no-max-output-tokens          omit the app-level output limit and use provider defaults\n  --dry-run                       print the resolved plan without network calls\n  --confirm-live                  required before any paid/live request\n  --help                          show this help\n\nExamples:\n  bun run matrix --dry-run\n  NEWAPI_API_KEY=... bun run matrix --confirm-live --no-max-output-tokens\n  NEWAPI_API_KEY=... bun run matrix --confirm-live --mode smoke\n  NEWAPI_API_KEY=... bun run matrix --confirm-live --source claude --target gemini --scenario file\n`
}
