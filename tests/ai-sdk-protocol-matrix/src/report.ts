import path from "node:path"
import { runStatus } from "./analysis.js"
import type { MatrixRunResult, ScenarioName, ScenarioStatus, SourceFormat } from "./types.js"
import { writeJson, writeText } from "./util.js"

const STATUS_LABEL: Record<ScenarioStatus, string> = {
  pass: "✅ PASS",
  warn: "⚠️ WARN",
  fail: "❌ FAIL",
  unsupported: "➖ SDK UNSUPPORTED",
  capability_unsupported: "➖ CAPABILITY UNSUPPORTED",
}

function matrixCell(result: MatrixRunResult, source: SourceFormat, target: SourceFormat, scenario: ScenarioName): string {
  const cell = result.cells.find((item) => item.source === source && item.target === target)
  const scenarioResult = cell?.scenarios.find((item) => item.name === scenario)
  return scenarioResult ? STATUS_LABEL[scenarioResult.status] : "—"
}

function scenarioTable(result: MatrixRunResult, scenario: ScenarioName): string {
  const sources = result.manifest.sourceFormats
  const targets = result.manifest.targets.map((item) => item.format)
  const header = `| Client \\ Upstream | ${targets.join(" | ")} |`
  const divider = `| ${["---", ...targets.map(() => "---")].join(" | ")} |`
  const rows = sources.map(
    (source) => `| ${source} | ${targets.map((target) => matrixCell(result, source, target, scenario)).join(" | ")} |`,
  )
  return [header, divider, ...rows].join("\n")
}

function detailLines(result: MatrixRunResult): string[] {
  const lines: string[] = []
  for (const cell of result.cells) {
    for (const scenario of cell.scenarios) {
      for (const item of scenario.checks) {
        if (item.status === "pass") continue
        lines.push(
          `- **${item.status.toUpperCase()}** \`${cell.source} → ${cell.target}/${scenario.name}/${item.id}\`: ${item.message}`,
        )
      }
    }
  }
  return lines
}

function requestCount(result: MatrixRunResult): number {
  return result.cells.reduce(
    (cellTotal, cell) =>
      cellTotal +
      cell.scenarios.reduce(
        (scenarioTotal, scenario) =>
          scenarioTotal + scenario.operations.reduce((operationTotal, operation) => operationTotal + operation.outcome.trace.exchangeCount, 0),
        0,
      ),
    0,
  )
}

export function markdownReport(result: MatrixRunResult): string {
  const overall = runStatus(result.cells)
  const details = detailLines(result)
  const versions = Object.entries(result.manifest.packageVersions)
    .map(([name, version]) => `- \`${name}\`: \`${version}\``)
    .join("\n")
  const targets = result.manifest.targets.map((target) => `- \`${target.format}\` → \`${target.model}\``).join("\n")

  return `# AI SDK 4×4 协议转换矩阵报告

- Run ID: \`${result.manifest.runId}\`
- Overall: **${STATUS_LABEL[overall]}**
- Base URL: \`${result.manifest.baseUrl}\`
- Key fingerprint: \`${result.manifest.keyFingerprint}\`（仅指纹，密钥不会写入日志）
- HTTP exchanges: **${requestCount(result)}**
- Started: \`${result.manifest.startedAt}\`
- Finished: \`${result.manifest.finishedAt ?? "incomplete"}\`

## 与 OpenCode 对齐的依赖

${versions}

同时应用 OpenCode 当前仓库对 \`@ai-sdk/openai-compatible@2.0.41\` 和 \`@ai-sdk/google@3.0.73\` 的补丁。

## 上游原生格式与模型

${targets}

> A → B 表示客户端使用 A 协议，NewAPI 将请求转换到 B 原生上游。日志完整记录 AI SDK ↔ NewAPI 的请求体、响应体和 SSE；鉴权头会脱敏。NewAPI → 上游的转换后请求仍需通过服务端日志按 request ID 关联。

## conversation：多轮、复杂题、公开 reasoning、工具生命周期、上下文回放

${scenarioTable(result, "conversation")}

## file：PDF 文件上传与读取

${scenarioTable(result, "file")}

## image：PNG 图片上传、OCR 与计数

${scenarioTable(result, "image")}

## 异常与警告

${details.length > 0 ? details.join("\n") : "- 无。"}

## 判读原则

- **PASS**：协议请求成功，且场景断言通过。
- **WARN**：请求成功但公开 reasoning 不可见、回答细节不完整，或某项仅具可移植性风险。
- **FAIL**：HTTP/SDK 异常、工具参数或 ID 生命周期失败、上下文丢失、文件/图片读取错误。
- **SDK UNSUPPORTED**：源 AI SDK 在发出 HTTP 请求前拒绝该附件类型；这不属于 NewAPI 转换失败，但说明该客户端格式无法用该方式表达该能力。
- **CAPABILITY UNSUPPORTED**：NewAPI 在出站前确认目标模型/协议不支持该能力并返回结构化错误；这不计为协议转换 FAIL，也不会向上游发送已知无效请求。
- “reasoning 可见”只检测供应商公开返回的 reasoning summary/thought，不要求也不应暴露模型私有完整思维链。

## 产物结构

每个操作目录包含：

- \`sdk-input.json\`：AI SDK 输入消息结构和 provider options（本地二进制记录长度与 SHA-256）；
- \`sdk-full-stream.jsonl\`：AI SDK 解析后的完整流事件；
- \`sdk-result.json\`：AI SDK 最终结果、steps、tool calls/results 和错误；
- \`http-NNN.request.json\` / \`.body.txt\`：完整客户端请求（鉴权脱敏）；
- \`http-NNN.response.json\` / \`.body.txt\`：完整 HTTP/SSE 响应；
- 单元格和总报告 JSON。
`
}

export async function writeReports(result: MatrixRunResult, outputRoot: string): Promise<void> {
  await Promise.all([
    writeJson(path.join(outputRoot, "summary.json"), {
      status: runStatus(result.cells),
      ...result,
    }),
    writeText(path.join(outputRoot, "summary.md"), markdownReport(result)),
  ])
}
