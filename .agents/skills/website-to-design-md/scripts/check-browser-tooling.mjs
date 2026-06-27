#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";

const targetCwd = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function which(binary) {
  const result = run("bash", ["-lc", `command -v ${binary}`]);
  if (!result.ok || !result.stdout) {
    return null;
  }
  return result.stdout.split("\n")[0].trim();
}

function previewHelp(commandPath) {
  if (!commandPath) {
    return null;
  }

  const result = run(commandPath, ["--help"]);
  if (!result.ok) {
    return null;
  }

  return result.stdout.split(/\r?\n/).find(Boolean) ?? null;
}

const nodePath = which("node");
const npmPath = which("npm");
const agentBrowserPath = which("agent-browser");

const result = {
  cwd: targetCwd,
  node: {
    available: Boolean(nodePath),
    path: nodePath,
    version: nodePath ? run(nodePath, ["-v"]).stdout || null : null,
  },
  npm: {
    available: Boolean(npmPath),
    path: npmPath,
    version: npmPath ? run(npmPath, ["-v"]).stdout || null : null,
  },
  agentBrowser: {
    available: Boolean(agentBrowserPath),
    path: agentBrowserPath,
    helpPreview: previewHelp(agentBrowserPath),
  },
  usableTools: agentBrowserPath ? ["agent-browser"] : [],
  recommendedTool: agentBrowserPath ? "agent-browser" : "none",
  recommendedMode: agentBrowserPath ? "agent-browser-eval" : "none",
  shouldInstallAgentBrowser: !agentBrowserPath,
  installPlan: agentBrowserPath
    ? []
    : [
        "Install or expose the `agent-browser` CLI in PATH.",
        "Verify availability with `agent-browser --help`.",
        "Then use `agent-browser open`, `agent-browser wait`, and `agent-browser eval` for extraction.",
      ],
};

console.log(JSON.stringify(result, null, 2));
