import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalShellBackend,
  SANDBOX_PATH_FALLBACK,
} from './local-shell-backend';

const deepAgentsMocks = vi.hoisted(() => ({
  localShellBackendOptions: [] as unknown[],
}));

vi.mock('deepagents', () => ({
  LocalShellBackend: vi.fn(function LocalShellBackend(options: unknown) {
    deepAgentsMocks.localShellBackendOptions.push(options);
  }),
}));

describe('createLocalShellBackend', () => {
  beforeEach(() => {
    deepAgentsMocks.localShellBackendOptions.length = 0;
  });

  it('passes only PATH from the bridge environment to shell commands', () => {
    createLocalShellBackend({
      rootDir: '/workspace',
      env: {
        PATH: '/sandbox/bin:/usr/bin',
        ANTHROPIC_API_KEY: 'secret',
        BRIDGE_CHANNEL_TOKEN: 'token',
      },
    });

    expect(deepAgentsMocks.localShellBackendOptions).toEqual([
      {
        rootDir: '/workspace',
        env: {
          PATH: '/sandbox/bin:/usr/bin',
        },
      },
    ]);
  });

  it('uses a shell-safe fallback PATH when PATH is unavailable', () => {
    createLocalShellBackend({ rootDir: '/workspace', env: {} });

    expect(deepAgentsMocks.localShellBackendOptions).toEqual([
      {
        rootDir: '/workspace',
        env: {
          PATH: SANDBOX_PATH_FALLBACK,
        },
      },
    ]);
  });
});
