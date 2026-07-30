package sub2api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdaptorUsesOnlyUserChannelCredential(t *testing.T) {
	t.Setenv("SUB2API_ADMIN_API_KEY", "platform-management-secret")
	t.Setenv("SUB2API_API_KEY", "platform-relay-secret")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAIResponses,
		ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "user-channel-key"},
	}
	headers := http.Header{}
	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &headers, info))
	assert.Equal(t, "Bearer user-channel-key", headers.Get("Authorization"))
	assert.NotContains(t, headers.Get("Authorization"), "platform-")
}

func TestAdaptorPreservesClaudeBetaHeader(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	c.Request.Header.Set("anthropic-beta", "prompt-caching-2024-07-31")
	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatClaude,
		OriginModelName: "claude-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "user-channel-key",
			UpstreamModelName: "claude-test",
		},
	}
	headers := http.Header{}

	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &headers, info))
	assert.Equal(t, "prompt-caching-2024-07-31", headers.Get("anthropic-beta"))
}

func TestAdaptorSupportsAlphaSearchAndCompactPaths(t *testing.T) {
	tests := []struct {
		path string
		mode int
	}{
		{path: "/v1/alpha/search", mode: relayconstant.RelayModeAlphaSearch},
		{path: "/v1/responses/compact", mode: relayconstant.RelayModeResponsesCompact},
	}
	for _, tt := range tests {
		info := &relaycommon.RelayInfo{
			ChannelMeta:    &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeSub2API, ChannelBaseUrl: "https://sub2api.example"},
			RequestURLPath: tt.path,
			RelayMode:      tt.mode,
		}
		got, err := (&Adaptor{}).GetRequestURL(info)
		require.NoError(t, err)
		assert.Equal(t, "https://sub2api.example"+tt.path, got)
	}
}

func TestAdaptorMapsNativeGeminiModelInRequestURL(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatGemini,
		RequestURLPath: "/v1beta/models/client-model:streamGenerateContent?alt=sse",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeSub2API,
			ChannelBaseUrl:    "https://sub2api.example",
			IsModelMapped:     true,
			UpstreamModelName: "upstream-model",
		},
	}

	got, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://sub2api.example/v1beta/models/upstream-model:streamGenerateContent?alt=sse", got)
}
