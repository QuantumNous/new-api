package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAgentSettingDefaultsDisabledAndIsRegistered(t *testing.T) {
	setting := GetAgentSetting()
	require.NotNil(t, setting)
	assert.False(t, setting.Enabled)
	assert.Same(t, setting, config.GlobalConfig.Get("agent_setting"))
}
