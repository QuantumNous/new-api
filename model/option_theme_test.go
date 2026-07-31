package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateOptionMapNormalizesLegacyThemeFrontend(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	savedOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	savedFrontend := system_setting.GetThemeSettings().Frontend
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = savedOptionMap
		common.OptionMapRWMutex.Unlock()
		system_setting.GetThemeSettings().Frontend = savedFrontend
	})

	require.NoError(t, updateOptionMap("theme.frontend", "classic"))

	common.OptionMapRWMutex.RLock()
	storedFrontend := common.OptionMap["theme.frontend"]
	common.OptionMapRWMutex.RUnlock()
	assert.Equal(t, system_setting.DefaultFrontend, storedFrontend)
	assert.Equal(t, system_setting.DefaultFrontend, system_setting.GetThemeSettings().Frontend)
}
