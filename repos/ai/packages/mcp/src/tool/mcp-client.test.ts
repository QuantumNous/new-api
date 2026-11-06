import type * as McpTransportModule from './mcp-transport';
import type { MCPTransport } from './mcp-transport';
import { z } from 'zod/v4';
import { MCPClientError } from '../error/mcp-client-error';
import { createMCPClient } from './mcp-client';
import { MockMCPTransport } from './mock-mcp-transport';
import {
  ListToolsResult,
  ElicitationRequestSchema,
  LATEST_PROTOCOL_VERSION,
  type CallToolResult,
  type CompleteResult,
  type ListResourceTemplatesResult,
  type ListResourcesResult,
  type ReadResourceResult,
  type ListPromptsResult,
  type GetPromptResult,
  type Configuration,
  type InitializeResult,
} from './types';
import type { JSONRPCMessage, JSONRPCRequest } from './json-rpc-message';
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

const createMockTransport = vi.fn(config => new MockMCPTransport(config));

class GetterOnlyProtocolVersionTransport implements MCPTransport {
  private readonly transport: MockMCPTransport;
  private negotiatedProtocolVersion?: string;

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor(protocolVersion: string) {
    this.transport = new MockMCPTransport({
      initializeResult: {
        protocolVersion,
        serverInfo: { name: 'mock-mcp-server', version: '1.0.0' },
        capabilities: { tools: {} },
      },
    });
  }

  get protocolVersion(): string | undefined {
    return this.negotiatedProtocolVersion;
  }

  setProtocolVersion(version: string): void {
    this.negotiatedProtocolVersion = version;
  }

  async start(): Promise<void> {
    await this.transport.start();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.transport.onmessage = this.onmessage;
    this.transport.onclose = this.onclose;
    this.transport.onerror = this.onerror;
    await this.transport.send(message);
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}

class FailsFirstToolCallTransport implements MCPTransport {
  toolCallAttempts = 0;

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor(
    private readonly failure:
      | 'transient-http'
      | 'unlisted-http'
      | 'network'
      | 'invalid-params'
      | 'auth'
      | 'tool-result-error',
  ) {}

  async start(): Promise<void> {}

  async close(): Promise<void> {
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!('method' in message) || !('id' in message)) {
      return;
    }

    if (message.method === 'initialize') {
      this.onmessage?.({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          serverInfo: { name: 'retry-test-server', version: '1.0.0' },
          capabilities: { tools: {} },
        },
      });
      return;
    }

    if (message.method === 'tools/list') {
      this.onmessage?.({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [
            {
              name: 'retry-tool',
              description: 'A retry test tool',
              inputSchema: {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                },
              },
            },
          ],
        },
      });
      return;
    }

    if (message.method === 'tools/call') {
      this.toolCallAttempts += 1;

      if (this.toolCallAttempts === 1) {
        if (this.failure === 'transient-http') {
          throw new MCPClientError({
            message: 'temporary overload',
            statusCode: 503,
          });
        }

        if (this.failure === 'unlisted-http') {
          throw new MCPClientError({
            message: 'not retryable by default',
            statusCode: 418,
          });
        }

        if (this.failure === 'network') {
          throw Object.assign(new Error('connection reset'), {
            code: 'ECONNRESET',
          });
        }

        if (this.failure === 'invalid-params') {
          this.onmessage?.({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32602,
              message: 'Invalid params',
            },
          });
          return;
        }

        if (this.failure === 'auth') {
          throw new MCPClientError({
            message: 'Unauthorized',
            statusCode: 401,
          });
        }

        this.onmessage?.({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{ type: 'text', text: 'tool-level error' }],
            isError: true,
          },
        });
        return;
      }

      this.onmessage?.({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [{ type: 'text', text: 'retried successfully' }],
          isError: false,
        },
      });
    }
  }
}

class HangingToolCallTransport implements MCPTransport {
  sentMessages: JSONRPCMessage[] = [];

  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  async start(): Promise<void> {}

  async close(): Promise<void> {
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.sentMessages.push(message);

    if (!('method' in message) || !('id' in message)) {
      return;
    }

    if (message.method === 'initialize') {
      this.onmessage?.({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          serverInfo: { name: 'hanging-tool-call-server', version: '1.0.0' },
          capabilities: { tools: {} },
        },
      });
      return;
    }

    if (message.method === 'tools/call') {
      // Intentionally never respond. This exercises aborting an in-flight
      // request after it has been sent to a slow or hung MCP server.
      return;
    }
  }
}

vi.mock('./mcp-transport.ts', async importOriginal => {
  const actual = await importOriginal<typeof McpTransportModule>();
  return {
    ...actual,
    createMcpTransport: vi.fn(config => {
      return createMockTransport(config);
    }),
  };
});

describe('MCPClient', () => {
  let client: Awaited<ReturnType<typeof createMCPClient>>;

  beforeEach(async () => {
    createMockTransport.mockClear();
    createMockTransport.mockImplementation(() => new MockMCPTransport());
  });

  afterEach(async () => {
    vi.useRealTimers();
    await client?.close();
  });

  it('should return AI SDK compatible tool set', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });
    const tools = await client.tools();
    expect(tools).toHaveProperty('mock-tool');

    const tool = tools['mock-tool'];
    expect(tool).toHaveProperty('inputSchema');
    expect(tool.inputSchema).toMatchObject({
      jsonSchema: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
      },
    });
    expect(tool).toHaveProperty('type');
    expect(tool.type).toBe('dynamic');

    const toolCall = tool.execute;
    expect(toolCall).toBeDefined();
    expect(
      await toolCall(
        { foo: 'bar' },
        {
          messages: [],
          toolCallId: '1',
          context: {},
        },
      ),
    ).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "Mock tool call result",
            "type": "text",
          },
        ],
        "isError": false,
      }
    `);
  });

  it('should expose MCP tool metadata on dynamic tools', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
      clientName: 'MyMCPClient',
    });

    const tools = await client.tools();

    expect(tools['mock-tool'].metadata).toEqual({
      clientName: 'MyMCPClient',
      toolName: 'mock-tool',
    });
  });

  it('should expose MCP Apps metadata on tools', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          overrideTools: [
            {
              name: 'showDashboard',
              description: 'Show dashboard',
              inputSchema: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                },
              },
              _meta: {
                ui: {
                  resourceUri: 'ui://ai-sdk-e2e/dashboard',
                  visibility: ['model', 'app'],
                },
              },
            },
          ],
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
      clientName: 'MyMCPClient',
    });

    const dynamicTools = await client.tools();
    const typedTools = await client.tools({
      schemas: {
        showDashboard: {
          inputSchema: z.object({
            topic: z.string(),
          }),
        },
      },
    });

    expect(dynamicTools.showDashboard.metadata).toMatchInlineSnapshot(`
      {
        "app": {
          "mimeType": "text/html;profile=mcp-app",
          "resourceUri": "ui://ai-sdk-e2e/dashboard",
          "visibility": [
            "model",
            "app",
          ],
        },
        "clientName": "MyMCPClient",
        "toolName": "showDashboard",
      }
    `);
    expect(typedTools.showDashboard.metadata).toEqual(
      dynamicTools.showDashboard.metadata,
    );
  });

  it('should support deprecated client name for MCP tool metadata', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
      name: 'DeprecatedMCPServer',
    });

    const tools = await client.tools();

    expect(tools['mock-tool'].metadata).toEqual({
      clientName: 'DeprecatedMCPServer',
      toolName: 'mock-tool',
    });
  });

  it('should return serializable tool definitions via listTools()', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });
    const definitions = await client.listTools();

    expect(definitions).toHaveProperty('tools');
    expect(definitions.tools).toHaveLength(2);
    expect(definitions.tools[0]).toMatchObject({
      name: 'mock-tool',
      description: 'A mock tool for testing',
      inputSchema: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
      },
    });

    // Verify definitions are serializable (no functions)
    const serialized = JSON.stringify(definitions);
    const parsed = JSON.parse(serialized);
    expect(parsed.tools[0].name).toBe('mock-tool');
  });

  it('should create tools from cached definitions via toolsFromDefinitions()', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    // Get definitions (this would normally be cached)
    const definitions = await client.listTools();

    // Create tools from definitions without refetching
    const tools = client.toolsFromDefinitions(definitions);

    expect(tools).toHaveProperty('mock-tool');
    const tool = tools['mock-tool'];
    expect(tool).toHaveProperty('inputSchema');
    expect(tool).toHaveProperty('execute');

    // Verify the execute function works
    const result = await tool.execute(
      { foo: 'bar' },
      { messages: [], toolCallId: '1', context: {} },
    );
    expect(result).toMatchObject({
      content: [{ type: 'text', text: 'Mock tool call result' }],
    });
  });

  it('should allow caching workflow with listTools() and toolsFromDefinitions()', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    // Simulate caching workflow
    const definitions = await client.listTools();
    const cachedJson = JSON.stringify(definitions);

    // Later: restore from cache and create tools
    const restored = JSON.parse(cachedJson);
    const tools = client.toolsFromDefinitions(restored);

    expect(tools).toHaveProperty('mock-tool');
    expect(tools['mock-tool'].execute).toBeDefined();
  });

  it('should convert MCP image content to AI SDK format via toModelOutput', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          overrideTools: [
            {
              name: 'get-image',
              description: 'Returns an image',
              inputSchema: { type: 'object' },
            },
          ],
          toolCallResults: {
            'get-image': {
              content: [
                {
                  type: 'image',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
                  mimeType: 'image/png',
                },
              ],
              isError: false,
            },
          },
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const tools = await client.tools();
    const tool = tools['get-image'];

    expect(
      await tool.execute!({}, { messages: [], toolCallId: '1', context: {} }),
    ).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
            "mimeType": "image/png",
            "type": "image",
          },
        ],
        "isError": false,
      }
    `);

    expect(tool.toModelOutput).toBeDefined();
    expect(
      tool.toModelOutput!({
        toolCallId: '1',
        input: {},
        output: {
          content: [
            {
              type: 'image',
              data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
              mimeType: 'image/png',
            },
          ],
          isError: false,
        },
      }),
    ).toMatchInlineSnapshot(`
      {
        "type": "content",
        "value": [
          {
            "data": {
              "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
              "type": "data",
            },
            "mediaType": "image/png",
            "type": "file",
          },
        ],
      }
    `);
  });

  it('should convert MCP text content to AI SDK format via toModelOutput', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          overrideTools: [
            {
              name: 'get-text',
              description: 'Returns text',
              inputSchema: { type: 'object' },
            },
          ],
          toolCallResults: {
            'get-text': {
              content: [
                {
                  type: 'text',
                  text: 'Hello world',
                },
              ],
              isError: false,
            },
          },
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const tools = await client.tools();
    const tool = tools['get-text'];

    expect(
      await tool.execute!({}, { messages: [], toolCallId: '1', context: {} }),
    ).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "Hello world",
            "type": "text",
          },
        ],
        "isError": false,
      }
    `);

    expect(tool.toModelOutput).toBeDefined();
    expect(
      tool.toModelOutput!({
        toolCallId: '1',
        input: {},
        output: {
          content: [{ type: 'text', text: 'Hello world' }],
          isError: false,
        },
      }),
    ).toMatchInlineSnapshot(`
      {
        "type": "content",
        "value": [
          {
            "text": "Hello world",
            "type": "text",
          },
        ],
      }
    `);
  });

  it('should convert mixed MCP content to AI SDK format via toModelOutput', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          overrideTools: [
            {
              name: 'get-mixed',
              description: 'Returns mixed content',
              inputSchema: { type: 'object' },
            },
          ],
          toolCallResults: {
            'get-mixed': {
              content: [
                { type: 'text', text: 'Here is an image:' },
                { type: 'image', data: 'base64data', mimeType: 'image/png' },
              ],
              isError: false,
            },
          },
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const tools = await client.tools();
    const tool = tools['get-mixed'];

    expect(
      await tool.execute!({}, { messages: [], toolCallId: '1', context: {} }),
    ).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "text": "Here is an image:",
              "type": "text",
            },
            {
              "data": "base64data",
              "mimeType": "image/png",
              "type": "image",
            },
          ],
          "isError": false,
          "toolResult": undefined,
        }
      `);

    expect(tool.toModelOutput).toBeDefined();
    expect(
      tool.toModelOutput!({
        toolCallId: '1',
        input: {},
        output: {
          content: [
            { type: 'text', text: 'Here is an image:' },
            { type: 'image', data: 'base64data', mimeType: 'image/png' },
          ],
          isError: false,
        },
      }),
    ).toMatchInlineSnapshot(`
      {
        "type": "content",
        "value": [
          {
            "text": "Here is an image:",
            "type": "text",
          },
          {
            "data": {
              "data": "base64data",
              "type": "data",
            },
            "mediaType": "image/png",
            "type": "file",
          },
        ],
      }
    `);
  });

  it('should fallback to JSON for unknown content types via toModelOutput', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          overrideTools: [
            {
              name: 'get-unknown',
              description: 'Returns unknown content',
              inputSchema: { type: 'object' },
            },
          ],
          toolCallResults: {
            'get-unknown': {
              content: [{ type: 'custom', data: { foo: 'bar' } }],
              isError: false,
            } as unknown as CallToolResult,
          },
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const tools = await client.tools();
    const tool = tools['get-unknown'];

    expect(
      await tool.execute!({}, { messages: [], toolCallId: '1', context: {} }),
    ).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "data": {
                "foo": "bar",
              },
              "type": "custom",
            },
          ],
          "isError": false,
          "toolResult": undefined,
        }
      `);

    expect(tool.toModelOutput).toBeDefined();
    expect(
      (tool.toModelOutput as Function)({
        toolCallId: '1',
        input: {},
        output: {
          content: [{ type: 'custom', data: { foo: 'bar' } }],
          isError: false,
        },
      }),
    ).toMatchInlineSnapshot(`
      {
        "type": "content",
        "value": [
          {
            "text": "{"type":"custom","data":{"foo":"bar"}}",
            "type": "text",
          },
        ],
      }
    `);
  });

  it('should fallback to JSON when result has no content array via toModelOutput', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          overrideTools: [
            {
              name: 'get-raw',
              description: 'Returns raw result',
              inputSchema: { type: 'object' },
            },
          ],
          toolCallResults: {
            'get-raw': {
              value: 42,
              isError: false,
            } as unknown as CallToolResult,
          },
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const tools = await client.tools();
    const tool = tools['get-raw'];

    expect(
      await tool.execute!({}, { messages: [], toolCallId: '1', context: {} }),
    ).toMatchInlineSnapshot(`
        {
          "isError": false,
          "toolResult": undefined,
          "value": 42,
        }
      `);

    expect(tool.toModelOutput).toBeDefined();
    expect(
      (tool.toModelOutput as Function)({
        toolCallId: '1',
        input: {},
        output: { value: 42, isError: false },
      }),
    ).toMatchInlineSnapshot(`
      {
        "type": "json",
        "value": {
          "isError": false,
          "value": 42,
        },
      }
    `);
  });

  it('should expose _meta field from MCP tool definition', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          overrideTools: [
            {
              name: 'tool-with-meta',
              description: 'A tool with metadata',
              inputSchema: {
                type: 'object',
                properties: {
                  input: { type: 'string' },
                },
              },
              _meta: {
                'openai/outputTemplate': '{{result}}',
              },
            },
          ],
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const tools = await client.tools();
    const tool = tools['tool-with-meta'];

    expect(tool._meta?.['openai/outputTemplate']).toBe('{{result}}');
  });

  it('should list resources from the server', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const resources = await client.listResources();

    expectTypeOf(resources).toEqualTypeOf<ListResourcesResult>();

    expect(resources.resources).toMatchInlineSnapshot(`
      [
        {
          "description": "Mock resource",
          "mimeType": "text/plain",
          "name": "resource.txt",
          "uri": "file:///mock/resource.txt",
        },
      ]
    `);
  });

  it('should read resource contents', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const result = await client.readResource({
      uri: 'file:///mock/resource.txt',
    });

    expectTypeOf(result).toEqualTypeOf<ReadResourceResult>();

    expect(result.contents).toMatchInlineSnapshot(`
      [
        {
          "mimeType": "text/plain",
          "text": "Mock resource content",
          "uri": "file:///mock/resource.txt",
        },
      ]
    `);
  });

  it('should list resource templates', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const templates = await client.listResourceTemplates();

    expectTypeOf(templates).toEqualTypeOf<ListResourceTemplatesResult>();

    expect(templates.resourceTemplates).toMatchInlineSnapshot(`
      [
        {
          "description": "Mock template",
          "name": "mock-template",
          "uriTemplate": "file:///{path}",
        },
      ]
    `);
  });

  it('should request completions from the server', async () => {
    const mockTransport = new MockMCPTransport({
      completionResult: {
        completion: {
          values: ['auth', 'auth-staging'],
          total: 2,
          hasMore: false,
        },
      },
    });
    const sendSpy = vi.spyOn(mockTransport, 'send');

    client = await createMCPClient({
      transport: mockTransport,
    });

    const completion = await client.complete({
      ref: {
        type: 'ref/resource',
        uri: 'kubernetes://namespaced/{plural}/{namespace}',
      },
      argument: {
        name: 'namespace',
        value: 'auth',
      },
      context: {
        arguments: {
          plural: 'deployments',
        },
      },
    });

    expectTypeOf(completion).toEqualTypeOf<CompleteResult>();

    expect(completion).toMatchInlineSnapshot(`
      {
        "completion": {
          "hasMore": false,
          "total": 2,
          "values": [
            "auth",
            "auth-staging",
          ],
        },
      }
    `);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'completion/complete',
        params: {
          ref: {
            type: 'ref/resource',
            uri: 'kubernetes://namespaced/{plural}/{namespace}',
          },
          argument: {
            name: 'namespace',
            value: 'auth',
          },
          context: {
            arguments: {
              plural: 'deployments',
            },
          },
        },
      }),
    );
  });

  it('should throw if the server does not support completions', async () => {
    const mockTransport = new MockMCPTransport();
    const sendSpy = vi.spyOn(mockTransport, 'send');

    client = await createMCPClient({
      transport: mockTransport,
    });

    await expect(
      client.complete({
        ref: {
          type: 'ref/prompt',
          name: 'code_review',
        },
        argument: {
          name: 'language',
          value: 'py',
        },
      }),
    ).rejects.toThrow(MCPClientError);
    expect(sendSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'completion/complete',
      }),
    );
  });

  it('should list prompts from the server', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const prompts = await client.experimental_listPrompts();

    expectTypeOf(prompts).toEqualTypeOf<ListPromptsResult>();

    expect(prompts.prompts).toMatchInlineSnapshot(`
      [
        {
          "arguments": [
            {
              "description": "The code to review",
              "name": "code",
              "required": true,
            },
          ],
          "description": "Asks the LLM to analyze code quality and suggest improvements",
          "name": "code_review",
          "title": "Request Code Review",
        },
      ]
    `);
  });

  it('should get a prompt by name', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const prompt = await client.experimental_getPrompt({
      name: 'code_review',
      arguments: { code: 'print(42)' },
    });

    expectTypeOf(prompt).toEqualTypeOf<GetPromptResult>();

    expect(prompt).toMatchInlineSnapshot(`
      {
        "description": "Code review prompt",
        "messages": [
          {
            "content": {
              "text": "Please review this code:
      function add(a, b) { return a + b; }",
              "type": "text",
            },
            "role": "user",
          },
        ],
      }
    `);
  });

  it('should throw if the server does not support prompts', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          resources: [],
          prompts: [],
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    await expect(client.experimental_listPrompts()).rejects.toThrow(
      MCPClientError,
    );
    await expect(
      client.experimental_getPrompt({ name: 'code_review' }),
    ).rejects.toThrow(MCPClientError);
  });

  it('should return typed AI SDK compatible tool set when schemas are provided', async () => {
    const mockTransport = new MockMCPTransport({
      overrideTools: [
        {
          name: 'mock-tool-only-input-schema',
          description: 'A mock tool for testing custom transports',
          inputSchema: {
            type: 'object',
            properties: {
              foo: { type: 'string' },
            },
          },
        },
      ],
    });

    client = await createMCPClient({
      transport: mockTransport,
    });

    const tools = await client.tools({
      schemas: {
        'mock-tool-only-input-schema': {
          inputSchema: z.object({
            foo: z.string(),
          }),
        },
      },
    });
    expect(tools).toHaveProperty('mock-tool-only-input-schema');
    const tool = tools['mock-tool-only-input-schema'];

    type ToolParams = Parameters<typeof tool.execute>[0];
    expectTypeOf<ToolParams>().toEqualTypeOf<{ foo: string }>();

    const result = await tool.execute(
      { foo: 'bar' },
      {
        messages: [],
        toolCallId: '1',
        context: {},
      },
    );

    expectTypeOf<
      Exclude<typeof result, AsyncIterable<any>>
    >().toEqualTypeOf<CallToolResult>();
  });

  it('should not return user-defined tool if it is nonexistent', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });
    const tools = await client.tools({
      schemas: {
        'nonexistent-tool': {
          inputSchema: z.object({ bar: z.string() }),
        },
      },
    });

    expect(tools).not.toHaveProperty('nonexistent-tool');
  });

  it('should not return server tools named after Object.prototype properties unless explicitly allowed', async () => {
    const mockTransport = new MockMCPTransport({
      overrideTools: [
        {
          name: 'allowed-tool',
          description: 'An explicitly allowed tool',
          inputSchema: {
            type: 'object',
            properties: { foo: { type: 'string' } },
          },
        },
        {
          name: 'constructor',
          description: 'Tool named after an inherited prototype property',
          inputSchema: { type: 'object' },
        },
        {
          name: 'toString',
          description: 'Tool named after an inherited prototype property',
          inputSchema: { type: 'object' },
        },
        {
          name: '__proto__',
          description: 'Tool named after an inherited prototype property',
          inputSchema: { type: 'object' },
        },
      ],
    });

    client = await createMCPClient({
      transport: mockTransport,
    });

    const tools = await client.tools({
      schemas: {
        'allowed-tool': {
          inputSchema: z.object({ foo: z.string() }),
        },
      },
    });

    expect(Object.keys(tools)).toEqual(['allowed-tool']);
    expect(Object.prototype.hasOwnProperty.call(tools, 'constructor')).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(tools, 'toString')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(tools, '__proto__')).toBe(
      false,
    );
  });

  it('should not retry tool calls by default', async () => {
    const transport = new FailsFirstToolCallTransport('transient-http');
    client = await createMCPClient({
      transport,
    });

    const tools = await client.tools();

    await expect(
      tools['retry-tool'].execute(
        { value: 'test' },
        { messages: [], toolCallId: '1', context: {} },
      ),
    ).rejects.toThrow(MCPClientError);
    expect(transport.toolCallAttempts).toBe(1);
  });

  it('should retry transient HTTP tool call failures when maxRetries is configured', async () => {
    vi.useFakeTimers();
    const transport = new FailsFirstToolCallTransport('transient-http');
    client = await createMCPClient({
      transport,
      maxRetries: 1,
    });

    const tools = await client.tools();

    const result = tools['retry-tool'].execute(
      { value: 'test' },
      { messages: [], toolCallId: '1', context: {} },
    );
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "retried successfully",
            "type": "text",
          },
        ],
        "isError": false,
      }
    `);
    expect(transport.toolCallAttempts).toBe(2);
  });

  it('should retry network-style tool call failures when maxRetries is configured', async () => {
    vi.useFakeTimers();
    const transport = new FailsFirstToolCallTransport('network');
    client = await createMCPClient({
      transport,
      maxRetries: 1,
    });

    const tools = await client.tools();

    const result = tools['retry-tool'].execute(
      { value: 'test' },
      { messages: [], toolCallId: '1', context: {} },
    );
    await vi.advanceTimersByTimeAsync(2000);

    await expect(result).resolves.toMatchObject({
      content: [{ type: 'text', text: 'retried successfully' }],
      isError: false,
    });
    expect(transport.toolCallAttempts).toBe(2);
  });

  it('should not retry HTTP status codes outside the default retry list', async () => {
    const transport = new FailsFirstToolCallTransport('unlisted-http');
    client = await createMCPClient({
      transport,
      maxRetries: 2,
    });

    const tools = await client.tools();

    await expect(
      tools['retry-tool'].execute(
        { value: 'test' },
        { messages: [], toolCallId: '1', context: {} },
      ),
    ).rejects.toMatchObject({ statusCode: 418 });
    expect(transport.toolCallAttempts).toBe(1);
  });

  it('should not retry invalid argument JSON-RPC errors', async () => {
    const transport = new FailsFirstToolCallTransport('invalid-params');
    client = await createMCPClient({
      transport,
      maxRetries: 2,
    });

    const tools = await client.tools();

    await expect(
      tools['retry-tool'].execute(
        { value: 'test' },
        { messages: [], toolCallId: '1', context: {} },
      ),
    ).rejects.toMatchObject({ code: -32602 });
    expect(transport.toolCallAttempts).toBe(1);
  });

  it('should not retry auth failures', async () => {
    const transport = new FailsFirstToolCallTransport('auth');
    client = await createMCPClient({
      transport,
      maxRetries: 2,
    });

    const tools = await client.tools();

    await expect(
      tools['retry-tool'].execute(
        { value: 'test' },
        { messages: [], toolCallId: '1', context: {} },
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(transport.toolCallAttempts).toBe(1);
  });

  it('should not retry successful MCP tool results with isError', async () => {
    const transport = new FailsFirstToolCallTransport('tool-result-error');
    client = await createMCPClient({
      transport,
      maxRetries: 2,
    });

    const tools = await client.tools();

    await expect(
      tools['retry-tool'].execute(
        { value: 'test' },
        { messages: [], toolCallId: '1', context: {} },
      ),
    ).resolves.toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "tool-level error",
            "type": "text",
          },
        ],
        "isError": true,
      }
    `);
    expect(transport.toolCallAttempts).toBe(1);
  });

  it('should error when calling tool with misconfigured parameters', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          failOnInvalidToolParams: true,
        }),
    );
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });
    const tools = await client.tools({
      schemas: {
        'mock-tool': {
          inputSchema: z.object({ bar: z.string() }),
        },
      },
    });
    const toolCall = tools['mock-tool'].execute;
    await expect(
      toolCall({ bar: 'bar' }, { messages: [], toolCallId: '1', context: {} }),
    ).rejects.toThrow(MCPClientError);
  });

  it('should include JSON-RPC error data in MCPClientError', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          failOnInvalidToolParams: true,
        }),
    );
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });
    const tools = await client.tools({
      schemas: {
        'mock-tool': {
          inputSchema: z.object({ bar: z.string() }),
        },
      },
    });
    const toolCall = tools['mock-tool'].execute;

    try {
      await toolCall(
        { bar: 'bar' },
        { messages: [], toolCallId: '1', context: {} },
      );
      throw new Error('Expected error to be thrown');
    } catch (error) {
      expect(MCPClientError.isInstance(error)).toBe(true);
      if (MCPClientError.isInstance(error)) {
        expect(error.code).toBe(-32602);
        expect(error.data).toMatchInlineSnapshot(`
          {
            "expectedSchema": {
              "properties": {
                "foo": {
                  "type": "string",
                },
              },
              "type": "object",
            },
            "receivedArguments": {
              "bar": "bar",
            },
          }
        `);
      }
    }
  });

  it('should throw if the server does not support any tools', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          overrideTools: [],
          resources: [],
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    await expect(client.tools()).rejects.toThrow(MCPClientError);
  });

  it('should throw if server sends invalid initialize result', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          initializeResult: {},
        }),
    );

    await expect(
      createMCPClient({
        transport: { type: 'sse', url: 'https://example.com/sse' },
      }),
    ).rejects.toThrowError(MCPClientError);
  });

  it('should throw if server sends invalid protocol version', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          initializeResult: {
            protocolVersion: 'foo',
            serverInfo: {
              name: 'mock-mcp-server',
              version: '1.0.0',
            },
            capabilities: {},
          },
        }),
    );

    await expect(
      createMCPClient({
        transport: { type: 'sse', url: 'https://example.com/sse' },
      }),
    ).rejects.toThrowError(MCPClientError);
  });

  it('should accept server responding with 2025-11-25 protocol version', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          initializeResult: {
            protocolVersion: '2025-11-25',
            serverInfo: {
              name: 'mock-mcp-server',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          },
        }),
    );

    const client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    const tools = await client.tools();
    expect(tools).toBeDefined();
    await client.close();
  });

  it('should accept server responding with older supported protocol versions', async () => {
    for (const version of ['2025-06-18', '2025-03-26', '2024-11-05']) {
      createMockTransport.mockImplementation(
        () =>
          new MockMCPTransport({
            initializeResult: {
              protocolVersion: version,
              serverInfo: {
                name: 'mock-mcp-server',
                version: '1.0.0',
              },
              capabilities: {
                tools: {},
              },
            },
          }),
      );

      const client = await createMCPClient({
        transport: { type: 'sse', url: 'https://example.com/sse' },
      });

      const tools = await client.tools();
      expect(tools).toBeDefined();
      await client.close();
    }
  });

  it('should resume from an initial initialize result without reinitializing', async () => {
    const sentMessages: JSONRPCMessage[] = [];
    const initialInitializeResult: InitializeResult = {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      serverInfo: {
        name: 'resumed-server',
        version: '1.0.0',
      },
      capabilities: {
        tools: {},
      },
      instructions: 'Cached server instructions',
    };
    const transport: MCPTransport = {
      start: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      send: vi.fn(async message => {
        sentMessages.push(message);
        if (
          'method' in message &&
          'id' in message &&
          message.method === 'tools/list'
        ) {
          transport.onmessage?.({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: [],
            },
          });
        }
      }),
    };

    client = await createMCPClient({
      transport,
      initialInitializeResult,
    });

    expect(transport.start).toHaveBeenCalledTimes(1);
    expect(sentMessages).toEqual([]);
    expect(transport.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    expect(client.serverInfo).toEqual({
      name: 'resumed-server',
      version: '1.0.0',
    });
    expect(client.initializeResult).toEqual(initialInitializeResult);
    expect(client.instructions).toBe('Cached server instructions');

    await expect(client.listTools()).resolves.toEqual({ tools: [] });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      method: 'tools/list',
    });
  });

  it('should expose serverInfo from initialization', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          initializeResult: {
            protocolVersion: '2025-11-25',
            serverInfo: {
              name: 'my-server',
              version: '2.0.0',
              title: 'My Server',
            },
            capabilities: { tools: {} },
          },
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    expect(client.serverInfo).toMatchInlineSnapshot(`
      {
        "name": "my-server",
        "title": "My Server",
        "version": "2.0.0",
      }
    `);
  });

  it('should expose serverInfo without title when server omits it', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    expect(client.serverInfo).toMatchInlineSnapshot(`
      {
        "name": "mock-mcp-server",
        "version": "1.0.0",
      }
    `);
  });

  it('should expose instructions from initialization when server provides them', async () => {
    createMockTransport.mockImplementation(
      () =>
        new MockMCPTransport({
          initializeResult: {
            protocolVersion: '2025-11-25',
            serverInfo: {
              name: 'mock-mcp-server',
              version: '1.0.0',
            },
            capabilities: { tools: {} },
            instructions:
              'Use search tools to resolve IDs — never ask the user.',
          },
        }),
    );

    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    expect(client.instructions).toBe(
      'Use search tools to resolve IDs — never ask the user.',
    );
  });

  it('should expose undefined instructions when server omits them', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });

    expect(client.instructions).toBeUndefined();
  });

  it('should close transport when client is closed', async () => {
    const mockTransport = new MockMCPTransport();
    const closeSpy = vi.spyOn(mockTransport, 'close');
    createMockTransport.mockImplementation(() => mockTransport);
    const client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });
    await client.close();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should throw Abort Error if tool call request is aborted', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });
    const tools = await client.tools();
    const tool = tools['mock-tool'];
    const abortController = new AbortController();
    abortController.abort();
    await expect(
      tool.execute(
        { foo: 'bar' },
        {
          messages: [],
          toolCallId: '1',
          abortSignal: abortController.signal,
          context: {},
        },
      ),
    ).rejects.toSatisfy(
      error => error instanceof Error && error.name === 'AbortError',
    );
  });

  it('should reject in-flight tool call request when aborted', async () => {
    const transport = new HangingToolCallTransport();
    client = await createMCPClient({ transport });

    const abortController = new AbortController();
    const abortReason = new Error('abort after send');
    const toolCallPromise = client.callTool({
      name: 'hanging-tool',
      arguments: {},
      options: { signal: abortController.signal },
    });

    expect(
      transport.sentMessages.some(
        message => 'method' in message && message.method === 'tools/call',
      ),
    ).toBe(true);

    abortController.abort(abortReason);

    await expect(toolCallPromise).rejects.toSatisfy(
      error =>
        MCPClientError.isInstance(error) &&
        error.message === 'Request was aborted' &&
        error.cause === abortReason,
    );
    expect(
      (
        client as unknown as {
          responseHandlers: Map<number, unknown>;
        }
      ).responseHandlers.size,
    ).toBe(0);
  });

  describe('elicitation support', () => {
    it('should handle elicitation requests from the server', async () => {
      client = await createMCPClient({
        transport: { type: 'sse', url: 'https://example.com/sse' },
        capabilities: {
          elicitation: {},
        },
      });

      const transportInstance = createMockTransport.mock.results.at(-1)
        ?.value as MockMCPTransport;
      const sendSpy = vi.spyOn(transportInstance, 'send');
      const handler = vi.fn(async () => ({
        action: 'accept' as const,
        content: {
          name: 'octocat',
        },
      }));

      client.onElicitationRequest(ElicitationRequestSchema, handler);

      const elicitationRequest = {
        jsonrpc: '2.0' as const,
        id: 42,
        method: 'elicitation/create' as const,
        params: {
          message: 'Please provide your GitHub username',
          requestedSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
      };

      transportInstance.onmessage?.(elicitationRequest);

      await Promise.resolve();
      await Promise.resolve();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            message: elicitationRequest.params.message,
            requestedSchema: elicitationRequest.params.requestedSchema,
          },
        }),
      );

      const elicitationResponse = sendSpy.mock.calls.find(
        ([message]) =>
          'result' in message && message.id === elicitationRequest.id,
      );

      expect(elicitationResponse?.[0]).toMatchObject({
        jsonrpc: '2.0',
        id: elicitationRequest.id,
        result: {
          action: 'accept',
          content: {
            name: 'octocat',
          },
        },
      });
    });
  });

  describe('ping support', () => {
    it('should respond to ping requests with an empty result per MCP spec', async () => {
      client = await createMCPClient({
        transport: { type: 'sse', url: 'https://example.com/sse' },
      });

      const transportInstance = createMockTransport.mock.results.at(-1)
        ?.value as MockMCPTransport;
      const sendSpy = vi.spyOn(transportInstance, 'send');

      const pingRequest = {
        jsonrpc: '2.0' as const,
        id: 99,
        method: 'ping' as const,
      };

      transportInstance.onmessage?.(pingRequest);

      await Promise.resolve();
      await Promise.resolve();

      const pingResponse = sendSpy.mock.calls.find(
        ([message]) => 'id' in message && message.id === 99,
      );

      expect(pingResponse?.[0]).toMatchObject({
        jsonrpc: '2.0',
        id: 99,
        result: {},
      });
    });
  });

  it('should use onUncaughtError callback if provided', async () => {
    const onUncaughtError = vi.fn();
    const mockTransport = new MockMCPTransport({
      sendError: true,
    });
    createMockTransport.mockImplementation(() => mockTransport);
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
      onUncaughtError,
    });
    expect(onUncaughtError).toHaveBeenCalled();
  });

  it('should support custom transports', async () => {
    const mockTransport = new MockMCPTransport();
    client = await createMCPClient({
      transport: mockTransport,
    });
    const tools = await client.tools({
      schemas: {
        'mock-tool': {
          inputSchema: z.object({
            foo: z.string(),
          }),
        },
      },
    });
    expect(tools).toHaveProperty('mock-tool');
    const tool = tools['mock-tool'];

    type ToolParams = Parameters<typeof tool.execute>[0];
    expectTypeOf<ToolParams>().toEqualTypeOf<{ foo: string }>();

    const result = await tool.execute(
      { foo: 'bar' },
      {
        messages: [],
        toolCallId: '1',
        context: {},
      },
    );

    expectTypeOf<
      Exclude<typeof result, AsyncIterable<any>>
    >().toEqualTypeOf<CallToolResult>();
  });

  it('should throw if transport is missing required methods', async () => {
    // Because isCustomMcpTransport will return false, the client will fallback to createMcpTransport, but it will throw because the transport is invalid:
    const invalidTransport = {
      start: vi.fn(),
      close: vi.fn(),
    };
    // @ts-expect-error - invalid transport
    createMockTransport.mockImplementation(() => invalidTransport);
    await expect(
      // @ts-expect-error - invalid transport
      createMCPClient({ transport: invalidTransport }),
    ).rejects.toThrow();
  });

  it('should support zero-argument tools', async () => {
    client = await createMCPClient({
      transport: { type: 'sse', url: 'https://example.com/sse' },
    });
    const tools = await client.tools();
    const tool = tools['mock-tool-no-args'];
    expect(tool).toHaveProperty('inputSchema');
    expect(tool.inputSchema).toMatchObject({
      jsonSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    });

    const result = await tool.execute(
      {},
      { messages: [], toolCallId: '1', context: {} },
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "Mock tool call result",
            "type": "text",
          },
        ],
        "isError": false,
      }
    `);
  });

  it('should use custom client version when provided', async () => {
    const mockTransport = new MockMCPTransport();
    let capturedClientInfo: { name: string; version: string } | undefined;

    const originalSend = mockTransport.send.bind(mockTransport);
    mockTransport.send = vi.fn(async (message: JSONRPCRequest) => {
      if (message.method === 'initialize' && message.params) {
        capturedClientInfo = message.params.clientInfo as Configuration;
      }
      return originalSend(message);
    });

    client = await createMCPClient({
      transport: mockTransport,
      version: '2.5.0',
    });

    expect(capturedClientInfo).toBeDefined();
    expect(capturedClientInfo?.version).toBe('2.5.0');
  });

  it('should use clientName for client info when provided', async () => {
    const mockTransport = new MockMCPTransport();
    let capturedClientInfo: { name: string; version: string } | undefined;

    const originalSend = mockTransport.send.bind(mockTransport);
    mockTransport.send = vi.fn(async (message: JSONRPCRequest) => {
      if (message.method === 'initialize' && message.params) {
        capturedClientInfo = message.params.clientInfo as Configuration;
      }
      return originalSend(message);
    });

    client = await createMCPClient({
      transport: mockTransport,
      clientName: 'CustomMCPClient',
    });

    expect(capturedClientInfo).toBeDefined();
    expect(capturedClientInfo?.name).toBe('CustomMCPClient');
  });

  it('should prefer clientName over deprecated name for client info', async () => {
    const mockTransport = new MockMCPTransport();
    let capturedClientInfo: { name: string; version: string } | undefined;

    const originalSend = mockTransport.send.bind(mockTransport);
    mockTransport.send = vi.fn(async (message: JSONRPCRequest) => {
      if (message.method === 'initialize' && message.params) {
        capturedClientInfo = message.params.clientInfo as Configuration;
      }
      return originalSend(message);
    });

    client = await createMCPClient({
      transport: mockTransport,
      clientName: 'CustomMCPClient',
      name: 'DeprecatedMCPServer',
    });

    expect(capturedClientInfo).toBeDefined();
    expect(capturedClientInfo?.name).toBe('CustomMCPClient');
  });

  it('should use default version when not provided', async () => {
    const mockTransport = new MockMCPTransport();
    let capturedClientInfo: { name: string; version: string } | undefined;

    const originalSend = mockTransport.send.bind(mockTransport);
    mockTransport.send = vi.fn(async (message: JSONRPCRequest) => {
      if (message.method === 'initialize' && message.params) {
        capturedClientInfo = message.params.clientInfo as Configuration;
      }
      return originalSend(message);
    });

    client = await createMCPClient({
      transport: mockTransport,
    });

    expect(capturedClientInfo).toBeDefined();
    expect(capturedClientInfo?.version).toBe('1.0.0');
  });

  describe('outputSchema support', () => {
    it('should return typed output when outputSchema is provided with structuredContent', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'weather-tool',
            description: 'Get weather data',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
            outputSchema: {
              type: 'object',
              properties: {
                temperature: { type: 'number' },
                conditions: { type: 'string' },
              },
            },
          },
        ],
        toolCallResults: {
          'weather-tool': {
            content: [
              {
                type: 'text',
                text: '{"temperature": 22.5, "conditions": "Sunny"}',
              },
            ],
            structuredContent: {
              temperature: 22.5,
              conditions: 'Sunny',
            },
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'weather-tool': {
            inputSchema: z.object({
              location: z.string(),
            }),
            outputSchema: z.object({
              temperature: z.number(),
              conditions: z.string(),
            }),
          },
        },
      });

      const tool = tools['weather-tool'];

      type ToolInput = Parameters<typeof tool.execute>[0];
      expectTypeOf<ToolInput>().toEqualTypeOf<{ location: string }>();

      const result = await tool.execute(
        { location: 'New York' },
        { messages: [], toolCallId: '1', context: {} },
      );

      expectTypeOf<Exclude<typeof result, AsyncIterable<any>>>().toEqualTypeOf<{
        temperature: number;
        conditions: string;
      }>();

      expect(result).toEqual({
        temperature: 22.5,
        conditions: 'Sunny',
      });
    });

    it('should fallback to parsing text content when structuredContent is not present', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'json-tool',
            description: 'Returns JSON data',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        toolCallResults: {
          'json-tool': {
            content: [
              {
                type: 'text',
                text: '{"value": 42, "name": "test"}',
              },
            ],
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'json-tool': {
            inputSchema: z.object({}),
            outputSchema: z.object({
              value: z.number(),
              name: z.string(),
            }),
          },
        },
      });

      const result = await tools['json-tool'].execute(
        {},
        { messages: [], toolCallId: '1', context: {} },
      );

      expect(result).toEqual({
        value: 42,
        name: 'test',
      });
    });

    it('should return CallToolResult when outputSchema is not provided', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'untyped-tool',
            description: 'Returns untyped data',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string' },
              },
            },
          },
        ],
        toolCallResults: {
          'untyped-tool': {
            content: [
              {
                type: 'text',
                text: 'Some text result',
              },
            ],
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'untyped-tool': {
            inputSchema: z.object({
              input: z.string(),
            }),
            // No outputSchema - should return CallToolResult
          },
        },
      });

      const tool = tools['untyped-tool'];

      const result = await tool.execute(
        { input: 'test' },
        { messages: [], toolCallId: '1', context: {} },
      );

      expectTypeOf<
        Exclude<typeof result, AsyncIterable<any>>
      >().toEqualTypeOf<CallToolResult>();

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Some text result',
          },
        ],
        isError: false,
      });
    });

    it('should throw error when structuredContent does not match outputSchema', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'bad-output-tool',
            description: 'Returns mismatched data',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        toolCallResults: {
          'bad-output-tool': {
            content: [
              {
                type: 'text',
                text: '{"wrong": "data"}',
              },
            ],
            structuredContent: {
              wrong: 'data',
            },
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'bad-output-tool': {
            inputSchema: z.object({}),
            outputSchema: z.object({
              expected: z.number(),
            }),
          },
        },
      });

      await expect(
        tools['bad-output-tool'].execute(
          {},
          { messages: [], toolCallId: '1', context: {} },
        ),
      ).rejects.toThrow(MCPClientError);
    });

    it('should throw error when text content is not valid JSON but outputSchema is provided', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'invalid-json-tool',
            description: 'Returns invalid JSON',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        toolCallResults: {
          'invalid-json-tool': {
            content: [
              {
                type: 'text',
                text: 'not valid json',
              },
            ],
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'invalid-json-tool': {
            inputSchema: z.object({}),
            outputSchema: z.object({
              value: z.string(),
            }),
          },
        },
      });

      await expect(
        tools['invalid-json-tool'].execute(
          {},
          { messages: [], toolCallId: '1', context: {} },
        ),
      ).rejects.toThrow(MCPClientError);
    });

    it('should throw error when parsed JSON does not match outputSchema', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'mismatched-json-tool',
            description: 'Returns JSON that does not match schema',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        toolCallResults: {
          'mismatched-json-tool': {
            content: [
              {
                type: 'text',
                text: '{"differentField": "value"}',
              },
            ],
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'mismatched-json-tool': {
            inputSchema: z.object({}),
            outputSchema: z.object({
              requiredField: z.string(),
            }),
          },
        },
      });

      await expect(
        tools['mismatched-json-tool'].execute(
          {},
          { messages: [], toolCallId: '1', context: {} },
        ),
      ).rejects.toThrow(MCPClientError);
    });

    it('should work with automatic schema discovery (no outputSchema)', async () => {
      client = await createMCPClient({
        transport: { type: 'sse', url: 'https://example.com/sse' },
      });

      const tools = await client.tools(); // automatic schema discovery

      const result = await tools['mock-tool'].execute(
        { foo: 'bar' },
        { messages: [], toolCallId: '1', context: {} },
      );

      // With automatic discovery, result is CallToolResult
      expectTypeOf<
        Exclude<typeof result, AsyncIterable<any>>
      >().toEqualTypeOf<CallToolResult>();
      expect(result).toMatchObject({
        content: [{ type: 'text', text: 'Mock tool call result' }],
      });
    });

    it('should handle complex nested outputSchema', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'complex-tool',
            description: 'Returns complex nested data',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        toolCallResults: {
          'complex-tool': {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  users: [
                    { id: 1, name: 'Alice' },
                    { id: 2, name: 'Bob' },
                  ],
                  metadata: {
                    total: 2,
                    page: 1,
                  },
                }),
              },
            ],
            structuredContent: {
              users: [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
              ],
              metadata: {
                total: 2,
                page: 1,
              },
            },
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'complex-tool': {
            inputSchema: z.object({}),
            outputSchema: z.object({
              users: z.array(
                z.object({
                  id: z.number(),
                  name: z.string(),
                }),
              ),
              metadata: z.object({
                total: z.number(),
                page: z.number(),
              }),
            }),
          },
        },
      });

      const result = await tools['complex-tool'].execute(
        {},
        { messages: [], toolCallId: '1', context: {} },
      );

      expect(result).toEqual({
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        metadata: {
          total: 2,
          page: 1,
        },
      });
    });

    it('should bypass outputSchema validation when isError is true', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'error-tool',
            description: 'A tool that can error',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        ],
        toolCallResults: {
          'error-tool': {
            content: [
              {
                type: 'text',
                text: 'Workflow with name "test" already exists',
              },
            ],
            isError: true,
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'error-tool': {
            inputSchema: z.object({
              name: z.string(),
            }),
            outputSchema: z.object({
              id: z.number(),
              status: z.string(),
            }),
          },
        },
      });

      const result = await tools['error-tool'].execute(
        { name: 'test' },
        { messages: [], toolCallId: '1', context: {} },
      );

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Workflow with name "test" already exists',
          },
        ],
        isError: true,
      });
    });

    it('should bypass outputSchema validation for isError with structuredContent', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'error-structured-tool',
            description: 'A tool that errors with structuredContent',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        toolCallResults: {
          'error-structured-tool': {
            content: [
              {
                type: 'text',
                text: 'Something went wrong',
              },
            ],
            structuredContent: {
              error_code: 'DUPLICATE',
              message: 'Already exists',
            },
            isError: true,
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'error-structured-tool': {
            inputSchema: z.object({}),
            outputSchema: z.object({
              id: z.number(),
              status: z.string(),
            }),
          },
        },
      });

      const result = await tools['error-structured-tool'].execute(
        {},
        { messages: [], toolCallId: '1', context: {} },
      );

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: 'Something went wrong',
          },
        ],
        structuredContent: {
          error_code: 'DUPLICATE',
          message: 'Already exists',
        },
        isError: true,
      });
    });

    it('should still validate outputSchema when isError is false', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'non-error-tool',
            description: 'Returns bad data without error flag',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
        toolCallResults: {
          'non-error-tool': {
            content: [
              {
                type: 'text',
                text: 'not valid json',
              },
            ],
            isError: false,
          },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'non-error-tool': {
            inputSchema: z.object({}),
            outputSchema: z.object({
              value: z.string(),
            }),
          },
        },
      });

      await expect(
        tools['non-error-tool'].execute(
          {},
          { messages: [], toolCallId: '1', context: {} },
        ),
      ).rejects.toThrow(MCPClientError);
    });
  });

  describe('tool title support', () => {
    it('should use top-level title when provided (MCP spec-compliant)', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'titled-tool',
            title: 'My Tool Title',
            description: 'A tool with a title',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools();
      expect(tools['titled-tool'].title).toBe('My Tool Title');
      expect(tools['titled-tool'].metadata).toEqual({
        clientName: 'ai-sdk-mcp-client',
        title: 'My Tool Title',
        toolName: 'titled-tool',
      });
    });

    it('should fallback to annotations.title for backward compatibility', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'annotated-tool',
            description: 'A tool with title in annotations',
            inputSchema: {
              type: 'object',
              properties: {},
            },
            annotations: {
              title: 'Annotation Title',
            },
          },
        ],
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools();
      expect(tools['annotated-tool'].title).toBe('Annotation Title');
      expect(tools['annotated-tool'].metadata).toMatchObject({
        title: 'Annotation Title',
        toolName: 'annotated-tool',
      });
    });

    it('should prefer top-level title over annotations.title when both present', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'dual-title-tool',
            title: 'Top Level Title',
            description: 'A tool with both titles',
            inputSchema: {
              type: 'object',
              properties: {},
            },
            annotations: {
              title: 'Annotation Title',
            },
          },
        ],
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools();
      expect(tools['dual-title-tool'].title).toBe('Top Level Title');
    });

    it('should have undefined title when neither top-level nor annotations.title provided', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'no-title-tool',
            description: 'A tool without any title',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools();
      expect(tools['no-title-tool'].title).toBeUndefined();
      expect(tools['no-title-tool'].metadata).toEqual({
        clientName: 'ai-sdk-mcp-client',
        toolName: 'no-title-tool',
      });
    });

    it('should pass title through to typed tools with schemas', async () => {
      const mockTransport = new MockMCPTransport({
        overrideTools: [
          {
            name: 'typed-titled-tool',
            title: 'Typed Tool Title',
            description: 'A typed tool with a title',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string' },
              },
            },
          },
        ],
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      const tools = await client.tools({
        schemas: {
          'typed-titled-tool': {
            inputSchema: z.object({
              input: z.string(),
            }),
          },
        },
      });

      expect(tools['typed-titled-tool'].title).toBe('Typed Tool Title');
      expect(tools['typed-titled-tool'].metadata).toEqual({
        clientName: 'ai-sdk-mcp-client',
        title: 'Typed Tool Title',
        toolName: 'typed-titled-tool',
      });
    });
  });

  describe('protocol version negotiation', () => {
    it('should set protocolVersion on transport after successful init', async () => {
      const mockTransport = new MockMCPTransport();

      client = await createMCPClient({
        transport: mockTransport,
      });

      // The mock transport returns LATEST_PROTOCOL_VERSION by default
      expect(mockTransport.protocolVersion).toBe(
        (await import('./types')).LATEST_PROTOCOL_VERSION,
      );
    });

    it('should set negotiated protocolVersion on transport when server downgrades', async () => {
      const mockTransport = new MockMCPTransport({
        initializeResult: {
          protocolVersion: '2025-06-18',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: { tools: {} },
        },
      });

      client = await createMCPClient({
        transport: mockTransport,
      });

      expect(mockTransport.protocolVersion).toBe('2025-06-18');
    });

    it('should support transports with getter-only protocolVersion and setProtocolVersion', async () => {
      const transport = new GetterOnlyProtocolVersionTransport('2025-06-18');

      client = await createMCPClient({
        transport,
      });

      expect(transport.protocolVersion).toBe('2025-06-18');
    });
  });
});
