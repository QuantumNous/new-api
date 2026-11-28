/*
 * Temporary workaround for upstream codex CLI bug
 * https://github.com/openai/codex/issues/19425 — MCP tools registered via
 * `mcp_servers.*` are not exposed to the model in `codex exec --experimental-json`
 * mode (which is what `@openai/codex-sdk` uses). The MCP handshake completes
 * and `tools/list` succeeds, but codex never registers the tools as
 * model-callable functions.
 *
 * Until that's fixed upstream, this file implements a CLI-based relay:
 *
 *   1. A small Node script is written into harness-owned session state at turn
 *      start (`buildCliShimScript`). It accepts `<toolName> <jsonInput>` as
 *      argv, POSTs to the same HTTP relay the MCP shim uses, and prints the
 *      result to stdout.
 *
 *   2. Tool descriptions and invocation instructions are injected into the
 *      initial user prompt by the host adapter, telling the model to call host
 *      tools by running `node <shim-path> <toolName> '<jsonInput>'` via its
 *      built-in `bash` tool.
 *
 *   3. The bridge's event loop suppresses the matching `command_execution`
 *      events (`isToolRelayCommand`) so callers receive clean `tool-call` /
 *      `tool-result` events from the HTTP relay rather than seeing the
 *      relay invocations as raw bash commands.
 *
 * Once #19425 is fixed and MCP tools are properly exposed in exec mode, the
 * three hookpoints in `bridge/index.ts` can be removed along with this file.
 */
export const CLI_SHIM_FILENAME = 'harness-tool.mjs';

export function buildCliShimScript({
  relayPort,
}: {
  relayPort: number;
}): string {
  return `#!/usr/bin/env node
const [toolName, inputJson = '{}'] = process.argv.slice(2);
if (!toolName) {
  console.error('Usage: harness-tool <tool_name> <json_input>');
  process.exit(64);
}
let input;
try {
  input = JSON.parse(inputJson);
} catch (error) {
  console.error('Invalid JSON input: ' + (error instanceof Error ? error.message : String(error)));
  process.exit(64);
}
const requestId = 'cli-' + Date.now() + '-' + Math.random().toString(16).slice(2);
const response = await fetch('http://127.0.0.1:${relayPort}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requestId, toolName, input }),
});
const text = await response.text();
let payload;
try {
  payload = text ? JSON.parse(text) : {};
} catch {
  payload = { error: text };
}
if (!response.ok || payload.error) {
  console.error(String(payload.error ?? ('tool relay failed with HTTP ' + response.status)));
  process.exit(1);
}
console.log(JSON.stringify(payload.result ?? payload, null, 2));
`;
}

export function isToolRelayCommand({
  command,
  cliShimPath,
}: {
  command: string;
  cliShimPath: string;
}): boolean {
  return parseToolRelayCommands({ command, cliShimPath }) !== undefined;
}

export function parseToolRelayCommand({
  command,
  cliShimPath,
}: {
  command: string;
  cliShimPath: string;
}): { toolName: string; input: unknown } | undefined {
  const calls = parseToolRelayCommands({ command, cliShimPath });
  return calls?.length === 1 ? calls[0] : undefined;
}

export function parseToolRelayCommands({
  command,
  cliShimPath,
}: {
  command: string;
  cliShimPath: string;
}): Array<{ toolName: string; input: unknown }> | undefined {
  return parseToolRelayCommandsInternal({ command, cliShimPath, depth: 0 });
}

function parseToolRelayCommandsInternal({
  command,
  cliShimPath,
  depth,
}: {
  command: string;
  cliShimPath: string;
  depth: number;
}): Array<{ toolName: string; input: unknown }> | undefined {
  const commands = splitShellAndCommands(command);
  if (!commands) return undefined;
  if (commands.length > 1) {
    const relayCalls: Array<{ toolName: string; input: unknown }> = [];
    for (const nestedCommand of commands) {
      const nestedCalls = parseToolRelayCommandsInternal({
        command: nestedCommand,
        cliShimPath,
        depth,
      });
      if (!nestedCalls) return undefined;
      relayCalls.push(...nestedCalls);
    }
    return relayCalls;
  }

  const argv = parseShellWords(command);
  if (!argv) return undefined;

  const relayCall = parseDirectToolRelayArgv({ argv, cliShimPath });
  if (relayCall) return [relayCall];

  const innerCommand = extractShellEvalCommand(argv);
  if (!innerCommand || depth >= 2) return undefined;
  return parseToolRelayCommandsInternal({
    command: innerCommand,
    cliShimPath,
    depth: depth + 1,
  });
}

function parseDirectToolRelayArgv({
  argv,
  cliShimPath,
}: {
  argv: string[];
  cliShimPath: string;
}): { toolName: string; input: unknown } | undefined {
  if (argv.length < 3 || argv.length > 4) return undefined;
  if (argv[0] !== 'node' || argv[1] !== cliShimPath) return undefined;
  const toolName = argv[2];
  if (!toolName) return undefined;
  try {
    return { toolName, input: JSON.parse(argv[3] ?? '{}') };
  } catch {
    return undefined;
  }
}

function extractShellEvalCommand(argv: string[]): string | undefined {
  if (argv.length !== 3) return undefined;
  const shellName = argv[0].split('/').at(-1);
  if (shellName !== 'bash' && shellName !== 'sh' && shellName !== 'zsh') {
    return undefined;
  }
  if (argv[1] !== '-c' && argv[1] !== '-lc') return undefined;
  return argv[2];
}

function splitShellAndCommands(command: string): string[] | undefined {
  const commands: string[] = [];
  let start = 0;
  let quote: '"' | "'" | undefined;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote === "'") {
      if (char === "'") quote = undefined;
      continue;
    }
    if (quote === '"') {
      if (char === '"') {
        quote = undefined;
      } else if (char === '\\') {
        i++;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '\\') {
      i++;
      continue;
    }
    if (char === '&' && command[i + 1] === '&') {
      const nestedCommand = command.slice(start, i).trim();
      if (!nestedCommand) return undefined;
      commands.push(nestedCommand);
      start = i + 2;
      i++;
    }
  }

  if (quote) return undefined;
  const nestedCommand = command.slice(start).trim();
  if (!nestedCommand) return undefined;
  commands.push(nestedCommand);
  return commands;
}

function parseShellWords(command: string): string[] | undefined {
  const words: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let hasCurrent = false;

  const pushCurrent = () => {
    if (!hasCurrent) return;
    words.push(current);
    current = '';
    hasCurrent = false;
  };

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote === "'") {
      if (char === "'") {
        quote = undefined;
      } else {
        current += char;
      }
      hasCurrent = true;
      continue;
    }
    if (quote === '"') {
      if (char === '"') {
        quote = undefined;
      } else if (char === '\\' && i + 1 < command.length) {
        current += command[++i];
      } else {
        current += char;
      }
      hasCurrent = true;
      continue;
    }
    if (/\s/.test(char)) {
      pushCurrent();
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      hasCurrent = true;
      continue;
    }
    if (char === '\\' && i + 1 < command.length) {
      current += command[++i];
      hasCurrent = true;
      continue;
    }
    if (/[;&|<>()`$]/.test(char)) return undefined;
    current += char;
    hasCurrent = true;
  }
  if (quote) return undefined;
  pushCurrent();
  return words;
}
