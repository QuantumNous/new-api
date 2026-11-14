import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  commonTool,
  HarnessCapabilityUnsupportedError,
  harnessV1DiagnosticFromBridgeFrame,
  type HarnessV1,
  type HarnessV1Bootstrap,
  type HarnessV1BuiltinTool,
  type HarnessV1BuiltinToolFiltering,
  type HarnessV1ContinueTurnState,
  type HarnessV1NetworkSandboxSession,
  type HarnessV1PermissionMode,
  type HarnessV1Prompt,
  type HarnessV1PromptControl,
  type HarnessV1ResumeSessionState,
  type HarnessV1Session,
  type HarnessV1Skill,
  type HarnessV1StreamPart,
} from '@ai-sdk/harness';
import {
  markBridgeStarting,
  createBridgeErrorHandler,
  createBridgeStartupError,
  drainBridgeProcessStream,
  forwardBridgeProcessStream,
  resolveSandboxHomeDir,
  SandboxChannel,
  shellQuote,
  waitForBridgeReady,
  writeSkills as writeHarnessSkills,
} from '@ai-sdk/harness/utils';
import { tool, type Experimental_SandboxProcess } from '@ai-sdk/provider-utils';
import { WebSocket } from 'ws';
import { z } from 'zod/v4';
import {
  resolveDeepAgentsEnv,
  type DeepAgentsAuthOptions,
} from './deepagents-auth';
import {
  outboundMessageSchema,
  type InboundMessage,
  type OutboundMessage,
} from './deepagents-bridge-protocol';
import { VERSION } from './version';

type DeepAgentsChannel = SandboxChannel<OutboundMessage, InboundMessage>;

// Pure derived state in /tmp; reinstalled per sandbox, persistence is the provider snapshot.
const BOOTSTRAP_DIR = '/tmp/harness/deepagents';
/**
 * Value to use in User-Agent and `x-client-app` headers.
 */
const DEEPAGENTS_CLIENT_APP = `ai-sdk/harness-deepagents/${VERSION}`;

// Pinned ripgrep release + per-arch tarball checksums (verified before install).
const RIPGREP_VERSION = '14.1.1';
const RIPGREP_SHA256_X64 =
  '4cf9f2741e6c465ffdb7c26f38056a59e2a2544b51f7cc128ef28337eeae4d8e';
const RIPGREP_SHA256_ARM =
  'c827481c4ff4ea10c9dc7a4022c8de5db34a5737cb74484d62eb94a95841ab2f';

// Idempotent, checksum-verified install of a static ripgrep binary into a PATH dir.
// DeepAgents' grep shells out to `rg`; without it, its fallback reads the whole workdir (incl. node_modules) into memory and OOMs. Skipped if `rg` already exists.
function installRipgrepCommand(): string {
  const v = RIPGREP_VERSION;
  return [
    'command -v rg >/dev/null 2>&1 || {',
    'case "$(uname -m)" in',
    `aarch64) a=aarch64-unknown-linux-gnu; sha=${RIPGREP_SHA256_ARM} ;;`,
    `*) a=x86_64-unknown-linux-musl; sha=${RIPGREP_SHA256_X64} ;;`,
    'esac;',
    `f=/tmp/ripgrep-${v}.tar.gz;`,
    `curl -fsSL "https://github.com/BurntSushi/ripgrep/releases/download/${v}/ripgrep-${v}-$a.tar.gz" -o "$f"`,
    '&& echo "$sha  $f" | sha256sum -c -',
    '&& tar xzf "$f" -C /tmp',
    `&& mv "/tmp/ripgrep-${v}-$a/rg" /usr/local/bin/rg && chmod +x /usr/local/bin/rg;`,
    '}',
  ].join(' ');
}

// Skills source subpath, written under $HOME (out of the work dir so it can't clash with code cloned into the work dir) and also discovered from <workDir> for repo-provided skills.
const SKILLS_SOURCE_PATH = '/.agents/skills';

export type DeepAgentsHarnessSettings = {
  readonly auth?: DeepAgentsAuthOptions;
  /** Model id for the DeepAgents runtime, e.g. `claude-sonnet-4` (converted to `provider:model`). */
  readonly model?: string;
  /** Bridge port override; defaults to the sandbox's first declared port. */
  readonly port?: number;
  /** Maximum milliseconds to wait for the bridge to advertise its port. Defaults to 120000. */
  readonly startupTimeoutMs?: number;
  /** Max LangGraph super-steps per turn before it errors. Defaults to 100; raise for long multi-step tasks. */
  readonly recursionLimit?: number;
};

// Every model-callable DeepAgents built-in, keyed by what the bridge emits (commonName ?? nativeName); all must be listed or AI SDK throws AI_NoSuchToolError.
const DEEPAGENTS_BUILTIN_TOOLS = {
  read: commonTool('read', {
    nativeName: 'read_file',
    toolUseKind: 'readonly',
    description: 'Read file contents',
    inputSchema: z.object({ file_path: z.string() }),
  }),
  write: commonTool('write', {
    nativeName: 'write_file',
    toolUseKind: 'edit',
    description: 'Create a file',
    inputSchema: z.object({ file_path: z.string(), content: z.string() }),
  }),
  edit: commonTool('edit', {
    nativeName: 'edit_file',
    toolUseKind: 'edit',
    description: 'Perform exact string replacements in a file',
    inputSchema: z.object({
      file_path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
    }),
  }),
  bash: commonTool('bash', {
    nativeName: 'execute',
    toolUseKind: 'bash',
    description: 'Run a shell command',
    inputSchema: z.object({ command: z.string() }),
  }),
  grep: commonTool('grep', {
    nativeName: 'grep',
    toolUseKind: 'readonly',
    description: 'Search file contents',
    inputSchema: z.object({ pattern: z.string() }),
  }),
  glob: commonTool('glob', {
    nativeName: 'glob',
    toolUseKind: 'readonly',
    description: 'Find files matching a glob pattern',
    inputSchema: z.object({ pattern: z.string() }),
  }),
  // No common-name equivalent — keyed by native name.
  ls: tool({
    description: 'List files in a directory',
    inputSchema: z.object({ path: z.string().optional() }),
  }),
  task: tool({
    description: 'Spawn a subagent to handle a delegated task',
    inputSchema: z.object({
      description: z.string().optional(),
      subagent_type: z.string().optional(),
    }),
  }),
  write_todos: tool({
    description: 'Manage a structured todo list',
    inputSchema: z.object({ todos: z.array(z.unknown()).optional() }),
  }),
} as const satisfies Record<string, HarnessV1BuiltinTool<any, any>>;

// Live bridge coordinates returned by doDetach/doSuspendTurn so a later process can reattach.
const deepAgentsBridgeCoordsSchema = z.object({
  port: z.number(),
  token: z.string(),
  lastSeenEventId: z.number(),
  sandboxId: z.string().optional(),
});
const deepAgentsResumeStateSchema = z.object({
  bridge: deepAgentsBridgeCoordsSchema.optional(),
});
type DeepAgentsBridgeCoords = z.infer<typeof deepAgentsBridgeCoordsSchema>;

export function createDeepAgents(
  settings: DeepAgentsHarnessSettings = {},
): HarnessV1<typeof DEEPAGENTS_BUILTIN_TOOLS> {
  let cachedBootstrap: HarnessV1Bootstrap | undefined;

  return {
    specificationVersion: 'harness-v1',
    harnessId: 'deepagents',
    builtinTools: DEEPAGENTS_BUILTIN_TOOLS,
    // Built-in tool approvals are gated in-bridge via DeepAgents' interruptOn (HITL) middleware.
    supportsBuiltinToolApprovals: true,
    lifecycleStateSchema: deepAgentsResumeStateSchema,
    getBootstrap: async () => {
      if (cachedBootstrap != null) return cachedBootstrap;
      const [bridge, pkg, lock] = await Promise.all([
        readBridgeAsset('index.mjs'),
        readBridgeAsset('package.json'),
        readBridgeAsset('pnpm-lock.yaml'),
      ]);
      cachedBootstrap = {
        harnessId: 'deepagents',
        bootstrapDir: BOOTSTRAP_DIR,
        files: [
          { path: `${BOOTSTRAP_DIR}/bridge.mjs`, content: bridge },
          { path: `${BOOTSTRAP_DIR}/package.json`, content: pkg },
          { path: `${BOOTSTRAP_DIR}/pnpm-lock.yaml`, content: lock },
        ],
        commands: [
          { command: `mkdir -p ${BOOTSTRAP_DIR}` },
          { command: installRipgrepCommand() },
          {
            command: `pnpm --dir ${BOOTSTRAP_DIR} install --frozen-lockfile --store-dir ${BOOTSTRAP_DIR}/.pnpm-store`,
          },
        ],
      };
      return cachedBootstrap;
    },
    doStart: async startOpts => {
      const permissionMode = startOpts.permissionMode;
      const sandboxSession = startOpts.sandboxSession;
      const session = sandboxSession.restricted();
      const sandboxId = sandboxSession.id;

      const lifecycleState = startOpts.continueFrom ?? startOpts.resumeFrom;
      const isResume = lifecycleState != null;
      const isContinue = startOpts.continueFrom != null;
      const coords =
        isResume && typeof lifecycleState?.data === 'object'
          ? (lifecycleState.data as { bridge?: DeepAgentsBridgeCoords }).bridge
          : undefined;

      const workDir = startOpts.sessionWorkDir;
      const sessionDataDir = `${sandboxSession.defaultWorkingDirectory}/.agent-runs/${startOpts.sessionId}`;
      const bridgeStateDir = `${sessionDataDir}/bridge`;
      const timeoutMs = settings.startupTimeoutMs ?? 120_000;

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
        harnessId: 'deepagents',
        sessionId: startOpts.sessionId,
      });

      // Attach to the still-running bridge (continueFrom replays past the cursor); on failure fall through to a fresh spawn.
      if (coords) {
        try {
          const attachUrl =
            (await sandboxSession.getPortUrl({
              port: coords.port,
              protocol: 'ws',
            })) + `?agent_bridge_token=${encodeURIComponent(coords.token)}`;
          const attachChannel: DeepAgentsChannel = new SandboxChannel({
            connect: () => openWebSocket(attachUrl),
            outboundSchema: outboundMessageSchema,
            initialLastSeenEventId: coords.lastSeenEventId,
            onDiagnostic,
            onBridgeError,
          });
          await attachChannel.open(isContinue ? { resume: true } : undefined);
          return createSession({
            sessionId: startOpts.sessionId,
            channel: attachChannel,
            proc: undefined,
            model: settings.model,
            bridgePort: coords.port,
            bridgeToken: coords.token,
            sandboxId,
            isResume: true,
            attached: true,
            permissionMode,
            builtinToolFiltering: startOpts.builtinToolFiltering,
            recursionLimit: settings.recursionLimit,
          });
        } catch {
          // Bridge no longer reachable — recover by respawning below.
        }
      }

      const port = resolveBridgePort(sandboxSession, settings.port);
      const token = randomBytes(32).toString('hex');

      // Always discover repo-provided skills under <workDir>/.agents/skills (e.g. a cloned repo); a missing dir is tolerated by deepagents.
      // Absolute paths: LocalShellBackend (non-virtual) treats a leading-slash path as a real fs path.
      const skillsPaths = [`${workDir}${SKILLS_SOURCE_PATH}`];
      // Host-provided skills go to $HOME (out of the work dir) and take priority (listed last → wins on name collision).
      if ((startOpts.skills?.length ?? 0) > 0) {
        const homeDir = await resolveSandboxHomeDir({
          sandbox: session,
          abortSignal: startOpts.abortSignal,
        });
        const homeSkillsRoot = `${homeDir}${SKILLS_SOURCE_PATH}`;
        await writeSkills({
          sandbox: session,
          root: homeSkillsRoot,
          skills: startOpts.skills ?? [],
          abortSignal: startOpts.abortSignal,
        });
        skillsPaths.push(homeSkillsRoot);
      }

      const env = {
        ...resolveDeepAgentsEnv({ auth: settings.auth }),
        AI_SDK_HARNESS_CLIENT_APP: DEEPAGENTS_CLIENT_APP,
        BRIDGE_CHANNEL_TOKEN: token,
        BRIDGE_WS_PORT: String(port),
      };

      await session.run({
        command: `mkdir -p ${shellQuote(workDir)} ${shellQuote(bridgeStateDir)}`,
        abortSignal: startOpts.abortSignal,
      });

      await markBridgeStarting({
        sandbox: session,
        bridgeStateDir,
        bridgeType: 'deepagents',
        abortSignal: startOpts.abortSignal,
      });

      const proc = await session.spawn({
        command: `node ${BOOTSTRAP_DIR}/bridge.mjs --workdir ${shellQuote(workDir)} --bridge-state-dir ${shellQuote(bridgeStateDir)} --bootstrap-dir ${shellQuote(BOOTSTRAP_DIR)}`,
        env,
        abortSignal: startOpts.abortSignal,
      });
      const stderrTail: string[] = [];
      const bridgeStderrDone = forwardBridgeProcessStream({
        stream: proc.stderr,
        streamName: 'stderr',
        source: 'deepagents',
        collectTail: stderrTail,
      });

      const { port: boundPort } = await waitForBridgeReady({
        proc,
        sandbox: session,
        bridgeStateDir,
        bridgeType: 'deepagents',
        timeoutMs,
        abortSignal: startOpts.abortSignal,
        createTimeoutError: ({ proc, stdoutTail }) =>
          createBridgeStartupError({
            message: 'deepagents bridge did not become ready in time.',
            proc,
            stdoutTail,
            stderrTail,
            stderrDone: bridgeStderrDone,
          }),
        createExitError: ({ proc, stdoutTail }) =>
          createBridgeStartupError({
            message: 'deepagents bridge exited before becoming ready.',
            proc,
            stdoutTail,
            stderrTail,
            stderrDone: bridgeStderrDone,
          }),
      });
      void drainBridgeProcessStream(proc.stdout);

      const wsUrl =
        (await sandboxSession.getPortUrl({
          port: boundPort,
          protocol: 'ws',
        })) + `?agent_bridge_token=${encodeURIComponent(token)}`;

      const channel: DeepAgentsChannel = new SandboxChannel({
        connect: () => openWebSocket(wsUrl),
        outboundSchema: outboundMessageSchema,
        onDiagnostic,
        onBridgeError,
      });
      await channel.open();

      return createSession({
        sessionId: startOpts.sessionId,
        channel,
        proc,
        model: settings.model,
        bridgePort: boundPort,
        bridgeToken: token,
        sandboxId,
        isResume,
        // Freshly spawned bridge — it must receive the instructions on the first prompt.
        attached: false,
        skillsPaths,
        permissionMode,
        builtinToolFiltering: startOpts.builtinToolFiltering,
        recursionLimit: settings.recursionLimit,
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
    harnessId: 'deepagents',
    message:
      'The deepagents harness needs a TCP port exposed by the sandbox. ' +
      'Create the sandbox with `ports: [<port>]` or pass `createDeepAgents({ port })`.',
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

// Materialize each skill as a native deepagents `<name>/SKILL.md` folder (+ attached files) under the given root, so skills load on demand and file references resolve.
async function writeSkills({
  sandbox,
  root,
  skills,
  abortSignal,
}: {
  sandbox: ReturnType<HarnessV1NetworkSandboxSession['restricted']>;
  root: string;
  skills: ReadonlyArray<HarnessV1Skill>;
  abortSignal?: AbortSignal;
}): Promise<void> {
  /*
   * DeepAgents requires each `SKILL.md` frontmatter name to match the parent
   * directory name, so keep the stricter lowercase skill-name policy here.
   */
  await writeHarnessSkills({
    sandbox,
    rootDir: root,
    skills,
    abortSignal,
    skillNamePattern: /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/,
    invalidSkillNameMessage: ({ name }) =>
      `Invalid deepagents skill name '${name}': must be lowercase alphanumeric with hyphens, 1-64 chars.`,
    filePathMode: 'strip-leading-slashes',
    invalidSkillFilePathMessage: ({ skillName, filePath }) =>
      `Invalid skill file path for '${skillName}': ${filePath}`,
  });
}

function openWebSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const onOpen = () => {
      ws.off('error', onError);
      resolve(ws);
    };
    const onError = (err: Error) => {
      ws.off('open', onOpen);
      reject(err);
    };
    ws.once('open', onOpen);
    ws.once('error', onError);
  });
}

function createSession({
  sessionId,
  channel,
  proc,
  model,
  bridgePort,
  bridgeToken,
  sandboxId,
  isResume,
  attached,
  skillsPaths,
  permissionMode,
  builtinToolFiltering,
  recursionLimit,
}: {
  sessionId: string;
  channel: DeepAgentsChannel;
  // Undefined on attach — the live bridge was spawned by another process.
  proc: Experimental_SandboxProcess | undefined;
  model: string | undefined;
  bridgePort: number;
  bridgeToken: string;
  sandboxId: string;
  isResume: boolean;
  // True only when attaching to a live bridge that already built the agent with
  // its instructions. A fresh spawn (incl. a respawn on attach failure or a
  // stop-resume) starts a new bridge that must receive the instructions again.
  attached: boolean;
  skillsPaths?: string[];
  permissionMode?: HarnessV1PermissionMode;
  builtinToolFiltering?: HarnessV1BuiltinToolFiltering;
  recursionLimit?: number;
}): HarnessV1Session {
  let stopped = false;
  let instructionsApplied = attached;

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
      'file-change',
      'finish-step',
      'raw',
    ] as const;
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

    for (const type of eventTypes) {
      unsubs.push(channel.on(type, msg => forward(msg)));
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

    // A `'suspended'` close is a graceful slice-boundary freeze (suspend/detach keep the bridge alive for continuation); end the turn cleanly. Any other close is an unexpected bridge failure.
    const onClose = (_code: number, reason: string) => {
      if (isSettled) return;
      if (reason === 'suspended') {
        settleSuccess();
        return;
      }
      settleError(
        new Error('deepagents bridge closed before the turn finished.'),
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
        turnOpts.abortSignal.addEventListener('abort', onAbort, { once: true });
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
      submitUserMessage: async text => {
        channel.send({ type: 'user-message', text });
      },
      submitToolApproval: async input => {
        channel.send({
          type: 'tool-approval-response',
          approvalId: input.approvalId,
          approved: input.approved,
          ...(input.reason != null ? { reason: input.reason } : {}),
        });
      },
      done,
    };
  };

  const unsupported = (capability: string): never => {
    throw new HarnessCapabilityUnsupportedError({
      harnessId: 'deepagents',
      message: `Harness 'deepagents' does not support ${capability} yet.`,
    });
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

      const applyInstructions =
        !instructionsApplied && !!promptOpts.instructions;
      instructionsApplied = true;

      channel.send({
        type: 'start',
        prompt: extractUserText(promptOpts.prompt),
        ...(applyInstructions ? { instructions: promptOpts.instructions } : {}),
        tools: (promptOpts.tools ?? []).map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
        ...(model ? { model } : {}),
        ...(skillsPaths?.length ? { skillsPaths } : {}),
        ...(permissionMode ? { permissionMode } : {}),
        ...(builtinToolFiltering ? { builtinToolFiltering } : {}),
        ...(recursionLimit != null ? { recursionLimit } : {}),
      });

      return control;
    },
    doContinueTurn: async continueOpts => {
      // Attach/replay: doStart opened with `{ resume: true }` so the bridge replays past the cursor; no `start` is sent (that would clear the replay log).
      return wireTurn({
        emit: continueOpts.emit,
        abortSignal: continueOpts.abortSignal,
      });
    },
    doSuspendTurn: async () => {
      if (stopped) {
        throw new Error(
          `deepagents session ${sessionId} is stopped; cannot suspend.`,
        );
      }
      stopped = true;
      // Freeze the active turn at the cursor, leaving the bridge running so the next slice replays the tail.
      await channel.interrupt();
      const lastSeenEventId = await channel.suspend();
      const payload: HarnessV1ContinueTurnState = {
        type: 'continue-turn',
        harnessId: 'deepagents',
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
    doDetach: async () => {
      if (stopped) {
        throw new Error(
          `deepagents session ${sessionId} is already stopped; cannot detach.`,
        );
      }
      stopped = true;
      // Park between turns: close the host socket but leave the bridge running for a later reattach via these coords.
      const lastSeenEventId = await channel.suspend();
      const payload: HarnessV1ResumeSessionState = {
        type: 'resume-session',
        harnessId: 'deepagents',
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
    doCompact: async () => unsupported('manual compaction'),
    doStop: async () => {
      if (stopped) {
        throw new Error(
          `deepagents session ${sessionId} is already stopped; cannot stop.`,
        );
      }
      stopped = true;
      await teardown(channel, proc);
      // In-memory conversation is lost on teardown; the sandbox snapshot preserves the workspace files, not the conversation.
      const payload: HarnessV1ResumeSessionState = {
        type: 'resume-session',
        harnessId: 'deepagents',
        specificationVersion: 'harness-v1',
        data: {},
      };
      return payload;
    },
    doDestroy: async () => {
      if (stopped) return;
      stopped = true;
      await teardown(channel, proc);
    },
  };
}

async function teardown(
  channel: DeepAgentsChannel,
  proc: Experimental_SandboxProcess | undefined,
): Promise<void> {
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
}

// Reduce the prompt to plain user text; non-text parts are unsupported.
function extractUserText(prompt: HarnessV1Prompt): string {
  if (typeof prompt === 'string') return prompt;
  const { content } = prompt;
  if (typeof content === 'string') return content;
  const parts: string[] = [];
  for (const part of content) {
    if (part.type !== 'text') {
      throw new HarnessCapabilityUnsupportedError({
        harnessId: 'deepagents',
        message: `The deepagents harness does not yet support user message parts of type '${part.type}'. Pass a string or a user message whose content contains only text parts.`,
      });
    }
    parts.push(part.text);
  }
  return parts.join('\n\n');
}
