package service

import (
	"errors"
	"regexp"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type SensitiveCheckScope struct {
	EffectiveGroups []string
	ModelCandidates []string
	Path            string
}

type SensitiveMatchResult struct {
	ShouldCheck bool
	Words       []string
	RuleIDs     []string
	RuleNames   []string
	Legacy      bool
}

type SensitiveTextCheckResult struct {
	Contains bool
	Words    []string
	Scope    SensitiveCheckScope
	Match    SensitiveMatchResult
	ScopeKey string
	Cached   bool
}

var sensitiveRuleRegexCache sync.Map

func CheckSensitiveMessages(messages []dto.Message) ([]string, error) {
	if len(messages) == 0 {
		return nil, nil
	}

	for _, message := range messages {
		arrayContent := message.ParseContent()
		for _, m := range arrayContent {
			if m.Type == "image_url" {
				// TODO: check image url
				continue
			}
			// 检查 text 是否为空
			if m.Text == "" {
				continue
			}
			if ok, words := SensitiveWordContains(m.Text); ok {
				return words, errors.New("sensitive words detected")
			}
		}
	}
	return nil, nil
}

func CheckSensitiveText(text string) (bool, []string) {
	return CheckSensitiveTextWithWords(text, setting.GetSensitiveWordsCopy())
}

func CheckSensitiveTextWithWords(text string, words []string) (bool, []string) {
	return sensitiveWordContainsWithWords(text, words)
}

// SensitiveWordContains 是否包含敏感词，返回是否包含敏感词和敏感词列表
func SensitiveWordContains(text string) (bool, []string) {
	return sensitiveWordContainsWithWords(text, setting.GetSensitiveWordsCopy())
}

func ResolveSensitiveCheckScope(c *gin.Context, info *relaycommon.RelayInfo) SensitiveCheckScope {
	scope := SensitiveCheckScope{}
	if c != nil && c.Request != nil && c.Request.URL != nil {
		scope.Path = c.Request.URL.Path
	}
	if info == nil {
		return scope
	}

	scope.ModelCandidates = appendUniqueNonEmpty(scope.ModelCandidates, info.OriginModelName)
	scope.ModelCandidates = appendUniqueNonEmpty(scope.ModelCandidates, ratio_setting.FormatMatchingModelName(info.OriginModelName))
	if strings.HasSuffix(info.OriginModelName, ratio_setting.CompactModelSuffix) {
		scope.ModelCandidates = appendUniqueNonEmpty(scope.ModelCandidates, strings.TrimSuffix(info.OriginModelName, ratio_setting.CompactModelSuffix))
	}

	currentGroup := ""
	if c != nil {
		currentGroup = common.GetContextKeyString(c, constant.ContextKeyAutoGroup)
	}
	if currentGroup == "" {
		currentGroup = firstNonEmptyString(info.UsingGroup, info.TokenGroup, info.UserGroup)
	}
	if currentGroup == "auto" {
		for _, group := range GetUserAutoGroup(info.UserGroup) {
			scope.EffectiveGroups = appendUniqueNonEmpty(scope.EffectiveGroups, group)
		}
	} else {
		scope.EffectiveGroups = appendUniqueNonEmpty(scope.EffectiveGroups, currentGroup)
	}

	return scope
}

func ResolveSensitiveWords(scope SensitiveCheckScope) SensitiveMatchResult {
	if !setting.ShouldCheckPromptSensitive() {
		return SensitiveMatchResult{}
	}

	globalWords := setting.GetSensitiveWordsCopy()
	config := setting.GetSensitiveCheckRulesCopy()
	if len(config.Rules) == 0 {
		words := normalizeSensitiveWordsForRuntime(globalWords)
		return SensitiveMatchResult{
			ShouldCheck: len(words) > 0,
			Words:       words,
			Legacy:      true,
		}
	}

	result := SensitiveMatchResult{}
	for _, rule := range config.Rules {
		if !rule.Enabled {
			continue
		}
		if !sensitiveRuleMatchesGroup(rule, scope.EffectiveGroups) {
			continue
		}
		if !sensitiveRuleMatchesModel(rule, scope.ModelCandidates) {
			continue
		}
		if rule.IncludeGlobalWords {
			result.Words = append(result.Words, globalWords...)
		}
		result.Words = append(result.Words, rule.Words...)
		result.RuleIDs = appendUniqueNonEmpty(result.RuleIDs, rule.ID)
		result.RuleNames = appendUniqueNonEmpty(result.RuleNames, rule.Name)
	}

	result.Words = normalizeSensitiveWordsForRuntime(result.Words)
	result.ShouldCheck = len(result.Words) > 0
	return result
}

func CheckSensitiveTextByScope(c *gin.Context, info *relaycommon.RelayInfo, text string, checkedScopes map[string]struct{}) SensitiveTextCheckResult {
	result := SensitiveTextCheckResult{}
	if strings.TrimSpace(text) == "" {
		return result
	}

	result.Scope = ResolveSensitiveCheckScope(c, info)
	result.Match = ResolveSensitiveWords(result.Scope)
	if !result.Match.ShouldCheck {
		return result
	}

	result.ScopeKey = BuildSensitiveScopeKey(result.Scope, result.Match)
	if checkedScopes != nil {
		if _, ok := checkedScopes[result.ScopeKey]; ok {
			result.Cached = true
			return result
		}
		checkedScopes[result.ScopeKey] = struct{}{}
	}

	result.Contains, result.Words = CheckSensitiveTextWithWords(text, result.Match.Words)
	return result
}

func BuildSensitiveScopeKey(scope SensitiveCheckScope, match SensitiveMatchResult) string {
	parts := make([]string, 0, len(scope.EffectiveGroups)+len(scope.ModelCandidates)+len(match.RuleIDs)+len(match.RuleNames)+4)
	parts = append(parts, "groups:"+strings.Join(scope.EffectiveGroups, ","))
	parts = append(parts, "models:"+strings.Join(scope.ModelCandidates, ","))
	parts = append(parts, "rules:"+strings.Join(match.RuleIDs, ","))
	parts = append(parts, "rule_names:"+strings.Join(match.RuleNames, ","))
	parts = append(parts, "words:"+acKey(match.Words))
	if match.Legacy {
		parts = append(parts, "legacy")
	}
	return strings.Join(parts, "|")
}

func sensitiveWordContainsWithWords(text string, words []string) (bool, []string) {
	words = normalizeSensitiveWordsForRuntime(words)
	if len(words) == 0 {
		return false, nil
	}
	if len(text) == 0 {
		return false, nil
	}
	checkText := strings.ToLower(text)
	return AcSearch(checkText, words, true)
}

// SensitiveWordReplace 敏感词替换，返回是否包含敏感词和替换后的文本
func SensitiveWordReplace(text string, returnImmediately bool) (bool, []string, string) {
	words := normalizeSensitiveWordsForRuntime(setting.GetSensitiveWordsCopy())
	if len(words) == 0 {
		return false, nil, text
	}
	checkText := strings.ToLower(text)
	m := getOrBuildAC(words)
	hits := m.MultiPatternSearch([]rune(checkText), returnImmediately)
	if len(hits) > 0 {
		words := make([]string, 0, len(hits))
		var builder strings.Builder
		builder.Grow(len(text))
		lastPos := 0

		for _, hit := range hits {
			pos := hit.Pos
			word := string(hit.Word)
			builder.WriteString(text[lastPos:pos])
			builder.WriteString("**###**")
			lastPos = pos + len(word)
			words = append(words, word)
		}
		builder.WriteString(text[lastPos:])
		return true, words, builder.String()
	}
	return false, nil, text
}

func sensitiveRuleMatchesGroup(rule setting.SensitiveCheckRule, groups []string) bool {
	if len(rule.Groups) == 0 {
		return true
	}
	for _, group := range groups {
		if containsString(rule.Groups, group) {
			return true
		}
	}
	return false
}

func sensitiveRuleMatchesModel(rule setting.SensitiveCheckRule, models []string) bool {
	if len(rule.Models) == 0 && len(rule.ModelRegex) == 0 {
		return true
	}
	for _, model := range models {
		if containsString(rule.Models, model) {
			return true
		}
		for _, pattern := range rule.ModelRegex {
			re := getOrCompileSensitiveRuleRegex(pattern)
			if re != nil && re.MatchString(model) {
				return true
			}
		}
	}
	return false
}

func getOrCompileSensitiveRuleRegex(pattern string) *regexp.Regexp {
	if pattern == "" {
		return nil
	}
	if cached, ok := sensitiveRuleRegexCache.Load(pattern); ok {
		if re, ok := cached.(*regexp.Regexp); ok {
			return re
		}
	}
	compiled, err := regexp.Compile(pattern)
	if err != nil {
		return nil
	}
	actual, _ := sensitiveRuleRegexCache.LoadOrStore(pattern, compiled)
	if re, ok := actual.(*regexp.Regexp); ok {
		return re
	}
	return compiled
}

func normalizeSensitiveWordsForRuntime(words []string) []string {
	result := make([]string, 0, len(words))
	seen := make(map[string]struct{}, len(words))
	for _, word := range words {
		word = strings.TrimSpace(word)
		if word == "" {
			continue
		}
		key := strings.ToLower(word)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, word)
	}
	return result
}

func appendUniqueNonEmpty(values []string, value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return values
	}
	if containsString(values, value) {
		return values
	}
	return append(values, value)
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
