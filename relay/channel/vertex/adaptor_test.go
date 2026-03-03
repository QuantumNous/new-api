package vertex

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURL_OpenSourceUsesV1Endpoint(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		OriginModelName: "zai-org/glm-5-maas",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiVersion:        `{"default":"global"}`,
			ApiKey:            `{"project_id":"demo-project"}`,
			UpstreamModelName: "zai-org/glm-5-maas",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				VertexKeyType: dto.VertexKeyTypeJSON,
			},
		},
	}

	adaptor := &Adaptor{}
	adaptor.Init(info)

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://aiplatform.googleapis.com/v1/projects/demo-project/locations/global/endpoints/openapi/chat/completions", url)
}

func TestGetRequestURL_OpenSourceWithAPIKeyReturnsError(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		OriginModelName: "zai-org/glm-5-maas",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiVersion:        `{"default":"global"}`,
			ApiKey:            "AIza-example",
			UpstreamModelName: "zai-org/glm-5-maas",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				VertexKeyType: dto.VertexKeyTypeAPIKey,
			},
		},
	}

	adaptor := &Adaptor{}
	adaptor.Init(info)

	_, err := adaptor.GetRequestURL(info)
	require.Error(t, err)
	require.Contains(t, err.Error(), "service account json credentials")
}
