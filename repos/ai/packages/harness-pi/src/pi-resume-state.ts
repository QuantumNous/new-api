import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { shellQuote } from '@ai-sdk/harness/utils';
import type { Experimental_SandboxSession } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

const PI_SESSION_FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.jsonl?$/;

export function safePiSessionFileName(sessionFileName: string): string {
  if (!PI_SESSION_FILE_NAME_PATTERN.test(sessionFileName)) {
    throw new Error(`Invalid Pi session file name: ${sessionFileName}`);
  }
  return sessionFileName;
}

const piSessionFileNameSchema = z
  .string()
  .refine(
    sessionFileName => PI_SESSION_FILE_NAME_PATTERN.test(sessionFileName),
    'Pi sessionFileName must be a safe .jsonl or .json basename.',
  );

/**
 * Schema for the adapter-specific portion of lifecycle state `data` produced
 * by Pi's resumable lifecycle methods. Carries the basename
 * (including extension) of the Pi session file. The actual session bytes live
 * in the sandbox under `${sessionWorkDir}/.pi-sessions/<sessionFileName>` so
 * they survive cross-process resume via the sandbox snapshot.
 */
export const piResumeStateSchema = z.looseObject({
  sessionFileName: piSessionFileNameSchema.optional(),
});

export type PiResumeStateData = z.infer<typeof piResumeStateSchema>;

const PI_SESSIONS_DIR = '.pi-sessions';

function resolveContainedHostPath(input: {
  readonly baseDir: string;
  readonly sessionFileName: string;
}): string {
  const baseDir = path.resolve(input.baseDir);
  const filePath = path.resolve(
    baseDir,
    safePiSessionFileName(input.sessionFileName),
  );
  const relativePath = path.relative(baseDir, filePath);
  if (
    relativePath === '' ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Invalid Pi session file name: ${input.sessionFileName}`);
  }
  return filePath;
}

function resolveContainedSandboxPath(input: {
  readonly sessionWorkDir: string;
  readonly sessionFileName: string;
}): string {
  const sessionDir = path.posix.resolve(input.sessionWorkDir, PI_SESSIONS_DIR);
  const filePath = path.posix.resolve(
    sessionDir,
    safePiSessionFileName(input.sessionFileName),
  );
  const relativePath = path.posix.relative(sessionDir, filePath);
  if (
    relativePath === '' ||
    relativePath.startsWith('..') ||
    path.posix.isAbsolute(relativePath)
  ) {
    throw new Error(`Invalid Pi session file name: ${input.sessionFileName}`);
  }
  return filePath;
}

/**
 * Copy the Pi session file from the host's local mirror to a stable location
 * inside the sandbox workspace. Called during resumable lifecycle methods so
 * the session survives a sandbox snapshot or a process handoff.
 */
export async function persistSessionFileToSandbox(args: {
  readonly sandbox: Experimental_SandboxSession;
  readonly sessionWorkDir: string;
  readonly hostSessionDir: string;
  readonly sessionFileName: string;
  readonly abortSignal?: AbortSignal;
}): Promise<void> {
  const hostPath = resolveContainedHostPath({
    baseDir: args.hostSessionDir,
    sessionFileName: args.sessionFileName,
  });
  const content = await readFile(hostPath);
  const remotePath = resolveContainedSandboxPath({
    sessionWorkDir: args.sessionWorkDir,
    sessionFileName: args.sessionFileName,
  });
  // Ensure the parent dir exists in the sandbox before writing.
  await args.sandbox.run({
    command: `mkdir -p ${shellQuote(path.posix.dirname(remotePath))}`,
    ...(args.abortSignal ? { abortSignal: args.abortSignal } : {}),
  });
  await args.sandbox.writeBinaryFile({
    path: remotePath,
    content,
    ...(args.abortSignal ? { abortSignal: args.abortSignal } : {}),
  });
}

/**
 * Pull a previously persisted Pi session file from the sandbox into a fresh
 * local mirror dir. Called during `doStart` on the resume path before Pi is
 * initialised. Returns the absolute path of the local session file or
 * `undefined` if the sandbox copy is missing.
 */
export async function pullSessionFileFromSandbox(args: {
  readonly sandbox: Experimental_SandboxSession;
  readonly sessionWorkDir: string;
  readonly hostSessionDir: string;
  readonly sessionFileName: string;
  readonly abortSignal?: AbortSignal;
}): Promise<string | undefined> {
  const remotePath = resolveContainedSandboxPath({
    sessionWorkDir: args.sessionWorkDir,
    sessionFileName: args.sessionFileName,
  });
  const bytes = await args.sandbox.readBinaryFile({
    path: remotePath,
    ...(args.abortSignal ? { abortSignal: args.abortSignal } : {}),
  });
  if (!bytes) return undefined;
  await mkdir(args.hostSessionDir, { recursive: true });
  const hostPath = resolveContainedHostPath({
    baseDir: args.hostSessionDir,
    sessionFileName: args.sessionFileName,
  });
  await writeFile(hostPath, bytes);
  return hostPath;
}
