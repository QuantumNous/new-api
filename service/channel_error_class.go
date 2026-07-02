package service

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
)

// ChannelErrorCategory classifies relay errors for disable / notify decisions.
type ChannelErrorCategory int

const (
	CategorySkip ChannelErrorCategory = iota
	CategoryUpstreamRecharge
	CategoryDisableImmediate
	CategoryDisableWindow
	CategoryRateLimitWindow // 429 codex cooldown — higher threshold before disable
)

var (
	upstreamRechargeHighConfidence = []string{
		"余额不足",
		"账户余额不足",
		"insufficient balance",
		"insufficient_balance",
		"balance is insufficient",
		"balance not enough",
		"credit balance is too low",
		"your credit balance is too low",
		"no credits",
		"out of credits",
		"exceeded your current quota",
	}

	upstreamRechargeMediumConfidence = []string{
		"remaining upstream balance",
		"upstream remaining balance",
		"account remaining balance",
	}

	distributorSkipMarkers = []string{
		"no available channel for model",
	}

	platformUserQuotaMarkers = []string{
		"用户额度不足",
		"预扣费额度失败",
		"用户剩余额度",
		"订阅额度不足",
		"subscription quota insufficient",
		"insufficient user quota",
		"token quota is not enough",
		"user quota is not enough",
	}

	rateLimitCooldownMarkers = []string{
		"cooling down",
		"are cooling down",
	}
)

func ClassifyChannelError(err *types.NewAPIError) ChannelErrorCategory {
	if err == nil {
		return CategorySkip
	}

	code := err.GetErrorCode()
	if code == types.ErrorCodeInsufficientUserQuota ||
		code == types.ErrorCodePreConsumeTokenQuotaFailed {
		return CategorySkip
	}

	if types.IsImageGenerationTimeoutError(err) {
		return CategorySkip
	}

	msg := strings.ToLower(err.Error())
	if isPlatformUserQuotaError(err) {
		return CategorySkip
	}

	for _, m := range distributorSkipMarkers {
		if strings.Contains(msg, m) {
			return CategorySkip
		}
	}

	if types.IsChannelError(err) {
		switch code {
		case types.ErrorCodeChannelInvalidKey, types.ErrorCodeChannelNoAvailableKey:
			return CategoryDisableImmediate
		}
	}

	if err.StatusCode == 401 {
		if strings.Contains(msg, "invalid") ||
			strings.Contains(msg, "unauthorized") ||
			strings.Contains(msg, "authentication") {
			return CategoryDisableImmediate
		}
	}

	if isUpstreamRechargeError(err) {
		return CategoryUpstreamRecharge
	}

	if operation_setting.ShouldDisableByStatusCode(err.StatusCode) {
		// Legacy keyword/status path for configured codes (default 401 handled above).
		return CategoryDisableImmediate
	}

	lowerMessage := strings.ToLower(err.Error())
	if search, _ := AcSearch(lowerMessage, operation_setting.AutomaticDisableKeywords, true); search {
		return CategoryUpstreamRecharge
	}

	if isRateLimitCooldown(err) {
		return CategoryRateLimitWindow
	}

	if isWindowFault(err) {
		return CategoryDisableWindow
	}

	return CategorySkip
}

func isUpstreamRechargeError(err *types.NewAPIError) bool {
	msg := err.Error()
	lower := strings.ToLower(msg)
	for _, kw := range upstreamRechargeHighConfidence {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return true
		}
	}
	hits := 0
	for _, kw := range upstreamRechargeMediumConfidence {
		if strings.Contains(msg, kw) {
			hits++
		}
	}
	return hits >= 1 && (strings.Contains(msg, "剩余额度") || strings.Contains(lower, "403"))
}

func isPlatformUserQuotaError(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	code := err.GetErrorCode()
	if code == types.ErrorCodeInsufficientUserQuota ||
		code == types.ErrorCodePreConsumeTokenQuotaFailed {
		return true
	}
	msg := strings.ToLower(err.Error())
	for _, kw := range platformUserQuotaMarkers {
		if strings.Contains(msg, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}

func isRateLimitCooldown(err *types.NewAPIError) bool {
	if err.StatusCode != 429 {
		return false
	}
	lower := strings.ToLower(err.Error())
	for _, m := range rateLimitCooldownMarkers {
		if strings.Contains(lower, m) {
			return true
		}
	}
	return false
}

func isWindowFault(err *types.NewAPIError) bool {
	if types.IsSkipRetryError(err) {
		return false
	}
	switch err.StatusCode {
	case 502, 503, 504, 524:
		return true
	}
	lower := strings.ToLower(err.Error())
	faultMarkers := []string{
		"timeout", "timed out", "bad gateway", "bad response status code",
		"connection reset", "connection refused", "upstream",
	}
	for _, m := range faultMarkers {
		if strings.Contains(lower, m) {
			return true
		}
	}
	return false
}

func IsHighConfidenceRecharge(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	for _, kw := range upstreamRechargeHighConfidence {
		if strings.Contains(lower, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}
