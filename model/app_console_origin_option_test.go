package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
)

func TestUpdateOptionNormalizesAndSyncsAppConsoleOrigin(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	require.NoError(t, UpdateOption("app_console.origin", " https://console.flatkey.ai/ "))

	var option Option
	require.NoError(t, DB.Where("key = ?", "app_console.origin").First(&option).Error)
	require.Equal(t, "https://console.flatkey.ai", option.Value)
	require.Equal(t, "https://console.flatkey.ai", system_setting.GetAppConsoleSettings().Origin)
}

func TestUpdateOptionRejectsInvalidAppConsoleOrigin(t *testing.T) {
	setupOptionGroupRenameTestDB(t)
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})
	system_setting.GetAppConsoleSettings().Origin = "https://existing.console"

	err := UpdateOption("app_console.origin", "console.flatkey.ai")
	require.Error(t, err)

	var persistedCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "app_console.origin").Count(&persistedCount).Error)
	require.Zero(t, persistedCount)
	require.Equal(t, "https://existing.console", system_setting.GetAppConsoleSettings().Origin)
}
