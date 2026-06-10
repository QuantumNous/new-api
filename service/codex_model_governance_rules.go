package service

import (
	"regexp"
	"strings"
	"unicode"
)

const officialCodexNoticeExcerptMaxLength = 200

type CodexUnsupportedMatch struct {
	Matched   bool
	ModelName string
	Pattern   string
}

func ClassifyCodexUnsupportedMessage(message string, patterns []string) CodexUnsupportedMatch {
	for _, pattern := range patterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		compiled, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}
		matches := compiled.FindStringSubmatch(message)
		if matches == nil {
			continue
		}
		match := CodexUnsupportedMatch{
			Matched: true,
			Pattern: pattern,
		}
		if len(matches) > 1 {
			match.ModelName = strings.TrimSpace(matches[1])
		}
		return match
	}
	return CodexUnsupportedMatch{}
}

type OfficialCodexNoticeMatch struct {
	Matched   bool
	ModelName string
	Term      string
	Excerpt   string
}

func FindOfficialCodexNoticeMatch(content string, modelNames []string, lifecycleTerms []string) OfficialCodexNoticeMatch {
	modelName, modelIndex := findOfficialCodexNoticeModel(content, modelNames)
	if modelIndex < 0 {
		return OfficialCodexNoticeMatch{}
	}
	segment := officialCodexNoticeSegment(content, modelIndex, len(modelName))
	term := findOfficialCodexNoticeTerm(segment, lifecycleTerms)
	if term == "" {
		return OfficialCodexNoticeMatch{}
	}
	return OfficialCodexNoticeMatch{
		Matched:   true,
		ModelName: modelName,
		Term:      term,
		Excerpt:   officialCodexNoticeExcerpt(segment, strings.Index(segment, modelName), len(modelName)),
	}
}

func findOfficialCodexNoticeModel(content string, modelNames []string) (string, int) {
	for _, modelName := range modelNames {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}
		searchStart := 0
		for {
			index := strings.Index(content[searchStart:], modelName)
			if index < 0 {
				break
			}
			absoluteIndex := searchStart + index
			if isExactCodexModelNameAt(content, absoluteIndex, len(modelName)) {
				return modelName, absoluteIndex
			}
			searchStart = absoluteIndex + len(modelName)
		}
	}
	return "", -1
}

func isExactCodexModelNameAt(content string, start int, length int) bool {
	end := start + length
	if start > 0 {
		previous, _ := lastRuneBefore(content[:start])
		if isCodexModelNameRune(previous) {
			return false
		}
	}
	if end < len(content) {
		next, _ := firstRune(content[end:])
		if isCodexModelNameRune(next) {
			return false
		}
	}
	return true
}

func findOfficialCodexNoticeTerm(content string, lifecycleTerms []string) string {
	lowerContent := strings.ToLower(content)
	for _, term := range lifecycleTerms {
		term = strings.TrimSpace(term)
		if term == "" {
			continue
		}
		if strings.Contains(lowerContent, strings.ToLower(term)) {
			return term
		}
	}
	return ""
}

func officialCodexNoticeSegment(content string, modelIndex int, modelLength int) string {
	if modelIndex < 0 || modelIndex >= len(content) {
		return content
	}
	start := 0
	for index, value := range content[:modelIndex] {
		if isOfficialCodexNoticeBoundary(value) {
			start = index + len(string(value))
		}
	}
	end := len(content)
	scanStart := modelIndex + modelLength
	if scanStart > len(content) {
		scanStart = len(content)
	}
	for index, value := range content[scanStart:] {
		if isOfficialCodexNoticeBoundary(value) {
			end = scanStart + index + len(string(value))
			break
		}
	}
	return strings.TrimSpace(content[start:end])
}

func isOfficialCodexNoticeBoundary(value rune) bool {
	switch value {
	case '.', '!', '?', '\n', '\r', ';', '。', '！', '？', '；':
		return true
	default:
		return false
	}
}

func officialCodexNoticeExcerpt(content string, modelIndex int, modelLength int) string {
	if modelIndex < 0 {
		modelIndex = 0
	}
	if len(content) <= officialCodexNoticeExcerptMaxLength {
		return strings.TrimSpace(content)
	}
	modelEnd := modelIndex + modelLength
	remaining := officialCodexNoticeExcerptMaxLength - modelLength
	if remaining < 0 {
		remaining = 0
	}
	before := remaining / 2
	after := remaining - before
	start := modelIndex - before
	if start < 0 {
		start = 0
	}
	end := modelEnd + after
	if end > len(content) {
		end = len(content)
	}
	if end-start < officialCodexNoticeExcerptMaxLength && start > 0 {
		start -= officialCodexNoticeExcerptMaxLength - (end - start)
		if start < 0 {
			start = 0
		}
	}
	if end-start < officialCodexNoticeExcerptMaxLength && end < len(content) {
		end += officialCodexNoticeExcerptMaxLength - (end - start)
		if end > len(content) {
			end = len(content)
		}
	}
	return strings.TrimSpace(content[start:end])
}

func isCodexModelNameRune(value rune) bool {
	return unicode.IsLetter(value) || unicode.IsDigit(value) || value == '.' || value == '_' || value == '-' || value == '/' || value == ':'
}

func firstRune(value string) (rune, bool) {
	for _, item := range value {
		return item, true
	}
	return 0, false
}

func lastRuneBefore(value string) (rune, bool) {
	var last rune
	found := false
	for _, item := range value {
		last = item
		found = true
	}
	return last, found
}
