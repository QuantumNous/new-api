import {
  commonTool,
  type HarnessV1,
  type HarnessV1BuiltinTool,
} from '@ai-sdk/harness';
import { tool } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import type { PiAuthOptions } from './pi-auth';
import { piResumeStateSchema } from './pi-resume-state';
import { createPiSession, type PiThinkingLevel } from './pi-session';
import { VERSION } from './version';

/**
 * Value to use in User-Agent and `x-client-app` headers.
 */
const PI_CLIENT_APP = `ai-sdk/harness-pi/${VERSION}`;

/**
 * Configuration knobs for `createPi`. Pi runs as an in-process Node library
 * (no bridge), so there's no `port` or `startupTimeoutMs` to set.
 */
export type PiHarnessSettings = {
  /** Where Pi sources API keys / gateway credentials from. */
  readonly auth?: PiAuthOptions;
  /**
   * Pi model id (or name). Leaving this unset falls back to the AI Gateway
   * default when `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` is set, and to
   * Pi's own resolution otherwise.
   */
  readonly model?: string;
  /**
   * Pi's extended-thinking budget level. Maps directly to the SDK's
   * `thinkingLevel` option on `createAgentSession`.
   */
  readonly thinkingLevel?: PiThinkingLevel;
};

const PI_BUILTIN_TOOLS = {
  read: commonTool('read', {
    nativeName: 'read',
    toolUseKind: 'readonly',
    description: 'Read file contents.',
    inputSchema: z.object({
      file_path: z.string(),
    }),
  }),
  write: commonTool('write', {
    nativeName: 'write',
    toolUseKind: 'edit',
    description: 'Overwrite or create a file.',
    inputSchema: z.object({
      file_path: z.string(),
      content: z.string(),
    }),
  }),
  edit: commonTool('edit', {
    nativeName: 'edit',
    toolUseKind: 'edit',
    description: 'Edit a file by exact string replacement.',
    inputSchema: z.object({
      file_path: z.string(),
      old_string: z.string(),
      new_string: z.string(),
    }),
  }),
  bash: commonTool('bash', {
    nativeName: 'bash',
    toolUseKind: 'bash',
    description: 'Execute a shell command in the sandbox.',
    inputSchema: z.object({
      command: z.string(),
      timeout: z.number().optional(),
    }),
  }),
  grep: commonTool('grep', {
    nativeName: 'grep',
    toolUseKind: 'readonly',
    description: 'Search file contents with regex.',
    inputSchema: z.object({
      pattern: z.string(),
      path: z.string().optional(),
      glob: z.string().optional(),
      ignoreCase: z.boolean().optional(),
      literal: z.boolean().optional(),
      context: z.number().optional(),
      limit: z.number().optional(),
    }),
  }),
  glob: commonTool('glob', {
    nativeName: 'find',
    toolUseKind: 'readonly',
    description: 'Find files matching a glob pattern.',
    inputSchema: z.object({
      pattern: z.string(),
      path: z.string().optional(),
      limit: z.number().optional(),
    }),
  }),
  ls: {
    ...tool({
      description: 'List directory entries.',
      inputSchema: z.object({
        path: z.string().optional(),
        limit: z.number().optional(),
      }),
      outputSchema: z.unknown(),
    }),
    nativeName: 'ls',
    toolUseKind: 'readonly',
  } as HarnessV1BuiltinTool,
} as const satisfies Record<string, HarnessV1BuiltinTool<any, any>>;

export function createPi(
  settings: PiHarnessSettings = {},
): HarnessV1<typeof PI_BUILTIN_TOOLS> {
  return {
    specificationVersion: 'harness-v1',
    harnessId: 'pi',
    builtinTools: PI_BUILTIN_TOOLS,
    supportsBuiltinToolApprovals: true,
    supportsBuiltinToolFiltering: true,
    lifecycleStateSchema: piResumeStateSchema,
    doStart: async startOpts => {
      const lifecycleState = startOpts.continueFrom ?? startOpts.resumeFrom;
      const resumeData = lifecycleState?.data as
        | { sessionFileName?: string }
        | undefined;

      return createPiSession({
        sessionId: startOpts.sessionId,
        sandboxSession: startOpts.sandboxSession,
        sessionWorkDir: startOpts.sessionWorkDir,
        skills: startOpts.skills ?? [],
        settings: {
          ...(settings.auth ? { auth: settings.auth } : {}),
          ...(settings.model ? { model: settings.model } : {}),
          ...(settings.thinkingLevel
            ? { thinkingLevel: settings.thinkingLevel }
            : {}),
        },
        clientApp: PI_CLIENT_APP,
        isResume: lifecycleState != null,
        permissionMode: startOpts.permissionMode,
        builtinToolFiltering: startOpts.builtinToolFiltering,
        ...(resumeData?.sessionFileName
          ? { resumeSessionFileName: resumeData.sessionFileName }
          : {}),
        ...(startOpts.abortSignal
          ? { abortSignal: startOpts.abortSignal }
          : {}),
      });
    },
  };
}
