package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestModelDataStatusMetadataModelAutoDisabled(t *testing.T) {
	otherInfo := `{
		"auto_disabled_models": {
			"claude-opus-4.8": {
				"disabled_at": 1783560000,
				"pass_count": 3,
				"reason": "HTTP 403 model access denied"
			}
		}
	}`

	reason, statusTime, passCount := modelDataStatusMetadata(common.ChannelStatusEnabled, false, &otherInfo, "claude-opus-4.8", 0)

	if reason != "HTTP 403 model access denied" {
		t.Fatalf("reason = %q", reason)
	}
	if statusTime != 1783560000 {
		t.Fatalf("statusTime = %d", statusTime)
	}
	if passCount != 3 {
		t.Fatalf("passCount = %d", passCount)
	}
}

func TestModelDataStatusMetadataManualModelDisabledHasNoAutoMetadata(t *testing.T) {
	otherInfo := `{}`

	reason, statusTime, passCount := modelDataStatusMetadata(common.ChannelStatusEnabled, false, &otherInfo, "claude-opus-4.8", 7)

	if reason != "" {
		t.Fatalf("reason = %q", reason)
	}
	if statusTime != 0 {
		t.Fatalf("statusTime = %d", statusTime)
	}
	if passCount != 7 {
		t.Fatalf("passCount = %d", passCount)
	}
}
