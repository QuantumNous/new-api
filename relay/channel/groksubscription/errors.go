package groksubscription

import (
	"encoding/json"
	"strings"
)

// ForbiddenCategory 是 Grok 上游 403 body 的脱敏分类（设计 §12）。
// 冲突时取高优先级：ContentPolicy > Account > CLICompat；
// Unknown 是零值，fail-closed，禁止进入任何自动恢复动作。
type ForbiddenCategory int

const (
	ForbiddenUnknown       ForbiddenCategory = iota // 未分类：稳定脱敏错误返回，不 refresh / 不 failover
	ForbiddenContentPolicy                          // 内容策略拒绝：返回脱敏策略错误，绝不换账号绕过
	ForbiddenAccount                                // 账号能力问题（订阅/封禁/额度）：按候选 failover
	ForbiddenCLICompat                              // CLI 兼容性 403：同账号 official API 回退一次
)

// cliCompatErrorPrefix 是 CLI proxy permission_denied 403 的固定长 error 前缀（clean-room 观察值）。
// 出处：设计 §8.4，逐字符转录，勿改动措辞。
const cliCompatErrorPrefix = "Access to the chat endpoint is denied. Please ensure you're using the correct credentials. If you believe this is a mistake, please"

// 设计 §8.4 要求前缀匹配大小写不敏感，双边 lower 匹配，防上游改大小写漏判。
var cliCompatErrorPrefixLower = strings.ToLower(cliCompatErrorPrefix)

// maxParse 限制参与解析/匹配的 403 body 长度，防超大 body 拖垮解析
// （设计 §8.4 的 64 KiB 缓冲上限同源）。
const maxParse = 1 << 16

// 结构化 marker 集：normalizeMarker（lower + trim）后精确匹配。
var contentPolicyMarkers = map[string]struct{}{
	"content_filter":           {},
	"content_policy":           {},
	"content_policy_violation": {},
	"content_moderation":       {},
	"cyber_policy":             {},
	"new_sensitive":            {},
}

var accountMarkers = map[string]struct{}{
	"account_suspended":     {},
	"account_disabled":      {},
	"user_suspended":        {},
	"user_disabled":         {},
	"subscription_required": {},
	"entitlement_required":  {},
	"not_entitled":          {},
	"plan_required":         {},
	"insufficient_quota":    {},
}

// 自由文本短语表：lowercase 子串匹配，全部收在 messages 拼接串上。
var contentPolicyPhrases = []string{
	"content policy violation",
	"content policy rejection",
	"content policy rejected",
	"content moderation blocked",
	"content moderation rejected",
	"blocked by policy",
	"violates policy",
	"is sensitive", // 有意宽于 §12 的 image/text 限定：误判方向 fail-safe（多判只走 ReturnPolicyError，不 failover）
	"prohibited content",
	"forbidden content",
}

var accountPhrases = []string{
	"account suspended",
	"account disabled",
	"user suspended",
	"user disabled",
	"subscription required",
	"entitlement required",
	"not entitled",
	"payment required",
	"spending limit",
	"out of credits",
}

// ClassifyForbidden 按设计 §12/§8.4 对 403 body 做纯函数分类：
// 结构化 marker（ContentPolicy 全集 → Account 全集）优先于 message 短语
// （ContentPolicy → Account），最后才是 CLI 兼容性 403 两条并列规则；
// 全不命中 fail-closed 到 ForbiddenUnknown。
func ClassifyForbidden(body []byte) ForbiddenCategory {
	if len(body) > maxParse {
		body = body[:maxParse]
	}
	sig := extractForbiddenSignals(body)

	for _, m := range sig.markers {
		if _, ok := contentPolicyMarkers[m]; ok {
			return ForbiddenContentPolicy
		}
	}
	for _, m := range sig.markers {
		if _, ok := accountMarkers[m]; ok {
			return ForbiddenAccount
		}
	}

	joined := strings.Join(sig.messages, " ")
	if containsAnyPhrase(joined, contentPolicyPhrases) {
		return ForbiddenContentPolicy
	}
	if containsAnyPhrase(joined, accountPhrases) {
		return ForbiddenAccount
	}

	// CLI 兼容性 403（设计 §8.4，两条并列规则，均须在第 12 节更高优先级分类未命中后）：
	// 1) 规范化后命中连续子串 "access denied"（单独 access 或 denied 不算）；
	// 2) 结构化 marker permission_denied 且 message 命中固定前缀（大小写不敏感）。
	if strings.Contains(joined, "access denied") {
		return ForbiddenCLICompat
	}
	for _, m := range sig.markers {
		if m != "permission_denied" {
			continue
		}
		for _, msg := range sig.messages {
			if strings.HasPrefix(strings.ToLower(strings.TrimSpace(msg)), cliCompatErrorPrefixLower) {
				return ForbiddenCLICompat
			}
		}
	}

	return ForbiddenUnknown
}

// forbiddenSignals 收集 403 body 中的结构化 marker 与自由文本 message（均 lowercase）。
type forbiddenSignals struct {
	markers  []string
	messages []string
}

// forbiddenMarkerKeys 的值视作 marker；forbiddenMessageKeys 的值视作 message。
// 键比较统一 lower；map/slice 值一律递归（slice 继承外层键）。
var forbiddenMarkerKeys = map[string]struct{}{
	"code":       {},
	"error_code": {},
	"type":       {},
	"category":   {},
	"reason":     {},
}

var forbiddenMessageKeys = map[string]struct{}{
	"message": {},
	"error":   {},
}

// extractForbiddenSignals 解析 403 body 并递归收集 marker/message。
// JSON 解析失败（HTML 错误页等）时把截断后的整个 body 当作单一 message，
// 交给短语/子串规则兜底。
func extractForbiddenSignals(body []byte) forbiddenSignals {
	var root any
	if err := json.Unmarshal(body, &root); err != nil {
		return forbiddenSignals{messages: []string{strings.ToLower(string(body))}}
	}
	s := forbiddenSignals{}
	walkForbidden(root, "", &s)
	return s
}

func walkForbidden(node any, key string, s *forbiddenSignals) {
	switch v := node.(type) {
	case map[string]any:
		for k, child := range v {
			walkForbidden(child, strings.ToLower(k), s)
		}
	case []any:
		for _, child := range v {
			walkForbidden(child, key, s)
		}
	case string:
		if _, ok := forbiddenMarkerKeys[key]; ok {
			s.markers = append(s.markers, normalizeMarker(v))
		}
		if _, ok := forbiddenMessageKeys[key]; ok {
			s.messages = append(s.messages, strings.ToLower(v))
		}
	}
}

func normalizeMarker(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func containsAnyPhrase(joined string, phrases []string) bool {
	for _, p := range phrases {
		if strings.Contains(joined, p) {
			return true
		}
	}
	return false
}

// Action 是 Grok 专用的重试/换渠道决定。
type Action int

const (
	ActionStop                 Action = iota // 结束当前请求，不再重试/换账号
	ActionRefreshRetryOnce                   // 抢 lease 强制刷新一次并重放
	ActionNeedsReauth                        // 置 needs_reauth、停用当前 channel、转候选
	ActionFailoverAlt                        // 切换到一个不同候选 channel（一次上限）
	ActionOfficialFallbackOnce               // 同账号 official API 回退一次（剥离 CLI headers）
	ActionReturnPolicyError                  // content policy：返回脱敏策略错误，不 failover
	ActionReturnStable                       // unknown：返回稳定脱敏错误，不 refresh/不 fallback
	ActionUseExistingRetry                   // 5xx/连接失败且未输出：走现有 retry/failover
)

// AttemptState 是整条请求生命周期的 attempt 上限状态（refresh/official-fallback/alt 各一次）。
type AttemptState struct {
	RefreshUsed          bool
	OfficialFallbackUsed bool
	AltChannelUsed       bool
}

// DecideAction 按 (status, 403 分类, attempt 状态, 是否可重放) 决定动作。
// replayable=false 表示已写出语义内容或请求体不可安全重放。
// st 为 nil 时视作全新 AttemptState（once 上限仅由调用方持久状态保证）。
func DecideAction(status int, cat ForbiddenCategory, st *AttemptState, replayable bool) Action {
	if st == nil {
		st = &AttemptState{}
	}
	switch status {
	case 401:
		if !replayable {
			return ActionStop
		}
		if !st.RefreshUsed {
			return ActionRefreshRetryOnce
		}
		return ActionNeedsReauth
	case 403:
		switch cat {
		case ForbiddenContentPolicy:
			return ActionReturnPolicyError
		case ForbiddenAccount:
			// 明确账号能力问题且可重放才按既有候选 failover，不进 refresh 循环
			if replayable && !st.AltChannelUsed {
				st.AltChannelUsed = true
				return ActionFailoverAlt
			}
			return ActionReturnStable
		case ForbiddenCLICompat:
			if !st.OfficialFallbackUsed {
				return ActionOfficialFallbackOnce
			}
			return ActionStop
		default:
			return ActionReturnStable
		}
	case 429:
		if replayable && !st.AltChannelUsed {
			st.AltChannelUsed = true
			return ActionFailoverAlt
		}
		return ActionStop
	default:
		if status >= 500 && replayable {
			return ActionUseExistingRetry
		}
		return ActionStop
	}
}
