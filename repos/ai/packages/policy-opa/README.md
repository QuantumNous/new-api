# @ai-sdk/policy-opa

Policy-as-code authorization for AI SDK tool calls, powered by [Open Policy Agent](https://www.openpolicyagent.org/).

Write your "what can this agent do?" rules in a `.rego` file. Plug them into `generateText` / `streamText` / `ToolLoopAgent` as a `toolApproval` configuration. The SDK enforces them at every tool call, with the same wire format used by built-in approvals (`tool-approval-request` / `tool-approval-response`).

## Why

`toolApproval` in `ai` already supports three outcomes: `approved`, `denied`, and `user-approval` (the human-in-the-loop case). What it does not give you is a place to author the rules that does not require a code deploy. Authorization is the kind of thing where you want a written, testable artifact reviewed by the right people, not a function buried in your agent's setup code.

This package fills that gap. Rules live in `.rego`. They are evaluated by OPA (in-process via WASM, or out-of-process via HTTP) and the result is mapped to the SDK's `ToolApprovalStatus`. Nothing new on the wire; everything sits on top of the existing public `toolApproval` callback.

## Install

```sh
pnpm add @ai-sdk/policy-opa
# pick one (or both) of the OPA backends:
pnpm add @open-policy-agent/opa-wasm   # in-process WASM evaluation
pnpm add @open-policy-agent/opa         # HTTP client to a running OPA server
```

The OPA backends are optional peer dependencies. The package only loads the one you import.

## How it works

Without policy:

```
model → tool call → tool.execute → result back to model
```

With policy:

```
model
  → tool call
  → toolApproval evaluates  ──┬──► approved      → tool.execute → result back to model
                              ├──► denied        → tool-approval-response (auto, with reason) → model sees the denial
                              └──► user-approval → tool-approval-request → wait for human
                                                                          → tool-approval-response on resume
                                                                          → tool.execute or denial
```

The policy is consulted **before** every tool dispatch. Auto-deny does not require a human; user-approval pauses the run until a human responds with a `tool-approval-response`. The model sees the denial as a structured result on its next step and can reason about it (for example, "I can't drop that table, let me try something else").

## Quick start

```ts
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { opaPolicy, wasmPolicyClient } from '@ai-sdk/policy-opa';
import { readFile } from 'node:fs/promises';

// 1. Load the compiled policy bundle.
const wasm = await readFile('./policy.wasm');
const client = await wasmPolicyClient({ wasm });

// 2. Build the toolApproval configuration.
const toolApproval = opaPolicy({
  client,
  path: 'agent/call/decision',
});

// 3. Pass it to generateText. Everything else is normal.
const result = await generateText({
  model: anthropic('claude-sonnet-4-5'),
  tools: { git, bash, queryLogs },
  toolApproval,
  prompt: 'find the failing test and push the fix',
});
```

## Writing the Rego policy

The adapter expects the policy to emit a decision object with one of three `decision` values. `reason` is optional and gets surfaced back to the model (for `deny`) or to the human approver (for `requires-approval`).

```rego
package agent.call

# Default to "not-applicable" so unmatched calls fall through to whatever
# behavior toolApproval has configured for them. Use { decision: "deny" } if
# you want to default-deny instead.
default decision := { "decision": "not-applicable" }

# Hard deny: pushes are never allowed automatically.
decision := { "decision": "deny", "reason": "pushes require human review" } {
  input.tool.name == "git"
  input.args.args[0] == "push"
}

# Auto-allow: read-only git operations.
decision := { "decision": "allow" } {
  input.tool.name == "git"
  input.args.args[0] in {"status", "log", "diff", "show"}
}

# Human-in-the-loop: kubectl by oncall during business hours.
decision := { "decision": "requires-approval", "reason": "kubectl by oncall" } {
  input.tool.name == "kubectl"
  input.runtimeContext.role == "sre-oncall"
}
```

The adapter also accepts the legacy boolean shape (`{ "allow": true | false, "reason": "..." }`) so existing rules migrate without rewriting.

### Errors fail closed

If the backend itself errors (OPA server unreachable, WASM fault, a misbuilt bundle that yields no result), `opaPolicy` returns `{ type: 'denied' }` with the underlying message as the reason. The error never rejects out of the `toolApproval` callback and never aborts the run. A backend outage blocks the affected tool call rather than silently letting it through. This matches `opaCapabilityMiddleware`, which also fails closed.

Note this is distinct from a Rego rule that returns no matching decision: that normalizes to `not-applicable` ("no opinion"), which the SDK treats as allow. Use `default decision := { "decision": "deny" }` in your policy if you want unmatched calls to be denied too.

### What the adapter passes as `input`

By default, the OPA input shape is:

```jsonc
{
  "tool": { "name": "git" },
  "args": { "args": ["push", "origin", "main"] },
  "messages": [
    /* model messages for this generation */
  ],
  "runtimeContext": {
    /* whatever you passed as runtimeContext */
  },
}
```

Override the shape with `toInput`:

```ts
opaPolicy({
  client,
  path: 'agent/call/decision',
  toInput: ({ toolCall, runtimeContext }) => ({
    action: toolCall.toolName,
    principal: runtimeContext.role,
    resource: toolCall.input,
  }),
});
```

### Testing the policy

OPA ships its own test framework:

```rego
# policy_test.rego
package agent.call

test_push_denied {
  decision.decision == "deny" with input as {
    "tool": { "name": "git" },
    "args": { "args": ["push", "origin", "main"] }
  }
}

test_status_allowed {
  decision.decision == "allow" with input as {
    "tool": { "name": "git" },
    "args": { "args": ["status"] }
  }
}
```

Run `opa test policy.rego policy_test.rego`. These tests run in CI without involving the SDK at all, which is the main practical reason policy-as-code beats policy-in-application-code.

## Loading the policy

### Option A: WASM (in-process)

Compile the `.rego` to WASM ahead of time:

```sh
opa build -t wasm -e 'agent/call/decision' -o bundle.tar.gz policy.rego
tar -xzf bundle.tar.gz /policy.wasm
```

Load it at startup:

```ts
import { wasmPolicyClient, opaPolicy } from '@ai-sdk/policy-opa';
import { readFile } from 'node:fs/promises';

const wasm = await readFile('./policy.wasm');
const client = await wasmPolicyClient({ wasm });

const toolApproval = opaPolicy({ client, path: 'agent/call/decision' });
```

No network call per decision. Good fit when you ship the policy with the app, or fetch it from object storage at startup. Hot-reloading means rebuilding the WASM and re-instantiating the client.

### Option B: HTTP (running OPA server)

Run OPA somewhere:

```yaml
# docker-compose.yml
services:
  opa:
    image: openpolicyagent/opa:latest
    command: ['run', '--server', '--addr', ':8181', '/policies']
    ports: ['8181:8181']
    volumes: ['./policies:/policies']
```

Point the client at it:

```ts
import { httpPolicyClient, opaPolicy } from '@ai-sdk/policy-opa';

const client = httpPolicyClient({ url: 'http://localhost:8181' });
const toolApproval = opaPolicy({ client, path: 'agent/call/decision' });
```

One HTTP round-trip per decision. Good fit when policies change frequently and you want hot-reload without redeploying the app, or when multiple services share one OPA. Headers can be supplied for Styra DAS / EOPA authentication:

```ts
httpPolicyClient({
  url: 'https://opa.internal',
  headers: { Authorization: `Bearer ${token}` },
});
```

## Transitive enforcement: composite tools

`toolApproval` only fires when the model calls a tool directly. Anywhere your agent has a coarse "dispatcher" tool that can perform many fine-grained actions, the model can bypass a per-action rule by going through the dispatcher. Classic example: the agent has a granular `git` tool that's gated, plus a coarse `bash` tool that isn't. `bash 'git push'` skips the `git` rule.

The fix lives inside the dispatcher's `toolApproval` entry, not inside the tool's `execute`. Parse the dispatcher input down to a `(name, args)` pair, then evaluate it against the same rule the direct tool uses. The granular rule fires whether the model called the granular tool directly or routed through the dispatcher.

To avoid writing the matching logic twice (once for the direct tool, once for the dispatcher), define it once and reuse it. Two forms work; pick whichever is easier to maintain for your codebase.

### Form A: shared TypeScript predicate

The matching logic lives in TS. Both approvals call the same predicate, varying only in how they extract `(name, args)` from the tool input. No OPA round-trip needed for the shared check, but you lose the policy-as-code authoring story for the rule itself.

```ts
function deniedForAction(name: string, args: string[]): string | undefined {
  if (name === 'git' && args[0] === 'push') {
    return 'pushes require human review';
  }
  return undefined;
}

const toolApproval = ({ toolCall }) => {
  if (toolCall.toolName === 'bash') {
    const [name, ...args] = (
      toolCall.input as { command: string }
    ).command.split(/\s+/);
    const reason = deniedForAction(name, args);
    if (reason) return { type: 'denied', reason };
  }
  if (toolCall.toolName === 'git') {
    const args = (toolCall.input as { args: string[] }).args;
    const reason = deniedForAction('git', args);
    if (reason) return { type: 'denied', reason };
  }
  return 'approved';
};

await generateText({ model, tools: { git, bash }, toolApproval, prompt });
```

### Form B: shared Rego helper rule

The matching logic lives in Rego. Both approvals call `opaPolicy` with the same `path`, varying only in how their `toInput` derives the `(kind, args)` pair. You get the authoring story (rules live in `.rego`, tested with `opa test`, reviewed independently), at the cost of one OPA evaluation per call.

```rego
package agent.action

# Shared helper: classifies a logical action regardless of which tool surface
# it arrived on. The dispatcher's toInput is responsible for setting
# `input.kind` and `input.args` consistently.
deny_reason["pushes require human review"] {
  input.kind == "git"
  input.args[0] == "push"
}

decision := { "decision": "deny", "reason": r } {
  r := deny_reason[_]
}
```

```ts
import { generateText } from 'ai';
import { opaPolicy, wasmPolicyClient } from '@ai-sdk/policy-opa';

const client = await wasmPolicyClient({ wasm });

const gitApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => ({
    kind: 'git',
    args: (toolCall.input as { args: string[] }).args,
  }),
});

const bashApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => {
    const { command } = toolCall.input as { command: string };
    const [bin, ...rest] = command.split(/\s+/);
    return { kind: bin, args: rest };
  },
});

await generateText({
  model,
  tools: { git, bash },
  toolApproval: {
    git: gitApproval,
    bash: bashApproval,
  },
  prompt,
});
```

The patterns below are all the same five lines: derive a logical `(kind, args)` from the dispatcher input, ask OPA, return the SDK status. What changes per domain is only the parsing.

### SQL meta-tool

```ts
const sqlApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => {
    const sql = (toolCall.input as { sql: string }).sql;
    const verb = sql.trim().split(/\s+/)[0]?.toLowerCase(); // select | insert | delete | drop
    return { kind: `db.${verb}`, sql };
  },
});
```

Rules like `input.kind == "db.delete"` or `input.kind == "db.drop"` fire whether the model called those granular tools directly or routed a `DROP TABLE` through `db.query`. For finer matches you can parse the statement with a SQL AST library and emit the affected tables in the input shape.

### HTTP dispatcher

```ts
const httpApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => {
    const { method, url } = toolCall.input as { method: string; url: string };
    const u = new URL(url);
    return {
      kind: `http.${method.toLowerCase()}`,
      host: u.host,
      path: u.pathname,
    };
  },
});
```

Rules can now match by host (`input.host == "api.production.internal"`), by method (`input.kind == "http.delete"`), or by both.

### MCP proxy

When an agent talks to an MCP server via a single `mcp.invoke` meta-tool, the server's entire surface arrives as one giant `*`-shaped capability. Narrow it back down inside the proxy's `toolApproval`:

```ts
const mcpApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => {
    const { name, input } = toolCall.input as { name: string; input: unknown };
    return { kind: `mcp.${name}`, args: input };
  },
});
```

A direct alternative is `wrapMcpTools` (below), which expands the MCP surface into per-tool entries so each one gets its own rule lookup; pick whichever model fits the way you discover and dispatch.

### Browser dispatcher

```ts
const browserApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => {
    const { action, target } = toolCall.input as {
      action: 'click' | 'type' | 'navigate';
      target: string;
    };
    return { kind: `browser.${action}`, target };
  },
});
```

### Shell tool: gating git subcommands

A `bash` tool (such as [vercel-labs/bash-tool](https://github.com/vercel-labs/bash-tool), input `{ command }`) can run any git operation, so the model could route a `git clone` or `git push` through it and skip a granular `git` rule. Gate it by parsing the command down to a git subcommand and deciding on that — and **deny anything you cannot reduce to a single clean git invocation**. Bash is adversarial to parse, so "can't prove it's safe" means "deny".

```ts
// Returns the git invocation, or null if `command` is not a single clean git
// command. Shell metacharacters (&& || ; | redirects, subshells, substitution)
// return null so the policy fails closed.
function parseGitInvocation(command: string) {
  if (/[;&|<>`$(){}\\\n]/.test(command)) return null;
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== 'git' || tokens.length < 2) return null;
  const [, subcommand, ...args] = tokens;
  return { subcommand, args };
}

const bashApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => {
    const { command } = toolCall.input as { command: string };
    const git = parseGitInvocation(command);
    // Unparseable / non-git → kind:'bash' → the policy default-denies it.
    return git
      ? { kind: 'git', subcommand: git.subcommand, args: git.args }
      : { kind: 'bash', command };
  },
});
```

The matching Rego allows only read-only git and denies the rest by default:

```rego
package agent.action

import rego.v1

# Subcommands that are read-only in every form.
git_read_only := {"status", "log", "diff", "show"}

# Default deny covers clone, push, pull, fetch, reset, and every kind:"bash"
# the parser refused to vouch for.
default decision := {"decision": "deny", "reason": "command not permitted by policy"}

decision := {"decision": "allow"} if {
	input.kind == "git"
	git_read_only[input.subcommand]
}

decision := {"decision": "deny", "reason": msg} if {
	input.kind == "git"
	not git_read_only[input.subcommand]
	msg := sprintf("git %s is not permitted (read-only git only)", [input.subcommand])
}
```

Note the allowlist is the four subcommands that are read-only in _every_ form. `git branch` and `git remote` are deliberately left out: `git branch -D` deletes and `git remote update` fetches, so a subcommand-level allowlist is too coarse for them — they need an additional listing-form check on their args. The [`examples/git-in-bash`](./examples/git-in-bash) policy shows that check in full.

A granular `git` tool shares the exact same rule, varying only in how it derives the action:

```ts
const gitApproval = opaPolicy({
  client,
  path: 'agent/action/decision',
  toInput: ({ toolCall }) => {
    const args = (toolCall.input as { args: string[] }).args;
    return { kind: 'git', subcommand: args[0], args: args.slice(1) };
  },
});
```

So `git status` is allowed on both surfaces, `git clone …` is denied on both, and `cd /tmp && git clone …` (a compound bash command) is denied because the parser refuses it. A complete, runnable version — `policy.rego`, `policy_test.rego` (run with `opa test`), the parser and its tests, and a `generateText` demo — lives in [`examples/git-in-bash`](./examples/git-in-bash). For a stricter parser, swap the regex for a shell-aware tokenizer (e.g. `shell-quote`).

### The honest limitation

This approach gates dispatch at the model's call boundary: the agent asks to run `bash 'git push'`, the policy sees `{ kind: 'git', args: ['push'] }`, the call is denied before `bash.execute` is ever invoked. What it does **not** defend against is a tool that, once approved, performs additional side effects beyond what its input describes. If `bash.execute` runs `command` and then _also_ sends a side-channel HTTP request, no policy at the call boundary can stop it.

The framework's job here is to give you one obvious place to write per-action authorization for the cases this design covers. For stronger guarantees against arbitrary side effects, run untrusted execution in an out-of-band sandbox (Vercel Sandbox, Firecracker, containers) and treat the sandbox boundary, not the tool boundary, as the trust frontier.

## Optional policy: allow-all when no policy is configured

Most apps load the policy from one source (a WASM bundle, a remote OPA server) and only want enforcement when that source is available. In local development, in CI, in a brand-new environment, you probably want the agent to just work without a policy file present.

`optionalOpaPolicy` makes this case a one-liner: pass `client: undefined` and the helper returns `undefined`, which is the same as not passing `toolApproval` at all (the SDK approves every tool call).

```ts
import { readFile } from 'node:fs/promises';
import { optionalOpaPolicy, wasmPolicyClient } from '@ai-sdk/policy-opa';

const wasm = process.env.POLICY_WASM_PATH
  ? await readFile(process.env.POLICY_WASM_PATH)
  : undefined;

const client = wasm ? await wasmPolicyClient({ wasm }) : undefined;

const toolApproval = optionalOpaPolicy({
  client,
  path: 'agent/call/decision',
});

await generateText({ model, tools, toolApproval, prompt });
```

Behavior:

- `POLICY_WASM_PATH` unset ➜ `client` is `undefined` ➜ `toolApproval` is `undefined` ➜ SDK allows all tool calls. The OPA modules are never loaded; lazy imports stay lazy.
- `POLICY_WASM_PATH` set ➜ policy loads, enforcement is on.

A symmetric option exists for the HTTP backend: gate `httpPolicyClient({ url })` on whether `OPA_URL` is set.

If you want stricter behavior (refuse to start without a policy), construct `opaPolicy` directly and let the missing-bytes case throw at startup. The "optional" framing is only for environments where you've intentionally decided absence means allow-all.

## Rolling out a new policy safely: shadow mode

Don't ship a new policy straight to enforce. The first version of any policy almost certainly denies things you didn't mean to deny, and you find out by breaking real agent runs. The fix is the same pattern Cloudflare uses for new rules and GitHub uses for new code-scanning checks: run the policy in **shadow mode** for a while, capture what it _would_ have decided, inspect, fix, then graduate.

`shadow(approval, opts)` wraps any `ToolApprovalConfiguration`. The wrapped policy is evaluated normally and the decision is reported via `onDecision`, but the SDK is told the call is approved regardless of what the policy said.

```ts
import { opaPolicy, shadow, wasmPolicyClient } from '@ai-sdk/policy-opa';

const client = await wasmPolicyClient({ wasm });

const toolApproval = shadow(
  opaPolicy({ client, path: 'agent/call/decision' }),
  {
    enforce: process.env.ENFORCE_POLICY === 'true',
    onDecision: event => {
      logger.info('policy.decision', {
        tool: event.toolCall.toolName,
        decision: event.decision.type,
        reason: event.decision.reason,
        enforced: event.enforced,
        wouldBlock: event.decision.type === 'denied',
      });
    },
  },
);

await generateText({ model, tools, toolApproval, prompt });
```

### Recommended rollout

1. Write the policy. Test it locally with `opa test`.
2. Wrap it in `shadow(...)` with `enforce: false` (the default) and an `onDecision` callback wired to your normal log / metrics pipeline.
3. Run for a while in your real environment. Inspect events where `decision.type === 'denied'` or `'user-approval'`: these are the calls the policy _would_ have changed.
4. Fix anything wrong with the policy. Iterate from step 2.
5. When the only `denied` / `user-approval` events are ones you actually want, flip `enforce: true`. The policy is now load-bearing.

Each event carries both the policy's verdict (`decision`) and what the SDK actually acted on (`effective`). In shadow mode they disagree whenever the policy returned anything other than approved; in enforce mode they always agree. Compare them in your dashboard to spot drift.

### Telemetry semantics

`onDecision` is fired **fire-and-forget**: a slow or throwing logger does not block tool execution and cannot break enforcement. Errors thrown from the callback are swallowed. The contract is "enforcement first, observability second."

If you want the opposite (enforcement waits for the audit log to commit), call your logger from inside the underlying `toolApproval` instead of through `shadow`.

## Defense in depth: capability scoping at the model boundary

`toolApproval` enforces policy when the model **tries to call** a tool. `opaCapabilityMiddleware` enforces it earlier, before the model is even told the tool exists. This is defense in depth: if a bug or regression lets something slip through the call-time gate, the middleware still prevents the model from seeing the disallowed tool in its first place.

```ts
import { wrapLanguageModel } from 'ai';
import { wasmPolicyClient, opaCapabilityMiddleware } from '@ai-sdk/policy-opa';

const client = await wasmPolicyClient({ wasm });

const wrappedModel = wrapLanguageModel({
  model: anthropic('claude-sonnet-4-5'),
  middleware: opaCapabilityMiddleware({
    client,
    path: 'agent/tools/allowed',
  }),
});

await generateText({ model: wrappedModel, tools, toolApproval, prompt });
```

The Rego rule at `path` returns either a `string[]` of allowed tool names or `{ tools: string[] }`. Function tools are matched by `name`; provider tools are matched by either their dotted `id` (`<provider>.<tool>`) or their bare `name`, so an allowlist authored with the plain name keeps them. Anything not in the allowlist gets dropped before the model sees the list.

Two non-obvious benefits beyond the security one:

- **Token savings.** The model doesn't read descriptions for tools it cannot call.
- **Better jailbreak rejection.** When the model is steered toward a denied tool, it responds with "I don't have access to that" rather than producing a tool call that gets blocked by `toolApproval`, which reads as friendlier in chat UIs.

### Failure mode

On a malformed OPA response or an evaluator error, the middleware **fails closed**: `params.tools` is set to `undefined`, so the model is told it has no tools available at all. Misconfiguration should not silently widen the agent's capability surface. If you want fail-open behavior, write the policy fallback in Rego (e.g., a default rule that returns the full tool list) rather than in the middleware.

## Scoping a discovered tool surface

When tools come from somewhere external (MCP discovery, a plugin registry, a remote agent catalog) you do not get to write per-tool rules ahead of time. You don't know which tools the server will expose until runtime. The risk: any tool you forgot to write a rule for is silently allowed.

`wrapMcpTools` closes that gap by making the resulting `toolApproval` configuration **total** over the discovered surface. Any tool the supplied approval does not match falls through to a configurable default:

```ts
import { opaPolicy, wasmPolicyClient, wrapMcpTools } from '@ai-sdk/policy-opa';

const discovered = await mcpClient.tools();
const client = await wasmPolicyClient({ wasm });

const { tools, toolApproval } = wrapMcpTools(
  discovered,
  opaPolicy({ client, path: 'agent/call/decision' }),
  { default: 'user-approval' }, // anything OPA does not match needs a human
);

await generateText({ model, tools, toolApproval, prompt });
```

Three useful defaults:

- `'user-approval'` (the default): uncovered tools require a human. Right choice when you trust the discovery source but want a safety net for tools you forgot about.
- `'denied'`: uncovered tools are blocked. Right choice for hard allowlist mode: the OPA policy enumerates what's allowed; everything else is rejected before the model can call it.
- `'approved'`: uncovered tools are allowed. Right choice only when the discovery source is fully trusted (rare; usually the wrong call for MCP).

Despite the name, the helper works on any `Record<string, Tool>`, not just MCP-discovered tools.

## API

Everything is exported from the package root, `@ai-sdk/policy-opa`.

### Engine-neutral core

- `shadow(approval, opts?)`: wrap any `ToolApprovalConfiguration` so the policy is evaluated and reported via `onDecision`, but the SDK acts as if every call was approved. Flip `opts.enforce: true` to graduate to real enforcement. Recommended starting point for any new policy.
- `wrapMcpTools(tools, approval, opts?)`: bundle a discovered tool set with a fallback approval policy so the resulting `toolApproval` configuration is total over the discovered surface. `opts.default` controls what happens to tools the supplied approval does not match (`'user-approval'` by default; use `'denied'` for hard allowlist mode).
- `PolicyClient`: interface implemented by the OPA backends. Use directly if you want to plug in a non-OPA engine.
- Helper types: `PolicyDecision`, `WrappedMcpTools`, `PolicyDecisionEvent`.

### OPA backend and adapters

- `wasmPolicyClient({ wasm, data? })`: async; loads a compiled OPA WASM bundle in-process. Optional `data` is passed to `setData` if the bundle exposes it.
- `httpPolicyClient({ url, headers? })`: sync; constructs a client against a running OPA server.
- `opaPolicy({ client, path, toInput? })`: returns a `ToolApprovalConfiguration` you pass to `generateText` / `streamText` / `ToolLoopAgent`. Fails closed (denies) if the backend errors.
- `optionalOpaPolicy({ client, path, toInput? })`: like `opaPolicy` but returns `undefined` when `client` is `undefined`, for environments where the policy file is optional and absence means allow-all.
- `opaCapabilityMiddleware({ client, path, toInput? })`: returns a `LanguageModelV4Middleware` that narrows `params.tools` to an OPA-supplied allowlist before the model sees them. Fails closed on malformed responses.
- `normalizeOpaDecision(result)`: exposed for users who want to call OPA themselves and just need the result normalization.

## Versioning

This package follows the AI SDK's release cadence. `peerDependencies` pins `ai` to the workspace version; the OPA backends are versioned independently.

## License

Apache-2.0.
