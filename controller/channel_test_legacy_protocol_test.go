package controller

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/require"
)

func TestShouldFallbackToResponsesInChannelTest_True(t *testing.T) {
	t.Parallel()

	body := `{"error":{"message":"Unsupported legacy protocol: /v1/chat/completions is not supported. Please use /v1/responses.","type":"invalid_request_error"}}`
	resp := &http.Response{
		StatusCode: http.StatusBadRequest,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{},
		},
	}
	req := &dto.GeneralOpenAIRequest{Model: "gpt-5.2"}

	legacyReq, ok := shouldFallbackToResponsesInChannelTest(info, req, resp, false)
	require.True(t, ok)
	require.Same(t, req, legacyReq)

	restored, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, body, string(restored))
}

func TestShouldFallbackToResponsesInChannelTest_FalseForNonGeneralRequest(t *testing.T) {
	t.Parallel()

	resp := &http.Response{
		StatusCode: http.StatusBadRequest,
		Body:       io.NopCloser(strings.NewReader(`{"error":{"message":"Unsupported legacy protocol: /v1/chat/completions is not supported. Please use /v1/responses."}}`)),
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{},
		},
	}

	legacyReq, ok := shouldFallbackToResponsesInChannelTest(info, &dto.EmbeddingRequest{Model: "text-embedding-3-small"}, resp, false)
	require.False(t, ok)
	require.Nil(t, legacyReq)
}

func TestShouldFallbackToResponsesInChannelTest_FalseWhenPassThroughEnabled(t *testing.T) {
	t.Parallel()

	resp := &http.Response{
		StatusCode: http.StatusBadRequest,
		Body:       io.NopCloser(strings.NewReader(`{"error":{"message":"Unsupported legacy protocol: /v1/chat/completions is not supported. Please use /v1/responses."}}`)),
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{},
		},
	}
	req := &dto.GeneralOpenAIRequest{Model: "gpt-5.2"}

	legacyReq, ok := shouldFallbackToResponsesInChannelTest(info, req, resp, true)
	require.False(t, ok)
	require.Nil(t, legacyReq)
}
