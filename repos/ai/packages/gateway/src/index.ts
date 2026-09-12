export type { GatewayModelId } from './gateway-language-model-settings';
export {
  GATEWAY_AUTH_SUBPROTOCOL_PREFIX,
  GATEWAY_REALTIME_SUBPROTOCOL,
  GATEWAY_TEAM_SUBPROTOCOL_PREFIX,
  GATEWAY_TRANSCRIPTION_SUBPROTOCOL,
  getGatewayRealtimeAuthToken,
  getGatewayRealtimeProtocols,
  getGatewayRealtimeTeamIdOrSlug,
  getGatewayTranscriptionProtocols,
} from './gateway-realtime-auth';
export type { GatewayRealtimeModelId } from './gateway-realtime-model-settings';
export type { GatewayRerankingModelId } from './gateway-reranking-model-settings';
export type { GatewaySpeechModelId } from './gateway-speech-model-settings';
export type { GatewayTranscriptionModelId } from './gateway-transcription-model-settings';
export type { GatewayVideoModelId } from './gateway-video-model-settings';
export type {
  GatewayLanguageModelEntry,
  GatewayLanguageModelSpecification,
} from './gateway-model-entry';
export type { GatewayCreditsResponse } from './gateway-fetch-metadata';
export type {
  GatewaySpendReportParams,
  GatewaySpendReportRow,
  GatewaySpendReportResponse,
} from './gateway-spend-report';
export type {
  GatewayGenerationInfoParams,
  GatewayGenerationInfo,
} from './gateway-generation-info';
export type { GatewayLanguageModelEntry as GatewayModelEntry } from './gateway-model-entry';
export {
  createGateway,
  /** @deprecated Use `createGateway` instead. */
  createGateway as createGatewayProvider,
  gateway,
} from './gateway-provider';
export type {
  GatewayProvider,
  GatewayProviderSettings,
} from './gateway-provider';
export type {
  GatewayProviderOptions,
  /** @deprecated Use `GatewayProviderOptions` instead. */
  GatewayProviderOptions as GatewayLanguageModelOptions,
} from './gateway-provider-options';
export {
  GatewayError,
  GatewayAuthenticationError,
  GatewayFailedDependencyError,
  GatewayForbiddenError,
  GatewayInvalidRequestError,
  GatewayRateLimitError,
  GatewayModelNotFoundError,
  GatewayInternalServerError,
  GatewayResponseError,
} from './errors';
export type { GatewayErrorResponse } from './errors';
export { VERSION } from './version';
