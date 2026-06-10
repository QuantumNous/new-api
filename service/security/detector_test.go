package security

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

func TestResolveAction(t *testing.T) {
	rules := []*model.SecurityRule{
		{ID: 1, Action: constant.SecurityActionPass},
		{ID: 2, Action: constant.SecurityActionAlert},
		{ID: 3, Action: constant.SecurityActionMask},
		{ID: 4, Action: constant.SecurityActionBlock},
		{ID: 5, Action: constant.SecurityActionReview},
	}

	matches := []*dto.SecurityMatchResult{
		{RuleID: 1},
		{RuleID: 3},
	}

	action := resolveAction(matches, rules)
	if action != constant.SecurityActionMask {
		t.Fatalf("expected mask (3), got %d", action)
	}

	matches = []*dto.SecurityMatchResult{
		{RuleID: 2},
		{RuleID: 4},
	}

	action = resolveAction(matches, rules)
	if action != constant.SecurityActionBlock {
		t.Fatalf("expected block (4), got %d", action)
	}
}

func TestApplyMasking(t *testing.T) {
	rules := []*model.SecurityRule{{ID: 1}}
	matches := []*dto.SecurityMatchResult{
		{RuleID: 1, Position: [2]int{5, 16}},
	}

	result := applyMasking("请联系 13800138000", matches, rules)
	expected := "请联系 1*********0"
	if result != expected {
		t.Fatalf("expected %q, got %q", expected, result)
	}
}

func TestMaskText(t *testing.T) {
	if maskText("ab") != "**" {
		t.Fatalf("expected **, got %s", maskText("ab"))
	}
	if maskText("abc") != "a*c" {
		t.Fatalf("expected a*c, got %s", maskText("abc"))
	}
	if maskText("abcd") != "a**d" {
		t.Fatalf("expected a**d, got %s", maskText("abcd"))
	}
}
