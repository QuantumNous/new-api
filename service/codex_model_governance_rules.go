package service

import (
	"regexp"
	"sort"
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
	for _, occurrence := range findOfficialCodexNoticeModelOccurrences(content, modelNames) {
		segment := officialCodexNoticeSegment(content, occurrence.Index, len(occurrence.ModelName))
		term := findOfficialCodexNoticeTerm(segment, lifecycleTerms)
		if term == "" {
			continue
		}
		return OfficialCodexNoticeMatch{
			Matched:   true,
			ModelName: occurrence.ModelName,
			Term:      term,
			Excerpt:   officialCodexNoticeExcerpt(segment, strings.Index(segment, occurrence.ModelName), len(occurrence.ModelName)),
		}
	}
	return OfficialCodexNoticeMatch{}
}

type officialCodexNoticeModelOccurrence struct {
	ModelName string
	Index     int
}

func findOfficialCodexNoticeModelOccurrences(content string, modelNames []string) []officialCodexNoticeModelOccurrence {
	occurrences := make([]officialCodexNoticeModelOccurrence, 0)
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
				occurrences = append(occurrences, officialCodexNoticeModelOccurrence{
					ModelName: modelName,
					Index:     absoluteIndex,
				})
			}
			searchStart = absoluteIndex + len(modelName)
		}
	}
	sort.SliceStable(occurrences, func(i, j int) bool {
		return occurrences[i].Index < occurrences[j].Index
	})
	return occurrences
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
	if modelIndex > len(content) {
		modelIndex = len(content)
	}
	runes := []rune(content)
	if len(runes) <= officialCodexNoticeExcerptMaxLength {
		return strings.TrimSpace(content)
	}
	modelEndByte := modelIndex + modelLength
	if modelEndByte > len(content) {
		modelEndByte = len(content)
	}
	modelRuneIndex := len([]rune(content[:modelIndex]))
	modelRuneLength := len([]rune(content[modelIndex:modelEndByte]))
	modelRuneEnd := modelRuneIndex + modelRuneLength
	remaining := officialCodexNoticeExcerptMaxLength - modelRuneLength
	if remaining < 0 {
		remaining = 0
	}
	before := remaining / 2
	after := remaining - before
	start := modelRuneIndex - before
	if start < 0 {
		start = 0
	}
	end := modelRuneEnd + after
	if end > len(runes) {
		end = len(runes)
	}
	if end-start < officialCodexNoticeExcerptMaxLength && start > 0 {
		start -= officialCodexNoticeExcerptMaxLength - (end - start)
		if start < 0 {
			start = 0
		}
	}
	if end-start < officialCodexNoticeExcerptMaxLength && end < len(runes) {
		end += officialCodexNoticeExcerptMaxLength - (end - start)
		if end > len(runes) {
			end = len(runes)
		}
	}
	return strings.TrimSpace(string(runes[start:end]))
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
