package mao

import (
	"fmt"
	"strings"
)

const MaxAsyncRetries = 3

// Non-retryable fail-reason substrings (case-insensitive). No bare "billing".
var nonRetryableKeywords = []string{
	// Audit / policy
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
	// Balance / quota
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

func isNonRetryableFailReason(reason string) bool {
	lower := strings.ToLower(reason)
	for _, kw := range nonRetryableKeywords {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}

func retryProgressLabel(failCount int) string {
	return fmt.Sprintf("retrying %d/%d", failCount+1, MaxAsyncRetries)
}

func shouldAttemptResubmit(body string, retryCount int, reason string) bool {
	return body != "" && retryCount < MaxAsyncRetries && !isNonRetryableFailReason(reason)
}
