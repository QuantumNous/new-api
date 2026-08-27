import { runStatus } from "./analysis.js"
import { helpText, parseConfig } from "./config.js"
import { runMatrix } from "./runner.js"
import { redactText, toSerializable } from "./util.js"

function estimatedHttpRequests(config: ReturnType<typeof parseConfig>): number {
  const perCell = config.scenarios.reduce((total, scenario) => {
    if (scenario === "conversation") return total + 5
    return total + 1
  }, 0)
  return config.sourceFormats.length * config.targets.length * perCell
}

async function main(): Promise<void> {
  const config = parseConfig()
  if (config.help) {
    console.log(helpText())
    return
  }

  const plan = {
    mode: `${config.sourceFormats.length}x${config.targets.length}`,
    sourceFormats: config.sourceFormats,
    targets: config.targets,
    scenarios: config.scenarios,
    baseUrl: config.baseUrl,
    outputRoot: config.outputRoot,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens ?? null,
    outputTokenLimitMode: config.maxOutputTokens === undefined ? "provider-default" : "explicit",
    estimatedHttpRequests: estimatedHttpRequests(config),
    apiKeyConfigured: config.apiKey.length > 0,
  }
  console.log(JSON.stringify(plan, null, 2))

  if (config.dryRun) return
  if (!config.confirmLive) {
    throw new Error("Live execution requires --confirm-live because the deep matrix can issue more than 100 paid requests")
  }
  if (!config.apiKey) {
    throw new Error("NEWAPI_API_KEY is required; put it in the environment, never in source code or command arguments")
  }

  const result = await runMatrix(config)
  if (runStatus(result.cells) === "fail") process.exitCode = 1
}

main().catch((error) => {
  const secret = process.env.NEWAPI_API_KEY?.trim() ?? ""
  const serialized = JSON.stringify(toSerializable(error, [secret]), null, 2)
  console.error(redactText(serialized, [secret]))
  process.exitCode = 1
})
