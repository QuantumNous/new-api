package ratio_setting

import "testing"

// TestGrok46DefaultRatios locks grok-4.6 to xAI's official standard-tier API
// pricing (<200K context): input $2/M, output $6/M, cached input $0.5/M.
// With USD=500 (ratio 1.0 == $2/M input), that maps to:
//
//	model ratio      = 1     ($2/M input)
//	completion ratio = 3     ($6/M output = 3x input)
//	cache ratio      = 0.25  ($0.5/M cached input = 0.25x input)
//
// No defaultCreateCacheRatio entry is registered on purpose: xAI bills only
// cached-read ($0.5/M), it has no cache-write/creation charge, and the Grok
// adaptor never emits cache-creation tokens (chat_response_bridge.go maps only
// CachedTokens). GetCreateCacheRatio missing the key => no cache-write billing,
// which is the correct behavior here.
func TestGrok46DefaultRatios(t *testing.T) {
	if got := defaultModelRatio["grok-4.6"]; got != 1 {
		t.Fatalf("input ratio = %v, want 1", got)
	}
	if got := defaultCompletionRatio["grok-4.6"]; got != 3 {
		t.Fatalf("completion ratio = %v, want 3", got)
	}
	if got := defaultCacheRatio["grok-4.6"]; got != 0.25 {
		t.Fatalf("cache ratio = %v, want 0.25", got)
	}
}

// TestGrok46CompletionRatioResolves guards the interaction with the hardcoded
// completion-ratio table: grok has no hardcoded override (returns contain=false),
// so GetCompletionRatio must fall through to the map value we registered. If a
// future "grok" hardcoded branch is added upstream it would shadow the map and
// silently break output billing — this test fails loudly if that happens.
func TestGrok46CompletionRatioResolves(t *testing.T) {
	InitRatioSettings()
	if got := GetCompletionRatio("grok-4.6"); got != 3 {
		t.Fatalf("GetCompletionRatio(grok-4.6) = %v, want 3", got)
	}
}
