package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldPassThroughImageRequestDisablesXAIImageEdits(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	original := settings.PassThroughRequestEnabled
	settings.PassThroughRequestEnabled = true
	t.Cleanup(func() { settings.PassThroughRequestEnabled = original })

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeXai,
		},
	}
	require.False(t, shouldPassThroughImageRequest(info))

	info.ApiType = constant.APITypeOpenAI
	assert.True(t, shouldPassThroughImageRequest(info))
}
