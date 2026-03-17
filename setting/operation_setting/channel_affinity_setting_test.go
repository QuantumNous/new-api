package operation_setting

import "testing"

func TestDefaultChannelAffinitySettingIncludesGeminiConversationRule(t *testing.T) {
	setting := GetChannelAffinitySetting()
	if setting == nil {
		t.Fatal("expected channel affinity setting")
	}

	var geminiRule *ChannelAffinityRule
	for i := range setting.Rules {
		rule := &setting.Rules[i]
		if rule.Name == "other-models gemini-native" {
			geminiRule = rule
			break
		}
	}
	if geminiRule == nil {
		t.Fatal("expected default gemini affinity rule")
	}

	if len(geminiRule.KeySources) < 5 {
		t.Fatalf("expected multiple gemini key sources, got %d", len(geminiRule.KeySources))
	}

	assertKeySource := func(index int, typ string, path string, key string) {
		t.Helper()
		if geminiRule.KeySources[index].Type != typ || geminiRule.KeySources[index].Path != path || geminiRule.KeySources[index].Key != key {
			t.Fatalf("unexpected key source[%d]: %#v", index, geminiRule.KeySources[index])
		}
	}

	assertKeySource(0, "gjson", "metadata.conversation_id", "")
	assertKeySource(1, "gjson", "metadata.thread_id", "")
	assertKeySource(2, "gjson", "metadata.session_id", "")
	assertKeySource(3, "gjson", "metadata.user_id", "")
	assertKeySource(4, "context_int", "", "token_id")

	if geminiRule.TTLSeconds != 3600 {
		t.Fatalf("expected gemini TTLSeconds=3600, got %d", geminiRule.TTLSeconds)
	}
}
