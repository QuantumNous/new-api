package setting

import "strings"

var CheckSensitiveEnabled = true
var CheckSensitiveOnPromptEnabled = true

//var CheckSensitiveOnCompletionEnabled = true

// StopOnSensitiveEnabled 如果检测到敏感词，是否立刻停止生成，否则替换敏感词
var StopOnSensitiveEnabled = true

// StreamCacheQueueLength 流模式缓存队列长度，0表示无缓存
var StreamCacheQueueLength = 0

// SensitiveWords 敏感词
// var SensitiveWords []string
var SensitiveWords = []string{
	"test_sensitive",
}

var ModerationEnabled = false
var ModerationModel = "omni-moderation-latest"
var ModerationBaseURL = "https://api.openai.com/v1"
var ModerationAPIKey = ""
var ModerationTimeoutSeconds = 10
var ModerationFailureMode = "open"
var ModerationBlockCategories = []string{
	"sexual/minors",
	"self-harm/instructions",
	"illicit/violent",
}

func SensitiveWordsToString() string {
	return strings.Join(SensitiveWords, "\n")
}

func SensitiveWordsFromString(s string) {
	SensitiveWords = []string{}
	sw := strings.Split(s, "\n")
	for _, w := range sw {
		w = strings.TrimSpace(w)
		if w != "" {
			SensitiveWords = append(SensitiveWords, w)
		}
	}
}

func ShouldCheckPromptSensitive() bool {
	return CheckSensitiveEnabled && CheckSensitiveOnPromptEnabled
}

func ShouldModeratePrompt() bool {
	return ModerationEnabled && strings.TrimSpace(ModerationAPIKey) != ""
}

func ModerationBlockCategoriesToString() string {
	return strings.Join(ModerationBlockCategories, "\n")
}

func ModerationBlockCategoriesFromString(s string) {
	ModerationBlockCategories = splitModerationList(s)
}

func NormalizeModerationFailureMode(mode string) string {
	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode != "closed" {
		return "open"
	}
	return mode
}

func splitModerationList(s string) []string {
	items := []string{}
	for _, raw := range strings.FieldsFunc(s, func(r rune) bool {
		return r == '\n' || r == ',' || r == ';'
	}) {
		item := strings.TrimSpace(raw)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}

//func ShouldCheckCompletionSensitive() bool {
//	return CheckSensitiveEnabled && CheckSensitiveOnCompletionEnabled
//}
