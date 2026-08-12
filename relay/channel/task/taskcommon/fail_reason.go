package taskcommon

import "strings"

// FailReasonClass classifies upstream async failure text for failover decisions.
type FailReasonClass int

const (
	FailReasonRetryable FailReasonClass = iota
	FailReasonAudit
	FailReasonUpstreamBalance
)

// Audit / policy — terminal; no same-channel or cross-channel retry.
var auditFailKeywords = []string{
	"audit",
	"policy",
	"违规",
	"敏感",
	"违禁",
	"content_policy",
	"moderation",
	"nsfw",
	"rejected by",
	"审核",
}

// Upstream channel balance/quota — skip same-channel; allow cross-channel failover.
// Not the local user wallet. No bare "billing".
var upstreamBalanceFailKeywords = []string{
	"余额不足",
	"insufficient balance",
	"insufficient_quota",
	"insufficient quota",
	"out of credit",
	"out of credits",
	"quota exceeded",
	"payment required",
	"402",
	"credit insufficient",
	"no enough quota",
}

// ClassifyFailReason returns audit, upstream-balance, or retryable.
// Audit is checked before balance so policy text wins if both match.
func ClassifyFailReason(reason string) FailReasonClass {
	lower := strings.ToLower(reason)
	for _, kw := range auditFailKeywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return FailReasonAudit
		}
	}
	for _, kw := range upstreamBalanceFailKeywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return FailReasonUpstreamBalance
		}
	}
	return FailReasonRetryable
}

// IsAuditFailReason is true when the task must end without failover.
func IsAuditFailReason(reason string) bool {
	return ClassifyFailReason(reason) == FailReasonAudit
}

// IsUpstreamBalanceFailReason is true when same-channel retry should be skipped
// but cross-channel failover is allowed.
func IsUpstreamBalanceFailReason(reason string) bool {
	return ClassifyFailReason(reason) == FailReasonUpstreamBalance
}

// BlocksSameChannelResubmit is true for audit or upstream-balance failures.
func BlocksSameChannelResubmit(reason string) bool {
	c := ClassifyFailReason(reason)
	return c == FailReasonAudit || c == FailReasonUpstreamBalance
}
