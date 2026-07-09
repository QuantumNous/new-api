package model_setting

import "testing"

func TestParseClientGoneFallbackSettings(t *testing.T) {
	raw := `{"policies":[{"enabled":true,"model_id":"claude-opus-4-8","frt_timeout_seconds":20,"extra_seconds_per_mb":10}]}`
	settings, err := ParseClientGoneFallbackSettings(raw)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if len(settings.Policies) != 1 {
		t.Fatalf("expected 1 policy, got %d", len(settings.Policies))
	}

	if _, err := ParseClientGoneFallbackSettings(`{"policies":[{"enabled":true,"model_id":"m","frt_timeout_seconds":0}]}`); err == nil {
		t.Fatalf("frt_timeout_seconds=0 should be rejected")
	}
	if _, err := ParseClientGoneFallbackSettings(`{"policies":[{"enabled":true,"model_id":"m","frt_timeout_seconds":20,"extra_seconds_per_mb":-1}]}`); err == nil {
		t.Fatalf("negative extra_seconds_per_mb should be rejected")
	}
	// extra_seconds_per_mb 允许为 0
	if _, err := ParseClientGoneFallbackSettings(`{"policies":[{"enabled":true,"model_id":"m","frt_timeout_seconds":20,"extra_seconds_per_mb":0}]}`); err != nil {
		t.Fatalf("extra_seconds_per_mb=0 should be accepted: %v", err)
	}
	if _, err := ParseClientGoneFallbackSettings(`{"policies":[{"enabled":true,"model_id":"m","frt_timeout_seconds":20},{"enabled":true,"model_id":"m","frt_timeout_seconds":30}]}`); err == nil {
		t.Fatalf("duplicate model_id should be rejected")
	}
}

func TestClientGoneFallbackFirstByteTimeout(t *testing.T) {
	policy := ClientGoneFallbackPolicy{FrtTimeoutSeconds: 20, ExtraSecondsPerMB: 10}
	if got := policy.FirstByteTimeoutSeconds(0); got != 20 {
		t.Fatalf("expected 20, got %d", got)
	}
	if got := policy.FirstByteTimeoutSeconds(3 * 1024 * 1024); got != 50 {
		t.Fatalf("expected 50 for 3MB, got %d", got)
	}
	// 每 MB 加秒为 0 时阈值不随 body 浮动
	policy.ExtraSecondsPerMB = 0
	if got := policy.FirstByteTimeoutSeconds(10 * 1024 * 1024); got != 20 {
		t.Fatalf("expected 20 with zero per-mb, got %d", got)
	}
}

func TestFindClientGoneFallbackPolicy(t *testing.T) {
	prev := clientGoneFallbackSettings
	defer func() { clientGoneFallbackSettings = prev }()

	if _, err := ApplyClientGoneFallbackSettings(`{"policies":[{"enabled":true,"model_id":"claude-opus-4-8","frt_timeout_seconds":20,"extra_seconds_per_mb":10},{"enabled":false,"model_id":"gpt-5.4","frt_timeout_seconds":20}]}`); err != nil {
		t.Fatalf("apply failed: %v", err)
	}
	if _, ok := FindClientGoneFallbackPolicy("claude-opus-4-8"); !ok {
		t.Fatalf("enabled policy should be found")
	}
	if _, ok := FindClientGoneFallbackPolicy("gpt-5.4"); ok {
		t.Fatalf("disabled policy should not be found")
	}
	if _, ok := FindClientGoneFallbackPolicy("unknown-model"); ok {
		t.Fatalf("unknown model should not be found")
	}
}
