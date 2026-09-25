import { LocalShellBackend } from 'deepagents';

export const SANDBOX_PATH_FALLBACK =
  '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

export function createLocalShellBackend({
  rootDir,
  env = process.env,
}: {
  readonly rootDir: string;
  readonly env?: NodeJS.ProcessEnv;
}): LocalShellBackend {
  return new LocalShellBackend({
    rootDir,
    env: {
      PATH: env.PATH ?? SANDBOX_PATH_FALLBACK,
    },
  });
}
