package service

import (
	"strings"
	"testing"
)

func TestClassifyCodexUnsupportedMessageMatchesConfiguredRegexAndExtractsModel(t *testing.T) {
	message := "The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account."
	patterns := []string{`The '([^']+)' model is not supported when using Codex with a ChatGPT account\.`}

	match := ClassifyCodexUnsupportedMessage(message, patterns)

	if !match.Matched {
		t.Fatalf("expected unsupported message to match")
	}
	if match.ModelName != "gpt-5.3-codex" {
		t.Fatalf("model name = %q, want %q", match.ModelName, "gpt-5.3-codex")
	}
	if match.Pattern != patterns[0] {
		t.Fatalf("pattern = %q, want %q", match.Pattern, patterns[0])
	}
}

func TestClassifyCodexUnsupportedMessageRequiresConfiguredRegex(t *testing.T) {
	genericMessages := []string{
		"model_not_found",
		"unsupported model",
		"request timeout",
		"rate limit exceeded",
	}

	for _, message := range genericMessages {
		match := ClassifyCodexUnsupportedMessage(message, nil)
		if match.Matched {
			t.Fatalf("message %q matched without configured regex: %#v", message, match)
		}
	}
}

func TestClassifyCodexUnsupportedMessageIgnoresBlankAndInvalidRegex(t *testing.T) {
	patterns := []string{
		"",
		"   ",
		`(`,
		`unsupported model: ([^\s]+)`,
	}

	match := ClassifyCodexUnsupportedMessage("unsupported model: gpt-5.4-codex", patterns)

	if !match.Matched {
		t.Fatalf("expected valid regex after blank/invalid patterns to match")
	}
	if match.ModelName != "gpt-5.4-codex" {
		t.Fatalf("model name = %q, want %q", match.ModelName, "gpt-5.4-codex")
	}
	if match.Pattern != patterns[3] {
		t.Fatalf("pattern = %q, want %q", match.Pattern, patterns[3])
	}
}

func TestClassifyCodexUnsupportedMessageUsesFirstCaptureGroupOnlyWhenPresent(t *testing.T) {
	match := ClassifyCodexUnsupportedMessage(
		"codex subscription rejected gpt-5.5-codex",
		[]string{`codex subscription rejected gpt-5\.5-codex`},
	)

	if !match.Matched {
		t.Fatalf("expected regex without capture group to match")
	}
	if match.ModelName != "" {
		t.Fatalf("model name = %q, want empty without capture group", match.ModelName)
	}
}

func TestFindOfficialCodexNoticeMatchRequiresExactModelAndLifecycleTerm(t *testing.T) {
	content := "The gpt-5.3-codex model will be retired for Codex subscriptions next month."

	match := FindOfficialCodexNoticeMatch(
		content,
		[]string{"gpt-5.3-codex", "gpt-5.4-codex"},
		[]string{"deprecated", "retired"},
	)

	if !match.Matched {
		t.Fatalf("expected official notice to match")
	}
	if match.ModelName != "gpt-5.3-codex" {
		t.Fatalf("model name = %q, want %q", match.ModelName, "gpt-5.3-codex")
	}
	if match.Term != "retired" {
		t.Fatalf("term = %q, want %q", match.Term, "retired")
	}
	if match.Excerpt == "" || len(match.Excerpt) > 220 {
		t.Fatalf("excerpt should be non-empty and bounded, got len=%d excerpt=%q", len(match.Excerpt), match.Excerpt)
	}
}

func TestFindOfficialCodexNoticeMatchLifecycleTermsAreCaseInsensitive(t *testing.T) {
	match := FindOfficialCodexNoticeMatch(
		"Codex update: gpt-5.4-codex is now NOT SUPPORTED for this plan.",
		[]string{"gpt-5.4-codex"},
		[]string{"not supported"},
	)

	if !match.Matched {
		t.Fatalf("expected case-insensitive lifecycle term match")
	}
	if match.Term != "not supported" {
		t.Fatalf("term = %q, want configured term casing", match.Term)
	}
}

func TestFindOfficialCodexNoticeMatchChecksLaterExactModelMentions(t *testing.T) {
	content := "Codex update: gpt-5.4-codex remains available. Effective July 1, gpt-5.4-codex will be retired for Codex subscriptions."

	match := FindOfficialCodexNoticeMatch(
		content,
		[]string{"gpt-5.4-codex"},
		[]string{"retired"},
	)

	if !match.Matched {
		t.Fatalf("expected later model mention with lifecycle term to match")
	}
	if match.ModelName != "gpt-5.4-codex" {
		t.Fatalf("model name = %q, want %q", match.ModelName, "gpt-5.4-codex")
	}
	if match.Term != "retired" {
		t.Fatalf("term = %q, want %q", match.Term, "retired")
	}
	if !strings.Contains(match.Excerpt, "retired") {
		t.Fatalf("excerpt = %q, want later lifecycle segment", match.Excerpt)
	}
}

func TestFindOfficialCodexNoticeMatchRequiresBothModelAndTerm(t *testing.T) {
	tests := []struct {
		name           string
		content        string
		modelNames     []string
		lifecycleTerms []string
	}{
		{
			name:           "model without term",
			content:        "Codex supports gpt-5.3-codex for this plan.",
			modelNames:     []string{"gpt-5.3-codex"},
			lifecycleTerms: []string{"retired"},
		},
		{
			name:           "term without model",
			content:        "A Codex model was retired.",
			modelNames:     []string{"gpt-5.3-codex"},
			lifecycleTerms: []string{"retired"},
		},
		{
			name:           "partial model name",
			content:        "gpt-5.3-codex-plus was retired.",
			modelNames:     []string{"gpt-5.3-codex"},
			lifecycleTerms: []string{"retired"},
		},
		{
			name:           "blank input",
			content:        "",
			modelNames:     []string{"gpt-5.3-codex"},
			lifecycleTerms: []string{"retired"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			match := FindOfficialCodexNoticeMatch(tt.content, tt.modelNames, tt.lifecycleTerms)
			if match.Matched {
				t.Fatalf("unexpected official notice match: %#v", match)
			}
		})
	}
}
