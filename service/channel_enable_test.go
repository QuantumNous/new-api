package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestShouldEnableChannelUsesResolvedEnableFlag(t *testing.T) {
	assert.False(t, ShouldEnableChannel(nil, common.ChannelStatusAutoDisabled, false))
	assert.True(t, ShouldEnableChannel(nil, common.ChannelStatusAutoDisabled, true))
	assert.False(t, ShouldEnableChannel(nil, common.ChannelStatusEnabled, true))
	assert.False(t, ShouldEnableChannel(types.NewError(assert.AnError, types.ErrorCodeBadResponseBody), common.ChannelStatusAutoDisabled, true))
}
