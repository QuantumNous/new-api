package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestBillingDisplayDataDefaultsAndDoesNotExposeSecrets(t *testing.T) {
	data := buildBillingDisplayData()
	require.Equal(t, false, data["public_welfare_text_enabled"])
	require.Equal(t, true, data["invitation_panel_enabled"])

	payload, err := common.Marshal(data)
	require.NoError(t, err)
	require.NotContains(t, string(payload), "secret")
	require.NotContains(t, string(payload), "key")
}

func TestBillingDisplayDataReflectsConfigUpdate(t *testing.T) {
	cfg := config.GlobalConfig.Get("billing_display_setting")
	require.NotNil(t, cfg)

	original := operation_setting.GetBillingDisplaySetting()
	t.Cleanup(func() {
		_ = config.UpdateConfigFromMap(cfg, map[string]string{
			"public_welfare_text_enabled": boolStringForController(original.PublicWelfareTextEnabled),
			"invitation_panel_enabled":    boolStringForController(original.InvitationPanelEnabled),
		})
	})

	require.NoError(t, config.UpdateConfigFromMap(cfg, map[string]string{
		"public_welfare_text_enabled": "true",
		"invitation_panel_enabled":    "false",
	}))

	data := buildBillingDisplayData()
	require.Equal(t, true, data["public_welfare_text_enabled"])
	require.Equal(t, false, data["invitation_panel_enabled"])
}

func boolStringForController(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
