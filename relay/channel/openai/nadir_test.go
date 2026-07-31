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

// nadirRelayInfo builds the minimal RelayInfo a Nadir request carries, so the
// tests below exercise URL construction and header setup the same way the
// relay does at runtime.
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

// TestNadirChannelRelaysToOpenAIChatCompletionsWithBearerAuth pins the wire
// contract: the request goes to <base>/v1/chat/completions and carries the key
// as a Bearer token, which is what lets Nadir reuse the shared OpenAI adaptor
// with no request translation.
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

// TestNadirChannelExposesAutoModelOverOpenAIEndpointOnly pins that the channel
// advertises exactly the "auto" model and claims only the OpenAI endpoint type.
// Claiming more would offer callers endpoints the router does not serve.
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
