package model

import (
	"strings"
	"testing"
)

func TestOpsExternalAPIKeyPredicateExcludesPlayground(t *testing.T) {
	if !strings.Contains(opsExternalAPIKeyLogPredicate, "token_id > 0") {
		t.Fatal("external API usage must require a real token")
	}
	if !strings.Contains(opsExternalAPIKeyLogPredicate, "token_name NOT LIKE 'playground%'") {
		t.Fatal("P1 must exclude Playground requests")
	}
}
