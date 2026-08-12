package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// ErrorOverrideMessage 覆写后统一返回给客户端的错误文案
const ErrorOverrideMessage = "Service Unavailable"

// 错误信息覆写：命中关键词的上游错误统一替换文案，避免向客户端暴露上游账务状态与转售链路。
// 仅作用于上游传递到本站的错误；本站自身产生的错误（用户额度不足、无可用渠道等）不受影响。
var ErrorOverrideEnabled = false

// 关键词统一以小写存储，匹配时对错误文案做小写化后比对
var ErrorOverrideKeywords = []string{"no available", "quota", "credits", "top-up"}

func ErrorOverrideKeywordsToString() string {
	return strings.Join(ErrorOverrideKeywords, "\n")
}

func ErrorOverrideKeywordsFromString(s string) {
	ErrorOverrideKeywords = []string{}
	ak := strings.Split(s, "\n")
	for _, k := range ak {
		k = strings.TrimSpace(k)
		k = strings.ToLower(k)
		if k != "" {
			ErrorOverrideKeywords = append(ErrorOverrideKeywords, k)
		}
	}
}

// OverrideUpstreamError 在错误写给客户端前覆写其文案，返回是否已覆写。必须在错误日志记录
// 之后调用，后台日志与渠道自动禁用判定始终使用原始上游文案。状态码、error.type、error.code
// 保持不变。
func OverrideUpstreamError(err *types.NewAPIError) bool {
	if !types.IsFromUpstreamError(err) {
		return false
	}
	if !shouldOverrideErrorMessage(err.Error()) {
		return false
	}
	err.ReplaceMessage(ErrorOverrideMessage)
	return true
}

// OverrideUpstreamMessage 供不经过 NewAPIError 的链路使用（任务平台、Midjourney）。
// 调用方需自行确认文案来自上游。
func OverrideUpstreamMessage(message string) string {
	if !shouldOverrideErrorMessage(message) {
		return message
	}
	return ErrorOverrideMessage
}

func shouldOverrideErrorMessage(message string) bool {
	if !ErrorOverrideEnabled || message == "" {
		return false
	}
	lowerMessage := strings.ToLower(message)
	for _, keyword := range ErrorOverrideKeywords {
		if strings.Contains(lowerMessage, keyword) {
			return true
		}
	}
	return false
}
