package service

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/model"
)

// SanitizeForChannel 把 msg 中出现的渠道真实地址替换为展示地址。
// 在所有面向非 Root 用户的出口调用；Root 调用方应跳过本函数以便排错。
func SanitizeForChannel(channelID int, msg string) string {
	if msg == "" {
		return msg
	}
	ch, err := model.CacheGetChannel(channelID)
	if err != nil || ch == nil {
		return msg
	}
	return SanitizeWithPair(ch.GetActualBaseURL(), ch.GetDisplayBaseURL(), msg)
}

// SanitizeWithPair 用于已持有 (actual, display) 的热路径（如中继错误返回），免一次缓存查询。
func SanitizeWithPair(actual, display, msg string) string {
	if msg == "" || actual == "" || actual == display {
		return msg
	}
	au, auErr := url.Parse(actual)
	du, duErr := url.Parse(display)
	if auErr != nil || au.Host == "" || duErr != nil || du.Host == "" {
		result := strings.ReplaceAll(msg, actual, display)
		// also strip the bare host when actual host is known but display has no host
		if auErr == nil && au.Host != "" && (duErr != nil || du.Host == "") {
			result = strings.ReplaceAll(result, au.Host, "")
		}
		return result
	}
	transformedActual := strings.ReplaceAll(actual, au.Host, du.Host)
	hostReplaced := strings.ReplaceAll(msg, au.Host, du.Host)
	if transformedActual != display {
		return strings.ReplaceAll(hostReplaced, transformedActual, display)
	}
	return redactCredentials(hostReplaced)
}

var sensitiveCredentialRE = regexp.MustCompile(`(?i)(Bearer\s+|api[-_ ]?key[=: ]+|sk-[A-Za-z0-9_-]{8,})[^\s,;]+`)

func redactCredentials(msg string) string {
	return sensitiveCredentialRE.ReplaceAllString(msg, "[REDACTED]")
}
