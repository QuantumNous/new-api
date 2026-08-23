package reasoning

import "testing"

func TestTrimEffortSuffixPrefersLongerMatches(t *testing.T) {
	base, level, ok := TrimEffortSuffix("gemini-3-pro-xhigh")
	if !ok || base != "gemini-3-pro" || level != LevelXHigh {
		t.Fatalf("TrimEffortSuffix(xhigh)=(%q,%q,%v)", base, level, ok)
	}

	base, level, ok = TrimEffortSuffix("gpt-test-max")
	if !ok || base != "gpt-test" || level != LevelMax {
		t.Fatalf("TrimEffortSuffix(max)=(%q,%q,%v)", base, level, ok)
	}

	effort, model := ParseOpenAIReasoningEffortFromModelSuffix("gpt-5-xhigh")
	if effort != LevelXHigh || model != "gpt-5" {
		t.Fatalf("ParseOpenAIReasoningEffortFromModelSuffix(xhigh)=(%q,%q)", effort, model)
	}
}
