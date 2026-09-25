import { describe, expect, it, vi } from 'vitest';
import { MCPAppBridge } from './bridge';

function createTargetWindow() {
  return {
    postMessage: vi.fn(),
  } as unknown as Window & { postMessage: ReturnType<typeof vi.fn> };
}

function messageEvent(targetWindow: Window, data: unknown): MessageEvent {
  return { source: targetWindow, data } as MessageEvent;
}

function originEvent(
  targetWindow: Window,
  origin: string,
  data: unknown,
): MessageEvent {
  return { source: targetWindow, origin, data } as unknown as MessageEvent;
}

describe('MCPAppBridge', () => {
  it('responds to app initialization requests', async () => {
    const targetWindow = createTargetWindow();
    const bridge = new MCPAppBridge({
      targetWindow,
      hostInfo: { name: 'test-host', version: '1.0.0' },
      hostContext: { displayMode: 'inline' },
    });

    bridge.handleMessage(
      messageEvent(targetWindow, {
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/initialize',
        params: {},
      }),
    );

    await vi.waitFor(() => {
      expect(targetWindow.postMessage).toHaveBeenCalled();
    });
    expect(targetWindow.postMessage.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "id": 1,
          "jsonrpc": "2.0",
          "result": {
            "hostCapabilities": {},
            "hostContext": {
              "displayMode": "inline",
            },
            "hostInfo": {
              "name": "test-host",
              "version": "1.0.0",
            },
            "protocolVersion": "2026-01-26",
          },
        },
        "*",
      ]
    `);
  });

  it('queues tool notifications until the app is initialized', () => {
    const targetWindow = createTargetWindow();
    const bridge = new MCPAppBridge({ targetWindow });

    bridge.sendToolInput({ topic: 'usage' });
    expect(targetWindow.postMessage).not.toHaveBeenCalled();

    bridge.handleMessage(
      messageEvent(targetWindow, {
        jsonrpc: '2.0',
        method: 'ui/notifications/initialized',
      }),
    );

    expect(targetWindow.postMessage.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "jsonrpc": "2.0",
            "method": "ui/notifications/tool-input",
            "params": {
              "arguments": {
                "topic": "usage",
              },
            },
          },
          "*",
        ],
      ]
    `);
  });

  it('proxies app-visible tool calls through the configured handler', async () => {
    const targetWindow = createTargetWindow();
    const bridge = new MCPAppBridge({
      targetWindow,
      handlers: {
        allowedTools: ['refreshDashboardData'],
        callTool: async params => ({
          content: [{ type: 'text', text: `called ${params.name}` }],
        }),
      },
    });

    bridge.handleMessage(
      messageEvent(targetWindow, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'refreshDashboardData',
          arguments: { reason: 'test' },
        },
      }),
    );

    await vi.waitFor(() => {
      expect(targetWindow.postMessage).toHaveBeenCalled();
    });
    expect(targetWindow.postMessage.mock.calls[0]).toMatchInlineSnapshot(`
      [
        {
          "id": 2,
          "jsonrpc": "2.0",
          "result": {
            "content": [
              {
                "text": "called refreshDashboardData",
                "type": "text",
              },
            ],
          },
        },
        "*",
      ]
    `);
  });

  it('denies tool calls by default when allowedTools is omitted', async () => {
    const targetWindow = createTargetWindow();
    const callTool = vi.fn(async () => ({ content: [] }));
    const bridge = new MCPAppBridge({
      targetWindow,
      handlers: {
        // no allowedTools => deny-by-default
        callTool,
      },
    });

    bridge.handleMessage(
      messageEvent(targetWindow, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'filesystem/write', arguments: { path: '~/.ssh' } },
      }),
    );

    await vi.waitFor(() => {
      expect(targetWindow.postMessage).toHaveBeenCalled();
    });

    // The host handler must not be invoked, and an error is returned.
    expect(callTool).not.toHaveBeenCalled();
    const [response] = targetWindow.postMessage.mock.calls[0];
    expect(response.id).toBe(3);
    expect(response.result).toBeUndefined();
    expect(response.error).toBeDefined();
    expect(response.error.message).toContain('not app-visible');
  });

  it('denies tool calls not in allowedTools', async () => {
    const targetWindow = createTargetWindow();
    const callTool = vi.fn(async () => ({ content: [] }));
    const bridge = new MCPAppBridge({
      targetWindow,
      handlers: {
        allowedTools: ['refreshDashboardData'],
        callTool,
      },
    });

    bridge.handleMessage(
      messageEvent(targetWindow, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'filesystem/write', arguments: {} },
      }),
    );

    await vi.waitFor(() => {
      expect(targetWindow.postMessage).toHaveBeenCalled();
    });

    expect(callTool).not.toHaveBeenCalled();
    const [response] = targetWindow.postMessage.mock.calls[0];
    expect(response.error?.message).toContain('not app-visible');
  });

  it('drops messages from an unexpected origin when a concrete origin is set', () => {
    const targetWindow = createTargetWindow();
    const onError = vi.fn();
    const bridge = new MCPAppBridge({
      targetWindow,
      targetOrigin: 'https://proxy.example',
      handlers: { onError },
    });

    bridge.handleMessage(
      originEvent(targetWindow, 'https://evil.example', {
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/initialize',
        params: {},
      }),
    );

    expect(targetWindow.postMessage).not.toHaveBeenCalled();
  });

  it('handles messages from the matching origin', async () => {
    const targetWindow = createTargetWindow();
    const bridge = new MCPAppBridge({
      targetWindow,
      targetOrigin: 'https://proxy.example',
    });

    bridge.handleMessage(
      originEvent(targetWindow, 'https://proxy.example', {
        jsonrpc: '2.0',
        id: 1,
        method: 'ui/initialize',
        params: {},
      }),
    );

    await vi.waitFor(() => {
      expect(targetWindow.postMessage).toHaveBeenCalled();
    });
    const [, origin] = targetWindow.postMessage.mock.calls[0];
    expect(origin).toBe('https://proxy.example');
  });

  async function requestResult(method: string, params: unknown) {
    const targetWindow = createTargetWindow();
    const bridge = new MCPAppBridge({
      targetWindow,
      handlers: {
        readResource: async p => ({ ok: p }),
        openLink: async p => ({ ok: p }),
        requestDisplayMode: p => ({ mode: p.mode }),
      },
    });
    bridge.handleMessage(
      messageEvent(targetWindow, { jsonrpc: '2.0', id: 9, method, params }),
    );
    await vi.waitFor(() => {
      expect(targetWindow.postMessage).toHaveBeenCalled();
    });
    return targetWindow.postMessage.mock.calls[0][0];
  }

  it('rejects resources/read outside the ui:// scope', async () => {
    const response = await requestResult('resources/read', {
      uri: 'file:///etc/passwd',
    });
    expect(response.result).toBeUndefined();
    expect(response.error.message).toContain('ui://');
  });

  it('allows resources/read for ui:// resources', async () => {
    const response = await requestResult('resources/read', {
      uri: 'ui://app/data',
    });
    expect(response.result).toEqual({ ok: { uri: 'ui://app/data' } });
  });

  it('rejects ui/open-link with a javascript: scheme', async () => {
    const response = await requestResult('ui/open-link', {
      // eslint-disable-next-line no-script-url
      url: 'javascript:alert(1)',
    });
    expect(response.result).toBeUndefined();
    expect(response.error.message).toContain('scheme');
  });

  it('allows ui/open-link with an https URL', async () => {
    const response = await requestResult('ui/open-link', {
      url: 'https://example.com',
    });
    expect(response.result).toEqual({ ok: { url: 'https://example.com' } });
  });

  it('rejects malformed request params', async () => {
    const readResponse = await requestResult('resources/read', { uri: 42 });
    expect(readResponse.error.message).toContain('resources/read');

    const modeResponse = await requestResult('ui/request-display-mode', {
      mode: 'zoomed',
    });
    expect(modeResponse.error.message).toContain('ui/request-display-mode');
  });
});
