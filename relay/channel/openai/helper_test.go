package openai

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/require"
)

func TestProcessTokenDataStripsDataPrefix(t *testing.T) {
	var responseTextBuilder strings.Builder
	var toolCount int

	err := processTokenData(
		relayconstant.RelayModeChatCompletions,
		`data: {"id":"chatcmpl-test","choices":[{"delta":{"content":"hello"}}]}`,
		&responseTextBuilder,
		&toolCount,
	)

	require.NoError(t, err)
	require.Equal(t, "hello", responseTextBuilder.String())
	require.Equal(t, 0, toolCount)
}

func TestHandleLastResponseStripsDataPrefix(t *testing.T) {
	var responseId string
	var created int64
	var systemFingerprint string
	var model string
	var usage = &dto.Usage{}
	var containStreamUsage bool
	var shouldSendLastResp = true

	err := handleLastResponse(
		`data: {"id":"chatcmpl-test","created":123,"model":"gpt-test","system_fingerprint":"fp-test","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7}}`,
		&responseId,
		&created,
		&systemFingerprint,
		&model,
		&usage,
		&containStreamUsage,
		&relaycommon.RelayInfo{ShouldIncludeUsage: true},
		&shouldSendLastResp,
	)

	require.NoError(t, err)
	require.Equal(t, "chatcmpl-test", responseId)
	require.Equal(t, int64(123), created)
	require.Equal(t, "fp-test", systemFingerprint)
	require.Equal(t, "gpt-test", model)
	require.True(t, containStreamUsage)
	require.Equal(t, 3, usage.PromptTokens)
	require.Equal(t, 4, usage.CompletionTokens)
	require.Equal(t, 7, usage.TotalTokens)
	require.True(t, shouldSendLastResp)
}
