import {
  createTestServer,
  TestResponseController,
} from '@ai-sdk/test-server/with-vitest';
import { MCPClientError } from '../error/mcp-client-error';
import { deserializeMessage, SseMCPTransport } from './mcp-sse-transport';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LATEST_PROTOCOL_VERSION } from './types';

describe('SseMCPTransport', () => {
  const server = createTestServer({
    'http://localhost:3000/sse': {},
    'http://localhost:3000/messages': {
      response: {
        type: 'json-value',
        body: {
          ok: true,
          message: 'Created',
          code: 201,
        },
      },
    },
    'http://localhost:3333/sse': {},
    'http://localhost:3333/messages': {
      response: {
        type: 'json-value',
        body: {
          ok: true,
        },
      },
    },
  });

  let transport: SseMCPTransport;

  beforeEach(() => {
    transport = new SseMCPTransport({
      url: 'http://localhost:3000/sse',
    });
  });

  it('should establish connection and receive endpoint', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const connectPromise = transport.start();

    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );

    await connectPromise;
    await transport.close();

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].requestMethod).toBe('GET');
    expect(server.calls[0].requestUrl).toBe('http://localhost:3000/sse');
    expect(server.calls[0].requestHeaders).toEqual({
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
      accept: 'text/event-stream',
    });
  });

  it('should throw if server returns non-200 status', async () => {
    server.urls['http://localhost:3000/sse'].response = {
      type: 'error',
      status: 500,
      body: 'Internal Server Error',
    };

    await expect(transport.start()).rejects.toThrow();
  });

  it('should handle valid JSON-RPC messages', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const messagePromise = new Promise(resolve => {
      transport.onmessage = msg => resolve(msg);
    });

    const connectPromise = transport.start();

    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );

    await connectPromise;

    const testMessage = {
      jsonrpc: '2.0' as const,
      method: 'test',
      params: { foo: 'bar' },
      id: '1',
    };

    controller.write(
      `event: message\ndata: ${JSON.stringify(testMessage)}\n\n`,
    );

    expect(await messagePromise).toEqual(testMessage);

    await transport.close();
  });

  it('should handle JSON-RPC messages without explicit event field', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const messagePromise = new Promise(resolve => {
      transport.onmessage = msg => resolve(msg);
    });

    const connectPromise = transport.start();

    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );

    await connectPromise;

    const testMessage = {
      jsonrpc: '2.0' as const,
      method: 'test',
      params: { foo: 'bar' },
      id: '1',
    };

    controller.write(`data: ${JSON.stringify(testMessage)}\n\n`);

    expect(await messagePromise).toEqual(testMessage);

    await transport.close();
  });

  it('should handle invalid JSON-RPC messages', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const errorPromise = new Promise<unknown>(resolve => {
      transport.onerror = err => resolve(err);
    });

    const connectPromise = transport.start();

    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );
    await connectPromise;

    const invalidMessage = { foo: 'bar' };
    controller.write(
      `event: message\ndata: ${JSON.stringify(invalidMessage)}\n\n`,
    );

    const error = await errorPromise;
    expect(error).toBeInstanceOf(MCPClientError);
    expect((error as Error).message).toContain('Failed to parse message');

    await transport.close();
  });

  it('should reject SSE messages containing __proto__ (prototype pollution)', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const errorPromise = new Promise<unknown>(resolve => {
      transport.onerror = err => resolve(err);
    });

    const connectPromise = transport.start();

    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );
    await connectPromise;

    const malicious =
      '{"jsonrpc":"2.0","id":1,"result":{"__proto__":{"polluted":true}}}';
    controller.write(`event: message\ndata: ${malicious}\n\n`);

    const error = await errorPromise;
    expect(error).toBeInstanceOf(MCPClientError);
    expect({
      message: (error as Error).message,
      cause: ((error as { cause?: Error }).cause as Error | undefined)?.message,
    }).toMatchInlineSnapshot(`
      {
        "cause": "JSON parsing failed: Text: {"jsonrpc":"2.0","id":1,"result":{"__proto__":{"polluted":true}}}.
      Error message: SyntaxError: Object contains forbidden prototype property",
        "message": "MCP SSE Transport Error: Failed to parse message",
      }
    `);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    await transport.close();
  });

  it('should send messages as POST requests', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const connectPromise = transport.start();
    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );
    await connectPromise;

    const message = {
      jsonrpc: '2.0' as const,
      method: 'test',
      params: { foo: 'bar' },
      id: '1',
    };

    await transport.send(message);

    expect(server.calls).toHaveLength(2);
    expect(server.calls[1].requestMethod).toBe('POST');
    expect(server.calls[1].requestUrl).toBe('http://localhost:3000/messages');
    expect(await server.calls[1].requestBodyJson).toEqual(message);

    await transport.close();
  });

  it('should reject cross-origin endpoints before connecting', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const errorPromise = new Promise<unknown>(resolve => {
      transport.onerror = err => resolve(err);
    });

    const connectPromise = transport.start();
    controller.write(
      'event: endpoint\ndata: http://localhost:3333/messages\n\n',
    );

    await expect(connectPromise).rejects.toThrow(
      'Endpoint origin does not match connection origin: http://localhost:3333',
    );

    const error = await errorPromise;
    expect(error).toBeInstanceOf(MCPClientError);
    expect(transport['connected']).toBe(false);
    expect(transport['endpoint']).toBeUndefined();

    await expect(
      transport.send({
        jsonrpc: '2.0' as const,
        method: 'test',
        params: {},
        id: '1',
      }),
    ).rejects.toThrow('Not connected');

    await transport.close();
  });

  it('should ignore endpoint events after connecting', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const connectPromise = transport.start();
    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );
    await connectPromise;

    controller.write(
      'event: endpoint\ndata: http://localhost:3333/messages\n\n',
    );
    await new Promise(resolve => setTimeout(resolve, 0));

    const message = {
      jsonrpc: '2.0' as const,
      method: 'test',
      params: { foo: 'bar' },
      id: '1',
    };

    await transport.send(message);

    const postCalls = server.calls.filter(c => c.requestMethod === 'POST');
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0].requestUrl).toBe('http://localhost:3000/messages');

    await transport.close();
  });

  it('should handle POST request errors', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    server.urls['http://localhost:3000/messages'].response = {
      type: 'error',
      status: 500,
      body: 'Internal Server Error',
    };

    const errorPromise = new Promise<unknown>(resolve => {
      transport.onerror = err => resolve(err);
    });

    const connectPromise = transport.start();
    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );
    await connectPromise;

    const message = {
      jsonrpc: '2.0' as const,
      method: 'test',
      params: { foo: 'bar' },
      id: '1',
    };

    await transport.send(message);

    const error = await errorPromise;
    expect(error).toBeInstanceOf(MCPClientError);
    expect((error as Error).message).toContain('Error: POSTing to endpoint');
    expect(transport['connected']).toBe(true);

    await transport.close();
  });

  it('should handle invalid endpoint URLs', async () => {
    server.urls['http://localhost:3333/sse'].response = {
      type: 'error',
      status: 500,
      body: 'Internal Server Error',
    };

    transport = new SseMCPTransport({
      url: 'http://localhost:3333/sse',
    });

    const errorPromise = new Promise<unknown>(resolve => {
      transport.onerror = err => resolve(err);
    });

    const connectPromise = transport.start();

    await expect(connectPromise).rejects.toThrow();

    const error = await errorPromise;
    expect((error as Error).message).toContain(
      'MCP SSE Transport Error: 500 Internal Server Error',
    );
  });

  it('should send custom headers with all requests', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:3000/sse'].response = {
      type: 'controlled-stream',
      controller,
    };

    const customHeaders = {
      authorization: 'Bearer test-token',
      'x-custom-header': 'test-value',
    };

    transport = new SseMCPTransport({
      url: 'http://localhost:3000/sse',
      headers: customHeaders,
    });

    const connectPromise = transport.start();

    controller.write(
      'event: endpoint\ndata: http://localhost:3000/messages\n\n',
    );

    await connectPromise;

    const message = {
      jsonrpc: '2.0' as const,
      method: 'test',
      params: { foo: 'bar' },
      id: '1',
    };

    await transport.send(message);

    // Verify SSE connection headers
    expect(server.calls[0].requestHeaders).toEqual({
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
      accept: 'text/event-stream',
      ...customHeaders,
    });
    expect(server.calls[0].requestUserAgent).toContain('ai-sdk/');

    // Verify POST request headers
    expect(server.calls[1].requestHeaders).toEqual({
      'content-type': 'application/json',
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
      ...customHeaders,
    });
    expect(server.calls[1].requestUserAgent).toContain('ai-sdk/');

    await transport.close();
  });

  describe('redirect option', () => {
    it('should pass redirect: error to GET fetch on start()', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const controller = new TestResponseController();
      server.urls['http://localhost:3000/sse'].response = {
        type: 'controlled-stream',
        controller,
      };

      transport = new SseMCPTransport({
        url: 'http://localhost:3000/sse',
        redirect: 'error',
      });

      const connectPromise = transport.start();
      controller.write(
        'event: endpoint\ndata: http://localhost:3000/messages\n\n',
      );
      await connectPromise;

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/sse',
        expect.objectContaining({ redirect: 'error' }),
      );

      await transport.close();
      fetchSpy.mockRestore();
    });

    it('should pass redirect: error to POST fetch on send()', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const controller = new TestResponseController();
      server.urls['http://localhost:3000/sse'].response = {
        type: 'controlled-stream',
        controller,
      };

      transport = new SseMCPTransport({
        url: 'http://localhost:3000/sse',
        redirect: 'error',
      });

      const connectPromise = transport.start();
      controller.write(
        'event: endpoint\ndata: http://localhost:3000/messages\n\n',
      );
      await connectPromise;

      fetchSpy.mockClear();

      await transport.send({
        jsonrpc: '2.0' as const,
        method: 'test',
        params: {},
        id: '1',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ redirect: 'error' }),
      );

      await transport.close();
      fetchSpy.mockRestore();
    });

    it('should default redirect to error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const controller = new TestResponseController();
      server.urls['http://localhost:3000/sse'].response = {
        type: 'controlled-stream',
        controller,
      };

      transport = new SseMCPTransport({
        url: 'http://localhost:3000/sse',
      });

      const connectPromise = transport.start();
      controller.write(
        'event: endpoint\ndata: http://localhost:3000/messages\n\n',
      );
      await connectPromise;

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3000/sse',
        expect.objectContaining({ redirect: 'error' }),
      );

      await transport.close();
      fetchSpy.mockRestore();
    });
  });

  describe('custom fetch', () => {
    it('should use provided fetch function for SSE connection', async () => {
      const controller = new TestResponseController();
      server.urls['http://localhost:3000/sse'].response = {
        type: 'controlled-stream',
        controller,
      };

      const customFetch = vi.fn(globalThis.fetch);

      transport = new SseMCPTransport({
        url: 'http://localhost:3000/sse',
        fetch: customFetch,
      });

      const connectPromise = transport.start();
      controller.write(
        'event: endpoint\ndata: http://localhost:3000/messages\n\n',
      );
      await connectPromise;

      expect(customFetch).toHaveBeenCalledWith(
        'http://localhost:3000/sse',
        expect.objectContaining({ headers: expect.anything() }),
      );

      await transport.close();
    });

    it('should use provided fetch function for POST send()', async () => {
      const controller = new TestResponseController();
      server.urls['http://localhost:3000/sse'].response = {
        type: 'controlled-stream',
        controller,
      };
      server.urls['http://localhost:3000/messages'].response = {
        type: 'empty',
        status: 200,
      };

      const customFetch = vi.fn(globalThis.fetch);

      transport = new SseMCPTransport({
        url: 'http://localhost:3000/sse',
        fetch: customFetch,
      });

      const connectPromise = transport.start();
      controller.write(
        'event: endpoint\ndata: http://localhost:3000/messages\n\n',
      );
      await connectPromise;

      customFetch.mockClear();

      await transport.send({
        jsonrpc: '2.0' as const,
        method: 'test',
        params: {},
        id: '1',
      });

      expect(customFetch).toHaveBeenCalledWith(
        'http://localhost:3000/messages',
        expect.objectContaining({ method: 'POST' }),
      );

      await transport.close();
    });
  });

  describe('protocol version downgrade', () => {
    it('should use negotiated protocolVersion in POST headers after it is set', async () => {
      const controller = new TestResponseController();

      server.urls['http://localhost:3000/sse'].response = {
        type: 'controlled-stream',
        controller,
        headers: { 'content-type': 'text/event-stream' },
      };

      const connectPromise = transport.start();
      controller.write(
        'event: endpoint\ndata: http://localhost:3000/messages\n\n',
      );
      await connectPromise;

      // Simulate protocol version negotiation
      transport.protocolVersion = '2025-06-18';

      await transport.send({
        jsonrpc: '2.0' as const,
        method: 'tools/list',
        params: {},
        id: '1',
      });

      const postCall = server.calls.find(c => c.requestMethod === 'POST');
      expect(postCall?.requestHeaders['mcp-protocol-version']).toBe(
        '2025-06-18',
      );

      await transport.close();
    });
  });
});

describe('deserializeMessage', () => {
  it('should reject payloads containing __proto__ (prototype pollution)', async () => {
    const malicious =
      '{"jsonrpc":"2.0","id":1,"result":{"__proto__":{"polluted":true}}}';

    await expect(
      deserializeMessage(malicious),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      [AI_JSONParseError: JSON parsing failed: Text: {"jsonrpc":"2.0","id":1,"result":{"__proto__":{"polluted":true}}}.
      Error message: SyntaxError: Object contains forbidden prototype property]
    `,
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('should reject payloads containing constructor.prototype', async () => {
    const malicious =
      '{"jsonrpc":"2.0","id":1,"result":{"constructor":{"prototype":{"polluted":true}}}}';

    await expect(
      deserializeMessage(malicious),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `
      [AI_JSONParseError: JSON parsing failed: Text: {"jsonrpc":"2.0","id":1,"result":{"constructor":{"prototype":{"polluted":true}}}}.
      Error message: SyntaxError: Object contains forbidden prototype property]
    `,
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
