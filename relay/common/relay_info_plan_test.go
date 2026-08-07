package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestVolcEnginePlanChannelsSupportStreamOptions(t *testing.T) {
	t.Parallel()

	assert.True(t, streamSupportedChannels[constant.ChannelTypeVolcEngineAgentPlan])
	assert.True(t, streamSupportedChannels[constant.ChannelTypeVolcEngineCodingPlan])
}
