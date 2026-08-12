import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, test, vi } from 'vitest';
import { ToolRelayAuthorizer } from './tool-relay-auth';
import { startAuthorizedToolRelay } from './tool-relay';

const execFileAsync = promisify(execFile);

describe('startAuthorizedToolRelay', () => {
  test('rejects a request from a process containing the MCP helper path', async () => {
    const emit = vi.fn();
    const requestToolResult = vi.fn(async () => ({
      output: { leaked: 'HOST_TOOL_SECRET' },
    }));
    const relay = await startAuthorizedToolRelay({
      tools: [{ name: 'host_secret' }],
      emit,
      requestToolResult,
      authorizer: new ToolRelayAuthorizer({ ttlMs: 50 }),
    });

    try {
      const response = await requestFromProcessWithHelperPath({
        url: `http://127.0.0.1:${relay.port}`,
        helperPath: '/tmp/harness/opencode/host-tool-mcp.mjs',
        toolName: 'host_secret',
        input: { from: 'malicious-project-code' },
      });

      expect(response).toEqual({
        status: 401,
        body: { error: 'unauthorized tool relay request' },
      });
      expect(emit).not.toHaveBeenCalled();
      expect(requestToolResult).not.toHaveBeenCalled();
    } finally {
      relay.close();
    }
  });

  test('executes an exactly authorized tool call', async () => {
    const emit = vi.fn();
    const requestToolResult = vi.fn(async () => ({ output: { value: 42 } }));
    const relay = await startAuthorizedToolRelay({
      tools: [{ name: 'lookup' }],
      emit,
      requestToolResult,
    });
    const call = { toolName: 'lookup', input: { key: 'answer' } };

    try {
      relay.authorizeToolCall(call);
      const response = await fetch(`http://127.0.0.1:${relay.port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: 'authorized-call', ...call }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        result: { value: 42 },
      });
      expect(requestToolResult).toHaveBeenCalledOnce();
      expect(emit).toHaveBeenCalledTimes(2);
    } finally {
      relay.close();
    }
  });
});

async function requestFromProcessWithHelperPath({
  url,
  helperPath,
  toolName,
  input,
}: {
  url: string;
  helperPath: string;
  toolName: string;
  input: unknown;
}): Promise<{ status: number; body: unknown }> {
  const script = `
const response = await fetch(${JSON.stringify(url)}, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${JSON.stringify({
    requestId: 'unauthorized-call',
    toolName,
    input,
  })}),
});
process.stdout.write(JSON.stringify({ status: response.status, body: await response.json() }));
`;
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', script, helperPath],
    { encoding: 'utf8' },
  );
  return JSON.parse(stdout) as { status: number; body: unknown };
}
