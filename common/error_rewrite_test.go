package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRewriteUpstreamError_Enabled(t *testing.T) {
	MaskUpstreamErrors = true

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		// Authentication errors
		{
			name:     "OpenAI invalid API key",
			input:    "Incorrect API key provided: sk-proj-xxx. You can find your API key at https://platform.openai.com/account/api-keys.",
			expected: "The upstream service authentication failed. Please contact the administrator.",
		},
		{
			name:     "Claude authentication error",
			input:    "authentication_error: invalid x-api-key",
			expected: "The upstream service authentication failed. Please contact the administrator.",
		},
		// Quota errors
		{
			name:     "OpenAI quota exceeded",
			input:    "You exceeded your current quota, please check your plan and billing details.",
			expected: "The service is temporarily unavailable due to capacity limits. Please try again later.",
		},
		{
			name:     "Claude credit balance",
			input:    "Your credit balance is too low to access the Claude API.",
			expected: "The service is temporarily unavailable due to capacity limits. Please try again later.",
		},
		// Rate limiting
		{
			name:     "Rate limit",
			input:    "Rate limit reached for gpt-4 in organization org-xxx on tokens per min.",
			expected: "Request rate limit exceeded. Please slow down and try again.",
		},
		// Model not found
		{
			name:     "Model does not exist",
			input:    "The model 'gpt-5-turbo' does not exist or you do not have access to it.",
			expected: "The requested model is currently unavailable.",
		},
		// Server errors
		{
			name:     "Upstream overloaded",
			input:    "The server is overloaded, please try again later.",
			expected: "The upstream service encountered an error. Please try again later.",
		},
		// Context length
		{
			name:     "Context length exceeded",
			input:    "This model's maximum context length is 8192 tokens. However, your messages resulted in 12000 tokens.",
			expected: "The request exceeds the maximum context length for this model.",
		},
		// No match - pass through
		{
			name:     "User validation error - pass through",
			input:    "Invalid request: 'messages' is a required property",
			expected: "Invalid request: 'messages' is a required property",
		},
		{
			name:     "Empty message",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := RewriteUpstreamError(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRewriteUpstreamError_Disabled(t *testing.T) {
	MaskUpstreamErrors = false
	defer func() { MaskUpstreamErrors = true }()

	input := "You exceeded your current quota, please check your plan and billing details."
	result := RewriteUpstreamError(input)
	assert.Equal(t, input, result, "Should return original message when masking is disabled")
}
