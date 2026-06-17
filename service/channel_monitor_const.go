package service

import (
	"errors"
	"time"
)

const (
	MonitorProviderOpenAI    = "openai"
	MonitorProviderAnthropic = "anthropic"
	MonitorProviderGemini    = "gemini"

	MonitorAPIModeChatCompletions = "chat_completions"
	MonitorAPIModeResponses       = "responses"

	MonitorBodyOverrideModeOff     = "off"
	MonitorBodyOverrideModeMerge   = "merge"
	MonitorBodyOverrideModeReplace = "replace"

	MonitorStatusOperational = "operational"
	MonitorStatusDegraded    = "degraded"
	MonitorStatusFailed      = "failed"
	MonitorStatusError       = "error"
)

const (
	monitorRequestTimeout           = 45 * time.Second
	monitorPingTimeout              = 8 * time.Second
	monitorDegradedThreshold        = 6 * time.Second
	monitorHistoryRetentionDays     = 30
	monitorWorkerConcurrency        = 5
	monitorStartupLoadTimeout       = 10 * time.Second
	monitorMinIntervalSeconds       = 15
	monitorMaxIntervalSeconds       = 3600
	monitorMessageMaxBytes          = 500
	monitorResponseMaxBytes         = 64 * 1024
	monitorErrorBodySnippetMaxBytes = 300
	monitorChallengeMin             = 1
	monitorChallengeMax             = 50
	monitorChallengeMaxTokens       = 50
	monitorTimelineMaxPoints        = 60
	monitorEndpointResolveTimeout   = 5 * time.Second
	monitorAnthropicAPIVersion      = "2023-06-01"
	monitorRunOneBuffer             = 10 * time.Second
	monitorIdleConnTimeout          = 30 * time.Second
	monitorTLSHandshakeTimeout      = 10 * time.Second
	monitorResponseHeaderTimeout    = 30 * time.Second
	monitorPingDiscardMaxBytes      = 1024
	monitorDialTimeout              = 10 * time.Second
	monitorDialKeepAlive            = 30 * time.Second

	providerOpenAIPath            = "/v1/chat/completions"
	providerOpenAIResponsesPath   = "/v1/responses"
	providerAnthropicPath         = "/v1/messages"
	providerGeminiPathTemplate    = "/v1beta/models/%s:generateContent"
	channelMonitorDefaultPageSize = 20
	ChannelMonitorHistoryLimit    = 100
	ChannelMonitorHistoryMaxLimit = 1000
)

var (
	ErrChannelMonitorNotFound            = errors.New("channel monitor not found")
	ErrChannelMonitorInvalidProvider     = errors.New("provider must be one of openai/anthropic/gemini")
	ErrChannelMonitorInvalidAPIMode      = errors.New("api_mode must be chat_completions or responses; responses is only supported for openai")
	ErrChannelMonitorInvalidInterval     = errors.New("interval_seconds must be in [15, 3600]")
	ErrChannelMonitorInvalidJitter       = errors.New("jitter_seconds must be >= 0 and interval_seconds - jitter_seconds must be >= 15")
	ErrChannelMonitorInvalidEndpoint     = errors.New("endpoint must be a valid https URL")
	ErrChannelMonitorEndpointScheme      = errors.New("endpoint must use https scheme")
	ErrChannelMonitorEndpointPath        = errors.New("endpoint must be base origin only (no path/query/fragment)")
	ErrChannelMonitorEndpointPrivate     = errors.New("endpoint must be a public host")
	ErrChannelMonitorEndpointUnreachable = errors.New("endpoint hostname could not be resolved")
	ErrChannelMonitorMissingAPIKey       = errors.New("api_key is required when creating a monitor")
	ErrChannelMonitorMissingPrimaryModel = errors.New("primary_model is required")
	ErrChannelMonitorAPIKeyDecryptFailed = errors.New("api key decryption failed; please re-edit the monitor with a fresh key")
	ErrChannelMonitorInvalidRequestBody  = errors.New("request body override is invalid for the selected provider and api mode")

	ErrChannelMonitorTemplateNotFound          = errors.New("channel monitor request template not found")
	ErrChannelMonitorTemplateMissingName       = errors.New("template name is required")
	ErrChannelMonitorTemplateInvalidProvider   = errors.New("template provider must be one of openai/anthropic/gemini")
	ErrChannelMonitorTemplateInvalidAPIMode    = errors.New("template api_mode must be chat_completions or responses; responses is only supported for openai")
	ErrChannelMonitorTemplateInvalidBodyMode   = errors.New("body_override_mode must be one of off/merge/replace")
	ErrChannelMonitorTemplateBodyRequired      = errors.New("body_override is required when body_override_mode is merge or replace")
	ErrChannelMonitorTemplateHeaderForbidden   = errors.New("header name is forbidden")
	ErrChannelMonitorTemplateHeaderInvalidName = errors.New("header name contains invalid characters")
	ErrChannelMonitorTemplateProviderMismatch  = errors.New("monitor provider does not match template provider")
	ErrChannelMonitorTemplateAPIModeMismatch   = errors.New("monitor api_mode does not match template api_mode")
	ErrChannelMonitorTemplateApplyEmpty        = errors.New("monitor_ids must be a non-empty array")
)
