package setting

import "strings"

var CheckSensitiveEnabled = true
var CheckSensitiveOnPromptEnabled = true

// CheckSensitiveOnCompletionEnabled enables scanning assistant output after the
// upstream model responds (non-streaming replacement or streaming stop).
var CheckSensitiveOnCompletionEnabled = true

// StopOnSensitiveEnabled 如果检测到敏感词，是否立刻停止生成，否则替换敏感词
var StopOnSensitiveEnabled = true

// StreamCacheQueueLength 流模式缓存队列长度，0表示无缓存
var StreamCacheQueueLength = 0

// SensitiveWords 敏感词
// var SensitiveWords []string
var SensitiveWords = []string{
	"test_sensitive",
}

// SensitiveBlockReply is returned to the client as a simulated model reply when
// a prompt or completion is blocked by the sensitive-word filter. Empty uses the built-in default.
var SensitiveBlockReply = ""

const DefaultSensitiveBlockReply = "Sorry, I cannot assist with that request."

func GetSensitiveBlockReply() string {
	reply := strings.TrimSpace(SensitiveBlockReply)
	if reply == "" {
		return DefaultSensitiveBlockReply
	}
	return reply
}

func SensitiveWordsToString() string {
	return strings.Join(SensitiveWords, "\n")
}

func SensitiveWordsFromString(s string) {
	SensitiveWords = []string{}
	sw := strings.SplitSeq(s, "\n")
	for w := range sw {
		w = strings.TrimSpace(w)
		if w != "" {
			SensitiveWords = append(SensitiveWords, w)
		}
	}
}

func ShouldCheckPromptSensitive() bool {
	return CheckSensitiveEnabled && CheckSensitiveOnPromptEnabled
}

func ShouldCheckCompletionSensitive() bool {
	return CheckSensitiveEnabled && CheckSensitiveOnCompletionEnabled
}
