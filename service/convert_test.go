package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestDerivePromptCacheKeyFromClaudeRequestPrefersHeader(t *testing.T) {
	metadata := []byte(`{"user_id":"{\"device_id\":\"dev-1\",\"session_id\":\"meta-session\"}"}`)
	req := dto.ClaudeRequest{
		Model:    "gpt-5.4",
		Metadata: metadata,
	}
	info := &relaycommon.RelayInfo{
		RequestHeaders: map[string]string{
			"X-Claude-Code-Session-Id": "header-session",
		},
	}

	cacheKey := derivePromptCacheKeyFromClaudeRequest(req, info)
	require.Equal(t, "header-session", cacheKey)
}

func TestDerivePromptCacheKeyFromClaudeRequestFallsBackToMetadata(t *testing.T) {
	metadata := []byte(`{"user_id":"{\"device_id\":\"dev-1\",\"session_id\":\"meta-session\"}"}`)
	req := dto.ClaudeRequest{
		Model:    "gpt-5.4",
		Metadata: metadata,
	}

	cacheKey := derivePromptCacheKeyFromClaudeRequest(req, &relaycommon.RelayInfo{})
	require.Equal(t, "meta-session", cacheKey)
}
