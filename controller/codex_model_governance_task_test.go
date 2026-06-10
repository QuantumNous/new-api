package controller

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestCodexGovernanceProbeIntervalFallsBackToOneHour(t *testing.T) {
	got := codexGovernanceProbeInterval(&operation_setting.CodexModelGovernanceSetting{ProbeIntervalMinutes: 0})

	if got != time.Hour {
		t.Fatalf("interval = %s, want %s", got, time.Hour)
	}
}

func TestClassifyCodexGovernanceProbeErrorOnlyMatchesConfiguredRules(t *testing.T) {
	patterns := []string{`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`}
	strict := classifyCodexGovernanceProbeError(
		"The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account.",
		patterns,
	)
	if !strict.Matched || strict.ModelName != "gpt-5.3-codex" {
		t.Fatalf("strict match = %#v, want extracted model", strict)
	}

	for _, message := range []string{"model_not_found", "unsupported model", "rate limit exceeded", "request timeout"} {
		match := classifyCodexGovernanceProbeError(message, patterns)
		if match.Matched {
			t.Fatalf("generic message %q matched: %#v", message, match)
		}
	}
}
