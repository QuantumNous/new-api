package volcengine

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentPlanTTSRequestUsesDocumentedResourceAndFields(t *testing.T) {
	request := buildAgentPlanTTSRequest(dto.AudioRequest{
		Input:          "你好，世界",
		Voice:          "zh_female_vv_uranus_bigtts",
		ResponseFormat: "mp3",
	})

	assert.Equal(t, "BidirectionalTTS", request.Namespace)
	assert.Equal(t, "你好，世界", request.ReqParams.Text)
	assert.Equal(t, "zh_female_vv_uranus_bigtts", request.ReqParams.Speaker)
	assert.Equal(t, "zh_female_vv_uranus_bigtts", agentPlanVoice(""))
	assert.Equal(t, "zh_female_vv_uranus_bigtts", agentPlanVoice("alloy"))
	assert.Equal(t, "mp3", request.ReqParams.AudioParams.Format)
	assert.Equal(t, 24000, request.ReqParams.AudioParams.SampleRate)
	assert.Equal(t, 0, request.ReqParams.AudioParams.SpeechRate)
}

func TestAgentPlanTTSHeadersUseArkKey(t *testing.T) {
	header := buildAgentPlanTTSHeaders("ark-test-key")

	assert.Equal(t, "ark-test-key", header.Get("X-Api-Key"))
	assert.Equal(t, ttsAgentPlanResourceID, header.Get("X-Api-Resource-Id"))
	assert.NotEmpty(t, header.Get("X-Api-Connect-Id"))
	assert.Empty(t, header.Get("Authorization"))
	assert.Empty(t, header.Get("X-Api-App-Key"))
}

func TestAgentPlanTTSRoutingDoesNotRelaxLegacyAuth(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeAudioSpeech,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ark.cn-beijing.volces.com",
			ApiKey:         "appid|access-token",
		},
	}

	assert.False(t, isAgentPlanTTS(info))
	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "wss://openspeech.bytedance.com/api/v1/tts/ws_binary", url)

	info.ChannelMeta.ApiKey = "ark-test-key"
	assert.True(t, isAgentPlanTTS(info))
	url, err = adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, ttsAgentPlanEndpoint, url)
}
