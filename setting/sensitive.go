package setting

import (
	"fmt"
	"regexp"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var CheckSensitiveEnabled = true
var CheckSensitiveOnPromptEnabled = true

//var CheckSensitiveOnCompletionEnabled = true

// StopOnSensitiveEnabled controls whether generation stops when sensitive words are detected.
var StopOnSensitiveEnabled = true

// StreamCacheQueueLength is the streaming cache queue length; 0 means no cache.
var StreamCacheQueueLength = 0

// SensitiveWords contains the global sensitive word list.
var SensitiveWords = []string{
	"test_sensitive",
}

type SensitiveCheckRuleConfig struct {
	Version int                  `json:"version"`
	Rules   []SensitiveCheckRule `json:"rules"`
}

type SensitiveCheckRule struct {
	ID                 string   `json:"id,omitempty"`
	Name               string   `json:"name,omitempty"`
	Enabled            bool     `json:"enabled"`
	Groups             []string `json:"groups,omitempty"`
	Models             []string `json:"models,omitempty"`
	ModelRegex         []string `json:"model_regex,omitempty"`
	IncludeGlobalWords bool     `json:"include_global_words"`
	Words              []string `json:"words,omitempty"`
}

var SensitiveCheckRules = SensitiveCheckRuleConfig{Version: 1, Rules: []SensitiveCheckRule{}}

var sensitiveMutex sync.RWMutex

func SensitiveWordsToString() string {
	sensitiveMutex.RLock()
	defer sensitiveMutex.RUnlock()
	return strings.Join(SensitiveWords, "\n")
}

func SensitiveWordsFromString(s string) {
	words := parseSensitiveWords(s)
	sensitiveMutex.Lock()
	defer sensitiveMutex.Unlock()
	SensitiveWords = words
}

func GetSensitiveWordsCopy() []string {
	sensitiveMutex.RLock()
	defer sensitiveMutex.RUnlock()
	return append([]string(nil), SensitiveWords...)
}

func SensitiveCheckRulesToString() string {
	config := GetSensitiveCheckRulesCopy()
	jsonBytes, err := common.Marshal(config)
	if err != nil {
		common.SysLog("error marshalling sensitive check rules: " + err.Error())
		return `{"version":1,"rules":[]}`
	}
	return string(jsonBytes)
}

func SensitiveCheckRulesFromString(s string) error {
	config, err := ParseSensitiveCheckRules(s)
	if err != nil {
		return err
	}
	sensitiveMutex.Lock()
	defer sensitiveMutex.Unlock()
	SensitiveCheckRules = config
	return nil
}

func GetSensitiveCheckRulesCopy() SensitiveCheckRuleConfig {
	sensitiveMutex.RLock()
	defer sensitiveMutex.RUnlock()

	config := SensitiveCheckRuleConfig{
		Version: SensitiveCheckRules.Version,
		Rules:   make([]SensitiveCheckRule, 0, len(SensitiveCheckRules.Rules)),
	}
	if config.Version == 0 {
		config.Version = 1
	}
	for _, rule := range SensitiveCheckRules.Rules {
		config.Rules = append(config.Rules, cloneSensitiveCheckRule(rule))
	}
	return config
}

func HasSensitiveCheckRules() bool {
	sensitiveMutex.RLock()
	defer sensitiveMutex.RUnlock()
	return len(SensitiveCheckRules.Rules) > 0
}

func ValidateSensitiveCheckRules(s string) error {
	_, err := ParseSensitiveCheckRules(s)
	return err
}

func ParseSensitiveCheckRules(s string) (SensitiveCheckRuleConfig, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return SensitiveCheckRuleConfig{Version: 1, Rules: []SensitiveCheckRule{}}, nil
	}

	config := SensitiveCheckRuleConfig{}
	if err := common.UnmarshalJsonStr(s, &config); err != nil {
		return SensitiveCheckRuleConfig{}, err
	}
	if config.Version == 0 {
		config.Version = 1
	}
	if config.Version != 1 {
		return SensitiveCheckRuleConfig{}, fmt.Errorf("unsupported sensitive check rules version: %d", config.Version)
	}
	if config.Rules == nil {
		config.Rules = []SensitiveCheckRule{}
	}

	normalizedRules := make([]SensitiveCheckRule, 0, len(config.Rules))
	for i, rule := range config.Rules {
		normalized, err := normalizeSensitiveCheckRule(rule)
		if err != nil {
			return SensitiveCheckRuleConfig{}, fmt.Errorf("rule %d invalid: %w", i+1, err)
		}
		normalizedRules = append(normalizedRules, normalized)
	}
	config.Rules = normalizedRules
	return config, nil
}

func ShouldCheckPromptSensitive() bool {
	return CheckSensitiveEnabled && CheckSensitiveOnPromptEnabled
}

//func ShouldCheckCompletionSensitive() bool {
//	return CheckSensitiveEnabled && CheckSensitiveOnCompletionEnabled
//}

func parseSensitiveWords(s string) []string {
	words := make([]string, 0)
	for _, w := range strings.Split(s, "\n") {
		w = strings.TrimSpace(w)
		if w != "" {
			words = append(words, w)
		}
	}
	return words
}

func cloneSensitiveCheckRule(rule SensitiveCheckRule) SensitiveCheckRule {
	rule.Groups = append([]string(nil), rule.Groups...)
	rule.Models = append([]string(nil), rule.Models...)
	rule.ModelRegex = append([]string(nil), rule.ModelRegex...)
	rule.Words = append([]string(nil), rule.Words...)
	return rule
}

func normalizeSensitiveCheckRule(rule SensitiveCheckRule) (SensitiveCheckRule, error) {
	rule.ID = strings.TrimSpace(rule.ID)
	rule.Name = strings.TrimSpace(rule.Name)
	rule.Groups = normalizeStringList(rule.Groups)
	rule.Models = normalizeStringList(rule.Models)
	rule.ModelRegex = normalizeStringList(rule.ModelRegex)
	rule.Words = normalizeStringList(rule.Words)

	for _, pattern := range rule.ModelRegex {
		if _, err := regexp.Compile(pattern); err != nil {
			return SensitiveCheckRule{}, fmt.Errorf("invalid model_regex %q: %w", pattern, err)
		}
	}
	if rule.Enabled && !rule.IncludeGlobalWords && len(rule.Words) == 0 {
		return SensitiveCheckRule{}, fmt.Errorf("enabled rule must include global words or custom words")
	}
	return rule, nil
}

func normalizeStringList(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
