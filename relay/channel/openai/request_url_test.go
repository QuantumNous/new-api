package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIRequestURLAppendsAPIVersionPreview(t *testing.T) {
	const baseURL = "https://example.openai.azure.com/openai"
	for _, tc := range []struct {
		name    string
		enabled bool
		path    string
		want    string
	}{
		{
			name: "off leaves the client path unchanged",
			path: "/v1/responses",
			want: baseURL + "/v1/responses",
		},
		{
			name:    "on adds preview when the client omits it",
			enabled: true,
			path:    "/v1/responses",
			want:    baseURL + "/v1/responses?api-version=preview",
		},
		{
			name:    "on keeps a client api-version",
			enabled: true,
			path:    "/v1/responses?api-version=2025-04-01-preview",
			want:    baseURL + "/v1/responses?api-version=2025-04-01-preview",
		},
		{
			name:    "on keeps other query parameters",
			enabled: true,
			path:    "/v1/responses?foo=1",
			want:    baseURL + "/v1/responses?api-version=preview&foo=1",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    constant.ChannelTypeOpenAI,
					ChannelBaseUrl: baseURL,
					ChannelOtherSettings: dto.ChannelOtherSettings{
						OpenAIAPIVersionPreview: tc.enabled,
					},
				},
				RequestURLPath: tc.path,
			}
			got, err := (&Adaptor{}).GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}
