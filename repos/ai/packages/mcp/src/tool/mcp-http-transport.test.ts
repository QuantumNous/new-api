import {
  createTestServer,
  TestResponseController,
} from '@ai-sdk/test-server/with-vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMCPClient } from './mcp-client';
import { HttpMCPTransport } from './mcp-http-transport';
import { LATEST_PROTOCOL_VERSION } from './types';
import { MCPClientError } from '../error/mcp-client-error';
import type { OAuthClientProvider } from './oauth';
import type { OAuthTokens } from './oauth-types';

describe('HttpMCPTransport', () => {
  const server = createTestServer({
    'http://localhost:4000/mcp': {
      response: {
        type: 'json-value',
        body: { jsonrpc: '2.0', id: 1, result: { ok: true } },
        headers: { 'mcp-session-id': 'abc123' },
      },
    },
    'http://localhost:4000/stream': {},
  });

  let transport: HttpMCPTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = new HttpMCPTransport({ url: 'http://localhost:4000/mcp' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should POST JSON and receive JSON response', async () => {
    await transport.start();

    const message = {
      jsonrpc: '2.0' as const,
      method: 'initialize',
      id: 1,
      params: {},
    };

    const messagePromise = new Promise(resolve => {
      transport.onmessage = msg => resolve(msg);
    });

    await transport.send(message);

    const received = await messagePromise;
    expect(received).toEqual({ jsonrpc: '2.0', id: 1, result: { ok: true } });

    expect(server.calls[1].requestMethod).toBe('POST');
    expect(server.calls[1].requestHeaders).toEqual({
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    });
  });

  it('should handle text/event-stream responses', async () => {
    transport = new HttpMCPTransport({ url: 'http://localhost:4000/stream' });
    const controller = new TestResponseController();

    // Avoid locking a single ReadableStream for both GET (start) and POST (send)
    // GET from start -> 405 (no inbound SSE)
    // POST send -> controlled stream with text/event-stream
    server.urls['http://localhost:4000/stream'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return {
            type: 'controlled-stream',
            controller,
            headers: { 'content-type': 'text/event-stream' },
          };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    await transport.start();

    const msgPromise = new Promise(resolve => {
      transport.onmessage = msg => resolve(msg);
    });

    const message = {
      jsonrpc: '2.0' as const,
      method: 'initialize',
      id: 2,
      params: {},
    };
    await transport.send(message);

    controller.write(
      `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 2, result: { ok: true } })}\n\n`,
    );

    expect(await msgPromise).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: { ok: true },
    });
  });

  it('should initialize MCP client from SSE response without explicit event field', async () => {
    const controller = new TestResponseController();

    server.urls['http://localhost:4000/stream'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return {
            type: 'controlled-stream',
            controller,
            headers: { 'content-type': 'text/event-stream' },
          };
        case 2:
          return { type: 'empty', status: 202 };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    const clientPromise = createMCPClient({
      transport: {
        type: 'http',
        url: 'http://localhost:4000/stream',
      },
    });

    await vi.waitFor(() => {
      expect(server.calls[1]?.requestMethod).toBe('POST');
    });

    controller.write(
      `data: ${JSON.stringify({
        jsonrpc: '2.0',
        id: 0,
        result: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: {},
          serverInfo: { name: 'test-server', version: '1.0.0' },
        },
      })}\n\n`,
    );

    const client = await clientPromise;
    expect(client.serverInfo).toEqual({
      name: 'test-server',
      version: '1.0.0',
    });

    await client.close();
  });

  it('should (re)open inbound SSE after 202 Accepted', async () => {
    const controller = new TestResponseController();

    // Call 0 (GET from start): 405 -> no inbound SSE
    // Call 1 (POST send): 202 -> should trigger inbound SSE open
    // Call 2 (GET after 202): controlled stream opens successfully
    server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return { type: 'empty', status: 202 };
        case 2:
          return { type: 'controlled-stream', controller };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    await transport.start();

    // POST a request that gets 202
    await transport.send({
      jsonrpc: '2.0' as const,
      method: 'initialize',
      id: 1,
      params: {},
    });

    // openInboundSse() is fire-and-forget, so wait for the GET request to appear
    await vi.waitFor(() => {
      expect(server.calls[2]).toBeDefined();
    });

    expect(server.calls[2].requestMethod).toBe('GET');
    expect(server.calls[2].requestHeaders.accept).toBe('text/event-stream');
  });

  it('should DELETE to terminate session on close when session exists', async () => {
    // Call 0: GET from start returns 405 (skip SSE)
    // Call 1: POST returns JSON and sets mcp-session-id header
    // Call 2: DELETE on close to terminate session
    server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return {
            type: 'json-value',
            headers: { 'mcp-session-id': 'xyz-session' },
            body: { jsonrpc: '2.0', id: 1, result: { ok: true } },
          };
        case 2:
          return { type: 'empty', status: 200 };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    await transport.start();
    await transport.send({
      jsonrpc: '2.0' as const,
      method: 'initialize',
      id: 1,
      params: {},
    });

    await transport.close();

    expect(server.calls[2].requestMethod).toBe('DELETE');
    expect(server.calls[2].requestHeaders['mcp-session-id']).toBe(
      'xyz-session',
    );
  });

  it('should not DELETE to terminate session on close when disabled', async () => {
    transport = new HttpMCPTransport({
      url: 'http://localhost:4000/mcp',
      terminateSessionOnClose: false,
    });

    server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return {
            type: 'json-value',
            headers: { 'mcp-session-id': 'xyz-session' },
            body: { jsonrpc: '2.0', id: 1, result: { ok: true } },
          };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    await transport.start();
    await transport.send({
      jsonrpc: '2.0' as const,
      method: 'initialize',
      id: 1,
      params: {},
    });

    await transport.close();

    expect(server.calls).toHaveLength(2);
    expect(server.calls[0].requestMethod).toBe('GET');
    expect(server.calls[1].requestMethod).toBe('POST');
  });

  it('should send initial session id on resumed HTTP requests', async () => {
    const initialSessionId = 'saved-session';
    const initialProtocolVersion = '2025-06-18';

    transport = new HttpMCPTransport({
      url: 'http://localhost:4000/mcp',
      initialSessionId,
      initialProtocolVersion,
    });

    server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return {
            type: 'json-value',
            body: { jsonrpc: '2.0', id: 1, result: { ok: true } },
          };
        case 2:
          return {
            type: 'json-value',
            body: { jsonrpc: '2.0', id: 2, result: { ok: true } },
          };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    await transport.start();
    await transport.send({
      jsonrpc: '2.0' as const,
      method: 'initialize',
      id: 1,
      params: {},
    });
    await transport.send({
      jsonrpc: '2.0' as const,
      method: 'tools/list',
      id: 2,
      params: {},
    });

    expect(server.calls[0].requestMethod).toBe('GET');
    expect(server.calls[0].requestHeaders['mcp-session-id']).toBe(
      initialSessionId,
    );
    expect(server.calls[0].requestHeaders['mcp-protocol-version']).toBe(
      initialProtocolVersion,
    );

    expect(server.calls[1].requestMethod).toBe('POST');
    expect(server.calls[1].requestHeaders['mcp-session-id']).toBeUndefined();
    expect(server.calls[1].requestHeaders['mcp-protocol-version']).toBe(
      initialProtocolVersion,
    );

    expect(server.calls[2].requestMethod).toBe('POST');
    expect(server.calls[2].requestHeaders['mcp-session-id']).toBe(
      initialSessionId,
    );
    expect(server.calls[2].requestHeaders['mcp-protocol-version']).toBe(
      initialProtocolVersion,
    );
  });

  it('should notify when the server changes the session id', async () => {
    const onSessionIdChange = vi.fn();

    transport = new HttpMCPTransport({
      url: 'http://localhost:4000/mcp',
      onSessionIdChange,
    });

    server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        default:
          return {
            type: 'json-value',
            headers: { 'mcp-session-id': 'new-session' },
            body: {
              jsonrpc: '2.0',
              id: callNumber,
              result: { ok: true },
            },
          };
      }
    };

    await transport.start();
    await transport.send({
      jsonrpc: '2.0' as const,
      method: 'initialize',
      id: 1,
      params: {},
    });
    await transport.send({
      jsonrpc: '2.0' as const,
      method: 'tools/list',
      id: 2,
      params: {},
    });

    expect(onSessionIdChange).toHaveBeenCalledTimes(1);
    expect(onSessionIdChange).toHaveBeenCalledWith('new-session');
    expect(server.calls[2].requestHeaders['mcp-session-id']).toBe(
      'new-session',
    );
  });

  it('should notify and clear the session id when POST returns 404', async () => {
    const onSessionIdChange = vi.fn();
    const onSessionExpired = vi.fn();

    transport = new HttpMCPTransport({
      url: 'http://localhost:4000/mcp',
      initialSessionId: 'expired-session',
      onSessionIdChange,
      onSessionExpired,
    });

    server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return { type: 'error', status: 404, body: 'Not Found' };
        case 2:
          return {
            type: 'json-value',
            body: { jsonrpc: '2.0', id: 2, result: { ok: true } },
          };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    await transport.start();
    await expect(
      transport.send({
        jsonrpc: '2.0' as const,
        method: 'tools/list',
        id: 1,
        params: {},
      }),
    ).rejects.toThrow('The MCP session expired');

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledWith('expired-session');
    expect(onSessionIdChange).toHaveBeenCalledTimes(1);
    expect(onSessionIdChange).toHaveBeenCalledWith(undefined);

    await transport.send({
      jsonrpc: '2.0' as const,
      method: 'tools/list',
      id: 2,
      params: {},
    });

    expect(server.calls[2].requestHeaders['mcp-session-id']).toBeUndefined();
  });

  it('should notify and clear the session id when inbound SSE returns 404', async () => {
    const onSessionIdChange = vi.fn();
    const onSessionExpired = vi.fn();

    transport = new HttpMCPTransport({
      url: 'http://localhost:4000/mcp',
      initialSessionId: 'expired-session',
      onSessionIdChange,
      onSessionExpired,
    });

    server.urls['http://localhost:4000/mcp'].response = {
      type: 'error',
      status: 404,
      body: 'Not Found',
    };

    await transport.start();

    await vi.waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledWith('expired-session');
    });

    expect(server.calls[0].requestMethod).toBe('GET');
    expect(server.calls[0].requestHeaders['mcp-session-id']).toBe(
      'expired-session',
    );
    expect(onSessionIdChange).toHaveBeenCalledWith(undefined);
  });

  it('should report HTTP errors from POST', async () => {
    transport = new HttpMCPTransport({ url: 'http://localhost:4000/mcp' });

    const controller = new TestResponseController();
    server.urls['http://localhost:4000/mcp'].response = {
      type: 'controlled-stream',
      controller,
      headers: { 'content-type': 'text/event-stream' },
    };

    await transport.start();

    while (
      !(server.calls.length > 0 && server.calls[0].requestMethod === 'GET')
    ) {
      await vi.advanceTimersByTimeAsync(0);
    }

    // Now make POST fail
    server.urls['http://localhost:4000/mcp'].response = {
      type: 'error',
      status: 500,
      body: 'Internal Server Error',
    };

    const errorPromise = new Promise(resolve => {
      transport.onerror = e => resolve(e);
    });

    await expect(
      transport.send({
        jsonrpc: '2.0' as const,
        method: 'test',
        id: 3,
        params: {},
      }),
    ).rejects.toThrow('POSTing to endpoint');

    const error = await errorPromise;
    expect(error).toBeInstanceOf(MCPClientError);
    expect((error as Error).message).toContain('POSTing to endpoint');
    expect((error as MCPClientError).statusCode).toBe(500);
    expect((error as MCPClientError).url).toBe('http://localhost:4000/mcp');
    expect((error as MCPClientError).responseBody).toBe(
      'Internal Server Error',
    );
  });

  it('should expose HTTP status, URL, and response body on 404 from POST', async () => {
    transport = new HttpMCPTransport({ url: 'http://localhost:4000/mcp' });

    server.urls['http://localhost:4000/mcp'].response = {
      type: 'error',
      status: 404,
      body: 'Not Found',
    };

    await transport.start();

    let captured: unknown;
    transport.onerror = e => {
      captured = e;
    };

    await expect(
      transport.send({
        jsonrpc: '2.0' as const,
        method: 'initialize',
        id: 1,
        params: {},
      }),
    ).rejects.toThrow('POSTing to endpoint');

    expect(captured).toBeInstanceOf(MCPClientError);
    const error = captured as MCPClientError;
    expect(error.statusCode).toBe(404);
    expect(error.url).toBe('http://localhost:4000/mcp');
    expect(error.responseBody).toBe('Not Found');
    expect(error.message).toContain('does not support HTTP transport');
  });

  it('should expose HTTP status and URL on GET SSE failure', async () => {
    transport = new HttpMCPTransport({ url: 'http://localhost:4000/mcp' });

    server.urls['http://localhost:4000/mcp'].response = {
      type: 'error',
      status: 503,
      body: 'Service Unavailable',
    };

    let captured: unknown;
    transport.onerror = e => {
      captured = e;
    };

    await transport.start();

    while (
      !(server.calls.length > 0 && server.calls[0].requestMethod === 'GET')
    ) {
      await vi.advanceTimersByTimeAsync(0);
    }

    // Wait for the GET error handler to run
    await vi.advanceTimersByTimeAsync(0);

    expect(captured).toBeInstanceOf(MCPClientError);
    const error = captured as MCPClientError;
    expect(error.statusCode).toBe(503);
    expect(error.url).toBe('http://localhost:4000/mcp');
    expect(error.message).toContain('GET SSE failed');
  });

  it('should handle inbound SSE messages without explicit event field', async () => {
    const controller = new TestResponseController();
    server.urls['http://localhost:4000/mcp'].response = {
      type: 'controlled-stream',
      controller,
      headers: { 'content-type': 'text/event-stream' },
    };

    const message = { jsonrpc: '2.0' as const, id: 1, result: { ok: true } };
    const messagePromise = new Promise(resolve => {
      transport.onmessage = msg => resolve(msg);
    });

    await transport.start();
    await vi.waitFor(() => {
      expect(server.calls[0]?.requestMethod).toBe('GET');
    });

    controller.write(`data: ${JSON.stringify(message)}\n\n`);

    expect(await messagePromise).toEqual(message);
  });

  it('should handle invalid JSON-RPC messages from inbound SSE', async () => {
    const controller = new TestResponseController();
    server.urls['http://localhost:4000/mcp'].response = {
      type: 'controlled-stream',
      controller,
      headers: { 'content-type': 'text/event-stream' },
    };

    const errorPromise = new Promise(resolve => {
      transport.onerror = e => resolve(e);
    });

    await transport.start();

    controller.write(
      `event: message\ndata: ${JSON.stringify({ foo: 'bar' })}\n\n`,
    );

    const error = await errorPromise;
    expect(error).toBeInstanceOf(MCPClientError);
    expect((error as Error).message).toContain('Failed to parse message');
  });

  it('should handle rejected inbound SSE cancel after stream errors', async () => {
    const streamError = new TypeError('terminated');
    let streamController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined;

    const fetch = vi.fn(async () => {
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            streamController = controller;
          },
        }),
        {
          headers: { 'content-type': 'text/event-stream' },
        },
      );
    });

    transport = new HttpMCPTransport({
      url: 'http://localhost:4000/mcp',
      fetch,
    });

    const errors: unknown[] = [];
    transport.onerror = error => {
      errors.push(error);
    };

    await transport.start();

    await vi.waitFor(() => {
      expect(streamController).toBeDefined();
    });

    streamController!.error(streamError);

    await vi.waitFor(() => {
      expect(errors).toContain(streamError);
    });

    await transport.close();

    await vi.waitFor(() => {
      expect(errors.filter(error => error === streamError)).toHaveLength(2);
    });
  });

  it('should handle non-JSON-RPC response for notifications', async () => {
    server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return {
            type: 'json-value',
            body: { ok: true },
          };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    await transport.start();

    // Send a notification (no 'id' field)
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'notifications/initialized',
    };

    // Should not throw even though server returned non-JSON-RPC response
    await expect(transport.send(notification)).resolves.toBeUndefined();
  });

  it('should send custom headers with all requests', async () => {
    const controller = new TestResponseController();

    const customHeaders = {
      authorization: 'Bearer test-token',
      'x-custom-header': 'test-value',
    } as const;

    transport = new HttpMCPTransport({
      url: 'http://localhost:4000/mcp',
      headers: customHeaders as unknown as Record<string, string>,
    });

    // Avoid reusing the same stream across GET (start) and POST (send)
    // GET from start -> 405 (no inbound SSE)
    // POST send -> JSON OK
    server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
      switch (callNumber) {
        case 0:
          return { type: 'error', status: 405 };
        case 1:
          return {
            type: 'json-value',
            body: { jsonrpc: '2.0', id: 1, result: { ok: true } },
            headers: { 'content-type': 'application/json' },
          };
        default:
          return { type: 'empty', status: 200 };
      }
    };

    await transport.start();

    const message = {
      jsonrpc: '2.0' as const,
      method: 'test',
      params: { foo: 'bar' },
      id: '1',
    };

    await transport.send(message);

    expect(server.calls[0].requestHeaders).toEqual({
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
      accept: 'text/event-stream',
      ...customHeaders,
    });
    expect(server.calls[0].requestUserAgent).toContain('ai-sdk/');

    expect(server.calls[1].requestHeaders).toEqual({
      'content-type': 'application/json',
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
      accept: 'application/json, text/event-stream',
      ...customHeaders,
    });
    expect(server.calls[1].requestUserAgent).toContain('ai-sdk/');
  });

  it('should deduplicate OAuth refresh when inbound SSE and initialize both get 401', async () => {
    const trace: string[] = [];
    let storedTokens: OAuthTokens = {
      access_token: 'expired-access-token',
      token_type: 'Bearer',
      refresh_token: 'rotating-refresh-token',
      authorization_server: 'http://localhost:4000/',
      token_endpoint: 'http://localhost:4000/token',
    };
    let releaseRefresh: () => void;
    const refreshGate = new Promise<void>(resolve => {
      releaseRefresh = resolve;
    });
    const refreshRequests: URLSearchParams[] = [];

    const authProvider: OAuthClientProvider = {
      tokens: vi.fn(async () => storedTokens),
      saveTokens: vi.fn(async tokens => {
        storedTokens = tokens;
      }),
      redirectToAuthorization: vi.fn(),
      saveCodeVerifier: vi.fn(),
      codeVerifier: vi.fn(async () => 'verifier'),
      redirectUrl: 'http://localhost:4000/callback',
      clientMetadata: {
        redirect_uris: ['http://localhost:4000/callback'],
      },
      clientInformation: vi.fn(async () => ({ client_id: 'test-client' })),
    };

    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? 'GET';
        const headers = new Headers(init?.headers);
        trace.push(`${method} ${url.pathname}`);

        if (url.href === 'http://localhost:4000/mcp') {
          if (headers.get('authorization') === 'Bearer expired-access-token') {
            trace.push(`${method} ${url.pathname} 401`);
            return new Response(null, {
              status: 401,
              headers: {
                'www-authenticate':
                  'Bearer resource_metadata="http://localhost:4000/.well-known/oauth-protected-resource"',
              },
            });
          }

          if (method === 'GET') {
            return new Response(null, { status: 405 });
          }

          if (
            typeof init?.body === 'string' &&
            init.body.includes('notifications/initialized')
          ) {
            return new Response(null, { status: 202 });
          }

          return Response.json({
            jsonrpc: '2.0',
            id: 0,
            result: {
              protocolVersion: LATEST_PROTOCOL_VERSION,
              capabilities: {},
              serverInfo: { name: 'test-server', version: '1.0.0' },
            },
          });
        }

        if (
          url.href ===
          'http://localhost:4000/.well-known/oauth-protected-resource'
        ) {
          return Response.json({
            resource: 'http://localhost:4000',
            authorization_servers: ['http://localhost:4000'],
          });
        }

        if (
          url.href ===
          'http://localhost:4000/.well-known/oauth-authorization-server'
        ) {
          return Response.json({
            issuer: 'http://localhost:4000',
            authorization_endpoint: 'http://localhost:4000/authorize',
            token_endpoint: 'http://localhost:4000/token',
            response_types_supported: ['code'],
            code_challenge_methods_supported: ['S256'],
            grant_types_supported: ['refresh_token'],
            token_endpoint_auth_methods_supported: ['none'],
          });
        }

        if (url.href === 'http://localhost:4000/token') {
          refreshRequests.push(init?.body as URLSearchParams);
          await refreshGate;

          return Response.json({
            access_token: `refreshed-access-token-${refreshRequests.length}`,
            token_type: 'Bearer',
            refresh_token: `rotating-refresh-token-${refreshRequests.length}`,
          });
        }

        return new Response(null, { status: 404 });
      },
    );

    const clientPromise = createMCPClient({
      transport: {
        type: 'http',
        url: 'http://localhost:4000/mcp',
        authProvider,
        fetch: fetchFn,
      },
    });

    await vi.waitFor(() => {
      expect(trace).toContain('GET /mcp 401');
      expect(trace).toContain('POST /mcp 401');
    });

    expect(refreshRequests).toHaveLength(1);

    releaseRefresh!();
    const client = await clientPromise;
    await client.close();

    expect(refreshRequests).toHaveLength(1);
  });

  describe('redirect option', () => {
    it('should pass redirect: error to POST fetch on send()', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      transport = new HttpMCPTransport({
        url: 'http://localhost:4000/mcp',
        redirect: 'error',
      });

      server.urls['http://localhost:4000/mcp'].response = ({ callNumber }) => {
        switch (callNumber) {
          case 0:
            return { type: 'error', status: 405 };
          case 1:
            return {
              type: 'json-value',
              body: { jsonrpc: '2.0', id: 1, result: { ok: true } },
            };
          default:
            return { type: 'empty', status: 200 };
        }
      };

      await transport.start();
      fetchSpy.mockClear();

      await transport.send({
        jsonrpc: '2.0' as const,
        method: 'initialize',
        id: 1,
        params: {},
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ redirect: 'error' }),
      );

      fetchSpy.mockRestore();
    });

    it('should pass redirect: error to GET fetch on start()', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      transport = new HttpMCPTransport({
        url: 'http://localhost:4000/mcp',
        redirect: 'error',
      });

      server.urls['http://localhost:4000/mcp'].response = {
        type: 'error',
        status: 405,
      };

      await transport.start();

      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:4000/mcp',
        expect.objectContaining({ redirect: 'error', method: 'GET' }),
      );

      fetchSpy.mockRestore();
    });

    it('should default redirect to error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      transport = new HttpMCPTransport({
        url: 'http://localhost:4000/mcp',
      });

      server.urls['http://localhost:4000/mcp'].response = {
        type: 'error',
        status: 405,
      };

      await transport.start();

      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:4000/mcp',
        expect.objectContaining({ redirect: 'error', method: 'GET' }),
      );

      fetchSpy.mockRestore();
    });
  });

  describe('custom fetch', () => {
    it('should use provided fetch function instead of globalThis.fetch', async () => {
      const customFetch = vi.fn(globalThis.fetch);

      transport = new HttpMCPTransport({
        url: 'http://localhost:4000/mcp',
        fetch: customFetch,
      });

      server.urls['http://localhost:4000/mcp'].response = {
        type: 'error',
        status: 405,
      };

      await transport.start();

      await vi.waitFor(() => {
        expect(customFetch).toHaveBeenCalled();
      });

      expect(customFetch).toHaveBeenCalledWith(
        'http://localhost:4000/mcp',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should use provided fetch function for POST send()', async () => {
      const customFetch = vi.fn(globalThis.fetch);

      transport = new HttpMCPTransport({
        url: 'http://localhost:4000/mcp',
        fetch: customFetch,
      });

      server.urls['http://localhost:4000/mcp'].response = {
        type: 'json-value',
        body: { jsonrpc: '2.0', id: 1, result: { ok: true } },
        headers: { 'mcp-session-id': 'abc123' },
      };

      await transport.start();

      const message = {
        jsonrpc: '2.0' as const,
        method: 'initialize',
        id: 1,
        params: {},
      };

      await transport.send(message);

      expect(customFetch).toHaveBeenCalledWith(
        'http://localhost:4000/mcp',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('protocol version downgrade', () => {
    it('should use LATEST_PROTOCOL_VERSION by default', async () => {
      await transport.start();

      const message = {
        jsonrpc: '2.0' as const,
        method: 'initialize',
        id: 1,
        params: {},
      };

      await transport.send(message);

      expect(server.calls[1].requestHeaders['mcp-protocol-version']).toBe(
        LATEST_PROTOCOL_VERSION,
      );
    });

    it('should use negotiated protocolVersion in headers after it is set', async () => {
      const negotiatedVersion = '2025-06-18';

      server.urls['http://localhost:4000/mcp'].response = {
        type: 'json-value',
        body: { jsonrpc: '2.0', id: 2, result: { ok: true } },
        headers: { 'mcp-session-id': 'abc123' },
      };

      await transport.start();

      // Simulate the client setting the negotiated version after initialize
      transport.protocolVersion = negotiatedVersion;

      const message = {
        jsonrpc: '2.0' as const,
        method: 'tools/list',
        id: 2,
        params: {},
      };

      const messagePromise = new Promise(resolve => {
        transport.onmessage = msg => resolve(msg);
      });

      await transport.send(message);

      await messagePromise;

      // The POST for tools/list should use the negotiated version
      const postCall = server.calls.find(
        c =>
          c.requestMethod === 'POST' &&
          c.requestBodyJson.then(body => body.method === 'tools/list'),
      );
      expect(postCall?.requestHeaders['mcp-protocol-version']).toBe(
        negotiatedVersion,
      );
    });
  });
});
