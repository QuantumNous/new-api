package security

import (
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	goahocorasick "github.com/anknown/ahocorasick"
)

// KeywordDetector 关键词检测引擎
type KeywordDetector struct {
}

func (kd *KeywordDetector) Name() string {
	return "keyword"
}

// Detect 使用 Aho-Corasick 自动机检测关键词
func (kd *KeywordDetector) Detect(content string, rules []*model.SecurityRule) (*EngineResult, error) {
	result := &EngineResult{
		EngineName: kd.Name(),
		Detected:   false,
		Matches:    make([]*dto.SecurityMatchResult, 0),
		RiskScore:  0,
	}

	type keywordRule struct {
		keyword string
		rule    *model.SecurityRule
	}

	var allKeywords []string
	var keywordRules []keywordRule

	for _, rule := range rules {
		if rule.Type != constant.SecurityRuleTypeKeyword || rule.Status != constant.SecurityStatusEnabled {
			continue
		}

		keywords := strings.Split(rule.Content, ",")
		for _, keyword := range keywords {
			keyword = strings.TrimSpace(keyword)
			if keyword == "" {
				continue
			}
			allKeywords = append(allKeywords, strings.ToLower(keyword))
			keywordRules = append(keywordRules, keywordRule{keyword: keyword, rule: rule})
		}
	}

	if len(allKeywords) == 0 {
		return result, nil
	}

	// 构建 AC 自动机
	m := new(goahocorasick.Machine)
	runesDict := make([][]rune, 0, len(allKeywords))
	for _, kw := range allKeywords {
		runesDict = append(runesDict, []rune(kw))
	}
	if err := m.Build(runesDict); err != nil {
		return result, err
	}

	// 搜索（转为小写以支持大小写不敏感匹配）
	contentRunes := []rune(strings.ToLower(content))
	hits := m.MultiPatternSearch(contentRunes, false)

	if len(hits) == 0 {
		return result, nil
	}

	// 建立 rune 位置到 byte 位置的映射
	runeToByte := make([]int, len(contentRunes)+1)
	byteIdx := 0
	for i, r := range contentRunes {
		runeToByte[i] = byteIdx
		byteIdx += utf8.RuneLen(r)
	}
	runeToByte[len(contentRunes)] = byteIdx

	// 建立关键词到规则列表的映射
	keywordRuleMap := make(map[string][]keywordRule)
	for _, kr := range keywordRules {
		lk := strings.ToLower(kr.keyword)
		keywordRuleMap[lk] = append(keywordRuleMap[lk], kr)
	}

	// 每个关键词只取第一次命中的位置（与原 string.Index 行为一致）
	type hitInfo struct {
		pos  int
		word []rune
	}
	keywordFirstHit := make(map[string]hitInfo)
	for _, hit := range hits {
		word := string(hit.Word)
		if _, ok := keywordFirstHit[word]; !ok {
			keywordFirstHit[word] = hitInfo{pos: hit.Pos, word: hit.Word}
		}
	}

	matchedRules := make(map[int64]bool)

	for _, kr := range keywordRules {
		rule := kr.rule
		if matchedRules[rule.ID] {
			continue
		}

		lk := strings.ToLower(kr.keyword)
		info, ok := keywordFirstHit[lk]
		if !ok {
			continue
		}

		matchedRules[rule.ID] = true
		start := runeToByte[info.pos]
		end := runeToByte[info.pos+len(info.word)]

		result.Detected = true
		if rule.RiskScore > result.RiskScore {
			result.RiskScore = rule.RiskScore
		}
		result.Matches = append(result.Matches, &dto.SecurityMatchResult{
			RuleID:      rule.ID,
			GroupID:     rule.GroupID,
			Type:        rule.Type,
			MatchedText: content[start:end],
			Position:    [2]int{start, end},
		})
	}

	return result, nil
}
