package setting

import "testing"

func TestGlobalModelAlias_LookupHit(t *testing.T) {
	if err := UpdateGlobalModelAliasByJSONString(`{"gpt-4o":"openai/gpt-4o","claude-3-5-sonnet":"anthropic/claude-3-5-sonnet"}`); err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if got := GetGlobalModelAlias("gpt-4o"); got != "openai/gpt-4o" {
		t.Errorf("gpt-4o: want openai/gpt-4o, got %q", got)
	}
	if got := GetGlobalModelAlias("claude-3-5-sonnet"); got != "anthropic/claude-3-5-sonnet" {
		t.Errorf("claude: want anthropic/claude-3-5-sonnet, got %q", got)
	}
}

func TestGlobalModelAlias_MissReturnsEmpty(t *testing.T) {
	if err := UpdateGlobalModelAliasByJSONString(`{"gpt-4o":"openai/gpt-4o"}`); err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if got := GetGlobalModelAlias("unknown-model"); got != "" {
		t.Errorf("miss: want empty, got %q", got)
	}
	if got := GetGlobalModelAlias(""); got != "" {
		t.Errorf("empty input: want empty, got %q", got)
	}
}

func TestGlobalModelAlias_EmptyInputClears(t *testing.T) {
	if err := UpdateGlobalModelAliasByJSONString(`{"gpt-4o":"openai/gpt-4o"}`); err != nil {
		t.Fatalf("seed failed: %v", err)
	}
	for _, raw := range []string{"", "   ", "null"} {
		if err := UpdateGlobalModelAliasByJSONString(raw); err != nil {
			t.Fatalf("clear with %q failed: %v", raw, err)
		}
		if got := GetGlobalModelAlias("gpt-4o"); got != "" {
			t.Errorf("after clearing with %q: want empty, got %q", raw, got)
		}
	}
}

func TestGlobalModelAlias_InvalidJSON(t *testing.T) {
	if err := UpdateGlobalModelAliasByJSONString(`{not-json`); err == nil {
		t.Errorf("want error for invalid JSON, got nil")
	}
}

func TestGlobalModelAlias_RoundTripJSON(t *testing.T) {
	if err := UpdateGlobalModelAliasByJSONString(`{"a":"x/a"}`); err != nil {
		t.Fatalf("update failed: %v", err)
	}
	got := GlobalModelAlias2JSONString()
	if got != `{"a":"x/a"}` {
		t.Errorf("round-trip: want {\"a\":\"x/a\"}, got %q", got)
	}
}
