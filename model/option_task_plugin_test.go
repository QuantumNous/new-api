package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskPluginOverrideEnabledOptionUpdatesRuntimeSwitch(t *testing.T) {
	originalEnabled := constant.TaskPluginOverrideEnabled
	originalMap := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() {
		constant.TaskPluginOverrideEnabled = originalEnabled
		jsplugin.DefaultRegistry.SetOverrideEnabled(originalEnabled)
		common.OptionMap = originalMap
	})

	require.NoError(t, updateOptionMap("TaskPluginOverrideEnabled", "false"))

	assert.False(t, constant.TaskPluginOverrideEnabled)
	assert.Equal(t, "false", common.OptionMap["TaskPluginOverrideEnabled"])
}
