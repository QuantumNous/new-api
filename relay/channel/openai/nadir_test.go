package openai

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func nadirRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatOpenAI,
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RequestURLPath:  "/v1/chat/completions",
		OriginModelName: "auto",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "sk-test",
			ChannelBaseUrl:    constant.ChannelBaseURLs[constant.ChannelTypeNadir],
			ChannelType:       constant.ChannelTypeNadir,
			UpstreamModelName: "auto",
		},
	}
}

func TestNadirChannelRelaysToOpenAIChatCompletionsWithBearerAuth(t *testing.T) {
	adaptor := &Adaptor{}
	info := nadirRelayInfo()
	adaptor.Init(info)

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://api.getnadir.com/v1/chat/completions", requestURL)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t, "Bearer sk-test", header.Get("Authorization"))
}

func TestNadirChannelExposesAutoModelOverOpenAIEndpointOnly(t *testing.T) {
	adaptor := &Adaptor{}
	adaptor.Init(nadirRelayInfo())

	assert.Equal(t, "nadir", adaptor.GetChannelName())
	assert.Equal(t, []string{"auto"}, adaptor.GetModelList())
	assert.Equal(
		t,
		[]constant.EndpointType{constant.EndpointTypeOpenAI},
		common.GetEndpointTypesByChannelType(constant.ChannelTypeNadir, "auto"),
	)
}
