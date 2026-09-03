/* global process */
import { existsSync, readFileSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { execFileSync } from "child_process"
import { platform } from "os"
import { debugLog } from "./trellis-context.js"

const PYTHON_CMD = platform() === "win32" ? "python" : "python3"

const FIRST_REPLY_NOTICE = `<first-reply-notice>
First visible reply: say once in Chinese that Trellis SessionStart context is loaded, then answer directly.
This notice is one-shot: do not repeat it after the first assistant reply in the same session.
</first-reply-notice>`

function hasCuratedJsonlEntry(jsonlPath) {
  try {
    const content = readFileSync(jsonlPath, "utf-8")
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line) continue
      try {
        const row = JSON.parse(line)
        if (row && typeof row === "object" && typeof row.file === "string" && row.file) {
          return true
        }
      } catch {
        // Ignore malformed line
      }
    }
  } catch {
    return false
  }
  return false
}

function getTaskStatus(ctx, platformInput = null) {
  const active = ctx.getActiveTask(platformInput)
  const taskRef = active.taskPath
  if (!taskRef) {
    return (
      "Status: NO ACTIVE TASK\n" +
      "Next-Action: Classify the current turn before creating any Trellis task. " +
      "Simple conversation / small task asks only whether this turn should create a Trellis task. " +
      "Complex task asks whether task creation and planning are allowed."
    )
  }

  const taskDir = ctx.resolveTaskDir(taskRef)

  if (active.stale || !taskDir || !existsSync(taskDir)) {
    return `Status: STALE POINTER\nTask: ${taskRef}\nNext-Action: Task directory not found. Run: python3 ./.trellis/scripts/task.py finish`
  }

  let taskData = {}
  const taskJsonPath = join(taskDir, "task.json")
  if (existsSync(taskJsonPath)) {
    try {
      taskData = JSON.parse(readFileSync(taskJsonPath, "utf-8"))
    } catch {
      // Ignore parse errors
    }
  }

  const taskTitle = taskData.title || taskRef
  const taskStatus = taskData.status || "unknown"

  if (taskStatus === "completed") {
    return `Status: COMPLETED\nTask: ${taskTitle}\nNext-Action: Run /trellis:finish-work. If the working tree is dirty, return to Phase 3.4 first.`
  }

  const hasPrd = existsSync(join(taskDir, "prd.md"))
  const hasDesign = existsSync(join(taskDir, "design.md"))
  const hasImplementPlan = existsSync(join(taskDir, "implement.md"))
  const artifactNames = ["prd.md", "design.md", "implement.md", "implement.jsonl", "check.jsonl"]
  const present = artifactNames.filter(name => existsSync(join(taskDir, name)))
  if (existsSync(join(taskDir, "research"))) present.push("research/")
  const presentLine = present.length > 0 ? present.join(", ") : "(none)"
  const implementJsonl = join(taskDir, "implement.jsonl")
  const checkJsonl = join(taskDir, "check.jsonl")
  const jsonlReady =
    (!existsSync(implementJsonl) || hasCuratedJsonlEntry(implementJsonl)) &&
    (!existsSync(checkJsonl) || hasCuratedJsonlEntry(checkJsonl))

  if (taskStatus === "planning" && !hasPrd) {
    return `Status: PLANNING\nTask: ${taskTitle}\nPresent: ${presentLine}\nNext-Action: Load trellis-brainstorm and write prd.md. Stay in planning.`
  }

  if (taskStatus === "planning") {
    const missingComplex = []
    if (!hasDesign) missingComplex.push("design.md")
    if (!hasImplementPlan) missingComplex.push("implement.md")
    const nextBits = []
    if (missingComplex.length > 0) {
      nextBits.push(
        `Lightweight task can request start review with PRD-only; complex task must add ${missingComplex.join(", ")} before start`,
      )
    } else {
      nextBits.push("Planning artifacts are present; ask for review before `task.py start`")
    }
    if (!jsonlReady) {
      nextBits.push("curate `implement.jsonl` and `check.jsonl` before sub-agent mode start")
    }
    return `Status: PLANNING\nTask: ${taskTitle}\nPresent: ${presentLine}\nNext-Action: ${nextBits.join("; ")}. Do not enter implementation until the user confirms start.`
  }

  return (
    `Status: ${String(taskStatus).toUpperCase()}\nTask: ${taskTitle}\n` +
    `Present: ${presentLine}\n` +
    "Next-Action: Follow the matching per-turn workflow-state. " +
    "Implementation/check context order is jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`."
  )
}

function loadTrellisConfig(directory, contextKey = null) {
  const scriptPath = join(directory, ".trellis", "scripts", "get_context.py")
  if (!existsSync(scriptPath)) {
    return { isMonorepo: false, packages: {}, specScope: null, activeTaskPackage: null, defaultPackage: null }
  }
  try {
    const output = execFileSync(PYTHON_CMD, [scriptPath, "--mode", "packages", "--json"], {
      cwd: directory,
      timeout: 5000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(contextKey ? { TRELLIS_CONTEXT_ID: contextKey } : {}),
      },
    })
    const data = JSON.parse(output)
    if (data.mode !== "monorepo") {
      return { isMonorepo: false, packages: {}, specScope: null, activeTaskPackage: null, defaultPackage: null }
    }
    const pkgDict = {}
    for (const pkg of (data.packages || [])) {
      pkgDict[pkg.name] = pkg
    }
    return {
      isMonorepo: true,
      packages: pkgDict,
      specScope: data.specScope || null,
      activeTaskPackage: data.activeTaskPackage || null,
      defaultPackage: data.defaultPackage || null,
    }
  } catch (e) {
    debugLog("session", "loadTrellisConfig error:", e.message)
    return { isMonorepo: false, packages: {}, specScope: null, activeTaskPackage: null, defaultPackage: null }
  }
}

function checkLegacySpec(directory, config) {
  if (!config.isMonorepo || Object.keys(config.packages).length === 0) {
    return null
  }

  const specDir = join(directory, ".trellis", "spec")
  if (!existsSync(specDir)) return null

  let hasLegacy = false
  for (const name of ["backend", "frontend"]) {
    if (existsSync(join(specDir, name, "index.md"))) {
      hasLegacy = true
      break
    }
  }
  if (!hasLegacy) return null

  const pkgNames = Object.keys(config.packages).sort()
  const missing = pkgNames.filter(name => !existsSync(join(specDir, name)))

  if (missing.length === 0) return null

  if (missing.length === pkgNames.length) {
    return (
      `[!] Legacy spec structure detected: found \`spec/backend/\` or \`spec/frontend/\` ` +
      `but no package-scoped \`spec/<package>/\` directories.\n` +
      `Monorepo packages: ${pkgNames.join(", ")}\n` +
      `Please reorganize: \`spec/backend/\` -> \`spec/<package>/backend/\``
    )
  }
  return (
    `[!] Partial spec migration detected: packages ${missing.join(", ")} ` +
    `still missing \`spec/<pkg>/\` directory.\n` +
    `Please complete migration for all packages.`
  )
}

function resolveSpecScope(config) {
  if (!config.isMonorepo || Object.keys(config.packages).length === 0) {
    return null
  }

  const { specScope, activeTaskPackage, defaultPackage, packages } = config
  if (specScope == null) return null

  if (specScope === "active_task") {
    if (activeTaskPackage && activeTaskPackage in packages) return new Set([activeTaskPackage])
    if (defaultPackage && defaultPackage in packages) return new Set([defaultPackage])
    return null
  }

  if (Array.isArray(specScope)) {
    const valid = new Set()
    for (const entry of specScope) {
      if (entry in packages) {
        valid.add(entry)
      }
    }
    if (valid.size > 0) return valid
    if (activeTaskPackage && activeTaskPackage in packages) return new Set([activeTaskPackage])
    if (defaultPackage && defaultPackage in packages) return new Set([defaultPackage])
    return null
  }

  return null
}

function collectSpecIndexPaths(directory, allowedPkgs) {
  const specDir = join(directory, ".trellis", "spec")
  const paths = []

  const guidesIndex = join(specDir, "guides", "index.md")
  if (existsSync(guidesIndex)) {
    paths.push(".trellis/spec/guides/index.md")
  }

  if (!existsSync(specDir)) return paths

  try {
    const subs = readdirSync(specDir).filter(name => {
      if (name.startsWith(".") || name === "guides") return false
      try {
        return statSync(join(specDir, name)).isDirectory()
      } catch {
        return false
      }
    }).sort()

    for (const sub of subs) {
      const indexFile = join(specDir, sub, "index.md")
      if (existsSync(indexFile)) {
        paths.push(`.trellis/spec/${sub}/index.md`)
      } else {
        if (allowedPkgs !== null && !allowedPkgs.has(sub)) continue
        try {
          const nested = readdirSync(join(specDir, sub)).filter(name => {
            try {
              return statSync(join(specDir, sub, name)).isDirectory()
            } catch {
              return false
            }
          }).sort()
          for (const layer of nested) {
            const nestedIndex = join(specDir, sub, layer, "index.md")
            if (existsSync(nestedIndex)) {
              paths.push(`.trellis/spec/${sub}/${layer}/index.md`)
            }
          }
        } catch {
          // Ignore directory read errors
        }
      }
    }
  } catch {
    // Ignore spec directory read errors
  }

  return paths
}

function readDeveloper(directory) {
  try {
    const content = readFileSync(join(directory, ".trellis", ".developer"), "utf-8")
    for (const line of content.split(/\r?\n/)) {
      if (line.startsWith("name=")) return line.slice("name=".length).trim()
    }
  } catch {
    // Ignore missing developer file
  }
  return "(not initialized)"
}

function runGit(directory, args) {
  try {
    return execFileSync("git", args, {
      cwd: directory,
      timeout: 3000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
  } catch {
    return ""
  }
}

function buildCompactCurrentState(ctx, platformInput, specIndexPaths) {
  const directory = ctx.directory
  const lines = []
  lines.push(`Developer: ${readDeveloper(directory)}`)

  const branch = runGit(directory, ["branch", "--show-current"]) || "(detached)"
  const dirtyCount = runGit(directory, ["status", "--porcelain"])
    .split(/\r?\n/)
    .filter(line => line.trim()).length
  lines.push(`Git: branch ${branch}; ${dirtyCount === 0 ? "clean" : `dirty ${dirtyCount} paths`}.`)

  const active = ctx.getActiveTask(platformInput)
  if (active.taskPath) {
    const taskDir = ctx.resolveTaskDir(active.taskPath)
    let status = "unknown"
    if (taskDir) {
      try {
        const data = JSON.parse(readFileSync(join(taskDir, "task.json"), "utf-8"))
        status = data.status || "unknown"
      } catch {
        // Ignore parse errors
      }
    }
    lines.push(`Current task: ${active.taskPath}; status=${status}.`)
  } else {
    lines.push("Current task: none.")
  }

  const tasksDir = join(directory, ".trellis", "tasks")
  if (existsSync(tasksDir)) {
    try {
      const activeTasks = readdirSync(tasksDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name !== "archive" && existsSync(join(tasksDir, entry.name, "task.json")))
      lines.push(`Active tasks: ${activeTasks.length} total. Use \`python3 ./.trellis/scripts/task.py list --mine\` only if needed.`)
    } catch {
      // Ignore task list errors
    }
  }

  const developer = readDeveloper(directory)
  const workspaceDir = join(directory, ".trellis", "workspace", developer)
  if (developer !== "(not initialized)" && existsSync(workspaceDir)) {
    try {
      const journals = readdirSync(workspaceDir)
        .filter(name => /^journal-\d+\.md$/.test(name))
        .sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0))
      const journal = journals[journals.length - 1]
      if (journal) {
        const journalPath = join(workspaceDir, journal)
        const lineCount = readFileSync(journalPath, "utf-8").split(/\r?\n/).length
        lines.push(`Journal: .trellis/workspace/${developer}/${journal}, ${lineCount} / 2000 lines.`)
      }
    } catch {
      // Ignore journal errors
    }
  }

  if (specIndexPaths.length > 0) {
    lines.push(`Spec indexes: ${specIndexPaths.length} available.`)
  }

  return lines.join("\n")
}

export function buildSessionContext(ctx, platformInput = null) {
  const directory = ctx.directory
  const contextKey = typeof ctx.getContextKey === "function"
    ? ctx.getContextKey(platformInput)
    : null

  const config = loadTrellisConfig(directory, contextKey)
  const allowedPkgs = resolveSpecScope(config)
  const paths = collectSpecIndexPaths(directory, allowedPkgs)

  const parts = []

  parts.push(`<session-context>
Trellis compact SessionStart context. Use it to orient the session; load details on demand.
</session-context>`)
  parts.push(FIRST_REPLY_NOTICE)

  const legacyWarning = checkLegacySpec(directory, config)
  if (legacyWarning) {
    parts.push(`<migration-warning>\n${legacyWarning}\n</migration-warning>`)
  }

  parts.push("<current-state>")
  parts.push(buildCompactCurrentState(ctx, platformInput, paths))
  parts.push("</current-state>")

  const workflowContent = ctx.readProjectFile(".trellis/workflow.md")
  if (workflowContent) {
    const allLines = workflowContent.split("\n")
    const overviewLines = [
      "# Development Workflow - Session Summary",
      "Full guide: .trellis/workflow.md. Step detail: `python3 ./.trellis/scripts/get_context.py --mode phase --step <X.Y>`.",
      "",
    ]

    let rangeStart = -1
    let rangeEnd = allLines.length
    for (let i = 0; i < allLines.length; i++) {
      const stripped = allLines[i].trim()
      if (rangeStart === -1 && stripped === "## Phase Index") {
        rangeStart = i
      } else if (rangeStart !== -1 && stripped === "## Phase 1: Plan") {
        rangeEnd = i
        break
      }
    }
    if (rangeStart !== -1) {
      const strippedStateBlocks = allLines
        .slice(rangeStart, rangeEnd)
        .join("\n")
        .replace(/\[workflow-state:([A-Za-z0-9_-]+)\]\s*\n[\s\S]*?\n\s*\[\/workflow-state:\1\]\n?/g, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/^\[(?!\/?workflow-state:)\/?[^\]\n]+\]\s*\n?/gm, "")
        .replace(/\n{3,}/g, "\n\n")
      overviewLines.push(strippedStateBlocks.trimEnd())
    }

    parts.push("<trellis-workflow>")
    parts.push(overviewLines.join("\n").trimEnd())
    parts.push("</trellis-workflow>")
  }

  parts.push("<guidelines>")
  parts.push(
    "Task context order for implementation/check: jsonl entries -> `prd.md` -> " +
    "`design.md if present` -> `implement.md if present`. Missing optional artifacts " +
    "are skipped for lightweight tasks.\n"
  )

  if (paths.length > 0) {
    parts.push("## Available indexes (read on demand)")
    for (const p of paths) {
      parts.push(`- ${p}`)
    }
    parts.push("")
  }

  parts.push(
    "Discover more via: " +
    "`python3 ./.trellis/scripts/get_context.py --mode packages`"
  )
  parts.push("</guidelines>")

  const taskStatus = getTaskStatus(ctx, platformInput)
  parts.push(`<task-status>\n${taskStatus}\n</task-status>`)

  parts.push(`<ready>
Context loaded. Follow <task-status>. Load workflow/spec/task details only when needed.
</ready>`)

  return parts.join("\n\n")
}

function getTrellisMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return {}
  }

  const trellis = metadata.trellis
  if (!trellis || typeof trellis !== "object") {
    return {}
  }

  return trellis
}

function markPartAsSessionStart(part) {
  const metadata = part.metadata && typeof part.metadata === "object"
    ? part.metadata
    : {}
  part.metadata = {
    ...metadata,
    trellis: {
      ...getTrellisMetadata(metadata),
      sessionStart: true,
    },
  }
}

function hasSessionStartMarker(part) {
  if (!part || part.type !== "text" || typeof part.text !== "string") {
    return false
  }

  return getTrellisMetadata(part.metadata).sessionStart === true
}

export function hasInjectedTrellisContext(messages) {
  if (!Array.isArray(messages)) {
    return false
  }

  return messages.some(message => {
    if (!message?.info || message.info.role !== "user" || !Array.isArray(message.parts)) {
      return false
    }

    return message.parts.some(hasSessionStartMarker)
  })
}

export async function hasPersistedInjectedContext(client, directory, sessionID) {
  try {
    const response = await client.session.messages({
      path: { id: sessionID },
      query: { directory },
      throwOnError: true,
    })
    return hasInjectedTrellisContext(response.data || [])
  } catch (error) {
    debugLog(
      "session",
      "Failed to read session history for dedupe:",
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}

export function markContextInjected(part) {
  markPartAsSessionStart(part)
}
