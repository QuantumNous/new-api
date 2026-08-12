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
  type HarnessV1BuiltinTool,
  type HarnessV1BuiltinToolFiltering,
  type HarnessV1ContinueTurnState,
  type HarnessV1DebugConfig,
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
  type Experimental_SandboxProcess,
  type Experimental_SandboxSession,
} from '@ai-sdk/provider-utils';
import { WebSocket } from 'ws';
import { z } from 'zod/v4';
import {
  resolveOpenCodeEnv,
  splitOpenCodeModel,
  type OpenCodeAuthOptions,
} from './opencode-auth';
import {
  outboundMessageSchema,
  type InboundMessage,
  type OutboundMessage,
} from './opencode-bridge-protocol';
import { VERSION } from './version';

type OpenCodeChannel = SandboxChannel<OutboundMessage, InboundMessage>;
type OpenCodeRespawnStrategy = 'replay' | 'rerun';

type WriteSkillsResult = {
  readonly skillsDir: string;
};

/**
 * Value to use in User-Agent and `x-client-app` headers.
 */
const OPENCODE_CLIENT_APP = `ai-sdk/harness-opencode/${VERSION}`;

export type OpenCodeHarnessSettings = {
  readonly auth?: OpenCodeAuthOptions;
  readonly model?: string;
  readonly provider?: string;
  /**
   * OpenCode reasoning/thinking variant for reasoning-capable models, e.g.
   * `'low'`, `'medium'`, `'high'`, or another model-supported OpenCode
   * variant.
   */
  readonly reasoningVariant?: string;
  readonly port?: number;
  readonly startupTimeoutMs?: number;
};

const optionalStringRecord = z.record(z.string(), z.unknown()).optional();

const OPENCODE_BUILTIN_TOOLS = {
  read: commonTool('read', {
    nativeName: 'view',
    toolUseKind: 'readonly',
    description: 'Read file contents',
    inputSchema: z.looseObject({
      file_path: z.string().optional(),
      path: z.string().optional(),
    }),
  }),
  write: commonTool('write', {
    nativeName: 'write',
    toolUseKind: 'edit',
    description: 'Write content to a file',
    inputSchema: z.looseObject({
      file_path: z.string().optional(),
      path: z.string().optional(),
      content: z.string().optional(),
    }),
  }),
  edit: commonTool('edit', {
    nativeName: 'edit',
    toolUseKind: 'edit',
    description: 'Edit a file by replacing text',
    inputSchema: z.looseObject({
      file_path: z.string().optional(),
      path: z.string().optional(),
      old_string: z.string().optional(),
      new_string: z.string().optional(),
    }),
  }),
  bash: commonTool('bash', {
    nativeName: 'bash',
    toolUseKind: 'bash',
    description: 'Execute a shell command',
    inputSchema: z.looseObject({
      command: z.string().optional(),
    }),
  }),
  glob: commonTool('glob', {
    nativeName: 'glob',
    toolUseKind: 'readonly',
    description: 'Find files matching a glob pattern',
    inputSchema: z.looseObject({
      pattern: z.string().optional(),
      path: z.string().optional(),
    }),
  }),
  grep: commonTool('grep', {
    nativeName: 'grep',
    toolUseKind: 'readonly',
    description: 'Search file contents with regex',
    inputSchema: z.looseObject({
      pattern: z.string().optional(),
      path: z.string().optional(),
    }),
  }),
  ls: tool({
    description: 'List directory contents',
    inputSchema: z.looseObject({
      path: z.string().optional(),
    }),
  }),
  webfetch: tool({
    description: 'Fetch a URL',
    inputSchema: z.looseObject({
      url: z.string().optional(),
      prompt: z.string().optional(),
    }),
  }),
  skill: tool({
    description: 'Load an OpenCode skill by name',
    inputSchema: z.looseObject({
      name: z.string().optional(),
    }),
  }),
  todowrite: tool({
    description: 'Replace the OpenCode session todo list',
    inputSchema: z.looseObject({
      todos: z
        .array(
          z.looseObject({
            content: z.string().optional(),
            status: z.string().optional(),
            priority: z.string().optional(),
          }),
        )
        .optional(),
    }),
  }),
  agent: tool({
    description: 'Run an OpenCode subagent',
    inputSchema: z.looseObject({
      agent: z.string().optional(),
      prompt: z.string().optional(),
      description: z.string().optional(),
      metadata: optionalStringRecord,
    }),
  }),
} as const satisfies Record<string, HarnessV1BuiltinTool<any, any>>;

const BOOTSTRAP_DIR = '/tmp/harness/opencode';

const openCodeBridgeCoordsSchema = z.object({
  port: z.number(),
  token: z.string(),
  lastSeenEventId: z.number(),
  sandboxId: z.string().optional(),
});

const openCodeResumeStateSchema = z.object({
  openCodeSessionId: z.string().optional(),
  bridge: openCodeBridgeCoordsSchema.optional(),
});

type OpenCodeBridgeCoords = z.infer<typeof openCodeBridgeCoordsSchema>;

export function createOpenCode(
  settings: OpenCodeHarnessSettings = {},
): HarnessV1<typeof OPENCODE_BUILTIN_TOOLS> {
  let cachedBootstrap: HarnessV1Bootstrap | undefined;

  return {
    specificationVersion: 'harness-v1',
    harnessId: 'opencode',
    builtinTools: OPENCODE_BUILTIN_TOOLS,
    supportsBuiltinToolApprovals: true,
    lifecycleStateSchema: openCodeResumeStateSchema,
    getBootstrap: async () => {
      if (cachedBootstrap != null) return cachedBootstrap;
      const [pkg, lock, bridge, hostToolMcp] = await Promise.all([
        readBridgeAsset('package.json'),
        readBridgeAsset('pnpm-lock.yaml'),
        readBridgeAsset('index.mjs'),
        readBridgeAsset('host-tool-mcp.mjs'),
      ]);
      cachedBootstrap = {
        harnessId: 'opencode',
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
          {
            command: `cd ${BOOTSTRAP_DIR} && node node_modules/opencode-ai/postinstall.mjs && ./node_modules/.bin/opencode --version`,
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
      const resumeData =
        isResume && typeof lifecycleState?.data === 'object'
          ? (lifecycleState.data as {
              openCodeSessionId?: unknown;
              bridge?: OpenCodeBridgeCoords;
            })
          : undefined;
      const resumeSessionId =
        typeof resumeData?.openCodeSessionId === 'string' &&
        resumeData.openCodeSessionId.length > 0
          ? resumeData.openCodeSessionId
          : undefined;
      const coords = resumeData?.bridge;

      const workDir = startOpts.sessionWorkDir;
      const sessionDataDir = `${sandboxSession.defaultWorkingDirectory}/.agent-runs/${startOpts.sessionId}`;
      const bridgeStateDir = `${sessionDataDir}/bridge`;
      const timeoutMs = settings.startupTimeoutMs ?? 120_000;
      const model = splitOpenCodeModel(settings.model, settings.provider).model;

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
        harnessId: 'opencode',
        sessionId: startOpts.sessionId,
      });

      if (coords) {
        try {
          const attachUrl =
            (await sandboxSession.getPortUrl({
              port: coords.port,
              protocol: 'ws',
            })) + `?agent_bridge_token=${encodeURIComponent(coords.token)}`;
          const attachChannel: OpenCodeChannel = new SandboxChannel({
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
            model,
            provider: settings.provider,
            reasoningVariant: settings.reasoningVariant,
            openCodeSessionId: resumeSessionId,
            isResume: true,
            seedResumeSessionOnFirstPrompt: false,
            rerunContinue: false,
            bridgePort: coords.port,
            bridgeToken: coords.token,
            sandboxId,
            debug: startOpts.observability?.debug,
            permissionMode: startOpts.permissionMode,
            builtinToolFiltering: startOpts.builtinToolFiltering,
          });
        } catch {}
      }

      let respawnStrategy: OpenCodeRespawnStrategy | undefined = isResume
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
      const sandboxHomeDir = await resolveSandboxHomeDir({
        sandbox: session,
        abortSignal: startOpts.abortSignal,
      });
      const xdgConfigHome = `${sandboxHomeDir}/.config`;
      const xdgCacheHome = `${sandboxHomeDir}/.cache`;
      const xdgDataHome = `${sandboxHomeDir}/.local/share`;
      const xdgStateHome = `${sandboxHomeDir}/.local/state`;
      const skillSetup =
        startOpts.skills && startOpts.skills.length > 0
          ? await writeOpenCodeSkills({
              sandbox: session,
              skills: startOpts.skills,
              homeDir: sandboxHomeDir,
              abortSignal: startOpts.abortSignal,
            })
          : undefined;
      const env = {
        ...resolveOpenCodeEnv({
          auth: settings.auth,
          model: settings.model,
          provider: settings.provider,
        }),
        AI_SDK_HARNESS_CLIENT_APP: OPENCODE_CLIENT_APP,
        BRIDGE_CHANNEL_TOKEN: token,
        BRIDGE_WS_PORT: String(port),
        HOME: sandboxHomeDir,
        USERPROFILE: sandboxHomeDir,
        XDG_CONFIG_HOME: xdgConfigHome,
        XDG_CACHE_HOME: xdgCacheHome,
        XDG_DATA_HOME: xdgDataHome,
        XDG_STATE_HOME: xdgStateHome,
        ...(respawnStrategy === 'replay'
          ? { BRIDGE_REPLAY_FROM_DISK: '1' }
          : {}),
      };

      if (respawnStrategy === undefined) {
        await session.run({
          command: `mkdir -p ${shellQuote(workDir)} ${shellQuote(bridgeStateDir)} ${shellQuote(xdgConfigHome)} ${shellQuote(xdgCacheHome)} ${shellQuote(xdgDataHome)} ${shellQuote(xdgStateHome)}`,
          abortSignal: startOpts.abortSignal,
        });
      }

      await markBridgeStarting({
        sandbox: session,
        bridgeStateDir,
        bridgeType: 'opencode',
        abortSignal: startOpts.abortSignal,
      });

      const proc = await session.spawn({
        command: `node ${BOOTSTRAP_DIR}/bridge.mjs --workdir ${shellQuote(workDir)} --bridge-state-dir ${shellQuote(bridgeStateDir)} --bootstrap-dir ${shellQuote(BOOTSTRAP_DIR)}${skillSetup ? ` --skills-dir ${shellQuote(skillSetup.skillsDir)}` : ''}`,
        env,
        abortSignal: startOpts.abortSignal,
      });
      const stderrTail: string[] = [];
      const bridgeStderrDone = forwardBridgeProcessStream({
        stream: proc.stderr,
        streamName: 'stderr',
        source: 'opencode',
        collectTail: stderrTail,
      });

      const { port: boundPort } = await waitForBridgeReady({
        proc,
        sandbox: session,
        bridgeStateDir,
        bridgeType: 'opencode',
        timeoutMs,
        abortSignal: startOpts.abortSignal,
        createTimeoutError: ({ proc, stdoutTail }) =>
          createBridgeStartupError({
            message: 'OpenCode bridge did not become ready in time.',
            proc,
            stdoutTail,
            stderrTail,
            stderrDone: bridgeStderrDone,
          }),
        createExitError: ({ proc, stdoutTail }) =>
          createBridgeStartupError({
            message: 'OpenCode bridge exited before becoming ready.',
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

      const channel: OpenCodeChannel = new SandboxChannel({
        connect: () => openWebSocket(wsUrl),
        outboundSchema: outboundMessageSchema,
        onDiagnostic,
        onBridgeError,
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
        model,
        provider: settings.provider,
        reasoningVariant: settings.reasoningVariant,
        openCodeSessionId: resumeSessionId,
        isResume: respawnStrategy !== undefined,
        seedResumeSessionOnFirstPrompt: respawnStrategy !== undefined,
        rerunContinue: respawnStrategy === 'rerun',
        bridgePort: boundPort,
        bridgeToken: token,
        sandboxId,
        debug: startOpts.observability?.debug,
        permissionMode: startOpts.permissionMode,
        builtinToolFiltering: startOpts.builtinToolFiltering,
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
    harnessId: 'opencode',
    message:
      'The OpenCode harness needs a TCP port exposed by the sandbox. ' +
      'Create the sandbox with `ports: [<port>]` or pass `createOpenCode({ port })`.',
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

async function writeOpenCodeSkills({
  sandbox,
  skills,
  homeDir,
  abortSignal,
}: {
  sandbox: Experimental_SandboxSession;
  skills: ReadonlyArray<HarnessV1Skill>;
  homeDir: string;
  abortSignal?: AbortSignal;
}): Promise<WriteSkillsResult> {
  const skillsDir = path.posix.join(homeDir, '.agents', 'skills');
  await writeHarnessSkills({
    sandbox,
    rootDir: skillsDir,
    skills,
    abortSignal,
    invalidSkillNameMessage: ({ name }) =>
      `Invalid OpenCode skill name: ${name}`,
    invalidSkillFilePathMessage: ({ skillName, filePath }) =>
      `Invalid OpenCode skill file path for ${skillName}: ${filePath}`,
  });

  return { skillsDir };
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
  provider,
  reasoningVariant,
  openCodeSessionId,
  isResume,
  seedResumeSessionOnFirstPrompt,
  rerunContinue,
  bridgePort,
  bridgeToken,
  sandboxId,
  debug,
  permissionMode,
  builtinToolFiltering,
}: {
  sessionId: string;
  channel: OpenCodeChannel;
  proc: Experimental_SandboxProcess | undefined;
  model: string | undefined;
  provider: string | undefined;
  reasoningVariant: string | undefined;
  openCodeSessionId: string | undefined;
  isResume: boolean;
  seedResumeSessionOnFirstPrompt: boolean;
  rerunContinue: boolean;
  bridgePort: number;
  bridgeToken: string;
  sandboxId: string;
  debug: HarnessV1DebugConfig | undefined;
  permissionMode: HarnessV1PermissionMode | undefined;
  builtinToolFiltering: HarnessV1BuiltinToolFiltering | undefined;
}): HarnessV1Session {
  let stopped = false;
  let stopPromise: Promise<void> | undefined;
  let latestOpenCodeSessionId = openCodeSessionId;
  let pendingResumeSessionId = seedResumeSessionOnFirstPrompt
    ? openCodeSessionId
    : undefined;
  let instructionsApplied = isResume;
  let activeTurn = false;
  const pendingCompactionParts: HarnessV1StreamPart[] = [];

  channel.on('bridge-thread', msg => {
    latestOpenCodeSessionId = msg.threadId;
  });

  const wireTurn = (turnOpts: {
    emit: (event: HarnessV1StreamPart) => void;
    abortSignal?: AbortSignal;
  }): HarnessV1PromptControl => {
    activeTurn = true;
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
      'compaction',
      'raw',
    ] as const;
    let isSettled = false;
    const settleSuccess = () => {
      if (isSettled) return;
      isSettled = true;
      activeTurn = false;
      for (const u of unsubs) u();
      pendingResolve!();
    };
    const settleError = (err: unknown) => {
      if (isSettled) return;
      isSettled = true;
      activeTurn = false;
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

    const onClose = (_code?: number, reason?: string) => {
      if (isSettled) return;
      if (reason === 'suspended') {
        settleSuccess();
        return;
      }
      settleError(
        new Error('OpenCode bridge closed before the turn finished.'),
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

    while (pendingCompactionParts.length > 0) {
      forward(pendingCompactionParts.shift()!);
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

  const startBase = () => ({
    model,
    provider,
    ...(reasoningVariant ? { variant: reasoningVariant } : {}),
    ...(permissionMode ? { permissionMode } : {}),
    ...(builtinToolFiltering ? { builtinToolFiltering } : {}),
    ...(pendingResumeSessionId
      ? { resumeSessionId: pendingResumeSessionId }
      : latestOpenCodeSessionId
        ? { resumeSessionId: latestOpenCodeSessionId }
        : {}),
    ...(debug ? { debug } : {}),
  });

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
        operation: 'prompt',
        prompt: extractUserText(promptOpts.prompt),
        tools: (promptOpts.tools ?? []).map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
        ...(applyInstructions ? { instructions: promptOpts.instructions } : {}),
        ...startBase(),
      });
      pendingResumeSessionId = undefined;
      return control;
    },
    doContinueTurn: async continueOpts => {
      const control = wireTurn({
        emit: continueOpts.emit,
        abortSignal: continueOpts.abortSignal,
      });
      if (rerunContinue) {
        channel.send({
          type: 'start',
          operation: 'prompt',
          prompt: 'Continue.',
          tools: (continueOpts.tools ?? []).map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          ...startBase(),
        });
        pendingResumeSessionId = undefined;
      }
      return control;
    },
    doCompact: async (customInstructions?: string) => {
      if (customInstructions?.trim()) {
        throw new HarnessCapabilityUnsupportedError({
          harnessId: 'opencode',
          message:
            "Harness 'opencode' supports native manual compaction, but OpenCode does not expose custom compaction instructions through the supported API.",
        });
      }
      if (activeTurn) {
        throw new HarnessCapabilityUnsupportedError({
          harnessId: 'opencode',
          message:
            "Harness 'opencode' supports manual compaction between turns; compacting during an active turn is not supported by the bridge transport.",
        });
      }
      await runCompactOperation({
        channel,
        model,
        provider,
        permissionMode,
        debug,
        resumeSessionId: latestOpenCodeSessionId,
        onCompaction: part => pendingCompactionParts.push(part),
      });
    },
    doDetach: async () => {
      if (stopped) {
        throw new Error(
          `OpenCode session ${sessionId} is already stopped; cannot detach.`,
        );
      }
      stopped = true;
      const lastSeenEventId = await channel.suspend();
      return {
        type: 'resume-session',
        harnessId: 'opencode',
        specificationVersion: 'harness-v1',
        data: {
          ...(latestOpenCodeSessionId
            ? { openCodeSessionId: latestOpenCodeSessionId }
            : {}),
          bridge: {
            port: bridgePort,
            token: bridgeToken,
            lastSeenEventId,
            sandboxId,
          },
        },
      };
    },
    doDestroy: async () => {
      if (stopped) return stopPromise;
      stopped = true;
      stopPromise = (async () => {
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
          `OpenCode session ${sessionId} is already stopped; cannot stop.`,
        );
      }
      stopped = true;
      channel.beginClose();
      const data: unknown = channel.isClosed()
        ? {}
        : await new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => {
              unsub();
              reject(
                new Error(
                  `OpenCode session ${sessionId} did not reply to detach within 5s.`,
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
        harnessId: 'opencode',
        specificationVersion: 'harness-v1',
        data: (data ?? {}) as HarnessV1ResumeSessionState['data'],
      };
      return payload;
    },
    doSuspendTurn: async () => {
      if (stopped) {
        throw new Error(
          `OpenCode session ${sessionId} is stopped; cannot suspend.`,
        );
      }
      stopped = true;
      await channel.interrupt();
      const lastSeenEventId = await channel.suspend();
      const payload: HarnessV1ContinueTurnState = {
        type: 'continue-turn',
        harnessId: 'opencode',
        specificationVersion: 'harness-v1',
        data: {
          ...(latestOpenCodeSessionId
            ? { openCodeSessionId: latestOpenCodeSessionId }
            : {}),
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

async function runCompactOperation({
  channel,
  model,
  provider,
  permissionMode,
  debug,
  resumeSessionId,
  onCompaction,
}: {
  channel: OpenCodeChannel;
  model: string | undefined;
  provider: string | undefined;
  permissionMode: HarnessV1PermissionMode | undefined;
  debug: HarnessV1DebugConfig | undefined;
  resumeSessionId: string | undefined;
  onCompaction: (part: HarnessV1StreamPart) => void;
}): Promise<void> {
  let pendingResolve: (() => void) | undefined;
  let pendingReject: ((err: unknown) => void) | undefined;
  const done = new Promise<void>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
  });
  const unsubs = [
    channel.on('compaction', msg => onCompaction(msg)),
    channel.on('finish', () => {
      for (const u of unsubs) u();
      pendingResolve!();
    }),
    channel.on('error', msg => {
      for (const u of unsubs) u();
      pendingReject!(msg.error);
    }),
  ];
  channel.send({
    type: 'start',
    operation: 'compact',
    prompt: '',
    tools: [],
    model,
    provider,
    ...(permissionMode ? { permissionMode } : {}),
    ...(resumeSessionId ? { resumeSessionId } : {}),
    ...(debug ? { debug } : {}),
  });
  await done;
}

function extractUserText(prompt: HarnessV1Prompt): string {
  if (typeof prompt === 'string') return prompt;
  const { content } = prompt;
  if (typeof content === 'string') return content;
  const parts: string[] = [];
  for (const part of content) {
    if (part.type !== 'text') {
      throw new HarnessCapabilityUnsupportedError({
        harnessId: 'opencode',
        message: `The OpenCode harness does not yet support user message parts of type '${part.type}'. Pass a string or a user message whose content contains only text parts.`,
      });
    }
    parts.push(part.text);
  }
  return parts.join('\n\n');
}
