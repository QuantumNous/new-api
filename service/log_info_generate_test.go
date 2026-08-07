package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAppendRequestMetadataRecordsSanitizedAdminInfo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	ctx.Set(string(constant.ContextKeyUpstreamRequestMethod), http.MethodPost)
	ctx.Set(string(constant.ContextKeyUpstreamRequestURL), "https://upstream.test/api/v3/responses?key=secret&region=cn")

	info := &relaycommon.RelayInfo{
		RelayMode:   8,
		RelayFormat: types.RelayFormatOpenAIResponses,
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       62,
			ChannelBaseUrl:    "https://base-user:base-password@upstream.test/api/coding",
			ApiType:           1,
			ApiVersion:        "v3",
			UpstreamModelName: "ark-code-latest",
		},
	}
	other := map[string]interface{}{}

	AppendRequestMetadata(ctx, info, other)

	adminInfo := other["admin_info"].(map[string]interface{})
	metadata := adminInfo["request_metadata"].(map[string]interface{})
	require.Equal(t, http.MethodPost, metadata["method"])
	require.Equal(t, 62, metadata["channel_type"])
	require.Equal(t, "ark-code-latest", metadata["upstream_model"])
	require.Equal(t, true, metadata["stream"])
	require.NotContains(t, metadata["base_url"], "base-password")
	require.NotContains(t, metadata["upstream_url"], "secret")
	require.Contains(t, metadata["upstream_url"], "key=%2A%2A%2Amasked%2A%2A%2A")
}

func TestAppendRequestMetadataFallsBackToContextForErrorLogs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set(string(constant.ContextKeyChannelBaseUrl), "https://api.example.test")
	ctx.Set(string(constant.ContextKeyChannelType), 1)
	ctx.Set(string(constant.ContextKeyOriginalModel), "gpt-test")
	ctx.Set(string(constant.ContextKeyIsStream), true)
	ctx.Set(string(constant.ContextKeyUpstreamRequestURL), "https://api.example.test/v1/chat/completions")

	other := map[string]interface{}{}
	AppendRequestMetadata(ctx, nil, other)

	adminInfo := other["admin_info"].(map[string]interface{})
	metadata := adminInfo["request_metadata"].(map[string]interface{})
	require.Equal(t, "https://api.example.test", metadata["base_url"])
	require.Equal(t, "https://api.example.test/v1/chat/completions", metadata["upstream_url"])
	require.Equal(t, "gpt-test", metadata["upstream_model"])
	require.Equal(t, true, metadata["stream"])
}
