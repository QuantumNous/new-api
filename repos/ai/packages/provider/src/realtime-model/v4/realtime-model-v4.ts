import type {
  RealtimeModelV4ClientSecretOptions,
  RealtimeModelV4ClientSecretResult,
} from './realtime-model-v4-client-secret';
import type { RealtimeModelV4ClientEvent } from './realtime-model-v4-client-event';
import type { RealtimeModelV4ServerEvent } from './realtime-model-v4-server-event';
import type { RealtimeModelV4SessionConfig } from './realtime-model-v4-session-config';

/**
 * Specification for a realtime model that supports bidirectional
 * audio/text communication over WebSocket.
 *
 * Providers implement this interface to enable realtime voice
 * conversations through the AI SDK.
 */
export type RealtimeModelV4 = {
  /**
   * The realtime model must specify which interface version it implements.
   */
  readonly specificationVersion: 'v4';

  /**
   * Provider ID (e.g. 'openai', 'xai').
   */
  readonly provider: string;

  /**
   * Provider-specific model ID (e.g. 'gpt-4o-realtime', 'grok-3').
   */
  readonly modelId: string;

  /**
   * Server-side: Creates an ephemeral client secret for authenticating
   * browser-side WebSocket connections. The secret is short-lived and
   * safe to expose to client code.
   *
   * Naming: "do" prefix to prevent accidental direct usage by the user.
   */
  doCreateClientSecret(
    options: RealtimeModelV4ClientSecretOptions,
  ): PromiseLike<RealtimeModelV4ClientSecretResult>;

  /**
   * Browser-side: Returns the WebSocket URL and subprotocols to use
   * when connecting. Each provider has its own authentication mechanism
   * (e.g. OpenAI uses subprotocol headers, xAI may use query params).
   */
  getWebSocketConfig(options: { token: string; url: string }): {
    url: string;
    protocols?: string[];
  };

  /**
   * Browser-side: Parses a raw JSON event received over the WebSocket
   * and returns one or more normalized events. Providers map their native
   * event format to the common RealtimeModelV4ServerEvent union.
   *
   * Returns an array when a single provider message maps to multiple
   * normalized events (e.g. Google's serverContent can contain audio,
   * text, and turn-complete data in one message).
   */
  parseServerEvent(
    raw: unknown,
  ): RealtimeModelV4ServerEvent | RealtimeModelV4ServerEvent[];

  /**
   * Browser-side: Serializes a normalized client event into the
   * provider's native JSON format for sending over the WebSocket.
   */
  serializeClientEvent(
    event: RealtimeModelV4ClientEvent,
  ): unknown | PromiseLike<unknown>;

  /**
   * Browser-side: Builds the provider-specific session configuration
   * payload from a normalized session config. Used to construct the
   * session.update event sent after WebSocket connection.
   */
  buildSessionConfig(config: RealtimeModelV4SessionConfig): unknown;

  /**
   * Browser-side: Returns a message to auto-send back over the WebSocket
   * in response to a raw incoming message, or null if no response is needed.
   *
   * Used for provider-specific keepalive protocols (e.g. ping/pong).
   * Called by the session layer before parseServerEvent.
   */
  getHealthCheckResponse?(raw: unknown): unknown | null;
};
