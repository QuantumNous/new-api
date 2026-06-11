package security

import (
	"sync"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/dlclark/regexp2"
)

var (
	regexCache   = make(map[string]*regexp2.Regexp)
	regexCacheMu sync.RWMutex
)

// RegexDetector 正则检测引擎
type RegexDetector struct{}

func (rd *RegexDetector) Name() string { return "regex" }

func (rd *RegexDetector) getCompiled(pattern string) (*regexp2.Regexp, error) {
	regexCacheMu.RLock()
	re, ok := regexCache[pattern]
	regexCacheMu.RUnlock()
	if ok {
		return re, nil
	}

	re, err := regexp2.Compile(pattern, 0)
	if err != nil {
		return nil, err
	}

	regexCacheMu.Lock()
	regexCache[pattern] = re
	regexCacheMu.Unlock()
	return re, nil
}

// Detect 使用正则表达式检测
func (rd *RegexDetector) Detect(content string, rules []*model.SecurityRule) (*EngineResult, error) {
	result := &EngineResult{
		EngineName: rd.Name(),
		Detected:   false,
		Matches:    make([]*dto.SecurityMatchResult, 0),
		RiskScore:  0,
	}

	// 建立 rune 位置到 byte 位置的映射（与 keyword 引擎保持一致）
	contentRunes := []rune(content)
	runeToByte := make([]int, len(contentRunes)+1)
	byteIdx := 0
	for i, r := range contentRunes {
		runeToByte[i] = byteIdx
		byteIdx += utf8.RuneLen(r)
	}
	runeToByte[len(contentRunes)] = byteIdx

	for _, rule := range rules {
		if rule.Type != constant.SecurityRuleTypeRegex || rule.Status != constant.SecurityStatusEnabled {
			continue
		}

		re, err := rd.getCompiled(rule.Content)
		if err != nil {
			continue // 跳过无效正则
		}

		match, err := re.FindStringMatch(content)
		if err != nil {
			continue
		}

		if match != nil {
			result.Detected = true
			if rule.RiskScore > result.RiskScore {
				result.RiskScore = rule.RiskScore
			}

			matchedText := match.String()
			// regexp2 的 Index/Length 是 rune 位置，转换为 byte 位置
			start := runeToByte[match.Index]
			end := runeToByte[match.Index+match.Length]

			result.Matches = append(result.Matches, &dto.SecurityMatchResult{
				RuleID:      rule.ID,
				GroupID:     rule.GroupID,
				Type:        rule.Type,
				MatchedText: matchedText,
				Position:    [2]int{start, end},
			})
		}
	}

	return result, nil
}
