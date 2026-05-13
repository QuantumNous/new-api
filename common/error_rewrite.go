package common

import (
	"strings"
)

// MaskUpstreamErrors controls whether upstream provider error messages
// are rewritten to generic messages before being returned to API users.
// When enabled, error messages that reveal upstream provider details
// (e.g., "Invalid API key", "You exceeded your current quota") are
// replaced with generic equivalents that don't expose backend infrastructure.
//
// This does NOT affect:
// - Admin channel test responses (they use a separate code path)
// - User's own request validation errors (e.g., invalid parameters)
// - Internal error logging (original messages are always logged)
var MaskUpstreamErrors = true

// upstreamErrorRule defines a rewrite rule for upstream error messages.
type upstreamErrorRule struct {
	// keywords to match (case-insensitive) in the error message
	keywords []string
	// replacement message to return to the user
	replacement string
}

// upstreamErrorRules defines the rewrite rules for upstream error messages.
// Rules are evaluated in order; the first match wins.
var upstreamErrorRules = []upstreamErrorRule{
	// Authentication errors - hide which provider's key is invalid
	{
		keywords:    []string{"invalid api key", "invalid x-api-key", "incorrect api key", "invalid_api_key", "authentication_error", "invalid auth"},
		replacement: "The upstream service authentication failed. Please contact the administrator.",
	},
	// Quota/billing errors - hide upstream account status
	{
		keywords:    []string{"exceeded your current quota", "insufficient_quota", "billing hard limit", "account deactivated", "credit balance is too low", "rate_limit_exceeded", "quota exceeded"},
		replacement: "The service is temporarily unavailable due to capacity limits. Please try again later.",
	},
	// Rate limiting - generic message
	{
		keywords:    []string{"rate limit", "too many requests", "throttl"},
		replacement: "Request rate limit exceeded. Please slow down and try again.",
	},
	// Model not found - hide upstream model catalog
	{
		keywords:    []string{"model not found", "does not exist", "model_not_found", "no such model", "is not available"},
		replacement: "The requested model is currently unavailable.",
	},
	// Content policy - these can be passed through as they're about user content
	// (intentionally not rewritten)

	// Upstream new-api / one-api instance errors (Chinese) - hide upstream group/channel details
	{
		keywords:    []string{"可用渠道不存在", "可用渠道失败", "当前分组负载已饱和", "上游负载已饱和"},
		replacement: "The requested model is currently unavailable. Please try again later.",
	},
	// Server errors - hide upstream provider identity
	{
		keywords:    []string{"internal server error", "bad gateway", "service unavailable", "gateway timeout", "overloaded"},
		replacement: "The upstream service encountered an error. Please try again later.",
	},
	// Permission/access errors
	{
		keywords:    []string{"permission denied", "access denied", "forbidden", "not allowed to"},
		replacement: "Access to the requested resource is denied.",
	},
	// Context length errors - these are useful for users, pass through with generic wording
	{
		keywords:    []string{"context length", "maximum context", "token limit", "too many tokens", "max_tokens"},
		replacement: "The request exceeds the maximum context length for this model.",
	},
}

// RewriteUpstreamError checks if the error message contains upstream provider
// details and returns a sanitized version if MaskUpstreamErrors is enabled.
// Returns the original message if no rewrite rule matches or if masking is disabled.
func RewriteUpstreamError(message string) string {
	if !MaskUpstreamErrors {
		return message
	}
	if message == "" {
		return message
	}

	lowerMessage := strings.ToLower(message)

	for _, rule := range upstreamErrorRules {
		for _, keyword := range rule.keywords {
			if strings.Contains(lowerMessage, keyword) {
				return rule.replacement
			}
		}
	}

	return message
}
