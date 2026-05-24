package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
)

func TestBillingDisplaySettingDefaults(t *testing.T) {
	setting := GetBillingDisplaySetting()
	if setting.PublicWelfareTextEnabled {
		t.Fatal("public welfare text should be disabled by default")
	}
	if !setting.InvitationPanelEnabled {
		t.Fatal("invitation panel should be enabled by default")
	}
}

func TestBillingDisplaySettingConfigExportAndUpdate(t *testing.T) {
	cfg := config.GlobalConfig.Get("billing_display_setting")
	if cfg == nil {
		t.Fatal("billing_display_setting should be registered")
	}

	original := GetBillingDisplaySetting()
	defer func() {
		_ = config.UpdateConfigFromMap(cfg, map[string]string{
			"public_welfare_text_enabled": boolString(original.PublicWelfareTextEnabled),
			"invitation_panel_enabled":    boolString(original.InvitationPanelEnabled),
		})
	}()

	exported, err := config.ConfigToMap(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := exported["public_welfare_text_enabled"]; !ok {
		t.Fatal("public_welfare_text_enabled should be exported")
	}
	if _, ok := exported["invitation_panel_enabled"]; !ok {
		t.Fatal("invitation_panel_enabled should be exported")
	}

	if err := config.UpdateConfigFromMap(cfg, map[string]string{
		"public_welfare_text_enabled": "true",
		"invitation_panel_enabled":    "false",
	}); err != nil {
		t.Fatal(err)
	}

	updated := GetBillingDisplaySetting()
	if !updated.PublicWelfareTextEnabled {
		t.Fatal("public welfare text should be updated")
	}
	if updated.InvitationPanelEnabled {
		t.Fatal("invitation panel should be updated")
	}
}

func boolString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}
