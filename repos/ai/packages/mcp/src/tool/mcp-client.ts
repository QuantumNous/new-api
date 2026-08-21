import type { JSONObject, JSONSchema7, JSONValue } from '@ai-sdk/provider';
import {
  asSchema,
  dynamicTool,
  jsonSchema,
  retryWithExponentialBackoff,
  safeParseJSON,
  safeValidateTypes,
  tool,
  type FlexibleSchema,
  type Tool,
  type ToolExecutionOptions,
  type ToolResultOutput,
} from '@ai-sdk/provider-utils';
import type { z } from 'zod/v4';
import { MCPClientError } from '../error/mcp-client-error';
import type {
  JSONRPCError,
  JSONRPCNotification,
  JSONRPCRequest,
  JSONRPCResponse,
} from './json-rpc-message';
import {
  createMcpTransport,
  isCustomMcpTransport,
  type MCPTransport,
  type MCPTransportConfig,
} from './mcp-transport';
import { getMCPAppToolMeta, MCP_APP_MIME_TYPE } from './mcp-apps';
import {
  CallToolResultSchema,
  CompleteResultSchema,
  ElicitationRequestSchema,
  ElicitResultSchema,
  InitializeResultSchema,
  LATEST_PROTOCOL_VERSION,
  ListResourceTemplatesResultSchema,
  ListResourcesResultSchema,
  ListPromptsResultSchema,
  ListToolsResultSchema,
  ReadResourceResultSchema,
  GetPromptResultSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  type CallToolResult,
  type ClientCapabilities,
  type CompleteRequestParams,
  type CompleteResult,
  type Configuration,
  type Configuration as ClientConfiguration,
  type ElicitationRequest,
  type ElicitResult,
  type ListResourceTemplatesResult,
  type ListResourcesResult,
  type ListPromptsResult,
  type ListToolsResult,
  type McpToolSet,
  type Notification,
  type PaginatedRequest,
  type ReadResourceResult,
  type GetPromptResult,
  type Request,
  type RequestOptions,
  type ServerCapabilities,
  type ToolSchemas,
  type ToolMeta,
  type McpProviderMetadata,
  type InitializeResult,
} from './types';
const CLIENT_VERSION = '1.0.0';
const DEFAULT_MAX_TOOL_CALL_RETRIES = 0;

const DEFAULT_RETRY_ERROR_CODES = [
  'ConnectionRefused',
  'ConnectionClosed',
  'FailedToOpenSocket',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
];

function getErrorStatusCode(error: unknown): number | undefined {
  if (
    error != null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }

  return undefined;
}

function getStringErrorCode(error: unknown): string | undefined {
  if (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return undefined;
}

function isRetryableMCPToolCallError(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);
  if (statusCode != null) {
    return (
      statusCode === 408 ||
      statusCode === 409 ||
      statusCode === 429 ||
      statusCode >= 500
    );
  }

  if (MCPClientError.isInstance(error) && error.code != null) {
    return false;
  }

  const errorCode = getStringErrorCode(error);
  return errorCode != null && DEFAULT_RETRY_ERROR_CODES.includes(errorCode);
}

function prepareMaxRetries(maxRetries: number | undefined): number {
  if (maxRetries == null) {
    return DEFAULT_MAX_TOOL_CALL_RETRIES;
  }

  if (!Number.isInteger(maxRetries)) {
    throw new MCPClientError({
      message: 'maxRetries must be an integer',
    });
  }

  if (maxRetries < 0) {
    throw new MCPClientError({
      message: 'maxRetries must be >= 0',
    });
  }

  return maxRetries;
}

function mcpToModelOutput({
  output,
}: {
  toolCallId: string;
  input: unknown;
  output: unknown;
}): ToolResultOutput {
  const result = output as CallToolResult;

  if (!('content' in result) || !Array.isArray(result.content)) {
    return { type: 'json', value: result as JSONValue };
  }

  const convertedContent = result.content.map(
    (part: { type: string; [key: string]: unknown }) => {
      if (part.type === 'text' && 'text' in part) {
        return { type: 'text' as const, text: part.text as string };
      }
      if (part.type === 'image' && 'data' in part && 'mimeType' in part) {
        return {
          type: 'file' as const,
          mediaType: part.mimeType as string,
          data: { type: 'data' as const, data: part.data as string },
        };
      }
      return { type: 'text' as const, text: JSON.stringify(part) };
    },
  );

  return { type: 'content', value: convertedContent };
}

export interface MCPClientConfig {
  /** Transport configuration for connecting to the MCP server */
  transport: MCPTransportConfig | MCPTransport;
  /** Optional callback for uncaught errors */
  onUncaughtError?: (error: unknown) => void;
  /**
   * Maximum number of retries for transient MCP tool call failures.
   *
   * Set to 0 to disable retries. Retries only apply to tools/call requests.
   * JSON-RPC application errors, such as invalid params, are not retried.
   *
   * @default 0
   */
  maxRetries?: number;
  /**
   * Initialize result from a previous MCP session. When provided, the client
   * starts the transport and reuses this metadata without sending a new
   * initialize request.
   */
  initialInitializeResult?: InitializeResult;
  /** Optional client name, defaults to 'ai-sdk-mcp-client' */
  clientName?: string;
  /**
   * Optional client name, defaults to 'ai-sdk-mcp-client'
   *
   * @deprecated Use `clientName` instead.
   */
  name?: string;
  /** Optional client version, defaults to '1.0.0' */
  version?: string;
  /**
   * Optional client capabilities to advertise during initialization
   *
   * NOTE: It is up to the client application to handle the requests properly. This parameter just helps surface the request from the server
   */
  capabilities?: ClientCapabilities;
}

export async function createMCPClient(
  config: MCPClientConfig,
): Promise<MCPClient> {
  const client = new DefaultMCPClient(config);
  await client.init();
  return client;
}

export interface MCPClient {
  /**
   * Information about the connected MCP server, as reported during initialization.
   * @see https://modelcontextprotocol.io/specification/2025-11-25/schema#implementation
   */
  readonly serverInfo: Configuration;

  /**
   * The full initialize result used by this client, either from the server
   * during initialization or from `initialInitializeResult`.
   */
  readonly initializeResult: InitializeResult;

  /**
   * Optional instructions provided by the server during the initialize handshake.
   *
   * These describe how to use the server and its features, and can be used by clients
   * to improve LLM interactions (e.g. by including them in the system prompt).
   *
   * @see https://modelcontextprotocol.io/specification/2025-11-25/schema#initializeresult
   */
  readonly instructions?: string;

  tools<TOOL_SCHEMAS extends ToolSchemas = 'automatic'>(options?: {
    schemas?: TOOL_SCHEMAS;
  }): Promise<McpToolSet<TOOL_SCHEMAS>>;

  /**
   * Lists available tools from the MCP server.
   */
  listTools(options?: {
    params?: PaginatedRequest['params'];
    options?: RequestOptions;
  }): Promise<ListToolsResult>;

  /**
   * Calls a tool on the MCP server.
   */
  callTool(args: {
    name: string;
    arguments?: Record<string, unknown>;
    options?: RequestOptions;
  }): Promise<CallToolResult>;

  /**
   * Creates AI SDK tools from tool definitions.
   */
  toolsFromDefinitions<TOOL_SCHEMAS extends ToolSchemas = 'automatic'>(
    definitions: ListToolsResult,
    options?: { schemas?: TOOL_SCHEMAS },
  ): McpToolSet<TOOL_SCHEMAS>;

  listResources(options?: {
    params?: PaginatedRequest['params'];
    options?: RequestOptions;
  }): Promise<ListResourcesResult>;

  readResource(args: {
    uri: string;
    options?: RequestOptions;
  }): Promise<ReadResourceResult>;

  listResourceTemplates(options?: {
    options?: RequestOptions;
  }): Promise<ListResourceTemplatesResult>;

  experimental_listPrompts(options?: {
    params?: PaginatedRequest['params'];
    options?: RequestOptions;
  }): Promise<ListPromptsResult>;

  experimental_getPrompt(args: {
    name: string;
    arguments?: Record<string, unknown>;
    options?: RequestOptions;
  }): Promise<GetPromptResult>;

  complete(
    args: CompleteRequestParams & {
      options?: RequestOptions;
    },
  ): Promise<CompleteResult>;

  onElicitationRequest(
    schema: typeof ElicitationRequestSchema,
    handler: (
      request: ElicitationRequest,
    ) => Promise<ElicitResult> | ElicitResult,
  ): void;

  close: () => Promise<void>;
}

/**
 * A lightweight MCP Client implementation
 *
 * The primary purpose of this client is tool conversion between MCP<>AI SDK
 * but can later be extended to support other MCP features
 *
 * Tool parameters are automatically inferred from the server's JSON schema
 * if not explicitly provided in the tools configuration
 *
 * This client is meant to be used to communicate with a single server. To communicate and fetch tools across multiple servers, it's recommended to create a new client instance per server.
 *
 * Not supported:
 * - Accepting notifications
 * - Automatic session persistence for Streamable HTTP transport
 * - Resumable SSE streams
 */
class DefaultMCPClient implements MCPClient {
  private transport: MCPTransport;
  private onUncaughtError?: (error: unknown) => void;
  private maxRetries: number;
  private clientInfo: ClientConfiguration;
  private clientCapabilities: ClientCapabilities;
  private initialInitializeResult?: InitializeResult;
  private requestMessageId = 0;
  private responseHandlers: Map<
    number,
    (response: JSONRPCResponse | Error) => void
  > = new Map();
  private serverCapabilities: ServerCapabilities = {};
  private _serverInfo: Configuration = { name: '', version: '' };
  private _initializeResult: InitializeResult = {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    capabilities: {},
    serverInfo: this._serverInfo,
  };
  private _serverInstructions?: string;
  private isClosed = true;
  private elicitationRequestHandler?: (
    request: ElicitationRequest,
  ) => Promise<ElicitResult> | ElicitResult;

  constructor({
    transport: transportConfig,
    name,
    clientName = name ?? 'ai-sdk-mcp-client',
    version = CLIENT_VERSION,
    onUncaughtError,
    maxRetries,
    capabilities,
    initialInitializeResult,
  }: MCPClientConfig) {
    this.onUncaughtError = onUncaughtError;
    this.maxRetries = prepareMaxRetries(maxRetries);
    this.clientCapabilities = capabilities ?? {};
    this.initialInitializeResult = initialInitializeResult;

    if (isCustomMcpTransport(transportConfig)) {
      this.transport = transportConfig;
    } else {
      this.transport = createMcpTransport(transportConfig);
    }

    this.transport.onclose = () => this.onClose();
    this.transport.onerror = (error: Error) => this.onError(error);
    this.transport.onmessage = message => {
      if ('method' in message) {
        if ('id' in message) {
          this.onRequestMessage(message);
        } else {
          this.onError(
            new MCPClientError({
              message: 'Unsupported message type',
            }),
          );
        }
        return;
      }

      this.onResponse(message);
    };

    this.clientInfo = {
      name: clientName,
      version,
    };
  }

  get serverInfo(): Configuration {
    return this._serverInfo;
  }

  get initializeResult(): InitializeResult {
    return this._initializeResult;
  }

  get instructions(): string | undefined {
    return this._serverInstructions;
  }

  async init(): Promise<this> {
    try {
      await this.transport.start();
      this.isClosed = false;

      if (this.initialInitializeResult) {
        const result = InitializeResultSchema.parse(
          this.initialInitializeResult,
        );
        this.applyInitializeResult(result);
        return this;
      }

      const result = await this.request({
        request: {
          method: 'initialize',
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: this.clientCapabilities,
            clientInfo: this.clientInfo,
          },
        },
        resultSchema: InitializeResultSchema,
      });

      if (result === undefined) {
        throw new MCPClientError({
          message: 'Server sent invalid initialize result',
        });
      }

      this.applyInitializeResult(result);

      // Complete initialization handshake:
      await this.notification({
        method: 'notifications/initialized',
      });

      return this;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  private applyInitializeResult(result: InitializeResult): void {
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
      throw new MCPClientError({
        message: `Server's protocol version is not supported: ${result.protocolVersion}`,
      });
    }

    this.serverCapabilities = result.capabilities;
    this._serverInfo = result.serverInfo;
    this._initializeResult = result;
    if (this.transport.setProtocolVersion) {
      this.transport.setProtocolVersion(result.protocolVersion);
    } else {
      this.transport.protocolVersion = result.protocolVersion;
    }
    this._serverInstructions = result.instructions;
  }

  async close(): Promise<void> {
    if (this.isClosed) return;
    await this.transport?.close();
    this.onClose();
  }

  private assertCapability(method: string): void {
    switch (method) {
      case 'initialize':
        break;
      case 'completion/complete':
        if (!this.serverCapabilities.completions) {
          throw new MCPClientError({
            message: `Server does not support completions`,
          });
        }
        break;
      case 'tools/list':
      case 'tools/call':
        if (!this.serverCapabilities.tools) {
          throw new MCPClientError({
            message: `Server does not support tools`,
          });
        }
        break;
      case 'resources/list':
      case 'resources/read':
      case 'resources/templates/list':
        if (!this.serverCapabilities.resources) {
          throw new MCPClientError({
            message: `Server does not support resources`,
          });
        }
        break;
      case 'prompts/list':
      case 'prompts/get':
        if (!this.serverCapabilities.prompts) {
          throw new MCPClientError({
            message: `Server does not support prompts`,
          });
        }
        break;
      default:
        throw new MCPClientError({
          message: `Unsupported method: ${method}`,
        });
    }
  }

  private async request<T extends z.ZodType<object>>({
    request,
    resultSchema,
    options,
  }: {
    request: Request;
    resultSchema: T;
    options?: RequestOptions;
  }): Promise<z.infer<T>> {
    return new Promise((resolve, reject) => {
      if (this.isClosed) {
        return reject(
          new MCPClientError({
            message: 'Attempted to send a request from a closed client',
          }),
        );
      }

      this.assertCapability(request.method);

      const signal = options?.signal;
      signal?.throwIfAborted();

      const messageId = this.requestMessageId++;
      const jsonrpcRequest: JSONRPCRequest = {
        ...request,
        jsonrpc: '2.0',
        id: messageId,
      };

      const rejectWithAbortError = () => {
        reject(
          new MCPClientError({
            message: 'Request was aborted',
            cause: signal?.reason,
          }),
        );
      };

      const cleanup = () => {
        this.responseHandlers.delete(messageId);
        signal?.removeEventListener('abort', onAbort);
      };

      const rejectAndCleanup = (error: unknown) => {
        cleanup();
        reject(error);
      };

      const onAbort = () => {
        cleanup();
        rejectWithAbortError();
      };

      this.responseHandlers.set(messageId, response => {
        if (signal?.aborted) {
          cleanup();
          return rejectWithAbortError();
        }

        if (response instanceof Error) {
          return rejectAndCleanup(response);
        }

        try {
          const result = resultSchema.parse(response.result);
          cleanup();
          resolve(result);
        } catch (error) {
          const parseError = new MCPClientError({
            message: 'Failed to parse server response',
            cause: error,
          });
          rejectAndCleanup(parseError);
        }
      });

      signal?.addEventListener('abort', onAbort, { once: true });

      this.transport.send(jsonrpcRequest).catch(error => {
        rejectAndCleanup(error);
      });
    });
  }

  async listTools({
    params,
    options,
  }: {
    params?: PaginatedRequest['params'];
    options?: RequestOptions;
  } = {}): Promise<ListToolsResult> {
    return this.request({
      request: { method: 'tools/list', params },
      resultSchema: ListToolsResultSchema,
      options,
    });
  }

  private async callToolWithRetry({
    options,
    execute,
  }: {
    options?: RequestOptions;
    execute: () => Promise<CallToolResult>;
  }): Promise<CallToolResult> {
    if (this.maxRetries === 0) {
      return execute();
    }

    return retryWithExponentialBackoff({
      maxRetries: this.maxRetries,
      abortSignal: options?.signal,
      shouldRetry: isRetryableMCPToolCallError,
      createRetryError: ({ message, errors }) =>
        new MCPClientError({
          message,
          cause: errors[errors.length - 1],
        }),
    })(execute);
  }

  async callTool({
    name,
    arguments: args = {},
    options,
  }: {
    name: string;
    arguments?: Record<string, unknown>;
    options?: RequestOptions;
  }): Promise<CallToolResult> {
    try {
      return this.callToolWithRetry({
        options,
        execute: () =>
          this.request({
            request: {
              method: 'tools/call',
              params: { name, arguments: args },
            },
            resultSchema: CallToolResultSchema,
            options,
          }),
      });
    } catch (error) {
      throw error;
    }
  }

  private async listResourcesInternal({
    params,
    options,
  }: {
    params?: PaginatedRequest['params'];
    options?: RequestOptions;
  } = {}): Promise<ListResourcesResult> {
    try {
      return this.request({
        request: { method: 'resources/list', params },
        resultSchema: ListResourcesResultSchema,
        options,
      });
    } catch (error) {
      throw error;
    }
  }

  private async readResourceInternal({
    uri,
    options,
  }: {
    uri: string;
    options?: RequestOptions;
  }): Promise<ReadResourceResult> {
    try {
      return this.request({
        request: { method: 'resources/read', params: { uri } },
        resultSchema: ReadResourceResultSchema,
        options,
      });
    } catch (error) {
      throw error;
    }
  }

  private async listResourceTemplatesInternal({
    options,
  }: {
    options?: RequestOptions;
  } = {}): Promise<ListResourceTemplatesResult> {
    try {
      return this.request({
        request: { method: 'resources/templates/list' },
        resultSchema: ListResourceTemplatesResultSchema,
        options,
      });
    } catch (error) {
      throw error;
    }
  }

  private async listPromptsInternal({
    params,
    options,
  }: {
    params?: PaginatedRequest['params'];
    options?: RequestOptions;
  } = {}): Promise<ListPromptsResult> {
    try {
      return this.request({
        request: { method: 'prompts/list', params },
        resultSchema: ListPromptsResultSchema,
        options,
      });
    } catch (error) {
      throw error;
    }
  }

  private async getPromptInternal({
    name,
    args,
    options,
  }: {
    name: string;
    args?: Record<string, unknown>;
    options?: RequestOptions;
  }): Promise<GetPromptResult> {
    try {
      return this.request({
        request: { method: 'prompts/get', params: { name, arguments: args } },
        resultSchema: GetPromptResultSchema,
        options,
      });
    } catch (error) {
      throw error;
    }
  }

  private async completeInternal({
    options,
    ...params
  }: CompleteRequestParams & {
    options?: RequestOptions;
  }): Promise<CompleteResult> {
    return this.request({
      request: { method: 'completion/complete', params },
      resultSchema: CompleteResultSchema,
      options,
    });
  }

  private async notification(notification: Notification): Promise<void> {
    const jsonrpcNotification: JSONRPCNotification = {
      ...notification,
      jsonrpc: '2.0',
    };
    await this.transport.send(jsonrpcNotification);
  }

  /**
   * Returns a set of AI SDK tools from the MCP server.
   * This fetches tool definitions and wraps them with execute functions.
   * @returns A record of tool names to their implementations
   */
  async tools<TOOL_SCHEMAS extends ToolSchemas = 'automatic'>({
    schemas = 'automatic',
  }: {
    schemas?: TOOL_SCHEMAS;
  } = {}): Promise<McpToolSet<TOOL_SCHEMAS>> {
    const definitions = await this.listTools();
    return this.toolsFromDefinitions(definitions, {
      schemas,
    } as { schemas?: TOOL_SCHEMAS });
  }

  /**
   * Creates AI SDK tools from tool definitions without fetching from the server.
   */
  toolsFromDefinitions<TOOL_SCHEMAS extends ToolSchemas = 'automatic'>(
    definitions: ListToolsResult,
    { schemas = 'automatic' }: { schemas?: TOOL_SCHEMAS } = {} as {
      schemas?: TOOL_SCHEMAS;
    },
  ): McpToolSet<TOOL_SCHEMAS> {
    const tools: Record<string, Tool & { _meta?: ToolMeta }> = {};

    for (const {
      name,
      title,
      description,
      inputSchema,
      annotations,
      _meta,
    } of definitions.tools) {
      const resolvedTitle = title ?? annotations?.title;
      if (
        schemas !== 'automatic' &&
        !Object.prototype.hasOwnProperty.call(schemas, name)
      ) {
        continue;
      }

      const self = this;
      const outputSchema =
        schemas !== 'automatic' ? schemas[name]?.outputSchema : undefined;
      const appMeta = getMCPAppToolMeta({ _meta });
      const metadata = {
        clientName: this.clientInfo.name,
        toolName: name,
        ...(resolvedTitle != null ? { title: resolvedTitle } : {}),
        ...(appMeta?.resourceUri != null
          ? {
              app: {
                ...appMeta,
                mimeType: MCP_APP_MIME_TYPE,
              } as JSONObject,
            }
          : {}),
      } satisfies McpProviderMetadata;

      const execute = async (
        args: any,
        options: ToolExecutionOptions<{}>,
      ): Promise<unknown> => {
        options?.abortSignal?.throwIfAborted();
        const result = await self.callTool({
          name,
          arguments: args,
          options: { signal: options?.abortSignal },
        });

        if (result.isError) {
          return result;
        }

        if (outputSchema != null) {
          return self.extractStructuredContent(result, outputSchema, name);
        }

        return result;
      };

      const toolWithExecute =
        schemas === 'automatic'
          ? dynamicTool({
              description,
              title: resolvedTitle,
              metadata,
              inputSchema: jsonSchema({
                ...inputSchema,
                properties: inputSchema.properties ?? {},
                additionalProperties: false,
              } as JSONSchema7),
              execute,
              toModelOutput: mcpToModelOutput,
            })
          : tool({
              description,
              title: resolvedTitle,
              metadata,
              inputSchema: schemas[name].inputSchema,
              ...(outputSchema != null ? { outputSchema } : {}),
              execute,
              toModelOutput: mcpToModelOutput,
            });

      tools[name] = { ...toolWithExecute, _meta };
    }

    return tools as McpToolSet<TOOL_SCHEMAS>;
  }

  /**
   * Extracts and validates structuredContent from a tool result.
   */
  private async extractStructuredContent(
    result: CallToolResult,
    outputSchema: FlexibleSchema<unknown>,
    toolName: string,
  ): Promise<unknown> {
    if ('structuredContent' in result && result.structuredContent != null) {
      const validationResult = await safeValidateTypes({
        value: result.structuredContent,
        schema: asSchema(outputSchema),
      });

      if (!validationResult.success) {
        throw new MCPClientError({
          message: `Tool "${toolName}" returned structuredContent that does not match the expected outputSchema`,
          cause: validationResult.error,
        });
      }

      return validationResult.value;
    }

    // Fallback
    if ('content' in result && Array.isArray(result.content)) {
      const textContent = result.content.find(c => c.type === 'text');
      if (textContent && 'text' in textContent) {
        const parseResult = await safeParseJSON({
          text: textContent.text,
          schema: outputSchema,
        });

        if (!parseResult.success) {
          throw new MCPClientError({
            message: `Tool "${toolName}" returned content that does not match the expected outputSchema`,
            cause: parseResult.error,
          });
        }

        return parseResult.value;
      }
    }

    throw new MCPClientError({
      message: `Tool "${toolName}" did not return structuredContent or parseable text content`,
    });
  }

  listResources({
    params,
    options,
  }: {
    params?: PaginatedRequest['params'];
    options?: RequestOptions;
  } = {}): Promise<ListResourcesResult> {
    return this.listResourcesInternal({ params, options });
  }

  readResource({
    uri,
    options,
  }: {
    uri: string;
    options?: RequestOptions;
  }): Promise<ReadResourceResult> {
    return this.readResourceInternal({ uri, options });
  }

  listResourceTemplates({
    options,
  }: {
    options?: RequestOptions;
  } = {}): Promise<ListResourceTemplatesResult> {
    return this.listResourceTemplatesInternal({ options });
  }

  experimental_listPrompts({
    params,
    options,
  }: {
    params?: PaginatedRequest['params'];
    options?: RequestOptions;
  } = {}): Promise<ListPromptsResult> {
    return this.listPromptsInternal({ params, options });
  }

  experimental_getPrompt({
    name,
    arguments: args,
    options,
  }: {
    name: string;
    arguments?: Record<string, unknown>;
    options?: RequestOptions;
  }): Promise<GetPromptResult> {
    return this.getPromptInternal({ name, args, options });
  }

  complete(
    args: CompleteRequestParams & {
      options?: RequestOptions;
    },
  ): Promise<CompleteResult> {
    return this.completeInternal(args);
  }

  onElicitationRequest(
    schema: typeof ElicitationRequestSchema,
    handler: (
      request: ElicitationRequest,
    ) => Promise<ElicitResult> | ElicitResult,
  ): void {
    if (schema !== ElicitationRequestSchema) {
      throw new MCPClientError({
        message:
          'Unsupported request schema. Only ElicitationRequestSchema is supported.',
      });
    }

    this.elicitationRequestHandler = handler;
  }

  private async onRequestMessage(request: JSONRPCRequest): Promise<void> {
    try {
      if (request.method === 'ping') {
        await this.transport.send({
          jsonrpc: '2.0',
          id: request.id,
          result: {},
        });
        return;
      }

      if (request.method !== 'elicitation/create') {
        await this.transport.send({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Unsupported request method: ${request.method}`,
          },
        });
        return;
      }

      if (!this.elicitationRequestHandler) {
        await this.transport.send({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'No elicitation handler registered on client',
          },
        });
        return;
      }

      const parsedRequest = ElicitationRequestSchema.safeParse({
        method: request.method,
        params: request.params,
      });

      if (!parsedRequest.success) {
        await this.transport.send({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: `Invalid elicitation request: ${parsedRequest.error.message}`,
            data: parsedRequest.error.issues,
          },
        });
        return;
      }

      try {
        const result = await this.elicitationRequestHandler(parsedRequest.data);
        const validatedResult = ElicitResultSchema.parse(result);

        await this.transport.send({
          jsonrpc: '2.0',
          id: request.id,
          result: validatedResult,
        });
      } catch (error) {
        await this.transport.send({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message:
              error instanceof Error
                ? error.message
                : 'Failed to handle elicitation request',
          },
        });
        this.onError(error);
      }
    } catch (error) {
      this.onError(error);
    }
  }

  private onClose(): void {
    if (this.isClosed) return;

    this.isClosed = true;
    const error = new MCPClientError({
      message: 'Connection closed',
    });

    for (const handler of this.responseHandlers.values()) {
      handler(error);
    }

    this.responseHandlers.clear();
  }

  private onError(error: unknown): void {
    if (this.onUncaughtError) {
      this.onUncaughtError(error);
    }
  }

  private onResponse(response: JSONRPCResponse | JSONRPCError): void {
    const messageId = Number(response.id);
    const handler = this.responseHandlers.get(messageId);

    if (handler === undefined) {
      throw new MCPClientError({
        message: `Protocol error: Received a response for an unknown message ID: ${JSON.stringify(
          response,
        )}`,
      });
    }

    this.responseHandlers.delete(messageId);

    handler(
      'result' in response
        ? response
        : new MCPClientError({
            message: response.error.message,
            code: response.error.code,
            data: response.error.data,
            cause: response.error,
          }),
    );
  }
}
