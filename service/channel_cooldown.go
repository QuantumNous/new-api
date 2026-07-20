package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

var upstreamHostFailureExcludedKeywords = []string{
	"no available account",
	"concurrency limit exceeded",
	"insufficient account balance",
	"insufficient balance",
	"insufficient_quota",
	"credit balance is too low",
}

// IsUpstreamDistributorCapacityError identifies an upstream gateway whose
// distributor has no account/channel capacity for the requested model.
func IsUpstreamDistributorCapacityError(err *types.NewAPIError) bool {
	if err == nil ||
		err.UpstreamStatusCode != http.StatusServiceUnavailable ||
		err.GetErrorCode() != types.ErrorCodeModelNotFound {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.EqualFold(err.ToOpenAIError().Type, "new_api_error") &&
		strings.Contains(message, "no available channel") &&
		strings.Contains(message, "(distributor)")
}

func ShouldObserveUpstreamHostFailure(err *types.NewAPIError) bool {
	if err == nil || errors.Is(err, context.Canceled) || IsUpstreamDistributorCapacityError(err) {
		return false
	}
	message := strings.ToLower(err.Error() + " " + string(err.GetErrorCode()) + " " + string(err.GetErrorType()))
	for _, keyword := range upstreamHostFailureExcludedKeywords {
		if strings.Contains(message, keyword) {
			return false
		}
	}
	if err.GetErrorCode() == types.ErrorCodeDoRequestFailed {
		return true
	}
	return err.UpstreamStatusCode == http.StatusBadGateway || err.UpstreamStatusCode == http.StatusServiceUnavailable
}

// ObserveUpstreamHostFailure records only strongly attributable transport or
// upstream 502/503 failures. The model registry requires multiple failures from
// distinct channel IDs before opening, so one account cannot sideline siblings.
func ObserveUpstreamHostFailure(host, modelName, requestPath string, channelID int, err *types.NewAPIError) bool {
	if !ShouldObserveUpstreamHostFailure(err) {
		return false
	}
	host = model.NormalizeChannelBaseURLHost(host)
	path := ChannelHealthPath(requestPath)
	if host == "" || modelName == "" || path == "" {
		return false
	}
	reason := fmt.Sprintf("upstream_host_unstable status=%d upstream_status=%d code=%s error=%s", err.StatusCode, err.UpstreamStatusCode, err.GetErrorCode(), err.Error())
	opened := model.RecordChannelHostFailure(host, modelName, path, channelID, reason)
	if opened {
		common.SysLog(fmt.Sprintf("上游主机短时熔断：host=%s model=%s path=%s，持续 %s，原因：%s", host, modelName, path, 2*time.Minute, reason))
	}
	return opened
}

const (
	ChannelCooldownDuration           = 30 * time.Minute
	UpstreamErrorCooldownDuration     = 15 * time.Minute
	UpstreamRateLimitCooldownDuration = 2 * time.Hour
	// ShortChannelCooldownDuration is used for transient retryable failures
	// (mostly upstream 5xx). Kept short so a channel that only blipped returns
	// to rotation quickly instead of being sidelined for the full duration.
	ShortChannelCooldownDuration = 5 * time.Minute
	// SlowChannelFRTThreshold is the first-response-time (time to first token)
	// above which an otherwise-successful request is treated as an unstably-slow
	// upstream and the channel is cooled down. FRT (not total elapsed) is used so
	// that large prompts / high-reasoning requests, which are legitimately slow to
	// finish but still start streaming promptly, are not punished.
	SlowChannelFRTThreshold = 30 * time.Second
)

var channelCooldownKeywords = []string{
	"insufficient account balance",
	"insufficient balance",
	"insufficient_quota",
	"your credit balance is too low",
	"余额不足",
}

// IsUpstreamRateLimitError only matches a 429 returned by the selected
// upstream. Gateway-local rate limits have no UpstreamStatusCode provenance
// and must not penalize a channel.
func IsUpstreamRateLimitError(err *types.NewAPIError) bool {
	return err != nil && err.UpstreamStatusCode == http.StatusTooManyRequests
}

var upstreamErrorCooldownCodes = map[types.ErrorCode]bool{
	types.ErrorCodeDoRequestFailed:        true,
	types.ErrorCodeReadResponseBodyFailed: true,
	types.ErrorCodeBadResponse:            true,
	types.ErrorCodeBadResponseBody:        true,
	types.ErrorCodeEmptyResponse:          true,
}

// capabilityCooldownKeywords are 4xx upstream messages signalling that the
// channel cannot serve this request type right now — a per-channel capability
// gap (e.g. its upstream group has image generation disabled), not a problem
// with the client's request. The blanket 4xx gate below would normally skip
// cooldown, but retrying or re-selecting the same channel is futile and thrashes
// the pool (21s hangs that spill over onto unrelated traffic in the same group),
// so we cool it briefly until the upstream re-enables the capability.
var capabilityCooldownKeywords = []string{
	"image generation is not enabled",
	"not enabled for this group",
}

var upstreamErrorCooldownKeywords = []string{
	"openai_error",
	"empty or malformed response",
	"empty response",
	"malformed",
	"invalid character",
	"cannot unmarshal",
	"unexpected end of json",
	"unexpected eof",
	"http2: response body closed",
	"connection reset",
	"broken pipe",
	"stream error",
	"read/write",
}

// isCapabilityError reports whether the error is a per-channel capability gap
// (e.g. the upstream group has image generation disabled). These won't recover
// on a quick retry, so they warrant a full-duration cooldown.
func isCapabilityError(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error() + " " + string(err.GetErrorCode()) + " " + string(err.GetErrorType()))
	for _, keyword := range capabilityCooldownKeywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

func ShouldCooldownChannel(err *types.NewAPIError) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error() + " " + string(err.GetErrorCode()))
	for _, keyword := range channelCooldownKeywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

func ShouldCooldownChannelForUpstreamError(err *types.NewAPIError) bool {
	if err == nil || ShouldCooldownChannel(err) {
		return false
	}
	statusCode := err.StatusCode
	if err.UpstreamStatusCode != 0 {
		statusCode = err.UpstreamStatusCode
	}
	message := strings.ToLower(err.Error() + " " + string(err.GetErrorCode()) + " " + string(err.GetErrorType()))
	// Per-channel capability gaps surface as 4xx but are the channel's
	// limitation for this request type, not the client's. Cool them so retries
	// and later requests skip the channel instead of thrashing it. Checked
	// before the 4xx gate below, which would otherwise skip them.
	if isCapabilityError(err) {
		return true
	}
	if statusCode >= 400 && statusCode < 500 {
		return false
	}
	if upstreamErrorCooldownCodes[err.GetErrorCode()] {
		return true
	}
	if statusCode == 502 || statusCode == 503 {
		return true
	}
	if types.IsSkipRetryError(err) {
		return false
	}
	for _, keyword := range upstreamErrorCooldownKeywords {
		if strings.Contains(message, keyword) {
			return true
		}
	}
	return false
}

func CooldownChannel(channelError types.ChannelError, err *types.NewAPIError) {
	if !ShouldCooldownChannel(err) {
		return
	}
	common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", channelError.ChannelId, ChannelCooldownDuration, err.Error()))
	model.CooldownChannel(channelError.ChannelId, err.Error(), ChannelCooldownDuration)
}

func CooldownChannelForUpstreamError(channelError types.ChannelError, err *types.NewAPIError) {
	if !ShouldCooldownChannelForUpstreamError(err) {
		return
	}
	reason := fmt.Sprintf("upstream_unstable status=%d code=%s type=%s error=%s", err.StatusCode, err.GetErrorCode(), err.GetErrorType(), err.Error())
	common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", channelError.ChannelId, UpstreamErrorCooldownDuration, reason))
	model.CooldownChannel(channelError.ChannelId, reason, UpstreamErrorCooldownDuration)
}

func CooldownChannelForUpstreamRateLimit(channelError types.ChannelError, err *types.NewAPIError) {
	if !IsUpstreamRateLimitError(err) {
		return
	}
	reason := fmt.Sprintf("upstream_rate_limit status=%d upstream_status=%d code=%s type=%s error=%s", err.StatusCode, err.UpstreamStatusCode, err.GetErrorCode(), err.GetErrorType(), err.Error())
	if channelError.IsMultiKey {
		if channelError.UsingKey == "" {
			common.SysLog(fmt.Sprintf("通道 Key 冷却跳过：#%d，无法归因具体 Key，原因：%s", channelError.ChannelId, reason))
			return
		}
		common.SysLog(fmt.Sprintf("通道 Key 冷却：#%d，持续 %s，原因：%s", channelError.ChannelId, UpstreamRateLimitCooldownDuration, reason))
		model.CooldownChannelKey(channelError.ChannelId, channelError.UsingKey, reason, UpstreamRateLimitCooldownDuration)
		return
	}
	common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", channelError.ChannelId, UpstreamRateLimitCooldownDuration, reason))
	model.CooldownChannel(channelError.ChannelId, reason, UpstreamRateLimitCooldownDuration)
}

// CooldownChannelForRetry records a retry-triggering channel failure so later
// requests prefer healthy alternatives.
func CooldownChannelForRetry(channelError types.ChannelError, err *types.NewAPIError) {
	if IsUpstreamRateLimitError(err) {
		CooldownChannelForUpstreamRateLimit(channelError, err)
		return
	}
	// Transient retryable failures (mostly upstream 5xx) cool briefly so a
	// recovered channel rejoins rotation fast; structural capability gaps cool
	// for the full duration since a quick retry won't fix them.
	duration := ShortChannelCooldownDuration
	class := "retryable_transient"
	if isCapabilityError(err) {
		duration = ChannelCooldownDuration
		class = "capability_gap"
	}
	reason := fmt.Sprintf("%s status=%d code=%s type=%s error=%s", class, err.StatusCode, err.GetErrorCode(), err.GetErrorType(), err.Error())
	common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", channelError.ChannelId, duration, reason))
	model.CooldownChannel(channelError.ChannelId, reason, duration)
}

// CooldownSlowChannel cools a channel for the full ChannelCooldownDuration when
// an otherwise-successful request had a first-response-time above
// SlowChannelFRTThreshold, i.e. the upstream is up but unstably slow.
func CooldownSlowChannel(channelError types.ChannelError, frt time.Duration) {
	reason := fmt.Sprintf("slow_upstream first_token=%s threshold=%s", frt.Round(time.Millisecond), SlowChannelFRTThreshold)
	common.SysLog(fmt.Sprintf("通道冷却：#%d，持续 %s，原因：%s", channelError.ChannelId, ChannelCooldownDuration, reason))
	model.CooldownChannel(channelError.ChannelId, reason, ChannelCooldownDuration)
}
