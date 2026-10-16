/**
 * Constructs the environment variables for the child process.
 *
 * @param customEnv - Custom environment variables to merge with default environment variables.
 * @returns The environment variables for the child process.
 */
export function getEnvironment(
  customEnv?: Record<string, string>,
): Record<string, string> {
  const DEFAULT_INHERITED_ENV_VARS =
    globalThis.process.platform === 'win32'
      ? [
          'APPDATA',
          'HOMEDRIVE',
          'HOMEPATH',
          'LOCALAPPDATA',
          'PATH',
          'PROCESSOR_ARCHITECTURE',
          'SYSTEMDRIVE',
          'SYSTEMROOT',
          'TEMP',
          'USERNAME',
          'USERPROFILE',
        ]
      : ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER'];

  const env: Record<string, string> = customEnv ? { ...customEnv } : {};

  for (const key of DEFAULT_INHERITED_ENV_VARS) {
    const value = globalThis.process.env[key];
    if (value === undefined) {
      continue;
    }

    if (value.startsWith('()')) {
      continue;
    }

    env[key] = value;
  }

  return env;
}
