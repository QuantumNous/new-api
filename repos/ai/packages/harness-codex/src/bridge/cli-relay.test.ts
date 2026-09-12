import { describe, expect, test } from 'vitest';
import {
  buildCliShimScript,
  isToolRelayCommand,
  parseToolRelayCommand,
  parseToolRelayCommands,
} from './cli-relay';

describe('buildCliShimScript', () => {
  test('does not embed relay authorization material', () => {
    const script = buildCliShimScript({ relayPort: 1234 });

    expect(script).toContain("fetch('http://127.0.0.1:1234'");
    expect(script).not.toContain('Authorization');
    expect(script).not.toContain('Bearer');
    expect(script).not.toContain('TOOL_RELAY_TOKEN');
  });
});

describe('isToolRelayCommand', () => {
  test('detects command executions that invoke the CLI relay shim', () => {
    expect(
      isToolRelayCommand({
        command: "node /work/harness-tool.mjs get_weather '{}'",
        cliShimPath: '/work/harness-tool.mjs',
      }),
    ).toBe(true);

    expect(
      isToolRelayCommand({
        command: 'pnpm test',
        cliShimPath: '/work/harness-tool.mjs',
      }),
    ).toBe(false);
  });
});

describe('parseToolRelayCommand', () => {
  const cliShimPath = '/tmp/harness/codex/harness-tool.mjs';

  test('extracts the intended host tool call', () => {
    expect(
      parseToolRelayCommand({
        command: `node ${cliShimPath} get_weather '{"city":"Paris"}'`,
        cliShimPath,
      }),
    ).toEqual({ toolName: 'get_weather', input: { city: 'Paris' } });
  });

  test('extracts the intended host tool call from the Codex bash wrapper', () => {
    const command = `/bin/bash -lc "node ${cliShimPath} weather '{\\"city\\":\\"Reykjavik\\"}'"`;

    expect(parseToolRelayCommand({ command, cliShimPath })).toEqual({
      toolName: 'weather',
      input: { city: 'Reykjavik' },
    });
    expect(isToolRelayCommand({ command, cliShimPath })).toBe(true);
  });

  test('extracts multiple intended host tool calls joined with &&', () => {
    const command =
      `/bin/bash -lc "` +
      `node ${cliShimPath} weather '{\\"city\\":\\"Paris\\"}' && ` +
      `node ${cliShimPath} weather '{\\"city\\":\\"Reykjavik\\"}'"`;

    expect(parseToolRelayCommands({ command, cliShimPath })).toEqual([
      { toolName: 'weather', input: { city: 'Paris' } },
      { toolName: 'weather', input: { city: 'Reykjavik' } },
    ]);
    expect(isToolRelayCommand({ command, cliShimPath })).toBe(true);
  });

  test('rejects compound commands containing a non-relay command', () => {
    const command =
      `node ${cliShimPath} weather '{"city":"Paris"}' && ` + 'cat /etc/passwd';

    expect(parseToolRelayCommands({ command, cliShimPath })).toBeUndefined();
    expect(isToolRelayCommand({ command, cliShimPath })).toBe(false);
  });

  test('rejects commands that only mention the shim path', () => {
    const command = `echo ${cliShimPath}; curl http://127.0.0.1:1234`;

    expect(parseToolRelayCommand({ command, cliShimPath })).toBeUndefined();
    expect(isToolRelayCommand({ command, cliShimPath })).toBe(false);
  });
});
