package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestUpdateOptionSyncsAppConsoleOrigin(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	require.NoError(t, UpdateOption("app_console.origin", "https://console.flatkey.ai/"))

	var option Option
	require.NoError(t, DB.Where("key = ?", "app_console.origin").First(&option).Error)
	require.Equal(t, "https://console.flatkey.ai/", option.Value)
	require.Equal(t, "https://console.flatkey.ai/", system_setting.GetAppConsoleSettings().Origin)
}
