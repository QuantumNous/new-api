package kids

import "testing"

func TestIsModelEligible(t *testing.T) {
	cases := []struct {
		model string
		want  bool
	}{
		{"gpt-4o-mini", true},
		{"claude-3-5-sonnet-latest", true},
		{"claude-3-5-sonnet-20241022", true}, // versioned variant of whitelisted base
		// claude-haiku-4-5 is the current successor to claude-3-5-haiku
		{"claude-haiku-4-5", true},
		{"claude-haiku-4-5-20251001", true}, // dated snapshot via HasPrefix
		{"claude-opus-5", false},            // frontier tier is deliberately NOT kids-eligible
		{"claude-sonnet-5", false},
		{"gpt-3.5-turbo", false}, // not on whitelist
		{"some-uncensored-model-v2", false},
		{"", false},
		// gpt-image-2 lineup (added 2026-04-21, replaced DALL-E on 2026-05-12)
		{"gpt-image-2", true},
		{"gpt-image-2-2026-04-21", true}, // snapshot variant via HasPrefix
		{"gpt-image-1", true},            // kept as fallback for older channels
		{"dall-e-3", false},              // retired by OpenAI on 2026-05-12
		{"dall-e-2", false},              // retired same date
	}
	for _, tc := range cases {
		if got := IsModelEligible(tc.model); got != tc.want {
			t.Errorf("IsModelEligible(%q) = %v, want %v", tc.model, got, tc.want)
		}
	}
}

func TestStripIdentifyingMetadata(t *testing.T) {
	req := map[string]any{
		"model": "gpt-4o-mini",
		"user":  "kid-12345",
		"metadata": map[string]any{
			"user_id":        "u1",
			"kid_profile_id": "k1",
			"family_id":      "f1",
			"safe_field":     "keep-me",
		},
		"messages": []any{},
	}
	got := StripIdentifyingMetadata(req)
	if _, has := got["user"]; has {
		t.Errorf("expected 'user' removed, still present")
	}
	md, _ := got["metadata"].(map[string]any)
	if _, has := md["user_id"]; has {
		t.Errorf("expected metadata.user_id removed")
	}
	if _, has := md["kid_profile_id"]; has {
		t.Errorf("expected metadata.kid_profile_id removed")
	}
	if md["safe_field"] != "keep-me" {
		t.Errorf("expected safe_field preserved, got %v", md["safe_field"])
	}
}

func TestStripIdentifyingMetadata_DropsEmptyMetadata(t *testing.T) {
	req := map[string]any{
		"metadata": map[string]any{
			"user_id": "u1",
		},
	}
	got := StripIdentifyingMetadata(req)
	if _, has := got["metadata"]; has {
		t.Errorf("expected metadata removed when it becomes empty")
	}
}

func TestEnforceZeroDataRetention_OpenAI(t *testing.T) {
	req := map[string]any{"model": "gpt-4o-mini"}
	got := EnforceZeroDataRetention(req, "openai")
	if got["store"] != false {
		t.Errorf("expected store=false for openai, got %v", got["store"])
	}
}

func TestEnforceZeroDataRetention_NonOpenAI(t *testing.T) {
	req := map[string]any{"model": "claude-3-5-haiku-latest"}
	got := EnforceZeroDataRetention(req, "anthropic")
	if _, has := got["store"]; has {
		t.Errorf("expected store NOT set for non-openai, got %v", got["store"])
	}
}

func TestChildSafeSystemPrompt_Nonempty(t *testing.T) {
	if p := ChildSafeSystemPrompt(); len(p) < 50 {
		t.Errorf("system prompt too short, got %d chars", len(p))
	}
}
