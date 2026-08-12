import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  commonTool,
  HarnessCapabilityUnsupportedError,
  harnessV1DiagnosticFromBridgeFrame,
  type HarnessV1,
  type HarnessV1Bootstrap,
  type HarnessV1DebugConfig,
  type HarnessV1BuiltinTool,
  type HarnessV1ContinueTurnState,
  type HarnessV1Prompt,
  type HarnessV1PromptControl,
  type HarnessV1ResumeSessionState,
  type HarnessV1NetworkSandboxSession,
  type HarnessV1PermissionMode,
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
  type Experimental_SandboxProcess,
  type Experimental_SandboxSession,
} from '@ai-sdk/provider-utils';
import { WebSocket } from 'ws';
import { z } from 'zod/v4';
import { resolveCodexEnv, type CodexAuthOptions } from './codex-auth';
import {
  outboundMessageSchema,
  type InboundMessage,
  type OutboundMessage,
} from './codex-bridge-protocol';
import { CLI_SHIM_FILENAME } from './bridge/cli-relay';
import { VERSION } from './version';

type CodexChannel = SandboxChannel<OutboundMessage, InboundMessage>;
type CodexRespawnStrategy = 'replay' | 'rerun';

type WriteSkillsResult = {
  readonly homeDir: string;
  readonly codexHomeDir: string;
};

/*
 * The model the adapter pins when the consumer configures none. The Codex SDK
 * does not report the model it resolves to at runtime (no model field on any
 * event), and exposes no default-model constant, so we pin the latest
 * codex-specialized model available for the bundled `@openai/codex@0.130.0`
 * (published 2026-05-08): `gpt-5.3-codex` (released 2026-02). Keep this in sync
 * when bumping the codex SDK/binary. Passing it explicitly makes the resolved
 * model deterministic and the telemetry (`gen_ai.request.model`) accurate.
 */
const DEFAULT_CODEX_MODEL = 'gpt-5.3-codex';

/**
 * Value to use in User-Agent and `x-client-app` headers.
 */
const CODEX_CLIENT_APP = `ai-sdk/harness-codex/${VERSION}`;

export type CodexHarnessSettings = {
  readonly auth?: CodexAuthOptions;
  /**
   * OpenAI model id the underlying `codex` CLI should use. Leaving this unset
   * pins the adapter default (`DEFAULT_CODEX_MODEL`).
   */
  readonly model?: string;
  /**
   * Reasoning effort for reasoning-capable models. Leaving this unset
   * defers to the CLI's default.
   */
  readonly reasoningEffort?: 'low' | 'medium' | 'high';
  /**
   * When `true`, allow the underlying runtime to use live web search.
   */
  readonly webSearch?: boolean;
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
 * Every native tool the Codex CLI can invoke as a model-callable tool,
 * declared as a `ToolSet` keyed by what the bridge emits as `toolName` on
 * the wire (`commonName ?? nativeName`). Schemas reflect the `ThreadItem`
 * union in `@openai/codex-sdk`'s `dist/index.d.ts`.
 *
 * Codex's other native operations (`apply_patch`, todo planning) surface
 * only as side-effect events (`file_change`, `todo_list`) and are not
 * model-callable tools — they don't appear here.
 */
const CODEX_BUILTIN_TOOLS = {
  bash: commonTool('bash', {
    nativeName: 'shell',
    toolUseKind: 'bash',
    description: 'Execute a shell command',
    inputSchema: z.object({ command: z.string() }),
  }),
  webSearch: commonTool('webSearch', {
    nativeName: 'web_search',
    toolUseKind: 'readonly',
    description: 'Search the web',
    inputSchema: z.object({ query: z.string() }),
  }),
} as const satisfies Record<string, HarnessV1BuiltinTool<any, any>>;

/*
 * Bootstrap lives in /tmp because it's pure derived state — the harness can
 * reinstall the CLI and bridge files on any fresh sandbox from the recipe.
 * Persistence comes from the sandbox provider's snapshot, not the path.
 *
 * The session work dir (`startOpts.sessionWorkDir`) lives under the sandbox's
 * default working directory — the provider's persistent mount — so any files
 * the agent edits survive both detach -> attach and stop -> snapshot -> resume
 * cycles. Harness infra derived from `sandboxSession.defaultWorkingDirectory`
 * lives under `.agent-runs`, outside the agent workdir.
 */
const BOOTSTRAP_DIR = '/tmp/harness/codex';

/**
 * Live bridge coordinates returned by `doDetach()` and `doSuspendTurn()`. A
 * future process uses them to reopen a socket to the still-running bridge
 * (`attach`) instead of re-spawning it. Absent on a `doStop()` payload.
 */
const codexBridgeCoordsSchema = z.object({
  port: z.number(),
  token: z.string(),
  lastSeenEventId: z.number(),
  sandboxId: z.string().optional(),
});

/**
 * Schema for the adapter-specific lifecycle `data` payload Codex produces.
 * `threadId` is what `codex.resumeThread(...)` requires for the replay/rerun
 * rungs; the sandbox lookup is handled separately via
 * `provider.resumeSession({ sessionId })`. `bridge` carries live coordinates
 * for cross-process `attach` (present on `doDetach()` and `doSuspendTurn()`
 * payloads).
 */
const codexResumeStateSchema = z.object({
  threadId: z.string().optional(),
  bridge: codexBridgeCoordsSchema.optional(),
});

type CodexBridgeCoords = z.infer<typeof codexBridgeCoordsSchema>;

export function createCodex(
  settings: CodexHarnessSettings = {},
): HarnessV1<typeof CODEX_BUILTIN_TOOLS> {
  let cachedBootstrap: HarnessV1Bootstrap | undefined;

  return {
    specificationVersion: 'harness-v1',
    harnessId: 'codex',
    builtinTools: CODEX_BUILTIN_TOOLS,
    supportsBuiltinToolApprovals: false,
    lifecycleStateSchema: codexResumeStateSchema,
    getBootstrap: async () => {
      if (cachedBootstrap != null) return cachedBootstrap;
      const [pkg, lock, bridge, hostToolMcp] = await Promise.all([
        readBridgeAsset('package.json'),
        readBridgeAsset('pnpm-lock.yaml'),
        readBridgeAsset('index.mjs'),
        readBridgeAsset('host-tool-mcp.mjs'),
      ]);
      cachedBootstrap = {
        harnessId: 'codex',
        bootstrapDir: BOOTSTRAP_DIR,
        files: [
          { path: `${BOOTSTRAP_DIR}/package.json`, content: pkg },
          { path: `${BOOTSTRAP_DIR}/pnpm-lock.yaml`, content: lock },
          { path: `${BOOTSTRAP_DIR}/bridge.mjs`, content: bridge },
          {
            path: `${BOOTSTRAP_DIR}/host-tool-mcp.mjs`,
            content: hostToolMcp,
          },
        ],
        commands: [
          { command: `mkdir -p ${BOOTSTRAP_DIR}` },
          {
            command: `pnpm --dir ${BOOTSTRAP_DIR} install --frozen-lockfile --store-dir ${BOOTSTRAP_DIR}/.pnpm-store`,
          },
        ],
      };
      return cachedBootstrap;
    },
    doStart: async startOpts => {
      if (startOpts.builtinToolFiltering != null) {
        throw new HarnessCapabilityUnsupportedError({
          message:
            "Harness 'codex' does not support built-in tool filtering controls.",
          harnessId: 'codex',
        });
      }
      if (
        startOpts.permissionMode != null &&
        startOpts.permissionMode !== 'allow-all'
      ) {
        throw new HarnessCapabilityUnsupportedError({
          message:
            "Harness 'codex' does not support built-in tool approval requests; use permissionMode: 'allow-all'.",
          harnessId: 'codex',
        });
      }
      const sandboxSession = startOpts.sandboxSession;
      const session = sandboxSession.restricted();
      const sandboxId = sandboxSession.id;
      const lifecycleState = startOpts.continueFrom ?? startOpts.resumeFrom;
      const isResume = lifecycleState != null;
      const isContinue = startOpts.continueFrom != null;
      const resumeData =
        isResume && typeof lifecycleState?.data === 'object'
          ? (lifecycleState.data as {
              threadId?: unknown;
              bridge?: CodexBridgeCoords;
            })
          : undefined;
      const resumeThreadId = resumeData?.threadId;
      const resumeThreadIdString =
        typeof resumeThreadId === 'string' && resumeThreadId.length > 0
          ? resumeThreadId
          : undefined;
      const coords = resumeData?.bridge;

      const workDir = startOpts.sessionWorkDir;
      const sessionDataDir = `${sandboxSession.defaultWorkingDirectory}/.agent-runs/${startOpts.sessionId}`;
      const bridgeStateDir = `${sessionDataDir}/bridge`;
      const cliShimDir = `${sessionDataDir}/codex`;
      const cliShimPath = `${cliShimDir}/${CLI_SHIM_FILENAME}`;
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
        harnessId: 'codex',
        sessionId: startOpts.sessionId,
      });

      /*
       * Rung 1 — ATTACH. With live coordinates, reopen a socket to the
       * still-running bridge. Parked between-turn sessions just attach and wait
       * for the next `start`; suspended in-flight turns request replay of
       * everything past the persisted cursor. No spawn, no fresh token. If the
       * bridge is gone the open throws and we fall through to a spawn-based
       * recovery.
       */
      if (coords) {
        try {
          const attachUrl =
            (await sandboxSession.getPortUrl({
              port: coords.port,
              protocol: 'ws',
            })) + `?agent_bridge_token=${encodeURIComponent(coords.token)}`;
          const attachChannel: CodexChannel = new SandboxChannel({
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
            cliShimPath,
            // The live bridge was spawned by another process; no process handle.
            proc: undefined,
            model: settings.model ?? DEFAULT_CODEX_MODEL,
            reasoningEffort: settings.reasoningEffort,
            webSearch: settings.webSearch,
            resumeThreadId: resumeThreadIdString,
            isResume: true,
            seedResumeThreadOnFirstPrompt: false,
            rerunContinue: false,
            bridgePort: coords.port,
            bridgeToken: coords.token,
            sandboxId,
            debug: startOpts.observability?.debug,
            permissionMode: startOpts.permissionMode,
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
       * via `codex.resumeThread(threadId)` when attach is unavailable.
       */
      let respawnStrategy: CodexRespawnStrategy | undefined = isResume
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

      const port = resolveBridgePort(sandboxSession, settings.port);
      const token = randomBytes(32).toString('hex');
      const codexSkillSetup =
        startOpts.skills && startOpts.skills.length > 0
          ? await writeCodexSkills({
              sandbox: session,
              skills: startOpts.skills,
              abortSignal: startOpts.abortSignal,
            })
          : undefined;
      const env = {
        ...resolveCodexEnv(settings.auth),
        AI_SDK_HARNESS_CLIENT_APP: CODEX_CLIENT_APP,
        BRIDGE_CHANNEL_TOKEN: token,
        BRIDGE_WS_PORT: String(port),
        ...(codexSkillSetup
          ? {
              HOME: codexSkillSetup.homeDir,
              CODEX_HOME: codexSkillSetup.codexHomeDir,
            }
          : {}),
        ...(respawnStrategy === 'replay'
          ? { BRIDGE_REPLAY_FROM_DISK: '1' }
          : {}),
      };

      if (respawnStrategy === undefined) {
        await session.run({
          command: `mkdir -p ${shellQuote(workDir)} ${shellQuote(bridgeStateDir)}`,
          abortSignal: startOpts.abortSignal,
        });
      }

      await markBridgeStarting({
        sandbox: session,
        bridgeStateDir,
        bridgeType: 'codex',
        abortSignal: startOpts.abortSignal,
      });

      const proc = await session.spawn({
        command: `node ${BOOTSTRAP_DIR}/bridge.mjs --workdir ${shellQuote(workDir)} --bridge-state-dir ${shellQuote(bridgeStateDir)} --bootstrap-dir ${shellQuote(BOOTSTRAP_DIR)} --cli-shim-dir ${shellQuote(cliShimDir)}`,
        env,
        abortSignal: startOpts.abortSignal,
      });
      const stderrTail: string[] = [];
      const bridgeStderrDone = forwardBridgeProcessStream({
        stream: proc.stderr,
        streamName: 'stderr',
        source: 'codex',
        collectTail: stderrTail,
      });

      const { port: boundPort } = await waitForBridgeReady({
        proc,
        sandbox: session,
        bridgeStateDir,
        bridgeType: 'codex',
        timeoutMs,
        abortSignal: startOpts.abortSignal,
        createTimeoutError: ({ proc, stdoutTail }) =>
          createBridgeStartupError({
            message: 'codex bridge did not become ready in time.',
            proc,
            stdoutTail,
            stderrTail,
            stderrDone: bridgeStderrDone,
          }),
        createExitError: ({ proc, stdoutTail }) =>
          createBridgeStartupError({
            message: 'codex bridge exited before becoming ready.',
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

      const channel: CodexChannel = new SandboxChannel({
        connect: () => openWebSocket(wsUrl),
        outboundSchema: outboundMessageSchema,
        onDiagnostic,
        onBridgeError,
        // In replay mode the respawned bridge reloaded the finished turn from
        // disk; seed the cursor and resume so it streams the tail (incl.
        // `finish`).
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
        cliShimPath,
        proc,
        model: settings.model ?? DEFAULT_CODEX_MODEL,
        reasoningEffort: settings.reasoningEffort,
        webSearch: settings.webSearch,
        resumeThreadId: resumeThreadIdString,
        isResume: respawnStrategy !== undefined,
        seedResumeThreadOnFirstPrompt: respawnStrategy !== undefined,
        rerunContinue: respawnStrategy === 'rerun',
        bridgePort: boundPort,
        bridgeToken: token,
        sandboxId,
        debug: startOpts.observability?.debug,
        permissionMode: startOpts.permissionMode,
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
    harnessId: 'codex',
    message:
      'The codex harness needs a TCP port exposed by the sandbox. ' +
      'Create the sandbox with `ports: [<port>]` or pass `createCodex({ port })`.',
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

async function writeCodexSkills({
  sandbox,
  skills,
  abortSignal,
}: {
  sandbox: Experimental_SandboxSession;
  skills: ReadonlyArray<HarnessV1Skill>;
  abortSignal?: AbortSignal;
}): Promise<WriteSkillsResult> {
  const homeDir = await resolveSandboxHomeDir({ sandbox, abortSignal });
  const codexHomeDir = path.posix.join(homeDir, '.codex');
  await sandbox.run({
    command: `mkdir -p ${shellQuote(codexHomeDir)}`,
    abortSignal,
  });

  const rootDir = path.posix.join(homeDir, '.agents', 'skills');
  await writeHarnessSkills({
    sandbox,
    rootDir,
    skills,
    abortSignal,
    invalidSkillNameMessage: ({ name }) => `Invalid Codex skill name: ${name}`,
    invalidSkillFilePathMessage: ({ skillName, filePath }) =>
      `Invalid Codex skill file path for ${skillName}: ${filePath}`,
  });

  return {
    homeDir,
    codexHomeDir,
  };
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
  cliShimPath,
  proc,
  model,
  reasoningEffort,
  webSearch,
  resumeThreadId,
  isResume,
  seedResumeThreadOnFirstPrompt,
  rerunContinue,
  bridgePort,
  bridgeToken,
  sandboxId,
  debug,
  permissionMode,
}: {
  sessionId: string;
  channel: CodexChannel;
  cliShimPath: string;
  /** Undefined on `attach` — the live bridge was spawned by another process. */
  proc: Experimental_SandboxProcess | undefined;
  model: string | undefined;
  reasoningEffort: 'low' | 'medium' | 'high' | undefined;
  webSearch: boolean | undefined;
  resumeThreadId: string | undefined;
  isResume: boolean;
  seedResumeThreadOnFirstPrompt: boolean;
  rerunContinue: boolean;
  bridgePort: number;
  bridgeToken: string;
  sandboxId: string;
  debug: HarnessV1DebugConfig | undefined;
  permissionMode: HarnessV1PermissionMode | undefined;
}): HarnessV1Session {
  let stopped = false;
  let stopPromise: Promise<void> | undefined;
  /*
   * Send the persisted threadId on the first prompt only when the bridge was
   * respawned (rerun/replay) so it takes the `codex.resumeThread(...)` branch.
   * An `attach`ed bridge already holds its threadState in memory and continues
   * on its own, so it needs no seed.
   */
  let pendingResumeThreadId = seedResumeThreadOnFirstPrompt
    ? resumeThreadId
    : undefined;
  /*
   * Initial prompt guidance is prepended to the first user message of a fresh
   * session only. A resumed session (attach/replay/rerun) already carried it
   * in its original first message (preserved in the persisted thread), so it
   * starts "applied".
   */
  let instructionsApplied = isResume;

  /*
   * Latest codex thread id, cached from the bridge's `bridge-thread`
   * announcements. Seeded from lifecycle state so `doDetach()` and `doStop()`
   * can include a thread id even before this process has run a turn.
   */
  let latestThreadId = resumeThreadId;
  channel.on('bridge-thread', msg => {
    latestThreadId = msg.threadId;
  });

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
  }): {
    control: HarnessV1PromptControl;
    sendStart: (send: () => void) => void;
  } => {
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
      settleError(new Error('codex bridge closed before the turn finished.'));
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

    const control: HarnessV1PromptControl = {
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

    return {
      control,
      sendStart: send => {
        /*
         * Codex can complete short turns without using tools. Deferring the
         * start frame gives the harness runner one event-loop turn to finish
         * wiring the prompt control and stream output before Codex can settle.
         */
        const timer = setTimeout(() => {
          if (isSettled) return;
          try {
            send();
          } catch (err) {
            settleError(err);
          }
        }, 0);
        timer.unref?.();
      },
    };
  };

  return {
    sessionId,
    isResume,
    modelId: model,
    doPromptTurn: async promptOpts => {
      const turn = wireTurn({
        emit: promptOpts.emit,
        abortSignal: promptOpts.abortSignal,
      });

      const tools = (promptOpts.tools ?? []).map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      let promptText = extractUserText(promptOpts.prompt);
      if (!instructionsApplied) {
        const instructions =
          (promptOpts.instructions ? promptOpts.instructions + '\n\n' : '') +
          'Only respond with your `final` message once you have fully addressed the user request.';
        promptText = frameInitialPromptGuidance({
          instructions,
          toolUsageBlock:
            tools.length > 0
              ? composeToolUsageInstructions({
                  tools,
                  cliShimPath,
                })
              : undefined,
          userText: promptText,
        });
      }
      instructionsApplied = true;

      const startMessage = {
        type: 'start' as const,
        prompt: promptText,
        tools,
        model,
        reasoningEffort,
        webSearch,
        ...(permissionMode ? { permissionMode } : {}),
        ...(pendingResumeThreadId
          ? { resumeThreadId: pendingResumeThreadId }
          : {}),
        ...(debug ? { debug } : {}),
      };
      pendingResumeThreadId = undefined;
      turn.sendStart(() => channel.send(startMessage));

      return turn.control;
    },
    doContinueTurn: async continueOpts => {
      const turn = wireTurn({
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
       * re-drive codex's own thread via `resumeThreadId`. Lossy — work in flight
       * at the interruption is recomputed. This is the rare bridge-died
       * fallback; the common slice path is `attach`.
       */
      if (rerunContinue) {
        const threadId = pendingResumeThreadId ?? latestThreadId;
        pendingResumeThreadId = undefined;
        turn.sendStart(() =>
          channel.send({
            type: 'start' as const,
            /*
             * A continuation nudge rather than an empty prompt: `resumeThreadId`
             * rehydrates the prior thread, and this is the new user turn that
             * drives it forward. Keeping it non-empty avoids handing the runtime
             * an empty user message (and mirrors the claude-code adapter, where an
             * empty text block trips the Anthropic API's `cache_control` rule).
             */
            prompt: 'Continue.',
            tools: (continueOpts.tools ?? []).map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
            model,
            reasoningEffort,
            webSearch,
            ...(permissionMode ? { permissionMode } : {}),
            ...(threadId ? { resumeThreadId: threadId } : {}),
            ...(debug ? { debug } : {}),
          }),
        );
      }

      return turn.control;
    },
    doCompact: async () => {
      /*
       * Codex compacts its context automatically inside the core turn loop
       * (~90% of the model context window), but the `codex exec` transport this
       * adapter drives exposes no manual compaction trigger and emits no
       * compaction event. Manual `compact()` is therefore unsupported; Codex's
       * own auto-compaction continues to run regardless.
       */
      throw new HarnessCapabilityUnsupportedError({
        message:
          "Harness 'codex' does not support manual compaction; Codex auto-compacts its context internally.",
        harnessId: 'codex',
      });
    },
    doDetach: async () => {
      if (stopped) {
        throw new Error(
          `codex session ${sessionId} is already stopped; cannot detach.`,
        );
      }
      stopped = true;
      const lastSeenEventId = await channel.suspend();
      const payload: HarnessV1ResumeSessionState = {
        type: 'resume-session',
        harnessId: 'codex',
        specificationVersion: 'harness-v1',
        data: {
          ...(latestThreadId ? { threadId: latestThreadId } : {}),
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
          `codex session ${sessionId} is already stopped; cannot stop.`,
        );
      }
      stopped = true;
      /*
       * If the bridge's channel already closed (e.g. mid-turn WS drop)
       * there is no one to ack a `detach` message. Synthesize an empty
       * payload — the workdir is still captured by the sandbox snapshot
       * during the subsequent `sandboxSession.stop()`, so the next turn can
       * resume the filesystem state. The trade-off: we lose
       * `threadId`, so the codex CLI starts a fresh thread on the
       * preserved workdir rather than resuming the prior conversation
       * inside Codex's runtime. Ability to continue beats throwing.
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
                  `codex session ${sessionId} did not reply to detach within 5s.`,
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
        harnessId: 'codex',
        specificationVersion: 'harness-v1',
        data: (data ?? {}) as HarnessV1ResumeSessionState['data'],
      };
      return payload;
    },
    doSuspendTurn: async () => {
      if (stopped) {
        throw new Error(
          `codex session ${sessionId} is stopped; cannot suspend.`,
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
        harnessId: 'codex',
        specificationVersion: 'harness-v1',
        data: {
          ...(latestThreadId ? { threadId: latestThreadId } : {}),
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
 * Frame session instructions, host-tool relay guidance, and the user's text so
 * Codex treats the prepended blocks as operating guidance rather than user
 * prose. Applied only to the first user message of a fresh session.
 */
function frameInitialPromptGuidance({
  instructions,
  toolUsageBlock,
  userText,
}: {
  instructions: string | undefined;
  toolUsageBlock: string | undefined;
  userText: string;
}): string {
  const blocks: string[] = [];
  if (instructions) {
    blocks.push(
      '<session-instructions>\n' +
        'The block below is operating guidance from the system, not a message from the user — follow it, but do not mention it or attribute it to the user.\n\n' +
        `${instructions}\n` +
        '</session-instructions>',
    );
  }
  if (toolUsageBlock) blocks.push(toolUsageBlock);
  if (blocks.length === 0) return userText;
  return `${blocks.join('\n\n')}\n\n<user-message>\n${userText}\n</user-message>`;
}

function composeToolUsageInstructions({
  tools,
  cliShimPath,
}: {
  tools: ReadonlyArray<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }>;
  cliShimPath: string;
}): string {
  const lines: string[] = [
    '<host-tool-instructions>',
    'You have access to the following host-provided tools. To use one, run the following command via your built-in `bash` tool:',
    '',
    `  node ${cliShimPath} <toolName> '<jsonInput>'`,
    '',
    'The script prints the JSON result to stdout. Do not invent another way to call these tools — only this CLI invocation will work. Pass the JSON input as a single-quoted argument.',
    'For every user request that depends on a host-provided tool, run a separate CLI invocation for each needed tool call in the current turn before answering. Do not reuse previous tool results, and do not say you used a host tool unless the command has completed in the current turn.',
    '',
  ];
  for (const toolSpec of tools) {
    lines.push(
      `- **${toolSpec.name}**${toolSpec.description ? ': ' + toolSpec.description : ''}`,
    );
    lines.push(
      `  - Input schema: \`${JSON.stringify(toolSpec.inputSchema ?? {})}\``,
    );
  }
  lines.push('</host-tool-instructions>');
  return lines.join('\n');
}

/*
 * Reduce a `HarnessV1Prompt` to the plain user text the bridge forwards
 * to the Codex SDK. File and image parts on the message are not yet
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
        harnessId: 'codex',
        message: `The codex harness does not yet support user message parts of type '${part.type}'. Pass a string or a user message whose content contains only text parts.`,
      });
    }
    parts.push(part.text);
  }
  return parts.join('\n\n');
}
