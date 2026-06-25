package service

import "testing"

func TestParseImageTaskUpstreamError_moderationBlocked(t *testing.T) {
	msg := `upstream error: HTTP 400: {"error":{"message":"Your request was rejected by the safety system.","type":"image_generation_user_error","param":"","code":"moderation_blocked"}}`
	code, reason := parseImageTaskUpstreamError("task_failed", msg)
	if code != "moderation_blocked" {
		t.Fatalf("code = %q, want moderation_blocked", code)
	}
	if reason != "Your request was rejected by the safety system." {
		t.Fatalf("reason = %q", reason)
	}
	display := FormatImageTaskFailReason(code, reason)
	if display != "Your request was rejected by the safety system. (moderation_blocked)" {
		t.Fatalf("display = %q", display)
	}
}

func TestFormatImageTaskFailReason_emptyCode(t *testing.T) {
	got := FormatImageTaskFailReason("", "timeout")
	if got != "timeout" {
		t.Fatalf("got %q", got)
	}
}
