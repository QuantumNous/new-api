package tencent

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDispatchAdaptorInit(t *testing.T) {
	tests := []struct {
		name        string
		apiKey      string
		baseURL     string
		wantTC3     bool
		wantBaseURL string
	}{
		{name: "legacy TC3", apiKey: "1300000000|AKIDexample|secret-example", baseURL: constant.ChannelBaseURLs[constant.ChannelTypeTencent], wantTC3: true, wantBaseURL: constant.ChannelBaseURLs[constant.ChannelTypeTencent]},
		{name: "TokenHub default", apiKey: "tokenhub-example", baseURL: constant.ChannelBaseURLs[constant.ChannelTypeTencent], wantBaseURL: tokenHubBaseURL},
		{name: "TokenHub empty", apiKey: "tokenhub-example", wantBaseURL: tokenHubBaseURL},
		{name: "TokenHub custom base", apiKey: "tokenhub-example", baseURL: "https://proxy.example.com", wantBaseURL: "https://proxy.example.com"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
				ChannelType: constant.ChannelTypeTencent, ApiKey: tt.apiKey, ChannelBaseUrl: tt.baseURL,
			}}
			dispatch := &DispatchAdaptor{}
			dispatch.Init(info)
			require.NotNil(t, dispatch.Adaptor)
			if tt.wantTC3 {
				assert.IsType(t, &Adaptor{}, dispatch.Adaptor)
			} else {
				assert.IsType(t, &openai.Adaptor{}, dispatch.Adaptor)
			}
			assert.Equal(t, tt.wantBaseURL, info.ChannelBaseUrl)
		})
	}
}

func TestTokenHubPreservesStreamOptions(t *testing.T) {
	includeUsage := true
	stream := true
	request := &dto.GeneralOpenAIRequest{
		Stream:        &stream,
		StreamOptions: &dto.StreamOptions{IncludeUsage: includeUsage},
	}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType: constant.ChannelTypeTencent,
		ApiKey:      "tokenhub-example",
	}}
	dispatch := &DispatchAdaptor{}
	dispatch.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	converted, err := dispatch.ConvertOpenAIRequest(c, info, request)
	require.NoError(t, err)
	convertedRequest, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.NotNil(t, convertedRequest.StreamOptions)
	assert.True(t, convertedRequest.StreamOptions.IncludeUsage)
}
