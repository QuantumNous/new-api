package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChannelLimits_DisabledGlobal(t *testing.T) {
	orig := operation_setting.GetChannelLimitSetting().Enabled
	operation_setting.GetChannelLimitSetting().Enabled = false
	t.Cleanup(func() { operation_setting.GetChannelLimitSetting().Enabled = orig })

	ch := &model.Channel{}
	l := GetChannelLimits(ch)
	assert.False(t, l.Enabled)
}

func TestGetChannelLimits_ChannelValueOverridesDefault(t *testing.T) {
	g := operation_setting.GetChannelLimitSetting()
	orig := g.Enabled
	t.Cleanup(func() { g.Enabled = orig })
	g.Enabled = true

	settingJSON := `{"max_concurrency":5}`
	ch := &model.Channel{Id: 1, Setting: common.GetPointer(settingJSON)}

	l := GetChannelLimits(ch)
	require.True(t, l.Enabled)
	assert.Equal(t, 5, l.MaxConcurrency)
}
