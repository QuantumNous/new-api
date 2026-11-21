package service

import (
	"errors"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func IsCodingPlanRequest(path string) bool {
	switch path {
	case "/v1/chat/completions", "/v1/messages", "/v1/responses", "/pg/chat/completions":
		return true
	default:
		return false
	}
}

// CodingPlanPaidFallbackAllowed requires explicit opt-in for the token group.
func CodingPlanPaidFallbackAllowed(group string) bool {
	for entry := range strings.SplitSeq(os.Getenv("CODING_PLAN_PAID_FALLBACK_GROUPS"), ",") {
		if group != "" && strings.TrimSpace(entry) == group {
			return true
		}
	}
	return false
}

const (
	CodingPlanQuotaExceeded    types.ErrorCode = "QuotaExceeded"
	CodingPlanUnavailableCode  types.ErrorCode = "coding_plan_unavailable"
	codingPlanRetryDeadlineKey                 = "coding_plan_retry_deadline"
)

const codingPlanRelayKey = "coding_plan_relay"
const codingPlanRetryAfterKey = "coding_plan_retry_after"
const codingPlanAttemptKey = "coding_plan_attempt"
const codingPlanUpstreamStatusKey = "coding_plan_upstream_status"
const codingPlanDialFailureKey = "coding_plan_dial_failure"

func SetCodingPlanAttempt(c *gin.Context, isPlan bool) {
	c.Set(codingPlanAttemptKey, isPlan)
	if isPlan {
		c.Set(codingPlanRelayKey, true)
	}
	c.Set(codingPlanRetryAfterKey, time.Duration(0))
	c.Set(codingPlanUpstreamStatusKey, 0)
	c.Set(codingPlanDialFailureKey, false)
}

func SetCodingPlanRetryDeadline(c *gin.Context, deadline time.Time) {
	c.Set(codingPlanRetryDeadlineKey, deadline)
}

func CodingPlanRetryDeadline(c *gin.Context) time.Time {
	return c.GetTime(codingPlanRetryDeadlineKey)
}

func IsCodingPlanRelay(c *gin.Context) bool {
	return c != nil && c.GetBool(codingPlanRelayKey)
}

func ObserveCodingPlanRejection(c *gin.Context, resp *http.Response, err *types.NewAPIError) bool {
	if !c.GetBool(codingPlanAttemptKey) {
		return false
	}
	c.Set(codingPlanUpstreamStatusKey, resp.StatusCode)
	value := resp.Header.Get("Retry-After")
	var delay time.Duration
	if seconds, parseErr := strconv.ParseInt(value, 10, 32); parseErr == nil && seconds > 0 {
		delay = time.Duration(seconds) * time.Second
	} else if at, parseErr := http.ParseTime(value); parseErr == nil {
		delay = time.Until(at)
	}
	if delay > 0 && delay <= 31*24*time.Hour {
		c.Set(codingPlanRetryAfterKey, delay)
	}
	return resp.StatusCode == http.StatusTooManyRequests && IsCodingPlanQuotaRejection(c, err)
}

func CodingPlanUpstreamStatus(c *gin.Context) int {
	return c.GetInt(codingPlanUpstreamStatusKey)
}

func CodingPlanUpstreamRetryAfter(c *gin.Context) time.Duration {
	delay, _ := c.Get(codingPlanRetryAfterKey)
	duration, _ := delay.(time.Duration)
	return duration
}

func SetCodingPlanRetryHeader(c *gin.Context, retryAt time.Time) {
	delay := time.Until(retryAt)
	if retryAt.IsZero() || delay <= 0 {
		return
	}
	seconds := (delay + time.Second - 1) / time.Second
	c.Header("Retry-After", strconv.FormatInt(int64(seconds), 10))
}

func CodingPlanStreamRejection(c *gin.Context, event string) *types.NewAPIError {
	if !c.GetBool(codingPlanAttemptKey) {
		return nil
	}
	eventError := gjson.Get(event, "error")
	if !eventError.Exists() {
		switch gjson.Get(event, "type").String() {
		case "response.failed":
			eventError = gjson.Get(event, "response.error")
		case "error":
			eventError = gjson.Parse(event)
		}
	}
	code := eventError.Get("code").String()
	if !isCodingPlanQuotaCode(code) {
		code = eventError.Get("type").String()
	}
	if !isCodingPlanQuotaCode(code) {
		return nil
	}
	message := "Coding Plan quota exhausted"
	if code == "QuotaExceeded.AgentPlanQuotaExceeded" {
		message = "Agent Plan quota exhausted"
	}
	return types.NewOpenAIError(errors.New(message), types.ErrorCode(code), http.StatusTooManyRequests)
}

func IsCodingPlanQuotaRejection(c *gin.Context, err *types.NewAPIError) bool {
	if !c.GetBool(codingPlanAttemptKey) || err == nil || err.StatusCode != http.StatusTooManyRequests {
		return false
	}
	upstreamError, _ := err.RelayError.(types.OpenAIError)
	return isCodingPlanQuotaCode(string(err.GetErrorCode())) || isCodingPlanQuotaCode(upstreamError.Type)
}

func ObserveCodingPlanTransportFailure(c *gin.Context, err error) {
	var operation *net.OpError
	if c.GetBool(codingPlanAttemptKey) && errors.As(err, &operation) && operation.Op == "dial" {
		c.Set(codingPlanDialFailureKey, true)
	}
}

func CodingPlanDialFailed(c *gin.Context) bool {
	return c.GetBool(codingPlanDialFailureKey)
}

func isCodingPlanQuotaCode(code string) bool {
	return code == string(CodingPlanQuotaExceeded) || code == "QuotaExceeded.AgentPlanQuotaExceeded"
}
