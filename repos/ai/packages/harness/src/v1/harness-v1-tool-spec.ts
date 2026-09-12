import type { JSONSchema7 } from '@ai-sdk/provider';

/**
 * Description of a host-defined tool that the harness should make available
 * to the underlying agent runtime.
 *
 * Adapters translate this into whatever shape their runtime expects (e.g.
 * Claude Code's tool definitions, Codex CLI's tool config, an MCP server
 * exposed to the runtime, …). The adapter does not execute the tool; when
 * the runtime calls it, the adapter emits a `tool-call` event and waits for
 * `submitToolResult` from the caller.
 */
export type HarnessV1ToolSpec = {
  /**
   * Tool name the agent runtime sees. Must match the name on incoming
   * `tool-call` events.
   */
  readonly name: string;

  /**
   * Human-readable description handed to the runtime, used to help the model
   * decide when to call the tool.
   */
  readonly description?: string;

  /**
   * JSON Schema describing the expected input for the tool. Optional because
   * some runtimes accept tools without schemas (free-form arguments).
   */
  readonly inputSchema?: JSONSchema7;
};
