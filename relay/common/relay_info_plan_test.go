package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/warjiang/new-api/constant"
)

func TestVolcEnginePlanChannelsSupportStreamOptions(t *testing.T) {
	t.Parallel()

	assert.True(t, streamSupportedChannels[constant.ChannelTypeVolcEngineAgentPlan])
	assert.True(t, streamSupportedChannels[constant.ChannelTypeVolcEngineCodingPlan])
}
