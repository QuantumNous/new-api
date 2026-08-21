import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentToolResult,
  type Skill,
  type ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Type } from 'typebox';
import {
  type HarnessV1BuiltinToolFiltering,
  type HarnessV1ContinueTurnOptions,
  type HarnessV1ContinueTurnState,
  type HarnessV1PromptControl,
  type HarnessV1PromptTurnOptions,
  type HarnessV1NetworkSandboxSession,
  type HarnessV1PermissionMode,
  type HarnessV1ResumeSessionState,
  type HarnessV1Session,
  type HarnessV1Skill,
  type HarnessV1StreamPart,
  type HarnessV1ToolSpec,
} from '@ai-sdk/harness';
import { resolveSandboxHomeDir } from '@ai-sdk/harness/utils';
import { resolvePiEnv, type PiAuthOptions } from './pi-auth';
import { getPiTerminalError, parseNativeEvent } from './pi-events';
import { createPiModelResolver } from './pi-model-resolver';
import { createPiPathMapper } from './pi-paths';
import { createPiRemoteOps, type PiRemoteOps } from './pi-remote-ops';
import { writePiSkills } from './pi-skills';
import {
  persistSessionFileToSandbox,
  pullSessionFileFromSandbox,
  safePiSessionFileName,
} from './pi-resume-state';
import {
  createPiTranslatorState,
  finishPiApprovalStep,
  translatePiEvent,
  type PiTranslatorState,
} from './pi-translate';
import { toolSpecToTypeBoxParameters } from './pi-typebox-adapter';
import {
  extractUserText,
  frameInstructions,
  safePiMetadataSegment,
  serializeToolOutput,
} from './pi-utils';
import { PiWorkspaceVfs } from './pi-workspace-vfs';
import { syncHostWorkspaceFromSandbox } from './pi-workspace-mirror';

const HARNESS_ID = 'pi';

/*
 * Pi runs in this Node process, not behind an attachable in-sandbox bridge.
 * During a tool approval pause the Pi turn is still alive and blocked on the
 * custom tool promise, so detach must park that live session for the next
 * same-process resume instead of stopping it and resolving the promise as an
 * error. Cross-process resume still falls back to the persisted session file.
 */
const parkedPiSessions = new Map<string, HarnessV1Session>();

/**
 * Whether a discovered resource path belongs to a specific directory.
 */
function isWithinDirectory(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Whether a discovered resource path belongs to the session workspace — either
 * the sandbox-side working directory the model sees (`sessionWorkDir`) or its
 * host-side mirror (`hostWorkDir`).
 */
function isWithinWorkspace(
  candidate: string,
  sessionWorkDir: string,
  hostWorkDir: string,
): boolean {
  return (
    isWithinDirectory(sessionWorkDir, candidate) ||
    isWithinDirectory(hostWorkDir, candidate)
  );
}

function createHarnessPiSkills({
  skills,
  sandboxSkillRootDir,
}: {
  skills: ReadonlyArray<HarnessV1Skill>;
  sandboxSkillRootDir: string;
}): Skill[] {
  return skills.map(skill => {
    const name = safePiMetadataSegment(skill.name, 'skill');
    const baseDir = path.posix.join(sandboxSkillRootDir, name);
    const filePath = path.posix.join(baseDir, 'SKILL.md');
    return {
      name: skill.name,
      description: skill.description,
      filePath,
      baseDir,
      sourceInfo: {
        path: filePath,
        source: 'harness',
        scope: 'temporary',
        origin: 'top-level',
        baseDir,
      },
      disableModelInvocation: false,
    };
  });
}

const PI_NATIVE_BUILTIN_NAMES = [
  'read',
  'write',
  'edit',
  'bash',
  'grep',
  'find',
  'ls',
] as const;

const NATIVE_TO_COMMON: Readonly<Record<string, string>> = {
  find: 'glob',
};

const PUBLIC_TO_NATIVE: Readonly<
  Record<string, (typeof PI_NATIVE_BUILTIN_NAMES)[number]>
> = {
  read: 'read',
  write: 'write',
  edit: 'edit',
  bash: 'bash',
  grep: 'grep',
  glob: 'find',
  ls: 'ls',
};

const PI_NATIVE_TOOL_KINDS: Readonly<
  Record<(typeof PI_NATIVE_BUILTIN_NAMES)[number], 'readonly' | 'edit' | 'bash'>
> = {
  read: 'readonly',
  write: 'edit',
  edit: 'edit',
  bash: 'bash',
  grep: 'readonly',
  find: 'readonly',
  ls: 'readonly',
};

function resolveActivePiBuiltinNames(
  toolFiltering: HarnessV1BuiltinToolFiltering | undefined,
): ReadonlyArray<(typeof PI_NATIVE_BUILTIN_NAMES)[number]> {
  if (toolFiltering == null) return PI_NATIVE_BUILTIN_NAMES;
  if (toolFiltering.mode === 'allow') {
    return toolFiltering.toolNames
      .map(name => PUBLIC_TO_NATIVE[name])
      .filter(
        (name): name is (typeof PI_NATIVE_BUILTIN_NAMES)[number] =>
          name != null,
      );
  }
  return PI_NATIVE_BUILTIN_NAMES.filter(
    native =>
      !toolFiltering.toolNames.includes(NATIVE_TO_COMMON[native] ?? native),
  );
}

export type PiThinkingLevel =
  | 'off'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh';

export interface PiSessionSettings {
  readonly auth?: PiAuthOptions;
  readonly model?: string;
  readonly thinkingLevel?: PiThinkingLevel;
}

export interface CreatePiSessionInput {
  readonly sessionId: string;
  readonly sandboxSession: HarnessV1NetworkSandboxSession;
  readonly sessionWorkDir: string;
  readonly skills: ReadonlyArray<HarnessV1Skill>;
  readonly settings: PiSessionSettings;
  readonly clientApp: string;
  readonly isResume: boolean;
  readonly permissionMode?: HarnessV1PermissionMode;
  readonly builtinToolFiltering?: HarnessV1BuiltinToolFiltering;
  readonly resumeSessionFileName?: string;
  readonly abortSignal?: AbortSignal;
}

interface PendingToolResult {
  resolve: (value: unknown) => void;
}

interface PendingToolApproval {
  resolve: (value: { approved: boolean; reason?: string }) => void;
}

interface ActivePiTurn {
  readonly token: object;
  readonly done: Promise<void>;
}

export async function createPiSession(
  input: CreatePiSessionInput,
): Promise<HarnessV1Session> {
  if (input.isResume) {
    const parkedSession = parkedPiSessions.get(input.sessionId);
    if (parkedSession) {
      parkedPiSessions.delete(input.sessionId);
      return {
        ...parkedSession,
        isResume: true,
      };
    }
  }

  // Host-side mirror layout under tmpdir. Replace path-separator characters
  // that would otherwise turn a session id like `2026-05-29T17:54:27` into a
  // sub-directory tree on disk.
  const safeSessionId = input.sessionId.replace(/[\\/: ]/g, '-');
  const hostRoot = path.join(tmpdir(), 'ai-sdk-harness', 'pi', safeSessionId);
  const hostWorkDir = path.join(hostRoot, 'workspace');
  const hostAgentDir = path.join(hostRoot, 'agent');
  const hostSessionDir = path.join(hostRoot, 'sessions');

  // Pi runs in this host process but must behave as though it lives in the
  // sandbox workspace: its working directory is the real `sessionWorkDir`
  // (where `setup()` clones and where the sandbox-backed tools operate), so the
  // paths Pi advertises to the model — most notably the "Current working
  // directory" line in its system prompt — resolve inside the sandbox. The
  // workspace VFS maps that sandbox path to the host-side mirror so Pi's own
  // `fs`-based resource loading (`.pi/`, `AGENTS.md`) still works on the host.
  // `sessionWorkDir` is a sandbox path (e.g. `/vercel/sandbox/...`) that does
  // not exist on the host, so it is a safe, collision-free VFS mount point.
  const sessionWorkDir = input.sessionWorkDir;

  await mkdir(hostWorkDir, { recursive: true });
  await mkdir(hostAgentDir, { recursive: true });
  await mkdir(hostSessionDir, { recursive: true });

  const sandbox = input.sandboxSession.restricted();
  const permissionMode = input.permissionMode ?? 'allow-all';
  let sandboxSkillRootDir: string | undefined;
  let harnessSkills: Skill[] = [];

  // Materialise harness-provided skills into sandbox HOME, not the workspace.
  if (input.skills.length > 0) {
    const sandboxHomeDir = await resolveSandboxHomeDir({
      sandbox,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    sandboxSkillRootDir = path.posix.join(sandboxHomeDir, '.agents', 'skills');
    harnessSkills = createHarnessPiSkills({
      skills: input.skills,
      sandboxSkillRootDir,
    });
    await writePiSkills({
      sandbox,
      sandboxHomeDir,
      skills: input.skills,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
  }

  // On resume: pull the Pi session file out of the sandbox into the fresh
  // host mirror so SessionManager.open can read it.
  let resumeSessionFilePath: string | undefined;
  if (input.isResume && input.resumeSessionFileName) {
    const resumeSessionFileName = safePiSessionFileName(
      input.resumeSessionFileName,
    );
    resumeSessionFilePath = await pullSessionFileFromSandbox({
      sandbox,
      sessionWorkDir: input.sessionWorkDir,
      hostSessionDir,
      sessionFileName: resumeSessionFileName,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
  }

  // Snapshot sandbox state into the host mirror BEFORE the VFS goes live so
  // Pi sees the workspace as soon as it boots.
  await syncHostWorkspaceFromSandbox({
    sandbox,
    sandboxWorkDir: input.sessionWorkDir,
    hostWorkDir,
  });

  // Mount only the workspace: the model's view of the workspace lives at
  // `sessionWorkDir` and is backed by `hostWorkDir`. The agent and session
  // directories stay on the real host filesystem (below) — they are host-only
  // Pi state (auth, model registry, session journal) that must never surface
  // in the sandbox or the workspace mirror.
  const workspaceVfs = new PiWorkspaceVfs();
  workspaceVfs.mount(hostWorkDir, sessionWorkDir);

  const paths = createPiPathMapper({
    hostWorkDir,
    sandboxWorkDir: sessionWorkDir,
    readableRoots: sandboxSkillRootDir
      ? [{ sandboxDir: sandboxSkillRootDir }]
      : [],
  });

  // Pi auth + model registry are global to this Pi session. These live on the
  // real host filesystem (`hostAgentDir`), never in the sandbox/workspace.
  const authStorage = AuthStorage.create(path.join(hostAgentDir, 'auth.json'));
  const modelRegistry = ModelRegistry.create(
    authStorage,
    path.join(hostAgentDir, 'models.json'),
  );
  const settingsManager = SettingsManager.inMemory();

  // Run-scoped env (for the model resolver's gateway fallback heuristic).
  const resolverEnv = resolvePiEnv({
    options: input.settings.auth,
    env: process.env,
    registries: {
      authStorage,
      modelRegistry,
    },
    clientApp: input.clientApp,
  });
  const resolveModel = createPiModelResolver(modelRegistry, resolverEnv);
  // Resolve once: deterministic given the configured model. This is the Pi
  // `Model` object handed to `createAgentSession`.
  const resolvedModel = resolveModel(input.settings.model);

  const resourceLoader = new DefaultResourceLoader({
    cwd: sessionWorkDir,
    agentDir: hostAgentDir,
    settingsManager,
    appendSystemPromptOverride: () => [],
    extensionFactories: [],
    // Pi runs in the host process, so its default resource discovery reaches
    // the host developer's personal config (`~/.pi/agent/*`, `~/.agents/*`).
    // The harness does not expose extensions, themes, or prompt templates, so
    // disable those entirely — this also avoids loading and executing a host
    // developer's personal Pi extensions inside the server process. Skills are
    // kept but filtered to workspace project skills plus harness-provided
    // skills whose files live in sandbox HOME.
    noExtensions: true,
    noThemes: true,
    noPromptTemplates: true,
    skillsOverride: base => ({
      ...base,
      skills: [
        ...base.skills.filter(skill =>
          isWithinWorkspace(skill.filePath, sessionWorkDir, hostWorkDir),
        ),
        ...harnessSkills,
      ],
    }),
  });
  await resourceLoader.reload();

  // Per-session mutable state we hold across prompts.
  let piSession: AgentSession | undefined;
  let unsubscribe: (() => void) | undefined;
  let lastToolsSignature: string | undefined;
  let sessionFileName: string | undefined;
  let stopped = false;
  /*
   * Set by `doSuspendTurn` before it aborts the in-flight host turn at a slice
   * boundary. The turn's catch settles silently when this is set, so the stream
   * closes cleanly (no spurious `error` chunk) — the next slice rerun-continues
   * from the persisted journal.
   */
  let suspending = false;
  /*
   * Instructions are prepended to the first user message of a fresh session
   * only. A resumed session already carried them in its original first
   * message (preserved in the persisted session file), so it starts "applied".
   */
  let instructionsApplied = input.isResume;
  const pendingToolResults = new Map<string, PendingToolResult>();
  const pendingToolApprovals = new Map<string, PendingToolApproval>();

  // Emit channel set at the start of every doPromptTurn and cleared on end.
  let currentEmit: ((part: HarnessV1StreamPart) => void) | undefined;
  let translatorState: PiTranslatorState | undefined;
  let activeTurn: ActivePiTurn | undefined;
  /*
   * Compaction parts produced while no turn is active. Pi's `compact()` aborts
   * the current turn before it summarizes, so a manually triggered compaction
   * (and any compaction that lands between turns) emits its `compaction_end`
   * after `currentEmit` has been cleared. Buffer those parts and flush them on
   * the next turn's stream so the observation is not lost. Auto-compaction that
   * runs mid-turn still emits inline via `currentEmit`.
   */
  const pendingCompactionParts: HarnessV1StreamPart[] = [];

  const remoteOps = createPiRemoteOps({
    sandbox,
    paths,
    onFileChange: (event, relPath) => {
      currentEmit?.({ type: 'file-change', event, path: relPath });
    },
  });

  function settlePendingToolResults(reason: string): void {
    for (const pending of pendingToolResults.values()) {
      pending.resolve({ error: reason });
    }
    pendingToolResults.clear();
  }

  function settlePendingToolApprovals(reason: string): void {
    for (const pending of pendingToolApprovals.values()) {
      pending.resolve({ approved: false, reason });
    }
    pendingToolApprovals.clear();
  }

  async function persistSessionFile(): Promise<void> {
    if (!sessionFileName) return;
    await persistSessionFileToSandbox({
      sandbox,
      sessionWorkDir: input.sessionWorkDir,
      hostSessionDir,
      sessionFileName,
    });
  }

  function createPromptControl(input: {
    done: Promise<void>;
    abortSignal?: AbortSignal;
  }): HarnessV1PromptControl {
    const abortHandler = () => {
      piSession?.abort().catch(() => {});
    };
    if (input.abortSignal) {
      input.abortSignal.addEventListener('abort', abortHandler, {
        once: true,
      });
      void input.done.then(
        () => {
          input.abortSignal?.removeEventListener('abort', abortHandler);
        },
        () => {
          input.abortSignal?.removeEventListener('abort', abortHandler);
        },
      );
    }

    return {
      async submitToolResult(args) {
        const pending = pendingToolResults.get(args.toolCallId);
        if (!pending) return;
        pendingToolResults.delete(args.toolCallId);
        /*
         * Preserve the original output so the result projection can surface it
         * unchanged. The tool handler stringifies the output for the runtime
         * (so the model reads it), and Pi echoes that text back — without this
         * the consumer-facing result would be the serialized string instead of
         * the original object.
         */
        translatorState?.hostToolResults.set(args.toolCallId, args.output);
        pending.resolve(args.output);
      },
      async submitToolApproval(args) {
        const pending = pendingToolApprovals.get(args.approvalId);
        if (!pending) return;
        pendingToolApprovals.delete(args.approvalId);
        pending.resolve({
          approved: args.approved,
          reason: args.reason,
        });
      },
      async submitUserMessage(text) {
        await piSession?.steer(text);
      },
      done: input.done,
    };
  }

  async function requestBuiltinToolApproval(args: {
    toolCallId: string;
    nativeName: (typeof PI_NATIVE_BUILTIN_NAMES)[number];
  }): Promise<{ approved: boolean; reason?: string }> {
    if (
      !piBuiltinToolRequiresApproval({
        permissionMode,
        kind: PI_NATIVE_TOOL_KINDS[args.nativeName],
      })
    ) {
      return { approved: true };
    }
    currentEmit?.({
      type: 'tool-approval-request',
      approvalId: args.toolCallId,
      toolCallId: args.toolCallId,
    });
    if (translatorState) {
      for (const part of finishPiApprovalStep(
        translatorState,
        args.toolCallId,
      )) {
        currentEmit?.(part);
      }
    }
    return new Promise(resolve => {
      pendingToolApprovals.set(args.toolCallId, { resolve });
    });
  }

  function buildToolDefinitions(userTools: ReadonlyArray<HarnessV1ToolSpec>): {
    customTools: ToolDefinition[];
    builtinNames: string[];
  } {
    const builtinNames = resolveActivePiBuiltinNames(
      input.builtinToolFiltering,
    );
    const customTools: ToolDefinition[] = [
      ...builtinNames.map(native =>
        buildBuiltinToolDefinition({
          native,
          remoteOps,
          requestApproval: requestBuiltinToolApproval,
        }),
      ),
      ...userTools.map(spec =>
        buildUserToolDefinition(spec, pendingToolResults),
      ),
    ];
    return {
      customTools,
      builtinNames: [...builtinNames],
    };
  }

  async function rebuildPiSession(
    userTools: ReadonlyArray<HarnessV1ToolSpec>,
    isFirstBuild: boolean,
  ): Promise<void> {
    if (piSession) {
      unsubscribe?.();
      unsubscribe = undefined;
      piSession.dispose();
      piSession = undefined;
      // Original adapter waits 25 ms here to let Pi's teardown microtasks
      // settle before the next createAgentSession. Port verbatim.
      // TODO(pi-0.77): verify the race still exists; original SDK had a
      // teardown microtask the host needed to wait on.
      await new Promise(resolve => setTimeout(resolve, 25));
    }

    const { customTools, builtinNames } = buildToolDefinitions(userTools);
    const toolNames = customTools.map(t => t.name);

    // SessionManager: open the resumed file on the first build of a resumed
    // session; create fresh otherwise.
    const sessionManager =
      isFirstBuild && resumeSessionFilePath
        ? SessionManager.open(
            resumeSessionFilePath,
            hostSessionDir,
            sessionWorkDir,
          )
        : SessionManager.create(sessionWorkDir, hostSessionDir);

    const { session } = await createAgentSession({
      cwd: sessionWorkDir,
      agentDir: hostAgentDir,
      authStorage,
      modelRegistry,
      sessionManager,
      settingsManager,
      resourceLoader,
      customTools,
      tools: toolNames,
      ...(input.settings.thinkingLevel
        ? { thinkingLevel: input.settings.thinkingLevel }
        : {}),
      ...(resolvedModel ? { model: resolvedModel } : {}),
    });
    piSession = session;

    // Pick up the actual session file path so doStop can persist it. Pi
    // 0.77 emits `.jsonl` files; older builds used `.json`. Persist the
    // basename verbatim — including the extension — so the resume path can
    // round-trip it without guessing the extension.
    const candidatePath = sessionManager.getSessionFile();
    if (candidatePath) {
      sessionFileName = safePiSessionFileName(path.basename(candidatePath));
    }

    translatorState = createPiTranslatorState({
      builtinToolNames: builtinNames,
      nativeToCommon: NATIVE_TO_COMMON,
    });

    unsubscribe = piSession.subscribe(rawEvent => {
      if (!translatorState) return;
      const event = parseNativeEvent(rawEvent);
      if (!event) return;
      for (const part of translatePiEvent(event, translatorState)) {
        if (currentEmit) {
          currentEmit(part);
        } else if (part.type === 'compaction') {
          // No active turn: defer compaction observations to the next turn.
          pendingCompactionParts.push(part);
        }
        // Other event types outside a turn have no consumer and are dropped.
      }
    });
  }

  /*
   * Drive one turn against the Pi session and return the control surface.
   * Shared by `doPromptTurn` (a fresh user prompt) and `doContinueTurn` (an empty
   * prompt that asks Pi to continue its own thread after a rerun resume).
   */
  async function runTurn(turnOpts: {
    text: string;
    tools: ReadonlyArray<HarnessV1ToolSpec>;
    emit: (part: HarnessV1StreamPart) => void;
    abortSignal?: AbortSignal;
  }): Promise<HarnessV1PromptControl> {
    if (stopped) {
      throw new Error('Pi session has been stopped.');
    }

    const userTools = turnOpts.tools;
    const signature = JSON.stringify(userTools.map(t => t.name).sort());
    const needsRebuild = piSession == null || signature !== lastToolsSignature;
    if (needsRebuild) {
      await rebuildPiSession(userTools, piSession == null);
      lastToolsSignature = signature;
    }

    await resourceLoader.reload();
    await syncHostWorkspaceFromSandbox({
      sandbox,
      sandboxWorkDir: input.sessionWorkDir,
      hostWorkDir,
    });

    currentEmit = turnOpts.emit;
    // Fresh translator state for the new turn — keep the tool sets the
    // session was built with.
    translatorState = createPiTranslatorState({
      builtinToolNames: [...PI_NATIVE_BUILTIN_NAMES],
      nativeToCommon: NATIVE_TO_COMMON,
    });

    turnOpts.emit({ type: 'stream-start' });

    const turnPromise = (async () => {
      let terminalError: string | undefined;
      const session = piSession!;

      // We subscribed in rebuild, but the translator may need to detect
      // terminal errors too — wrap a second listener that records them.
      const unsubErr = session.subscribe(raw => {
        const ev = parseNativeEvent(raw);
        if (!ev) return;
        const err = getPiTerminalError(ev);
        if (err && !terminalError) {
          terminalError = err;
        }
      });

      try {
        await session.prompt(turnOpts.text);

        if (terminalError) {
          /*
           * A `doSuspendTurn` aborts the in-flight turn on purpose. Pi surfaces
           * that abort as a *resolved* prompt with a recorded terminal error
           * ("This operation was aborted") rather than a thrown exception, so the
           * `catch` guard below never sees it. Swallow it here too — but only if
           * it's actually the abort: the stream then closes cleanly (no spurious
           * `error` chunk) and the next slice rerun-continues from the journal.
           * Any other terminal error mid-suspend is unanticipated and must
           * surface.
           */
          if (suspending && isAbortError(terminalError)) return;
          currentEmit?.({ type: 'error', error: new Error(terminalError) });
          return;
        }

        const stats = session.getSessionStats();
        const finishReason = {
          unified: 'stop' as const,
          raw: undefined,
        };
        const usage = {
          inputTokens: {
            total: stats.tokens.input,
            noCache: undefined,
            cacheRead: stats.tokens.cacheRead,
            cacheWrite: stats.tokens.cacheWrite,
          },
          outputTokens: {
            total: stats.tokens.output,
            text: undefined,
            reasoning: undefined,
          },
        };
        currentEmit?.({
          type: 'finish',
          finishReason,
          totalUsage: usage,
        });
      } catch (err) {
        // A `doSuspendTurn` aborts the in-flight turn on purpose — settle silently
        // so the stream closes cleanly without a spurious `error` chunk; the
        // next slice rerun-continues from the persisted journal.
        // Same rule as the resolved-with-terminalError path: only swallow the
        // abort our own suspend caused; surface anything unanticipated.
        if (suspending && isAbortError(err)) return;
        currentEmit?.({ type: 'error', error: err });
      } finally {
        unsubErr();
      }
    })();

    const activeTurnToken = {};
    const done = turnPromise.finally(() => {
      if (activeTurn?.token === activeTurnToken) {
        activeTurn = undefined;
      }
      currentEmit = undefined;
    });
    activeTurn = {
      token: activeTurnToken,
      done,
    };

    return createPromptControl({
      done,
      abortSignal: turnOpts.abortSignal,
    });
  }

  const doStop = async (): Promise<HarnessV1ResumeSessionState> => {
    if (stopped) {
      throw new Error('Pi session has been stopped.');
    }
    stopped = true;
    parkedPiSessions.delete(input.sessionId);
    settlePendingToolResults('Pi session stopped');
    settlePendingToolApprovals('Pi session stopped');

    // Persist the Pi session file into the sandbox so a future process
    // can pick it up after `provider.resumeSession({ sessionId })` reattaches.
    if (sessionFileName) {
      try {
        await persistSessionFile();
      } catch {
        // Best-effort: a missing session file means resume returns to a
        // fresh conversation rather than failing stop.
      }
    }

    unsubscribe?.();
    unsubscribe = undefined;
    piSession?.dispose();
    piSession = undefined;
    workspaceVfs.unmount();
    await rm(hostRoot, { recursive: true, force: true });

    return {
      type: 'resume-session',
      harnessId: HARNESS_ID,
      specificationVersion: 'harness-v1',
      data: sessionFileName ? { sessionFileName } : {},
    };
  };

  const sessionImpl: HarnessV1Session = {
    sessionId: input.sessionId,
    isResume: input.isResume,
    // The model Pi actually resolves to (the configured id, or its default when
    // unset) — `gen_ai.request.model`.
    ...(resolvedModel?.id ? { modelId: resolvedModel.id } : {}),

    // Pi has no bridge to attach to and no on-disk event log to replay; its
    // only resume path is restoring the session file on a fresh/snapshotted
    // sandbox, i.e. `rerun`.

    doPromptTurn: async (
      promptOpts: HarnessV1PromptTurnOptions,
    ): Promise<HarnessV1PromptControl> => {
      let text = extractUserText(promptOpts.prompt);
      if (!instructionsApplied && promptOpts.instructions) {
        text = frameInstructions(promptOpts.instructions, text);
      }
      instructionsApplied = true;

      return runTurn({
        text,
        tools: promptOpts.tools ?? [],
        emit: promptOpts.emit,
        abortSignal: promptOpts.abortSignal,
      });
    },

    doContinueTurn: async (
      continueOpts: HarnessV1ContinueTurnOptions,
    ): Promise<HarnessV1PromptControl> => {
      if (activeTurn != null) {
        currentEmit = continueOpts.emit;
        return createPromptControl({
          done: activeTurn.done,
          abortSignal: continueOpts.abortSignal,
        });
      }

      /*
       * Pi runs the model on the host, so there is no live turn in the sandbox
       * to attach to — the previous slice's turn died with its process.
       * Rerun-continue: re-drive the agent from the journal restored on resume.
       * An empty prompt asks Pi to continue its own thread. Lossy — any work in
       * flight at the slice boundary is recomputed because a host-resident
       * runtime cannot do a lossless attach.
       */
      return runTurn({
        text: '',
        tools: continueOpts.tools ?? [],
        emit: continueOpts.emit,
        abortSignal: continueOpts.abortSignal,
      });
    },

    doCompact: async (customInstructions?: string) => {
      if (stopped) {
        throw new Error('Pi session has been stopped.');
      }
      /*
       * Pi owns the compaction. We just request it; the resulting
       * `compaction_end` event is observed by the session subscription and
       * translated into a `compaction` stream part. The returned
       * `CompactionResult` is intentionally discarded here.
       */
      await piSession?.compact(customInstructions);
    },

    doDestroy: async () => {
      if (stopped) return;
      stopped = true;
      parkedPiSessions.delete(input.sessionId);
      settlePendingToolResults('Pi session stopped');
      settlePendingToolApprovals('Pi session stopped');
      unsubscribe?.();
      unsubscribe = undefined;
      piSession?.dispose();
      piSession = undefined;
      workspaceVfs.unmount();
      await rm(hostRoot, { recursive: true, force: true });
    },

    doStop,

    doDetach: async (): Promise<HarnessV1ResumeSessionState> => {
      if (activeTurn != null || pendingToolResults.size > 0) {
        parkedPiSessions.set(input.sessionId, sessionImpl);
        if (sessionFileName) {
          try {
            await persistSessionFile();
          } catch {
            /*
             * The parked in-process session is the authoritative continuation
             * path while the live turn is waiting on host input. Persistence is
             * only a fallback for later non-live resumes.
             */
          }
        }
        return {
          type: 'resume-session',
          harnessId: HARNESS_ID,
          specificationVersion: 'harness-v1',
          data: sessionFileName ? { sessionFileName } : {},
        };
      }
      return doStop();
    },

    doSuspendTurn: async (): Promise<HarnessV1ContinueTurnState> => {
      if (stopped) {
        throw new Error('Pi session has been stopped.');
      }
      if (
        activeTurn != null &&
        (pendingToolResults.size > 0 || pendingToolApprovals.size > 0)
      ) {
        parkedPiSessions.set(input.sessionId, sessionImpl);
        if (sessionFileName) {
          try {
            await persistSessionFile();
          } catch {
            /*
             * While waiting on host input, the live parked session is the
             * authoritative same-process continuation path. The sandbox copy
             * remains a best-effort fallback for a later cold resume.
             */
          }
        }
        return {
          type: 'continue-turn',
          harnessId: HARNESS_ID,
          specificationVersion: 'harness-v1',
          data: sessionFileName ? { sessionFileName } : {},
        };
      }
      /*
       * Pi's model runs in this host process, which is about to be suspended at
       * the slice boundary — the in-flight turn cannot survive it. Abort it (the
       * turn settles silently via the `suspending` guard so the stream closes
       * cleanly), persist the journal into the sandbox, and tear down host-side
       * resources. The sandbox itself is left running; the next slice pulls the
       * journal after `provider.resumeSession({ sessionId })` and rerun-continues. The
       * tail in flight at the boundary is recomputed — Pi cannot freeze a live
       * turn the way a bridge adapter can.
       */
      suspending = true;
      await Promise.resolve(piSession?.abort()).catch(() => {});

      if (sessionFileName) {
        try {
          await persistSessionFile();
        } catch {
          // Best-effort: a missing/failed copy leaves the previously persisted
          // journal in place, so the next slice resumes from a slightly older
          // (still valid) state.
        }
      }

      stopped = true;
      parkedPiSessions.delete(input.sessionId);
      settlePendingToolResults('Pi session suspended');
      settlePendingToolApprovals('Pi session suspended');
      unsubscribe?.();
      unsubscribe = undefined;
      piSession?.dispose();
      piSession = undefined;
      workspaceVfs.unmount();
      await rm(hostRoot, { recursive: true, force: true });

      return {
        type: 'continue-turn',
        harnessId: HARNESS_ID,
        specificationVersion: 'harness-v1',
        data: sessionFileName ? { sessionFileName } : {},
      };
    },
  };

  return sessionImpl;
}

/**
 * Whether a terminal error (string from Pi's event stream, or a thrown error)
 * is an abort — the expected result of `doSuspendTurn` aborting the in-flight
 * turn. Only these are safe to swallow while `suspending`; any other error is
 * unanticipated and must surface as an `error` chunk.
 */
function isAbortError(value: unknown): boolean {
  if (value == null) return false;
  if (
    typeof value === 'object' &&
    (value as { name?: unknown }).name === 'AbortError'
  ) {
    return true;
  }
  const text =
    typeof value === 'string'
      ? value
      : value instanceof Error
        ? value.message
        : String(value);
  return /\baborted\b|AbortError|operation was aborted/i.test(text);
}

function asPiToolResult(text: string): AgentToolResult<unknown> {
  return {
    content: [{ type: 'text', text }],
    details: undefined,
  };
}

async function maybeDenyPiBuiltinTool(input: {
  toolCallId: string;
  nativeName: (typeof PI_NATIVE_BUILTIN_NAMES)[number];
  requestApproval: (args: {
    toolCallId: string;
    nativeName: (typeof PI_NATIVE_BUILTIN_NAMES)[number];
  }) => Promise<{ approved: boolean; reason?: string }>;
}): Promise<AgentToolResult<unknown> | undefined> {
  const decision = await input.requestApproval({
    toolCallId: input.toolCallId,
    nativeName: input.nativeName,
  });
  if (decision.approved) return undefined;
  return asPiToolResult(
    serializeToolOutput({
      type: 'execution-denied',
      reason: decision.reason,
    }),
  );
}

function piBuiltinToolRequiresApproval(input: {
  permissionMode: HarnessV1PermissionMode;
  kind: 'readonly' | 'edit' | 'bash';
}): boolean {
  if (input.permissionMode === 'allow-all') return false;
  if (input.permissionMode === 'allow-edits') return input.kind === 'bash';
  return input.kind === 'edit' || input.kind === 'bash';
}

function buildBuiltinToolDefinition(input: {
  native: (typeof PI_NATIVE_BUILTIN_NAMES)[number];
  remoteOps: PiRemoteOps;
  requestApproval: (args: {
    toolCallId: string;
    nativeName: (typeof PI_NATIVE_BUILTIN_NAMES)[number];
  }) => Promise<{ approved: boolean; reason?: string }>;
}): ToolDefinition {
  switch (input.native) {
    case 'read':
      return defineTool({
        name: 'read',
        label: 'read',
        description: 'Read file contents.',
        parameters: Type.Object({ file_path: Type.String() }),
        async execute(toolCallId, params) {
          const denied = await maybeDenyPiBuiltinTool({
            toolCallId,
            nativeName: 'read',
            requestApproval: input.requestApproval,
          });
          if (denied) return denied;
          const buf = await input.remoteOps.readBuffer(params.file_path);
          return asPiToolResult(buf.toString('utf8'));
        },
      });
    case 'write':
      return defineTool({
        name: 'write',
        label: 'write',
        description: 'Write content to a file.',
        parameters: Type.Object({
          file_path: Type.String(),
          content: Type.String(),
        }),
        async execute(toolCallId, params) {
          const denied = await maybeDenyPiBuiltinTool({
            toolCallId,
            nativeName: 'write',
            requestApproval: input.requestApproval,
          });
          if (denied) return denied;
          await input.remoteOps.writeFile(params.file_path, params.content);
          return asPiToolResult(`Wrote ${params.file_path}`);
        },
      });
    case 'edit':
      return defineTool({
        name: 'edit',
        label: 'edit',
        description: 'Edit a file by exact-string replacement.',
        parameters: Type.Object({
          file_path: Type.String(),
          old_string: Type.String(),
          new_string: Type.String(),
        }),
        async execute(toolCallId, params) {
          const denied = await maybeDenyPiBuiltinTool({
            toolCallId,
            nativeName: 'edit',
            requestApproval: input.requestApproval,
          });
          if (denied) return denied;
          await input.remoteOps.editFile(
            params.file_path,
            params.old_string,
            params.new_string,
          );
          return asPiToolResult(`Edited ${params.file_path}`);
        },
      });
    case 'bash':
      return defineTool({
        name: 'bash',
        label: 'bash',
        description: 'Execute a shell command.',
        parameters: Type.Object({
          command: Type.String(),
          timeout: Type.Optional(
            Type.Number({ description: 'Timeout in seconds.' }),
          ),
        }),
        async execute(toolCallId, params, signal) {
          const denied = await maybeDenyPiBuiltinTool({
            toolCallId,
            nativeName: 'bash',
            requestApproval: input.requestApproval,
          });
          if (denied) return denied;
          const chunks: Buffer[] = [];
          const result = await input.remoteOps.exec(params.command, '.', {
            onData(data) {
              chunks.push(data);
            },
            ...(signal ? { signal } : {}),
            ...(typeof params.timeout === 'number'
              ? { timeout: params.timeout }
              : {}),
          });
          const out = Buffer.concat(chunks).toString('utf8');
          const text = `${out}${
            result.exitCode != null ? `\n\n(exit ${result.exitCode})` : ''
          }`.trim();
          return asPiToolResult(text);
        },
      });
    case 'grep':
      return defineTool({
        name: 'grep',
        label: 'grep',
        description: 'Search file contents with regex.',
        parameters: Type.Object({
          pattern: Type.String(),
          path: Type.Optional(Type.String()),
          glob: Type.Optional(Type.String()),
          ignoreCase: Type.Optional(Type.Boolean()),
          literal: Type.Optional(Type.Boolean()),
          context: Type.Optional(Type.Number()),
          limit: Type.Optional(Type.Number()),
        }),
        async execute(toolCallId, params) {
          const denied = await maybeDenyPiBuiltinTool({
            toolCallId,
            nativeName: 'grep',
            requestApproval: input.requestApproval,
          });
          if (denied) return denied;
          const out = await input.remoteOps.grepFiles(params.pattern, params);
          return asPiToolResult(out);
        },
      });
    case 'find':
      return defineTool({
        name: 'find',
        label: 'find',
        description: 'Find files matching a glob pattern.',
        parameters: Type.Object({
          pattern: Type.String(),
          path: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Number()),
        }),
        async execute(toolCallId, params) {
          const denied = await maybeDenyPiBuiltinTool({
            toolCallId,
            nativeName: 'find',
            requestApproval: input.requestApproval,
          });
          if (denied) return denied;
          const matches = await input.remoteOps.findFiles(
            params.pattern,
            params.path ?? '.',
            params.limit ?? 1_000,
          );
          return asPiToolResult(matches.join('\n'));
        },
      });
    case 'ls':
      return defineTool({
        name: 'ls',
        label: 'ls',
        description: 'List directory entries.',
        parameters: Type.Object({
          path: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Number()),
        }),
        async execute(toolCallId, params) {
          const denied = await maybeDenyPiBuiltinTool({
            toolCallId,
            nativeName: 'ls',
            requestApproval: input.requestApproval,
          });
          if (denied) return denied;
          const entries = await input.remoteOps.listDirectory(
            params.path ?? '.',
            params.limit ?? 500,
          );
          return asPiToolResult(entries.join('\n'));
        },
      });
  }
}

function buildUserToolDefinition(
  spec: HarnessV1ToolSpec,
  pending: Map<string, PendingToolResult>,
): ToolDefinition {
  const schema = spec.inputSchema ?? {
    type: 'object',
    properties: {},
    additionalProperties: true,
  };
  return defineTool({
    name: spec.name,
    label: spec.name,
    description: spec.description ?? `User-registered tool ${spec.name}`,
    parameters: toolSpecToTypeBoxParameters(schema),
    async execute(toolCallId) {
      return new Promise<unknown>(resolve => {
        pending.set(toolCallId, { resolve });
      }).then(output => asPiToolResult(serializeToolOutput(output)));
    },
  });
}
