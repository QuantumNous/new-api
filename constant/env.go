package constant

var StreamingTimeout int
var DifyDebug bool
var MaxFileDownloadMB int
var StreamScannerMaxBufferMB int
var ForceStreamOption bool
var CountToken bool
var GetMediaToken bool
var GetMediaTokenNotStream bool
var UpdateTask bool
var MaxRequestBodyMB int
var AzureDefaultAPIVersion string
var NotifyLimitCount int
var NotificationLimitDurationMinute int
var GenerateDefaultToken bool
var ErrorLogEnabled bool

// LogBlockedUpstreamHeaders controls whether blocklist-stripped upstream
// response headers (name and value) are logged for auditing. Default true;
// set LOG_BLOCKED_UPSTREAM_HEADERS=false to disable.
var LogBlockedUpstreamHeaders = true

// AnthropicResponseNormalize controls whether Claude-protocol relay responses
// are normalized toward the official api.anthropic.com shape. When true (the
// default), the client-facing response carries an Anthropic-style
// "request-id: req_..." header instead of "X-Oneapi-Request-Id". When false,
// behavior falls back to emitting "X-Oneapi-Request-Id" as before. Disable via
// ANTHROPIC_RESPONSE_NORMALIZE=false. Default true is safe for B2B deployments
// (top/code.taluna.ai); the internal id is still recorded in context/logs for
// traceability regardless of this flag.
var AnthropicResponseNormalize = true

// AnthropicRecalcInputTokensChannels is the set of channel IDs whose Claude
// direct-passthrough message_start.usage.input_tokens should be recomputed with
// new-api's own local estimator (CalibrateAnthropicInputTokens) instead of
// trusting the upstream value.
//
// Rationale: in the B2B nested topology top -> guanli(nested new-api) ->
// OpenRouter, the upstream "guanli" already replaces message_start.input_tokens
// with its own cl100k estimate (~1026, model-independent), so trusting it on
// the passthrough path keeps the un-calibrated value. Recomputing locally for
// those specific channels brings the displayed value closer to the official
// count (research §5.6). A channel allowlist (rather than a global assumption)
// avoids wrongly recomputing when a channel points at a real Anthropic endpoint
// that already returns truthful values. Empty = disabled (default).
//
// Configured via ANTHROPIC_RECALC_INPUT_TOKENS_CHANNELS (comma-separated channel IDs).
var AnthropicRecalcInputTokensChannels = map[int]struct{}{}

var TaskQueryLimit int
var TaskTimeoutMinutes int

// temporary variable for sora patch, will be removed in future
var TaskPricePatches []string

// TrustedRedirectDomains is a list of trusted domains for redirect URL validation.
// Domains support subdomain matching (e.g., "example.com" matches "sub.example.com").
var TrustedRedirectDomains []string
