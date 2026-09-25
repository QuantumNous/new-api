package model

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"sync"
	"sync/atomic"

	goahocorasick "github.com/anknown/ahocorasick"
)

type sensitiveRuntimeRule struct {
	ID      int64
	Name    string
	Scope   string
	Mode    string
	Version int64
	Groups  map[string]struct{}
}

type sensitiveRuntimeSnapshot struct {
	machine       *goahocorasick.Machine
	words         map[string][]sensitiveRuntimeRule
	policyVersion int64
}

var sensitiveRuntime struct {
	sync.RWMutex
	snapshot *sensitiveRuntimeSnapshot
}

// The migration can intentionally leave legacy data unresolved. Keep request
// handling fail-open until the one-way migration has either completed or is
// retried successfully, rather than allowing a partially imported rule set to
// become authoritative.
var sensitiveWordRuntimeUnavailable atomic.Bool

var sensitiveSecretPattern = regexp.MustCompile(`(?i)(sk-[a-z0-9_-]{12,}|bearer\s+[a-z0-9._-]{12,}|https?://[^\s]+)`)

func invalidateSensitiveWordRuntime() {
	sensitiveRuntime.Lock()
	sensitiveRuntime.snapshot = nil
	sensitiveRuntime.Unlock()
}

func setSensitiveWordRuntimeUnavailable(unavailable bool) {
	sensitiveWordRuntimeUnavailable.Store(unavailable)
	invalidateSensitiveWordRuntime()
}

func normalizeSensitivePrompt(value string) string {
	value = strings.ReplaceAll(value, "\x00", "")
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	return strings.TrimSpace(value)
}

func redactedSensitivePreview(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	text = sensitiveSecretPattern.ReplaceAllString(text, "[已脱敏]")
	runes := []rune(text)
	if len(runes) > 96 {
		runes = runes[:96]
	}
	return string(runes)
}

func buildSensitiveRuntimeSnapshot(policyVersion int64) (*sensitiveRuntimeSnapshot, error) {
	if DB == nil {
		return nil, ErrSensitiveWordPolicyUnavailable
	}
	var rules []SensitiveWordRule
	if err := DB.Preload("Groups").Preload("Words").
		Where("mode IN ?", []string{SensitiveWordModeBlock, SensitiveWordModeObserve}).
		Order("id asc").Find(&rules).Error; err != nil {
		return nil, err
	}

	words := make([]string, 0)
	metadata := make(map[string][]sensitiveRuntimeRule)
	seenWords := make(map[string]struct{})
	for _, rule := range rules {
		groups := make(map[string]struct{}, len(rule.Groups))
		for _, group := range rule.Groups {
			groups[group.GroupName] = struct{}{}
		}
		for _, word := range ruleWords(rule) {
			normalized := strings.ToLower(word)
			if _, exists := seenWords[normalized]; !exists {
				seenWords[normalized] = struct{}{}
				words = append(words, normalized)
			}
			metadata[normalized] = append(metadata[normalized], sensitiveRuntimeRule{
				ID: rule.ID, Name: rule.Name, Scope: rule.Scope,
				Mode: normalizeSensitiveWordRuleMode(rule.Mode), Version: rule.Version,
				Groups: groups,
			})
		}
	}
	if len(words) == 0 {
		return &sensitiveRuntimeSnapshot{policyVersion: policyVersion, words: metadata}, nil
	}
	keywords := make([][]rune, 0, len(words))
	for _, word := range words {
		keywords = append(keywords, []rune(word))
	}
	machine := new(goahocorasick.Machine)
	if err := machine.Build(keywords); err != nil {
		return nil, err
	}
	return &sensitiveRuntimeSnapshot{
		machine: machine, words: metadata, policyVersion: policyVersion,
	}, nil
}

func getSensitiveRuntimeSnapshot(policyVersion int64) (*sensitiveRuntimeSnapshot, error) {
	sensitiveRuntime.RLock()
	snapshot := sensitiveRuntime.snapshot
	sensitiveRuntime.RUnlock()
	if snapshot != nil && snapshot.policyVersion == policyVersion {
		return snapshot, nil
	}
	sensitiveRuntime.Lock()
	defer sensitiveRuntime.Unlock()
	if sensitiveRuntime.snapshot != nil && sensitiveRuntime.snapshot.policyVersion == policyVersion {
		return sensitiveRuntime.snapshot, nil
	}
	built, err := buildSensitiveRuntimeSnapshot(policyVersion)
	if err != nil {
		return nil, err
	}
	sensitiveRuntime.snapshot = built
	return built, nil
}

func containsSensitiveWord(words []string, candidate string) bool {
	for _, word := range words {
		if strings.EqualFold(word, candidate) {
			return true
		}
	}
	return false
}

func normalizeSensitiveGroups(groups []string, fallback string) []string {
	seen := make(map[string]struct{}, len(groups)+1)
	result := make([]string, 0, len(groups)+1)
	for _, group := range append(groups, fallback) {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		if _, exists := seen[group]; exists {
			continue
		}
		seen[group] = struct{}{}
		result = append(result, group)
	}
	return result
}

func matchSensitiveRulesForGroups(prompt string, groups []string, fallbackGroup string, policyVersion int64) ([]SensitiveWordRule, []string, string, error) {
	candidates := normalizeSensitiveGroups(groups, fallbackGroup)
	if len(candidates) == 0 {
		candidates = []string{""}
	}
	snapshot, err := getSensitiveRuntimeSnapshot(policyVersion)
	if err != nil {
		return nil, nil, "", err
	}
	if snapshot == nil || snapshot.machine == nil {
		return nil, nil, "", nil
	}

	// The automaton walks the request exactly once. Group-scoped rules are
	// then evaluated against the already-resolved, ordered candidate groups.
	// This keeps auto-group routing deterministic without multiplying the
	// cost of a long prompt by the number of candidates.
	candidateIndex := make(map[string]int, len(candidates))
	for index, group := range candidates {
		candidateIndex[group] = index
	}
	rules := make([]SensitiveWordRule, 0)
	words := make([]string, 0)
	seenRules := make(map[string]struct{})
	matchedGroup := ""
	matchedGroupIndex := len(candidates)
	for _, term := range snapshot.machine.MultiPatternSearch([]rune(strings.ToLower(prompt)), false) {
		word := string(term.Word)
		for _, metadata := range snapshot.words[word] {
			if metadata.Scope == SensitiveWordScopeGroup {
				matchedIndex := len(candidates)
				for group := range metadata.Groups {
					if index, exists := candidateIndex[group]; exists && index < matchedIndex {
						matchedIndex = index
					}
				}
				if matchedIndex == len(candidates) {
					continue
				}
				if matchedIndex < matchedGroupIndex {
					matchedGroupIndex = matchedIndex
					matchedGroup = candidates[matchedIndex]
				}
			}
			key := fmt.Sprintf("%d:%s", metadata.ID, word)
			if _, exists := seenRules[key]; exists {
				continue
			}
			seenRules[key] = struct{}{}
			rules = append(rules, SensitiveWordRule{
				ID: metadata.ID, Name: metadata.Name, Word: word,
				Scope: metadata.Scope, Mode: metadata.Mode, Version: metadata.Version,
			})
			if !containsSensitiveWord(words, word) {
				words = append(words, word)
			}
		}
	}
	if matchedGroup == "" && len(candidates) > 0 {
		matchedGroup = candidates[0]
	}
	sort.Slice(rules, func(i, j int) bool {
		if rules[i].ID != rules[j].ID {
			return rules[i].ID < rules[j].ID
		}
		return strings.ToLower(rules[i].Word) < strings.ToLower(rules[j].Word)
	})
	sort.Slice(words, func(i, j int) bool {
		return strings.ToLower(words[i]) < strings.ToLower(words[j])
	})
	return rules, words, matchedGroup, nil
}

func sensitiveMatchSnippets(prompt string, words []string) []string {
	promptRunes := []rune(prompt)
	normalizedPrompt := []rune(strings.ToLower(prompt))
	seen := make(map[string]struct{}, len(words))
	result := make([]string, 0, len(words))
	for _, word := range words {
		normalizedWord := []rune(strings.ToLower(strings.TrimSpace(word)))
		if len(normalizedWord) == 0 || len(normalizedWord) > len(normalizedPrompt) {
			continue
		}
		for start := 0; start+len(normalizedWord) <= len(normalizedPrompt); start++ {
			matched := true
			for offset := range normalizedWord {
				if normalizedPrompt[start+offset] != normalizedWord[offset] {
					matched = false
					break
				}
			}
			if !matched {
				continue
			}
			from := max(0, start-24)
			to := min(len(promptRunes), start+len(normalizedWord)+24)
			snippet := redactedSensitivePreview(string(promptRunes[from:to]))
			if _, exists := seen[snippet]; !exists && snippet != "" {
				seen[snippet] = struct{}{}
				result = append(result, snippet)
			}
			break
		}
	}
	return result
}
