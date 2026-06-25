package service

import (
	"strings"

	"github.com/tidwall/gjson"
)

// ImageTaskPollResult is the parsed outcome of a single upstream GET /v1/tasks/{id}.
type ImageTaskPollResult struct {
	Status     string
	ImageURL   string
	FailCode   string
	FailReason string
}

func (p ImageTaskPollResult) DisplayFailReason() string {
	return FormatImageTaskFailReason(p.FailCode, p.FailReason)
}

// FormatImageTaskFailReason renders a user-facing failure message with optional code suffix.
func FormatImageTaskFailReason(code, reason string) string {
	code = strings.TrimSpace(code)
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return code
	}
	if code == "" || strings.Contains(reason, code) {
		return reason
	}
	return reason + " (" + code + ")"
}

func parseImageTaskUpstreamError(code, message string) (failCode, failReason string) {
	failCode = strings.TrimSpace(code)
	failReason = strings.TrimSpace(message)

	if idx := strings.Index(failReason, `{"error"`); idx >= 0 {
		nested := failReason[idx:]
		innerCode := strings.TrimSpace(gjson.Get(nested, "error.code").String())
		innerMsg := strings.TrimSpace(gjson.Get(nested, "error.message").String())
		if innerCode != "" {
			failCode = innerCode
		}
		if innerMsg != "" {
			failReason = innerMsg
		}
	}

	if failReason == "" && failCode != "" {
		failReason = failCode
	}
	if failReason == "" {
		return "", ""
	}
	return failCode, failReason
}
