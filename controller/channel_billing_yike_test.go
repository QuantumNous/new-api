package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestChannelBalanceUnit(t *testing.T) {
	assert.Equal(t, "credits", channelBalanceUnit(constant.ChannelTypeYike))
	assert.Empty(t, channelBalanceUnit(constant.ChannelTypeOpenAI))
}
