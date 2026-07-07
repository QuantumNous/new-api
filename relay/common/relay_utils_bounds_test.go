package common

import "testing"

func TestValidateTaskDurationBoundsRejectsOversizedSeconds(t *testing.T) {
	if err := validateTaskDurationBounds(TaskSubmitReq{Seconds: "3600"}); err != nil {
		t.Fatalf("valid seconds rejected: %v", err)
	}
	if err := validateTaskDurationBounds(TaskSubmitReq{Seconds: "3601"}); err == nil {
		t.Fatal("oversized seconds should be rejected")
	}
	if err := validateTaskDurationBounds(TaskSubmitReq{Duration: -1}); err == nil {
		t.Fatal("negative duration should be rejected")
	}
}
