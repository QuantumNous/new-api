import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  commonTool,
  harnessV1DiagnosticFromBridgeFrame,
  HarnessCapabilityUnsupportedError,
  type HarnessV1,
  type HarnessV1Bootstrap,
  type HarnessV1BuiltinToolFiltering,
  type HarnessV1BuiltinTool,
  type HarnessV1ContinueTurnState,
  type HarnessV1DebugConfig,
  type HarnessV1PermissionMode,
  type HarnessV1Prompt,
  type HarnessV1PromptControl,
  type HarnessV1ResumeSessionState,
  type HarnessV1NetworkSandboxSession,
  type HarnessV1Session,
  type HarnessV1Skill,
  type HarnessV1StreamPart,
} from '@ai-sdk/harness';
import {
  classifyDiskLog,
  createBridgeErrorHandler,
  createBridgeStartupError,
  drainBridgeProcessStream,
  forwardBridgeProcessStream,
  markBridgeStarting,
  resolveSandboxHomeDir,
  SandboxChannel,
  shellQuote,
  waitForBridgeReady,
  writeSkills as writeHarnessSkills,
} from '@ai-sdk/harness/utils';
import {
  tool,
  type Experimental_SandboxSession,
  type Experimental_SandboxProcess,
} from '@ai-sdk/provider-utils';
import { WebSocket } from 'ws';
import { z } from 'zod/v4';
import {
  resolveClaudeCodeEnv,
  type ClaudeCodeAuthOptions,
} from './claude-code-auth';
import {
  outboundMessageSchema,
  type InboundMessage,
  type OutboundMessage,
} from './claude-code-bridge-protocol';
import type { ClaudeCodeThinkingConfig } from './claude-code-thinking';
import { VERSION } from './version';

type ClaudeCodeChannel = SandboxChannel<OutboundMessage, InboundMessage>;
type ClaudeCodeRespawnStrategy = 'replay' | 'rerun';

/**
 * Value to use in User-Agent and `x-client-app` headers.
 */
const CLAUDE_CODE_CLIENT_APP = `ai-sdk/harness-claude-code/${VERSION}`;

export type ClaudeCodeHarnessSettings = {
  readonly auth?: ClaudeCodeAuthOptions;
  /**
   * Anthropic model id the underlying `claude` CLI should use. Leaving this
   * unset defers to the CLI's default.
   */
  readonly model?: string;
  /**
   * Hard cap on how many internal turns the CLI can take before yielding
   * back to the caller. Unset means the CLI's default.
   */
  readonly maxTurns?: number;
  /**
   * Controls extended-thinking behavior and whether reasoning is summarized or
   * omitted. Defaults to `{ type: 'adaptive', display: 'summarized' }`.
   */
  readonly thinking?: ClaudeCodeThinkingConfig;
  /**
   * Override the port the bridge binds inside the sandbox. By default the
   * adapter uses the first port the sandbox declares via `sandbox.ports`.
   * Only set this if the sandbox declares multiple ports and the first one
   * is reserved for something else.
   */
  readonly port?: number;
  /** Maximum milliseconds to wait for the bridge to advertise its port. Defaults to 120000. */
  readonly startupTimeoutMs?: number;
};

/*
 * Every native tool the Claude Code CLI can invoke, declared as a `ToolSet`
 * keyed by what the bridge emits as `toolName` on the wire
 * (`commonName ?? nativeName`). Schemas transcribed from
 * `@anthropic-ai/claude-agent-sdk`'s `agentSdkTypes.d.ts`.
 *
 * `MCP` (the generic proxy tool inside the Claude Code SDK) is intentionally
 * omitted — the bridge filters out `mcp__harness-tools__*` tool names before
 * emitting them, and other MCP invocations come through with their own
 * server-tool names rather than the literal `'Mcp'` token.
 */
const CLAUDE_CODE_BUILTIN_TOOLS = {
  read: commonTool('read', {
    nativeName: 'Read',
    toolUseKind: 'readonly',
    description: 'Read file contents (text, image, PDF, notebook)',
    inputSchema: z.object({
      file_path: z.string(),
      offset: z.number().optional(),
      limit: z.number().optional(),
      pages: z.string().optional(),
    }),
  }),
  write: commonTool('write', {
    nativeName: 'Write',
    toolUseKind: 'edit',
    description: 'Overwrite or create a file at an absolute path',
    inputSchema: z.object({
      file_path: z.string(),
      content: z.string(),
    }),
  }),
  edit: commonTool('edit', {
    nativeName: 'Edit',
    toolUseKind: 'edit',
    description: 'Edit a file by exact string replacement',
    inputSchema: z.object({
      file_path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
      replace_all: z.boolean().optional(),
    }),
  }),
  bash: commonTool('bash', {
    nativeName: 'Bash',
    toolUseKind: 'bash',
    description: 'Execute a shell command, optionally in background',
    inputSchema: z.object({
      command: z.string(),
      timeout: z.number().optional(),
      description: z.string().optional(),
      run_in_background: z.boolean().optional(),
      dangerouslyDisableSandbox: z.boolean().optional(),
    }),
  }),
  glob: commonTool('glob', {
    nativeName: 'Glob',
    toolUseKind: 'readonly',
    description: 'Fast file-pattern search using glob syntax',
    inputSchema: z.object({
      pattern: z.string(),
      path: z.string().optional(),
    }),
  }),
  grep: commonTool('grep', {
    nativeName: 'Grep',
    toolUseKind: 'readonly',
    description: 'Regex search over file contents via ripgrep',
    inputSchema: z.object({
      pattern: z.string(),
      path: z.string().optional(),
      glob: z.string().optional(),
      output_mode: z
        .enum(['content', 'files_with_matches', 'count'])
        .optional(),
      '-B': z.number().optional(),
      '-A': z.number().optional(),
      '-C': z.number().optional(),
      context: z.number().optional(),
      '-n': z.boolean().optional(),
      '-i': z.boolean().optional(),
      '-o': z.boolean().optional(),
      type: z.string().optional(),
      head_limit: z.number().optional(),
      offset: z.number().optional(),
      multiline: z.boolean().optional(),
    }),
  }),
  webSearch: commonTool('webSearch', {
    nativeName: 'WebSearch',
    toolUseKind: 'readonly',
    description: 'Issue web search queries with optional domain filters',
    inputSchema: z.object({
      query: z.string(),
      allowed_domains: z.array(z.string()).optional(),
      blocked_domains: z.array(z.string()).optional(),
    }),
  }),

  WebFetch: tool({
    description: 'Fetch a URL and run a prompt against its content',
    inputSchema: z.object({
      url: z.string(),
      prompt: z.string(),
    }),
  }),
  NotebookEdit: tool({
    description: 'Edit, insert, or delete a Jupyter notebook cell',
    inputSchema: z.object({
      notebook_path: z.string(),
      new_source: z.string(),
      cell_id: z.string().optional(),
      cell_type: z.enum(['code', 'markdown']).optional(),
      edit_mode: z.enum(['replace', 'insert', 'delete']).optional(),
    }),
  }),
  TodoWrite: tool({
    description: 'Replace the session todo list',
    inputSchema: z.object({
      todos: z.array(
        z.object({
          content: z.string(),
          status: z.enum(['pending', 'in_progress', 'completed']),
          activeForm: z.string(),
        }),
      ),
    }),
  }),
  Agent: tool({
    description: 'Spawn a subagent with a task',
    inputSchema: z.object({
      description: z.string(),
      prompt: z.string(),
      subagent_type: z.string().optional(),
      model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
      run_in_background: z.boolean().optional(),
      name: z.string().optional(),
      team_name: z.string().optional(),
      mode: z
        .enum([
          'acceptEdits',
          'auto',
          'bypassPermissions',
          'default',
          'dontAsk',
          'plan',
        ])
        .optional(),
      isolation: z.literal('worktree').optional(),
    }),
  }),
  TaskCreate: tool({
    description: 'Create a task in the session-local task list',
    inputSchema: z.object({
      subject: z.string(),
      description: z.string(),
      activeForm: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  TaskGet: tool({
    description: 'Retrieve a task by id',
    inputSchema: z.object({ taskId: z.string() }),
  }),
  TaskUpdate: tool({
    description: 'Update fields of an existing task',
    inputSchema: z.object({
      taskId: z.string(),
      subject: z.string().optional(),
      description: z.string().optional(),
      activeForm: z.string().optional(),
      status: z
        .union([
          z.enum(['pending', 'in_progress', 'completed']),
          z.literal('deleted'),
        ])
        .optional(),
      addBlocks: z.array(z.string()).optional(),
      addBlockedBy: z.array(z.string()).optional(),
      owner: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  TaskList: tool({
    description: 'Return all tasks in the session-local task list',
    inputSchema: z.object({}),
  }),
  TaskStop: tool({
    description: 'Stop a running background task by id',
    inputSchema: z.object({
      task_id: z.string().optional(),
      shell_id: z.string().optional(),
    }),
  }),
  TaskOutput: tool({
    description: 'Poll for output from a background task',
    inputSchema: z.object({
      task_id: z.string(),
      block: z.boolean(),
      timeout: z.number(),
    }),
  }),
  Monitor: tool({
    description: 'Run and monitor a shell command',
    inputSchema: z.object({
      command: z.string(),
      description: z.string().optional(),
      timeout_ms: z.number().optional(),
      persistent: z.boolean().optional(),
    }),
  }),
  ListMcpResources: tool({
    description: 'List resources available from MCP servers',
    inputSchema: z.object({ server: z.string().optional() }),
  }),
  ReadMcpResource: tool({
    description: 'Read a specific MCP resource by URI',
    inputSchema: z.object({ server: z.string(), uri: z.string() }),
  }),
  ExitPlanMode: tool({
    description: 'Exit plan mode with optional permission approvals',
    inputSchema: z.looseObject({
      allowedPrompts: z
        .array(
          z.object({
            tool: z.literal('Bash'),
            prompt: z.string(),
          }),
        )
        .optional(),
    }),
  }),
  EnterWorktree: tool({
    description: 'Create or enter an isolated git worktree',
    inputSchema: z.object({
      name: z.string().optional(),
      path: z.string().optional(),
    }),
  }),
  ExitWorktree: tool({
    description: 'Exit the current worktree session',
    inputSchema: z.object({
      action: z.enum(['keep', 'remove']),
      discard_changes: z.boolean().optional(),
    }),
  }),
  AskUserQuestion: tool({
    description: 'Ask the user multiple-choice questions via a structured UI',
    inputSchema: z.object({
      questions: z
        .array(
          z.object({
            question: z.string(),
            header: z.string(),
            options: z.array(
              z.object({
                label: z.string(),
                description: z.string(),
                preview: z.string().optional(),
              }),
            ),
            multiSelect: z.boolean(),
          }),
        )
        .min(1)
        .max(4),
      answers: z.record(z.string(), z.string()).optional(),
      annotations: z
        .record(
          z.string(),
          z.object({
            preview: z.string().optional(),
            notes: z.string().optional(),
          }),
        )
        .optional(),
      metadata: z.object({ source: z.string().optional() }).optional(),
    }),
  }),
  Skill: tool({
    description: 'Activate a skill by name',
    inputSchema: z.object({
      skill: z.string(),
      args: z.string().optional(),
    }),
  }),
  ToolSearch: tool({
    description:
      'Search deferred MCP / catalog tools so the model can load them on demand',
    inputSchema: z.object({
      query: z.string(),
      max_results: z.number().optional(),
    }),
  }),
} as const satisfies Record<string, HarnessV1BuiltinTool<any, any>>;

/*
 * Bootstrap lives in /tmp because it's pure derived state — the harness can
 * reinstall the CLI and bridge files on any fresh sandbox from the recipe.
 * Persistence comes from the sandbox provider's snapshot, not the path.
 *
 * The session work dir (`startOpts.sessionWorkDir`) and the bridge-state dir
 * derived from `sandboxSession.defaultWorkingDirectory` both live under the sandbox's
 * default working directory — the provider's persistent mount — so the
 * workdir's CLI state (Claude's `~/.claude/projects/<dir>/*.jsonl` thread
 * history is keyed by working directory) and the bridge state files survive
 * both detach -> attach/replay and stop -> snapshot -> resume cycles.
 */
const BOOTSTRAP_DIR = '/tmp/harness/claude-code';

/**
 * Live bridge coordinates returned by `doDetach()` and `doSuspendTurn()`. A
 * future process uses them to reopen a socket to the still-running bridge
 * (`attach`) instead of re-spawning it. Absent on a `doStop()` payload.
 */
const claudeCodeBridgeCoordsSchema = z.object({
  port: z.number(),
  token: z.string(),
  lastSeenEventId: z.number(),
  sandboxId: z.string().optional(),
});

/**
 * Schema for the adapter-specific portion of lifecycle state `data`.
 *
 * A `doStop()` payload is structurally empty (`{}`): the framework derives the
 * sandbox via `provider.resumeSession({ sessionId })`, and the Claude SDK's
 * `{ continue: true }` flag rehydrates the thread from the workdir. A
 * `doDetach()` payload additionally carries `bridge` coordinates for
 * cross-process `attach`. A loose object keeps both shapes valid.
 */
const claudeCodeResumeStateSchema = z.looseObject({
  bridge: claudeCodeBridgeCoordsSchema.optional(),
});

type ClaudeCodeBridgeCoords = z.infer<typeof claudeCodeBridgeCoordsSchema>;

export function createClaudeCode(
  settings: ClaudeCodeHarnessSettings = {},
): HarnessV1<typeof CLAUDE_CODE_BUILTIN_TOOLS> {
  let cachedBootstrap: HarnessV1Bootstrap | undefined;
  const thinking = settings.thinking ?? {
    type: 'adaptive',
    display: 'summarized',
  };

  return {
    specificationVersion: 'harness-v1',
    harnessId: 'claude-code',
    builtinTools: CLAUDE_CODE_BUILTIN_TOOLS,
    supportsBuiltinToolApprovals: true,
    supportsBuiltinToolFiltering: true,
    lifecycleStateSchema: claudeCodeResumeStateSchema,
    getBootstrap: async () => {
      if (cachedBootstrap != null) return cachedBootstrap;
      const [pkg, lock, bridge] = await Promise.all([
        readBridgeAsset('package.json'),
        readBridgeAsset('pnpm-lock.yaml'),
        readBridgeAsset('index.mjs'),
      ]);
      cachedBootstrap = {
        harnessId: 'claude-code',
        bootstrapDir: BOOTSTRAP_DIR,
        files: [
          { path: `${BOOTSTRAP_DIR}/package.json`, content: pkg },
          { path: `${BOOTSTRAP_DIR}/pnpm-lock.yaml`, content: lock },
          { path: `${BOOTSTRAP_DIR}/bridge.mjs`, content: bridge },
        ],
        commands: [
          { command: `mkdir -p ${BOOTSTRAP_DIR}` },
          {
            command: `pnpm --dir ${BOOTSTRAP_DIR} install --frozen-lockfile --store-dir ${BOOTSTRAP_DIR}/.pnpm-store`,
          },
          {
            command: `cd ${BOOTSTRAP_DIR} && if [ -f node_modules/@anthropic-ai/claude-code/install.cjs ]; then node node_modules/@anthropic-ai/claude-code/install.cjs; fi && ./node_modules/.bin/claude --version`,
          },
        ],
      };
      return cachedBootstrap;
    },
    doStart: async startOpts => {
      const sandboxSession = startOpts.sandboxSession;
      const session = sandboxSession.restricted();
      const sandboxId = sandboxSession.id;
      const lifecycleState = startOpts.continueFrom ?? startOpts.resumeFrom;
      const isResume = lifecycleState != null;
      const isContinue = startOpts.continueFrom != null;
      const coords = isResume
        ? (lifecycleState?.data as { bridge?: ClaudeCodeBridgeCoords })?.bridge
        : undefined;

      const workDir = startOpts.sessionWorkDir;
      const sessionDataDir = `${sandboxSession.defaultWorkingDirectory}/.agent-runs/${startOpts.sessionId}`;
      const bridgeStateDir = `${sessionDataDir}/bridge`;
      const timeoutMs = settings.startupTimeoutMs ?? 120_000;

      // Normalize each forwarded bridge diagnostics frame into the general
      // `HarnessV1Diagnostic` and report it. The adapter does no telemetry work
      // beyond this transport→emission mapping.
      const report = startOpts.observability?.report;
      const onDiagnostic = report
        ? (frame: Parameters<typeof harnessV1DiagnosticFromBridgeFrame>[0]) =>
            report(
              harnessV1DiagnosticFromBridgeFrame(frame, {
                sessionId: startOpts.sessionId,
                timestamp: Date.now(),
              }),
            )
        : undefined;
      const onBridgeError = createBridgeErrorHandler({
        harnessId: 'claude-code',
        sessionId: startOpts.sessionId,
      });

      // Builds the `connect` thunk a `SandboxChannel` re-invokes on every
      // (re)connect: open the socket, then wait for `bridge-hello` so the
      // end-to-end link is proven live before any frame is sent.
      const buildConnect = (wsUrl: string) => async (): Promise<WebSocket> => {
        return openBridgeWebSocket({ wsUrl, timeoutMs });
      };

      /*
       * Rung 1 — ATTACH. When lifecycle state carries live bridge coordinates,
       * try to reopen a socket to the still-running bridge. Parked sessions wait
       * for the next `start`; suspended turns request replay of everything past
       * the persisted cursor. No spawn, no fresh token (the existing bridge
       * still authorises the persisted one). If the bridge is gone the open
       * throws and we fall through to a spawn-based recovery.
       */
      if (coords) {
        try {
          const attachUrl =
            (await sandboxSession.getPortUrl({
              port: coords.port,
              protocol: 'ws',
            })) + `?agent_bridge_token=${encodeURIComponent(coords.token)}`;
          const attachChannel: ClaudeCodeChannel = new SandboxChannel({
            connect: buildConnect(attachUrl),
            outboundSchema: outboundMessageSchema,
            initialLastSeenEventId: coords.lastSeenEventId,
            onDiagnostic,
            onBridgeError,
          });
          await attachChannel.open(isContinue ? { resume: true } : undefined);
          return createSession({
            sessionId: startOpts.sessionId,
            channel: attachChannel,
            // The live bridge was spawned by another process; this one owns no
            // process handle. The session lifecycle method decides whether the
            // sandbox is left running, stopped, or destroyed.
            proc: undefined,
            model: settings.model,
            maxTurns: settings.maxTurns,
            thinking,
            isResume: true,
            continueOnFirstPrompt: false,
            rerunContinue: false,
            bridgePort: coords.port,
            bridgeToken: coords.token,
            sandboxId,
            debug: startOpts.observability?.debug,
            permissionMode: startOpts.permissionMode,
            builtinToolFiltering: startOpts.builtinToolFiltering,
            skills: startOpts.skills ?? [],
          });
        } catch {
          // Bridge no longer reachable — recover by respawning below.
        }
      }

      /*
       * Rungs 2/3 — REPLAY vs RERUN. Respawn the bridge. `replay` is only sound
       * for `continueFrom`: those coordinates include the cursor the on-disk
       * log is replayed *from*. `resumeFrom` is a between-turn resume; even when
       * it carries bridge coordinates, replaying the previous turn would
       * re-deliver stale events into the next turn. Those resumes always `rerun`
       * when attach is unavailable (the CLI continues its own thread from the
       * workdir snapshot via `continue: true`).
       */
      let respawnStrategy: ClaudeCodeRespawnStrategy | undefined = isResume
        ? 'rerun'
        : undefined;
      if (coords && isContinue) {
        const logRaw = await Promise.resolve(
          session.readTextFile({
            path: `${bridgeStateDir}/event-log.ndjson`,
            abortSignal: startOpts.abortSignal,
          }),
        ).catch(() => null);
        if ((await classifyDiskLog(logRaw)) === 'replay') {
          respawnStrategy = 'replay';
        }
      }

      const sandboxHomeDir =
        startOpts.skills && startOpts.skills.length > 0
          ? await resolveSandboxHomeDir({
              sandbox: session,
              abortSignal: startOpts.abortSignal,
            })
          : undefined;
      const port = resolveBridgePort(sandboxSession, settings.port);
      const token = randomBytes(32).toString('hex');
      const env = {
        ...resolveClaudeCodeEnv(settings.auth),
        /*
         * The Claude Agent SDK does not expose arbitrary model-request
         * headers. It reads this environment variable and sends the value as
         * `x-client-app`, while also appending `client-app/<value>` to
         * `User-Agent`, so this is the attribution path for AI Gateway.
         */
        CLAUDE_AGENT_SDK_CLIENT_APP: CLAUDE_CODE_CLIENT_APP,
        BRIDGE_CHANNEL_TOKEN: token,
        BRIDGE_WS_PORT: String(port),
        ...(sandboxHomeDir ? { HOME: sandboxHomeDir } : {}),
        ...(respawnStrategy === 'replay'
          ? { BRIDGE_REPLAY_FROM_DISK: '1' }
          : {}),
      };

      /*
       * On a fresh start the workdir, skill files, and bridge-state directory
       * must be created. On any resume they already exist in the
       * sandbox snapshot, so skip the rewrite. The env is sent fresh on every
       * spawn — `BRIDGE_CHANNEL_TOKEN` rotates per start.
       */
      if (respawnStrategy === undefined) {
        await session.run({
          command: `mkdir -p ${shellQuote(workDir)} ${shellQuote(bridgeStateDir)}`,
          abortSignal: startOpts.abortSignal,
        });

        if (startOpts.skills && startOpts.skills.length > 0) {
          if (!sandboxHomeDir) {
            throw new Error('Unable to resolve sandbox HOME directory.');
          }
          await writeClaudeCodeSkills({
            sandbox: session,
            homeDir: sandboxHomeDir,
            skills: startOpts.skills,
            abortSignal: startOpts.abortSignal,
          });
        }
      }

      await markBridgeStarting({
        sandbox: session,
        bridgeStateDir,
        bridgeType: 'claude-code',
        abortSignal: startOpts.abortSignal,
      });

      const proc = await session.spawn({
        command: `node ${BOOTSTRAP_DIR}/bridge.mjs --workdir ${shellQuote(workDir)} --bridge-state-dir ${shellQuote(bridgeStateDir)}`,
        env,
        abortSignal: startOpts.abortSignal,
      });

      const bridgeStartupStderr: string[] = [];
      const bridgeStartupStderrDone = forwardBridgeProcessStream({
        stream: proc.stderr,
        streamName: 'stderr',
        source: 'claude-code',
        collectTail: bridgeStartupStderr,
      });
      void bridgeStartupStderrDone;
      const { port: boundPort } = await waitForBridgeReady({
        proc,
        sandbox: session,
        bridgeStateDir,
        bridgeType: 'claude-code',
        timeoutMs,
        abortSignal: startOpts.abortSignal,
        createTimeoutError: ({ proc, stdoutTail }) =>
          createBridgeStartupError({
            message: 'claude-code bridge did not become ready in time.',
            proc,
            stdoutTail,
            stderrTail: bridgeStartupStderr,
            stderrDone: bridgeStartupStderrDone,
          }),
        createExitError: ({ proc, stdoutTail }) =>
          createBridgeStartupError({
            message: 'claude-code bridge exited before becoming ready.',
            proc,
            stdoutTail,
            stderrTail: bridgeStartupStderr,
            stderrDone: bridgeStartupStderrDone,
          }),
      });
      void drainBridgeProcessStream(proc.stdout);

      const wsUrl =
        (await sandboxSession.getPortUrl({
          port: boundPort,
          protocol: 'ws',
        })) + `?agent_bridge_token=${encodeURIComponent(token)}`;

      const channel: ClaudeCodeChannel = new SandboxChannel({
        connect: buildConnect(wsUrl),
        outboundSchema: outboundMessageSchema,
        onDiagnostic,
        onBridgeError,
        // In replay mode the respawned bridge reloaded the finished turn from
        // disk; seed the cursor and resume so it streams the tail (incl.
        // `finish`) rather than starting empty.
        ...(respawnStrategy === 'replay'
          ? { initialLastSeenEventId: coords?.lastSeenEventId ?? 0 }
          : {}),
      });
      await channel.open(
        respawnStrategy === 'replay' ? { resume: true } : undefined,
      );

      return createSession({
        sessionId: startOpts.sessionId,
        channel,
        proc,
        model: settings.model,
        maxTurns: settings.maxTurns,
        thinking,
        isResume: respawnStrategy !== undefined,
        continueOnFirstPrompt: respawnStrategy !== undefined,
        rerunContinue: respawnStrategy === 'rerun',
        bridgePort: boundPort,
        bridgeToken: token,
        sandboxId,
        debug: startOpts.observability?.debug,
        permissionMode: startOpts.permissionMode,
        builtinToolFiltering: startOpts.builtinToolFiltering,
        skills: startOpts.skills ?? [],
      });
    },
  };
}

function resolveBridgePort(
  sandboxSession: HarnessV1NetworkSandboxSession,
  override: number | undefined,
): number {
  if (override !== undefined) return override;
  if (sandboxSession.ports.length > 0) return sandboxSession.ports[0];
  throw new HarnessCapabilityUnsupportedError({
    harnessId: 'claude-code',
    message:
      'The claude-code harness needs a TCP port exposed by the sandbox. ' +
      'Create the sandbox with `ports: [<port>]` or pass `createClaudeCode({ port })`.',
  });
}

/**
 * Materialise skill files into
 * `$HOME/.claude/skills/<name>/SKILL.md`. The `claude` CLI
 * auto-discovers skills from that directory on startup, so the files have to
 * be in place before the bridge is spawned without mutating the session
 * workdir. Each file uses the YAML-frontmatter shape the CLI expects.
 */
async function writeClaudeCodeSkills({
  sandbox,
  homeDir,
  skills,
  abortSignal,
}: {
  sandbox: Experimental_SandboxSession;
  homeDir: string;
  skills: ReadonlyArray<HarnessV1Skill>;
  abortSignal?: AbortSignal;
}): Promise<void> {
  await writeHarnessSkills({
    sandbox,
    rootDir: `${homeDir}/.claude/skills`,
    skills,
    abortSignal,
    invalidSkillNameMessage: ({ name }) =>
      `Invalid Claude Code skill name: ${name}`,
    invalidSkillFilePathMessage: ({ skillName, filePath }) =>
      `Invalid Claude Code skill file path for ${skillName}: ${filePath}`,
    trailingNewline: true,
  });
}

async function readBridgeAsset(name: string): Promise<string> {
  const candidates = [
    new URL(`./bridge/${name}`, import.meta.url),
    new URL(`../bridge/${name}`, import.meta.url),
  ];
  let lastErr: unknown;
  for (const url of candidates) {
    try {
      return await readFile(fileURLToPath(url), 'utf8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`bridge asset not found: ${name}`);
}

/**
 * Wait for the bridge's `bridge-hello` message to arrive on the freshly
 * opened WebSocket before any other host-side code touches it.
 *
 * Some sandbox runtimes (Vercel in particular) complete the WS upgrade
 * with the host long before the connection is actually forwarded to the
 * sandbox-side bridge. Anything sent in that gap is silently dropped —
 * including the `start` message we send next. The bridge emits
 * `bridge-hello` the instant it accepts the connection, so receiving it
 * is the only reliable evidence that the end-to-end link is live.
 */
async function waitForBridgeHello({
  ws,
  timeoutMs,
}: {
  ws: WebSocket;
  timeoutMs: number;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      ws.off('message', onMessage);
      ws.off('close', onClose);
      ws.off('error', onError);
      if (timer) clearTimeout(timer);
    };
    const settle = (err?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve();
    };
    const onMessage = (raw: unknown) => {
      try {
        const text =
          typeof raw === 'string'
            ? raw
            : (raw as Buffer | ArrayBufferLike).toString
              ? (raw as Buffer).toString('utf8')
              : String(raw);
        const parsed = JSON.parse(text) as { type?: unknown };
        if (parsed?.type === 'bridge-hello') settle();
      } catch {
        // Ignore malformed frames while waiting.
      }
    };
    const onClose = () => {
      settle(
        new Error('claude-code bridge closed before sending bridge-hello'),
      );
    };
    const onError = (err: Error) => settle(err);
    const timer = setTimeout(
      () =>
        settle(
          new Error(
            `claude-code bridge did not send bridge-hello within ${timeoutMs}ms`,
          ),
        ),
      timeoutMs,
    );
    timer.unref?.();
    ws.on('message', onMessage);
    ws.on('close', onClose);
    ws.on('error', onError);
  });
}

async function openBridgeWebSocket({
  wsUrl,
  timeoutMs,
}: {
  wsUrl: string;
  timeoutMs: number;
}): Promise<WebSocket> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() < deadline) {
    attempt++;
    let ws: WebSocket | undefined;
    try {
      const remaining = Math.max(1, deadline - Date.now());
      ws = await openWebSocket({
        url: wsUrl,
        timeoutMs: Math.min(10_000, remaining),
      });
      await waitForBridgeHello({
        ws,
        timeoutMs: Math.min(5_000, Math.max(1, deadline - Date.now())),
      });
      return ws;
    } catch (err) {
      lastError = err;
      try {
        ws?.close();
      } catch {}
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(250 * attempt, 1_000, remaining));
    }
  }

  throw new Error(
    `claude-code bridge did not complete WebSocket handshake within ${timeoutMs}ms after ${attempt} attempt(s). Last error: ${formatUnknownError(lastError)}`,
  );
}

function openWebSocket({
  url,
  timeoutMs,
}: {
  url: string;
  timeoutMs: number;
}): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      cleanup();
      try {
        ws.terminate();
      } catch {}
      reject(new Error(`WebSocket open timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref?.();
    const cleanup = () => {
      clearTimeout(timer);
      ws.off('open', onOpen);
      ws.off('error', onError);
    };
    const onOpen = () => {
      cleanup();
      resolve(ws);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    ws.once('open', onOpen);
    ws.once('error', onError);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function createSession({
  sessionId,
  channel,
  proc,
  model,
  maxTurns,
  thinking,
  isResume,
  continueOnFirstPrompt,
  rerunContinue,
  bridgePort,
  bridgeToken,
  sandboxId,
  debug,
  permissionMode,
  builtinToolFiltering,
  skills,
}: {
  sessionId: string;
  channel: ClaudeCodeChannel;
  /** Undefined on `attach` — the live bridge was spawned by another process. */
  proc: Experimental_SandboxProcess | undefined;
  model: string | undefined;
  maxTurns: number | undefined;
  thinking: ClaudeCodeThinkingConfig;
  isResume: boolean;
  continueOnFirstPrompt: boolean;
  rerunContinue: boolean;
  bridgePort: number;
  bridgeToken: string;
  sandboxId: string;
  debug: HarnessV1DebugConfig | undefined;
  permissionMode: HarnessV1PermissionMode | undefined;
  builtinToolFiltering: HarnessV1BuiltinToolFiltering | undefined;
  skills: ReadonlyArray<HarnessV1Skill>;
}): HarnessV1Session {
  let stopped = false;
  let stopPromise: Promise<void> | undefined;
  /*
   * Force the Claude SDK's `continue: true` on the first prompt only when the
   * bridge was respawned (rerun/replay): a fresh bridge process treats its
   * first turn as new, so it must be told to rehydrate the workdir thread. An
   * `attach`ed bridge is already past its first turn and continues on its own.
   */
  let pendingResumeFlag = continueOnFirstPrompt;
  /*
   * Instructions are prepended to the first user message of a fresh session
   * only. A resumed session (attach/replay/rerun) already carried them in its
   * original first message (preserved in the workdir snapshot), so it starts
   * "applied".
   */
  let instructionsApplied = isResume;

  /*
   * Wire the channel into one turn's worth of events and return the control
   * surface. Shared by `doPromptTurn` (which sends a `start` afterwards) and
   * `doContinueTurn` (which attaches to an already-running/replayed turn, or sends
   * a rerun `start`). The only difference between the two entry points is the
   * `start` message, not the listener/abort/settle plumbing.
   */
  const wireTurn = (turnOpts: {
    emit: (event: HarnessV1StreamPart) => void;
    abortSignal?: AbortSignal;
  }): HarnessV1PromptControl => {
    let pendingResolve: (() => void) | undefined;
    let pendingReject: ((err: unknown) => void) | undefined;
    const done = new Promise<void>((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });

    const unsubs: Array<() => void> = [];
    const forward = (event: HarnessV1StreamPart) => {
      try {
        turnOpts.emit(event);
      } catch {}
    };

    let isSettled = false;
    const settleSuccess = () => {
      if (isSettled) return;
      isSettled = true;
      for (const u of unsubs) u();
      pendingResolve!();
    };
    const settleError = (err: unknown) => {
      if (isSettled) return;
      isSettled = true;
      for (const u of unsubs) u();
      pendingReject!(err);
    };

    const eventTypes = [
      'stream-start',
      'text-start',
      'text-delta',
      'text-end',
      'reasoning-start',
      'reasoning-delta',
      'reasoning-end',
      'tool-call',
      'tool-approval-request',
      'tool-result',
      'finish-step',
      'raw',
    ] as const;
    for (const type of eventTypes) {
      unsubs.push(
        channel.on(type, msg => {
          forward(msg);
        }),
      );
    }
    unsubs.push(
      channel.on('finish', msg => {
        forward(msg);
        settleSuccess();
      }),
    );
    unsubs.push(
      channel.on('error', msg => {
        forward(msg);
        settleError(msg.error);
      }),
    );

    /*
     * A `'suspended'` close is a graceful slice-boundary freeze the host
     * initiated (`doSuspendTurn`): the turn keeps running in the bridge and its
     * tail is replayed to the next process, so wind this turn down cleanly
     * rather than failing it. Any other close mid-turn is an unexpected drop.
     */
    const onClose = (_code?: number, reason?: string) => {
      if (isSettled) return;
      if (reason === 'suspended') {
        settleSuccess();
        return;
      }
      settleError(
        new Error('claude-code bridge closed before the turn finished.'),
      );
    };
    channel.onClose(onClose);

    const onAbort = () => {
      if (isSettled) return;
      try {
        channel.send({ type: 'abort' });
      } catch {}
      settleError(
        turnOpts.abortSignal?.reason ??
          new DOMException('Aborted', 'AbortError'),
      );
    };
    if (turnOpts.abortSignal) {
      if (turnOpts.abortSignal.aborted) {
        onAbort();
      } else {
        turnOpts.abortSignal.addEventListener('abort', onAbort, {
          once: true,
        });
      }
    }

    return {
      submitToolResult: async input => {
        channel.send({
          type: 'tool-result',
          toolCallId: input.toolCallId,
          output: input.output,
          isError: input.isError,
        });
      },
      submitToolApproval: async input => {
        channel.send({
          type: 'tool-approval-response',
          approvalId: input.approvalId,
          approved: input.approved,
          reason: input.reason,
        });
      },
      submitUserMessage: async text => {
        channel.send({ type: 'user-message', text });
      },
      done,
    };
  };

  return {
    sessionId,
    isResume,
    modelId: model,
    doPromptTurn: async promptOpts => {
      const control = wireTurn({
        emit: promptOpts.emit,
        abortSignal: promptOpts.abortSignal,
      });

      let promptText = extractUserText(promptOpts.prompt);
      if (!instructionsApplied && promptOpts.instructions) {
        promptText = frameInstructions(promptOpts.instructions, promptText);
      }
      instructionsApplied = true;

      const startMessage = {
        type: 'start' as const,
        prompt: promptText,
        tools: (promptOpts.tools ?? []).map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
        model,
        maxTurns,
        thinking,
        ...(skills.length > 0
          ? { skills: skills.map(skill => skill.name) }
          : {}),
        ...(permissionMode ? { permissionMode } : {}),
        ...(builtinToolFiltering ? { builtinToolFiltering } : {}),
        ...(debug ? { debug } : {}),
        ...(pendingResumeFlag ? { continue: true } : {}),
      };
      pendingResumeFlag = false;
      channel.send(startMessage);

      return control;
    },
    doContinueTurn: async continueOpts => {
      const control = wireTurn({
        emit: continueOpts.emit,
        abortSignal: continueOpts.abortSignal,
      });

      /*
       * attach / replay: the still-running (or disk-replayed) turn streams into
       * the wired listeners — `doStart` opened the channel with `{ resume: true }`
       * so the bridge replays everything past the persisted cursor (including a
       * `finish` if the turn ended during the gap). No `start` is sent: issuing
       * one would clear the bridge's replay log and begin a new turn. Lossless.
       *
       * rerun: the bridge was respawned with no in-flight turn to attach to, so
       * re-drive the runtime's own thread from the workdir snapshot via
       * `continue: true`. Lossy — work in flight at the interruption is
       * recomputed. This is the rare bridge-died fallback; the common slice path
       * is `attach`.
       */
      if (rerunContinue) {
        pendingResumeFlag = false;
        channel.send({
          type: 'start' as const,
          /*
           * A continuation nudge rather than an empty prompt: `continue: true`
           * rehydrates the prior thread, and this is the new user turn that
           * drives it forward. It must be non-empty — an empty text block is
           * rejected by the Anthropic API once the SDK stamps it with
           * `cache_control`.
           */
          prompt: 'Continue.',
          tools: (continueOpts.tools ?? []).map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          model,
          maxTurns,
          thinking,
          ...(skills.length > 0
            ? { skills: skills.map(skill => skill.name) }
            : {}),
          ...(permissionMode ? { permissionMode } : {}),
          ...(builtinToolFiltering ? { builtinToolFiltering } : {}),
          ...(debug ? { debug } : {}),
          continue: true,
        });
      }

      return control;
    },
    doCompact: async (customInstructions?: string) => {
      /*
       * Claude Code has no SDK/control method for compaction — the supported
       * trigger is the `/compact` slash command submitted as user input. Ride
       * the existing user-message rail; the bridge feeds it into the streaming
       * query input and Claude's native compaction handles the rest, emitting a
       * `compact_boundary` + `PostCompact` we observe as a `compaction` event.
       */
      const text =
        customInstructions && customInstructions.trim()
          ? `/compact ${customInstructions.trim()}`
          : '/compact';
      channel.send({ type: 'user-message', text });
    },
    doDetach: async () => {
      if (stopped) {
        throw new Error(
          `claude-code session ${sessionId} is already stopped; cannot detach.`,
        );
      }
      stopped = true;
      const lastSeenEventId = await channel.suspend();
      const payload: HarnessV1ResumeSessionState = {
        type: 'resume-session',
        harnessId: 'claude-code',
        specificationVersion: 'harness-v1',
        data: {
          bridge: {
            port: bridgePort,
            token: bridgeToken,
            lastSeenEventId,
            sandboxId,
          },
        },
      };
      return payload;
    },
    doDestroy: async () => {
      if (stopped) return stopPromise;
      stopped = true;
      stopPromise = (async () => {
        // Tell the channel we are tearing down so the bridge's post-shutdown
        // socket close finalises instead of triggering a reconnect.
        channel.beginClose();
        try {
          if (!channel.isClosed()) {
            channel.send({ type: 'shutdown' });
          }
        } catch {}
        let stopTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          if (proc) {
            await Promise.race([
              proc.wait(),
              new Promise<void>(resolve => {
                stopTimer = setTimeout(resolve, 5000);
                stopTimer.unref?.();
              }),
            ]);
          }
        } finally {
          if (stopTimer) clearTimeout(stopTimer);
          try {
            await proc?.kill();
          } catch {}
          channel.close();
        }
      })();
      return stopPromise;
    },
    doStop: async () => {
      if (stopped) {
        throw new Error(
          `claude-code session ${sessionId} is already stopped; cannot stop.`,
        );
      }
      stopped = true;
      /*
       * If the bridge's channel already closed (e.g. mid-turn WS drop)
       * there is no one to ack a `detach` message. Synthesize an empty
       * payload — for Claude Code the resume state structurally is `{}`
       * (the conversation lives in the workdir, captured by the sandbox
       * snapshot during the subsequent `sandboxSession.stop()`), so we
       * lose nothing by skipping the round-trip.
       */
      // Tell the channel we are tearing down so the bridge's post-detach
      // socket close finalises instead of triggering a reconnect.
      channel.beginClose();
      const data: unknown = channel.isClosed()
        ? {}
        : await new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => {
              unsub();
              reject(
                new Error(
                  `claude-code session ${sessionId} did not reply to detach within 5s.`,
                ),
              );
            }, 5000);
            timer.unref?.();
            const unsub = channel.on('bridge-detach', msg => {
              clearTimeout(timer);
              unsub();
              resolve(msg.data);
            });
            try {
              channel.send({ type: 'detach' });
            } catch (err) {
              clearTimeout(timer);
              unsub();
              reject(err);
            }
          });

      // The bridge exits itself ~50ms after sending bridge-detach. Give
      // it a moment, then ensure the process is reaped and the channel
      // closed.
      let stopTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        if (proc) {
          await Promise.race([
            proc.wait(),
            new Promise<void>(resolve => {
              stopTimer = setTimeout(resolve, 5000);
              stopTimer.unref?.();
            }),
          ]);
        }
      } finally {
        if (stopTimer) clearTimeout(stopTimer);
        try {
          await proc?.kill();
        } catch {}
        channel.close();
      }

      const payload: HarnessV1ResumeSessionState = {
        type: 'resume-session',
        harnessId: 'claude-code',
        specificationVersion: 'harness-v1',
        data: (data ?? {}) as HarnessV1ResumeSessionState['data'],
      };
      return payload;
    },
    doSuspendTurn: async () => {
      if (stopped) {
        throw new Error(
          `claude-code session ${sessionId} is stopped; cannot suspend.`,
        );
      }
      stopped = true;
      /*
       * First ask the runtime to interrupt the active model turn, then freeze
       * the host at a precise cursor. `channel.suspend` stops processing
       * inbound frames (the cursor stops advancing exactly at the last
       * delivered event), drains what was already dispatched, then closes the
       * host socket with reason `'suspended'` — which `wireTurn`'s `onClose`
       * treats as a clean turn end. The bridge keeps the turn running and
       * accumulates events past the cursor for the next slice to replay. The
       * sandbox process is deliberately left alive (no `shutdown`/`detach`).
       */
      await channel.interrupt();
      const lastSeenEventId = await channel.suspend();
      const payload: HarnessV1ContinueTurnState = {
        type: 'continue-turn',
        harnessId: 'claude-code',
        specificationVersion: 'harness-v1',
        data: {
          bridge: {
            port: bridgePort,
            token: bridgeToken,
            lastSeenEventId,
            sandboxId,
          },
        },
      };
      return payload;
    },
  };
}

/*
 * Frame session instructions and the user's text so the runtime treats the
 * instructions as system-provided operating guidance, not something the user
 * wrote. Without the wrapper the agent can echo the prepended text back as if
 * the user had asked for it, which is confusing since the user never typed it.
 * Applied only to the first user message of a fresh session.
 */
function frameInstructions(instructions: string, userText: string): string {
  return (
    '<session-instructions>\n' +
    'The block below is operating guidance from the system, not a message from the user — follow it, but do not mention it or attribute it to the user.\n\n' +
    `${instructions}\n` +
    '</session-instructions>\n\n' +
    `<user-message>\n${userText}\n</user-message>`
  );
}

/*
 * Reduce a `HarnessV1Prompt` to the plain user text the bridge forwards
 * to the Claude SDK. File and image parts on the message are not yet
 * supported by the underlying runtime — throw rather than silently drop
 * them so callers learn about the gap instead of seeing mysteriously
 * truncated prompts.
 */
function extractUserText(prompt: HarnessV1Prompt): string {
  if (typeof prompt === 'string') return prompt;
  const { content } = prompt;
  if (typeof content === 'string') return content;
  const parts: string[] = [];
  for (const part of content) {
    if (part.type !== 'text') {
      throw new HarnessCapabilityUnsupportedError({
        harnessId: 'claude-code',
        message: `The claude-code harness does not yet support user message parts of type '${part.type}'. Pass a string or a user message whose content contains only text parts.`,
      });
    }
    parts.push(part.text);
  }
  return parts.join('\n\n');
}
