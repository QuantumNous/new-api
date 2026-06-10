package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestNormalizeCodexPatternsOptionValueSerializesLineText(t *testing.T) {
	value, err := normalizeCodexPatternsOptionValue(operation_setting.DefaultCodexUnsupportedPattern)
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
