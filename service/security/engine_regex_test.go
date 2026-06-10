package security

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestRegexDetector_Detect(t *testing.T) {
	detector := &RegexDetector{}
	rules := []*model.SecurityRule{
		{
			ID:        1,
			GroupID:   1,
			Type:      constant.SecurityRuleTypeRegex,
			Content:   `1[3-9]\d{9}`,
			Action:    constant.SecurityActionMask,
			RiskScore: 70,
			Status:    constant.SecurityStatusEnabled,
		},
		{
			ID:        2,
			GroupID:   1,
			Type:      constant.SecurityRuleTypeRegex,
			Content:   `(?P<invalid>`,
			Action:    constant.SecurityActionBlock,
			RiskScore: 50,
			Status:    constant.SecurityStatusEnabled,
		},
	}

	result, err := detector.Detect("请联系 13800138000", rules)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Detected {
		t.Fatalf("expected detected, got not detected")
	}
	if result.RiskScore != 70 {
		t.Fatalf("expected risk score 70, got %d", result.RiskScore)
	}
	if len(result.Matches) != 1 {
		t.Fatalf("expected 1 match, got %d", len(result.Matches))
	}

	// 未命中
	result, err = detector.Detect("普通内容", rules)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Detected {
		t.Fatalf("expected not detected, got detected")
	}
}
