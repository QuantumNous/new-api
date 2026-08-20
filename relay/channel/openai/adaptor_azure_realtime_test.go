package openai

import (
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAzureRealtimeRequestURL(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeRealtime,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeAzure,
			ChannelBaseUrl:    "https://example.openai.azure.com",
			ApiVersion:        "2025-04-01-preview",
			UpstreamModelName: "gpt-realtime-deployment",
		},
	}

	requestURL, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	parsedURL, err := url.Parse(requestURL)
	require.NoError(t, err)
	assert.Equal(t, "wss", parsedURL.Scheme)
	assert.Equal(t, "/openai/v1/realtime", parsedURL.Path)
	assert.Equal(t, "gpt-realtime-deployment", parsedURL.Query().Get("model"))
	assert.Empty(t, parsedURL.Query().Get("deployment"))
	assert.Empty(t, parsedURL.Query().Get("api-version"))
}
