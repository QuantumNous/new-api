package groksubscription

import "testing"

func TestSanitizeStripsToolConfigForCompact(t *testing.T) {
	in := []byte(`{"model":"grok-4","tools":[{"type":"function"}],"tool_choice":"auto","parallel_tool_calls":true,"max_tool_calls":3,"tool_resources":{"x":1},"input":[]}`)
	out, err := SanitizeCompactRequest(in)
	if err != nil {
		t.Fatalf("sanitize err %v", err)
	}
	for _, forbidden := range []string{"tools", "tool_choice", "parallel_tool_calls", "max_tool_calls", "tool_resources"} {
		if hasTopLevelKey(out, forbidden) {
			t.Fatalf("compact sanitizer must strip top-level %q", forbidden)
		}
	}
}

func TestSanitizeRunsAfterParamOverride(t *testing.T) {
	overridden := []byte(`{"model":"grok-4","tools":[{"type":"function"}],"input":[]}`)
	out, err := SanitizeCompactRequest(overridden)
	if err != nil {
		t.Fatalf("sanitize err %v", err)
	}
	if hasTopLevelKey(out, "tools") {
		t.Fatalf("sanitizer must remove tools even if reintroduced by override")
	}
}
