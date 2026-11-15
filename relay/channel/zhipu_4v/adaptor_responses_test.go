package zhipu_4v

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIResponsesRequestPreservesNativePayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeZhipu_v4,
			ChannelBaseUrl:    "glm-coding-plan",
			UpstreamModelName: "glm-5.3",
		},
		RelayMode:       relayconstant.RelayModeResponses,
		RelayFormat:     types.RelayFormatOpenAIResponses,
		OriginModelName: "glm-5.3",
	}
	stream := true
	request := dto.OpenAIResponsesRequest{
		Model:    "glm-5.3",
		Input:    []byte(`[{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]}]`),
		Metadata: []byte(`{"trace_id":"keep-me"}`),
		Tools:    []byte(`[{"type":"custom","name":"apply_patch"}]`),
		Stream:   &stream,
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(c, info, request)
	require.NoError(t, err)
	responsesRequest, ok := converted.(dto.OpenAIResponsesRequest)
	require.True(t, ok)
	assert.Equal(t, request.Model, responsesRequest.Model)
	assert.JSONEq(t, string(request.Input), string(responsesRequest.Input))
	assert.JSONEq(t, string(request.Metadata), string(responsesRequest.Metadata))
	assert.JSONEq(t, string(request.Tools), string(responsesRequest.Tools))
	assert.Same(t, request.Stream, responsesRequest.Stream)

	requestURL, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://open.bigmodel.cn/api/v1/responses", requestURL)
}

func TestGetRequestURLAcceptsDirectNativeResponsesBase(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://open.bigmodel.cn/api/v1/",
		},
		RelayMode: relayconstant.RelayModeResponses,
	}

	requestURL, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://open.bigmodel.cn/api/v1/responses", requestURL)
}

func TestGetRequestURLRejectsResponsesWithoutNativeBase(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://open.bigmodel.cn",
		},
		RelayMode: relayconstant.RelayModeResponses,
	}

	_, err := (&Adaptor{}).GetRequestURL(info)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "native responses endpoint is not configured")
}
