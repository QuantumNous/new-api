import type { ProviderV2, ProviderV3, ProviderV4 } from '@ai-sdk/provider';
import type { LogWarningsFunction } from './logger/log-warnings';
import type { Telemetry } from './telemetry/telemetry';

// add AI SDK default provider to the globalThis object
declare global {
  /**
   * The default provider to use for the AI SDK.
   * String model ids are resolved to the default provider and model id.
   *
   * If not set, the default provider is the Vercel AI gateway provider.
   *
   * @see https://ai-sdk.dev/docs/ai-sdk-core/provider-management#global-provider-configuration
   */
  var AI_SDK_DEFAULT_PROVIDER: ProviderV4 | ProviderV3 | ProviderV2 | undefined;

  /**
   * The warning logger to use for the AI SDK.
   *
   * If not set, the default logger is the console.warn function.
   *
   * If set to false, no warnings are logged.
   */
  var AI_SDK_LOG_WARNINGS: LogWarningsFunction | undefined | false;

  /**
   * Globally registered telemetry integrations for the AI SDK.
   *
   * Integrations registered here receive lifecycle events (onStart, onStepStart,
   * etc.) from every `generateText`, `streamText`, and similar call.
   *
   * Prefer using `registerTelemetry()` from `'ai'` instead of
   * assigning this directly.
   */
  var AI_SDK_TELEMETRY_INTEGRATIONS: Telemetry[] | undefined;
}
