package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestNormalizeCodexPatternsOptionValueSerializesLineText(t *testing.T) {
	value, err := normalizeCodexPatternsOptionValue(operation_setting.DefaultCodexUnsupportedPattern + "\n")
	if err != nil {
		t.Fatalf("normalizeCodexPatternsOptionValue returned error: %v", err)
	}

	var patterns []string
	if err := common.UnmarshalJsonStr(value, &patterns); err != nil {
		t.Fatalf("normalized value is not a JSON string array: %v", err)
	}
	if len(patterns) != 1 || patterns[0] != operation_setting.DefaultCodexUnsupportedPattern {
		t.Fatalf("patterns = %v, want default pattern", patterns)
	}
}

func TestNormalizeCodexPatternsOptionValueRejectsInvalidRegex(t *testing.T) {
	_, err := normalizeCodexPatternsOptionValue(`(`)
	if err == nil {
		t.Fatal("expected invalid regex error")
	}
}

func TestNormalizeStringSliceOptionValueSerializesArrayInput(t *testing.T) {
	value, values, err := normalizeStringSliceOptionValue([]any{
		"https://example.com/codex",
		" https://example.com/changelog ",
	})
	if err != nil {
		t.Fatalf("normalizeStringSliceOptionValue returned error: %v", err)
	}
	if len(values) != 2 {
		t.Fatalf("normalized values = %v, want 2 values", values)
	}

	var decoded []string
	if err := common.UnmarshalJsonStr(value, &decoded); err != nil {
		t.Fatalf("normalized value is not a JSON string array: %v", err)
	}
	if len(decoded) != 2 || decoded[1] != "https://example.com/changelog" {
		t.Fatalf("decoded values = %v", decoded)
	}
}
