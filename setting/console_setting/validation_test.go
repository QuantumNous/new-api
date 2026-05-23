package console_setting

import "testing"

func TestValidateUptimeKumaGroupsAllowsDirectHeartbeatURLWithoutSlug(t *testing.T) {
	settings := `[{
		"categoryName": "Foxcode",
		"url": "https://status.rjj.cc/api/status-page/heartbeat/foxcode",
		"description": "Foxcode 模型状态"
	}]`

	if err := validateUptimeKumaGroups(settings); err != nil {
		t.Fatalf("expected direct heartbeat URL without slug to be valid, got %v", err)
	}
}
