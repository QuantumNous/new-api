import path from "node:path"
import { cellStatus, check, runStatus, scenarioStatus } from "./analysis.js"
import { createModelRuntime, PACKAGE_VERSIONS } from "./providers.js"
import { writeReports } from "./report.js"
import { runConversationScenario, runFileScenario, runImageScenario } from "./scenarios.js"
import { TraceRecorder } from "./trace-recorder.js"
import type {
  CellResult,
  MatrixConfig,
  MatrixRunResult,
  RunManifest,
  ScenarioName,
  ScenarioResult,
  SourceFormat,
  TargetSpec,
} from "./types.js"
import { keyFingerprint, nowIso, toSerializable, writeJson } from "./util.js"

function relativeCellDirectory(source: SourceFormat, target: SourceFormat): string {
  return path.join("cells", `${source}-to-${target}`)
}

async function runScenario(
  name: ScenarioName,
  context: Parameters<typeof runConversationScenario>[0],
): Promise<ScenarioResult> {
  switch (name) {
    case "conversation":
      return runConversationScenario(context)
    case "file":
      return runFileScenario(context)
    case "image":
      return runImageScenario(context)
  }
}

async function runScenarioSafely(
  name: ScenarioName,
  context: Parameters<typeof runConversationScenario>[0],
): Promise<ScenarioResult> {
  const startedAt = nowIso()
  try {
    return await runScenario(name, context)
  } catch (error) {
    const failure = check(
      `${name}.runner-crash`,
      "fail",
      "sdk",
      `Scenario runner crashed before it could produce a normal result: ${JSON.stringify(toSerializable(error))}`,
      error,
    )
    await writeJson(
      path.join(context.config.outputRoot, context.relativeCellDirectory, name, "scenario-runner-error.json"),
      error,
      [context.config.apiKey],
    )
    return {
      name,
      status: scenarioStatus([failure]),
      checks: [failure],
      operations: [],
      startedAt,
      finishedAt: nowIso(),
    }
  }
}

async function runCell(
  recorder: TraceRecorder,
  config: MatrixConfig,
  source: SourceFormat,
  target: TargetSpec,
): Promise<CellResult> {
  const startedAt = nowIso()
  const relativeDirectory = relativeCellDirectory(source, target.format)
  const runtime = createModelRuntime(source, target, config, recorder.fetch)
  const scenarios: ScenarioResult[] = []

  for (const scenario of config.scenarios) {
    console.log(`[matrix] ${source} → ${target.format} (${target.model}) / ${scenario}`)
    const result = await runScenarioSafely(scenario, {
      recorder,
      config,
      source,
      target,
      runtime,
      relativeCellDirectory: relativeDirectory,
    })
    scenarios.push(result)
    console.log(`[matrix] ${source} → ${target.format} / ${scenario}: ${result.status}`)
  }

  const cell: CellResult = {
    source,
    target: target.format,
    model: target.model,
    status: cellStatus(scenarios),
    scenarios,
    startedAt,
    finishedAt: nowIso(),
  }
  await writeJson(path.join(config.outputRoot, relativeDirectory, "cell-result.json"), cell, [config.apiKey])
  return cell
}

export async function runMatrix(config: MatrixConfig): Promise<MatrixRunResult> {
  const startedAt = nowIso()
  const manifest: RunManifest = {
    runId: config.runId,
    startedAt,
    baseUrl: config.baseUrl,
    keyFingerprint: keyFingerprint(config.apiKey),
    packageVersions: PACKAGE_VERSIONS,
    sourceFormats: config.sourceFormats,
    targets: config.targets,
    scenarios: config.scenarios,
    timeoutMs: config.timeoutMs,
    maxOutputTokens: config.maxOutputTokens ?? null,
  }
  await writeJson(path.join(config.outputRoot, "manifest.json"), manifest)

  const recorder = new TraceRecorder(config.outputRoot, config.apiKey)
  const cells: CellResult[] = []
  for (const source of config.sourceFormats) {
    for (const target of config.targets) {
      const cell = await runCell(recorder, config, source, target)
      cells.push(cell)
      await writeReports({ manifest, cells }, config.outputRoot)
    }
  }

  manifest.finishedAt = nowIso()
  const result: MatrixRunResult = { manifest, cells }
  await Promise.all([
    writeJson(path.join(config.outputRoot, "manifest.json"), manifest),
    writeReports(result, config.outputRoot),
  ])
  console.log(`[matrix] complete: ${runStatus(cells)}; artifacts: ${config.outputRoot}`)
  return result
}
