import type { Experimental_SandboxSession as SandboxSession } from 'ai';

export const aiSdkCodingSandboxWorkDir = 'ai-sdk';
export const aiSdkCodingSandboxBootstrapHash = 'vercel-ai-shallow-clone-v1';

export async function bootstrapAiSdkCodingRepo({
  session,
  workDir,
  abortSignal,
}: {
  readonly session: SandboxSession;
  readonly workDir: string;
  readonly abortSignal?: AbortSignal;
}): Promise<void> {
  const cloneResult = await session.run({
    command:
      'test -d .git || git clone --depth 1 https://github.com/vercel/ai.git .',
    workingDirectory: workDir,
    abortSignal,
  });
  if (cloneResult.exitCode !== 0) {
    throw new Error(
      `Failed to clone vercel/ai (exit ${cloneResult.exitCode}): ${cloneResult.stderr}`,
    );
  }

  await installAiSdkDependencies({ session, workDir, abortSignal });
}

export async function refreshAiSdkCodingRepo({
  session,
  sessionWorkDir,
  abortSignal,
}: {
  readonly session: SandboxSession;
  readonly sessionWorkDir: string;
  readonly abortSignal?: AbortSignal;
}): Promise<void> {
  const statusResult = await session.run({
    command: 'git status --porcelain',
    workingDirectory: sessionWorkDir,
    abortSignal,
  });
  if (statusResult.exitCode !== 0) {
    throw new Error(
      `Failed to check repository status (exit ${statusResult.exitCode}): ${statusResult.stderr}`,
    );
  }
  if (statusResult.stdout.trim().length > 0) return;

  const beforePull = await gitHead({
    session,
    workDir: sessionWorkDir,
    abortSignal,
  });
  const pullResult = await session.run({
    command: 'git pull --ff-only',
    workingDirectory: sessionWorkDir,
    abortSignal,
  });
  if (pullResult.exitCode !== 0) {
    throw new Error(
      `Failed to update vercel/ai (exit ${pullResult.exitCode}): ${pullResult.stderr}`,
    );
  }
  const afterPull = await gitHead({
    session,
    workDir: sessionWorkDir,
    abortSignal,
  });
  if (beforePull !== afterPull) {
    await installAiSdkDependencies({
      session,
      workDir: sessionWorkDir,
      abortSignal,
    });
  }
}

async function gitHead({
  session,
  workDir,
  abortSignal,
}: {
  readonly session: SandboxSession;
  readonly workDir: string;
  readonly abortSignal?: AbortSignal;
}): Promise<string> {
  const result = await session.run({
    command: 'git rev-parse HEAD',
    workingDirectory: workDir,
    abortSignal,
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to resolve repository HEAD (exit ${result.exitCode}): ${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

async function installAiSdkDependencies({
  session,
  workDir,
  abortSignal,
}: {
  readonly session: SandboxSession;
  readonly workDir: string;
  readonly abortSignal?: AbortSignal;
}): Promise<void> {
  const installResult = await session.run({
    command: 'pnpm install',
    workingDirectory: workDir,
    abortSignal,
  });
  if (installResult.exitCode !== 0) {
    throw new Error(
      `Failed to install dependencies (exit ${installResult.exitCode}): ${installResult.stderr}`,
    );
  }
}
