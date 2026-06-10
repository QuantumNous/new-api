package operation_setting

import "strings"

// UpstreamQuotaErrorKeywords 用于识别上游"余额/额度不足"类错误文案。
// 命中后该错误会被视为可重试（换渠道转移），且渠道会进入短暂的 quota 冷却。
// 可在运营设置中按行配置，新增下游平台时把其真实余额错误文案补充进来。
var UpstreamQuotaErrorKeywords = []string{
	"insufficient credits",
	"insufficient credit",
	"insufficient balance",
	"not enough credits",
	"not enough credit",
	"credit balance",
	"quota exceeded",
	"insufficient_user_quota",
	"余额不足",
	"额度不足",
}

func UpstreamQuotaErrorKeywordsToString() string {
	return strings.Join(UpstreamQuotaErrorKeywords, "\n")
}

func UpstreamQuotaErrorKeywordsFromString(s string) {
	keywords := []string{}
	for _, k := range strings.Split(s, "\n") {
		k = strings.ToLower(strings.TrimSpace(k))
		if k != "" {
			keywords = append(keywords, k)
		}
	}
	UpstreamQuotaErrorKeywords = keywords
}

// IsUpstreamQuotaErrorMessage 判断错误文案是否命中余额/额度不足关键词。
func IsUpstreamQuotaErrorMessage(message string) bool {
	message = strings.ToLower(message)
	for _, keyword := range UpstreamQuotaErrorKeywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}
