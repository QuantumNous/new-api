package service

import (
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"
)

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
	return SensitiveWordContains(text)
}

// CheckSensitiveTextSuffix scans only the newly appended suffix of an accumulating
// stream buffer, with an overlap of the longest keyword so matches across chunk
// boundaries are still detected. previouslyChecked is the byte length already
// covered by earlier checks; newChecked is len(full) after this call.
func CheckSensitiveTextSuffix(full string, previouslyChecked int) (hit bool, words []string, newChecked int) {
	newChecked = len(full)
	if len(setting.SensitiveWords) == 0 || newChecked == 0 {
		return false, nil, newChecked
	}
	if previouslyChecked < 0 {
		previouslyChecked = 0
	}
	if previouslyChecked > newChecked {
		previouslyChecked = newChecked
	}
	maxBytes := 0
	for _, w := range setting.SensitiveWords {
		if bytes := len(w); bytes > maxBytes {
			maxBytes = bytes
		}
	}
	if maxBytes == 0 {
		return false, nil, newChecked
	}
	start := previouslyChecked - maxBytes
	if start < 0 {
		start = 0
	}
	for start > 0 && !utf8.RuneStart(full[start]) {
		start--
	}
	checkText := strings.ToLower(full[start:])
	hit, words = AcSearch(checkText, setting.SensitiveWords, true)
	return hit, words, newChecked
}

// SensitiveWordsAreSubstrings reports whether every matched word appears in text.
// Semantic hits name a keyword that may not occur literally, so the whole reply
// has to be replaced instead of masked in place.
func SensitiveWordsAreSubstrings(text string, words []string) bool {
	if len(words) == 0 {
		return false
	}
	lower := strings.ToLower(text)
	for _, word := range words {
		word = strings.ToLower(strings.TrimSpace(word))
		if word == "" || !strings.Contains(lower, word) {
			return false
		}
	}
	return true
}

// SensitiveWordContains 是否包含敏感词，返回是否包含敏感词和敏感词列表
func SensitiveWordContains(text string) (bool, []string) {
	if len(setting.SensitiveWords) == 0 {
		return false, nil
	}
	if len(text) == 0 {
		return false, nil
	}
	checkText := strings.ToLower(text)
	return AcSearch(checkText, setting.SensitiveWords, true)
}

// SensitiveWordReplace 敏感词替换，返回是否包含敏感词和替换后的文本
func SensitiveWordReplace(text string, returnImmediately bool) (bool, []string, string) {
	if len(setting.SensitiveWords) == 0 {
		return false, nil, text
	}
	checkText := strings.ToLower(text)
	m := getOrBuildAC(setting.SensitiveWords)
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
