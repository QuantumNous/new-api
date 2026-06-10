package security

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// KeywordDetector 关键词检测引擎
type KeywordDetector struct {
}

func (kd *KeywordDetector) Name() string {
	return "keyword"
}

// Detect 使用字符串匹配检测关键词
func (kd *KeywordDetector) Detect(content string, rules []*model.SecurityRule) (*EngineResult, error) {
	result := &EngineResult{
		EngineName: kd.Name(),
		Detected:   false,
		Matches:    make([]*dto.SecurityMatchResult, 0),
		RiskScore:  0,
	}

	lowerContent := strings.ToLower(content)
	for _, rule := range rules {
		if rule.Type != constant.SecurityRuleTypeKeyword || rule.Status != constant.SecurityStatusEnabled {
			continue
		}

		keywords := strings.Split(rule.Content, ",")
		for _, keyword := range keywords {
			keyword = strings.TrimSpace(strings.ToLower(keyword))
			if keyword == "" {
				continue
			}

			idx := strings.Index(lowerContent, keyword)
			if idx != -1 {
				result.Detected = true
				if rule.RiskScore > result.RiskScore {
					result.RiskScore = rule.RiskScore
				}
				result.Matches = append(result.Matches, &dto.SecurityMatchResult{
					RuleID:      rule.ID,
					GroupID:     rule.GroupID,
					Type:        rule.Type,
					MatchedText: content[idx : idx+len(keyword)],
					Position:    [2]int{idx, idx + len(keyword)},
				})
			}
		}
	}

	return result, nil
}
