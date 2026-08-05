package setting

import (
	"strings"
	"sync/atomic"
)

var CheckSensitiveEnabled = true
var CheckSensitiveOnPromptEnabled = true

//var CheckSensitiveOnCompletionEnabled = true

// StopOnSensitiveEnabled 如果检测到敏感词，是否立刻停止生成，否则替换敏感词
var StopOnSensitiveEnabled = true

// StreamCacheQueueLength 流模式缓存队列长度，0表示无缓存
var StreamCacheQueueLength = 0

// sensitiveWords 敏感词。
//
// 配置热更新每个同步周期都会重建这份列表，而敏感词检查在中继请求路径上读取它。原先的写法是
// 先清空再逐个 append，读者因此可能读到空的或残缺的列表，导致本应拦截的内容被放行。改为在
// 本地构建完整列表后一次性发布，读者要么看到旧列表、要么看到新列表，不存在中间态。
var sensitiveWords atomic.Pointer[[]string]

func init() {
	defaults := []string{"test_sensitive"}
	sensitiveWords.Store(&defaults)
}

// GetSensitiveWords 返回当前敏感词列表。返回的切片不得被调用方修改。
func GetSensitiveWords() []string {
	return *sensitiveWords.Load()
}

func SensitiveWordsToString() string {
	return strings.Join(GetSensitiveWords(), "\n")
}

func SensitiveWordsFromString(s string) {
	words := make([]string, 0)
	for _, w := range strings.Split(s, "\n") {
		if w = strings.TrimSpace(w); w != "" {
			words = append(words, w)
		}
	}
	sensitiveWords.Store(&words)
}

func ShouldCheckPromptSensitive() bool {
	return CheckSensitiveEnabled && CheckSensitiveOnPromptEnabled
}

//func ShouldCheckCompletionSensitive() bool {
//	return CheckSensitiveEnabled && CheckSensitiveOnCompletionEnabled
//}
