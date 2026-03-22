package service

import (
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const (
	defaultResponsesBootstrapGracePeriod = 180 * time.Second
	defaultResponsesBootstrapProbePeriod = 1 * time.Second
	defaultResponsesBootstrapPingPeriod  = 10 * time.Second
)

// ResponsesBootstrapRecoveryConfig contains the active bootstrap recovery settings.
type ResponsesBootstrapRecoveryConfig struct {
	Enabled              bool
	GracePeriod          time.Duration
	ProbeInterval        time.Duration
	PingInterval         time.Duration
	RetryableStatusCodes map[int]struct{}
}

// ResponsesBootstrapRecoveryState tracks a single request's bootstrap recovery window.
type ResponsesBootstrapRecoveryState struct {
	Enabled              bool
	StartedAt            time.Time
	Deadline             time.Time
	ProbeInterval        time.Duration
	PingInterval         time.Duration
	RetryableStatusCodes map[int]struct{}
	LastPingAt           time.Time
	HeadersSent          bool
	PayloadStarted       bool
	WaitAttempts         int
	WaitDuration         time.Duration
}

// GetResponsesBootstrapRecoveryConfig loads the current bootstrap recovery settings.
func GetResponsesBootstrapRecoveryConfig() ResponsesBootstrapRecoveryConfig {
	settings := operation_setting.GetGeneralSettingSnapshot()
	cfg := ResponsesBootstrapRecoveryConfig{
		Enabled:              settings.ResponsesStreamBootstrapRecoveryEnabled,
		GracePeriod:          defaultResponsesBootstrapGracePeriod,
		ProbeInterval:        defaultResponsesBootstrapProbePeriod,
		PingInterval:         defaultResponsesBootstrapPingPeriod,
		RetryableStatusCodes: map[int]struct{}{},
	}
	if settings.ResponsesStreamBootstrapGracePeriodSeconds > 0 {
		cfg.GracePeriod = time.Duration(settings.ResponsesStreamBootstrapGracePeriodSeconds) * time.Second
	}
	if settings.ResponsesStreamBootstrapProbeIntervalMilliseconds > 0 {
		cfg.ProbeInterval = time.Duration(settings.ResponsesStreamBootstrapProbeIntervalMilliseconds) * time.Millisecond
	}
	if settings.ResponsesStreamBootstrapPingIntervalSeconds > 0 {
		cfg.PingInterval = time.Duration(settings.ResponsesStreamBootstrapPingIntervalSeconds) * time.Second
	}
	for _, code := range settings.ResponsesStreamBootstrapRetryableStatusCodes {
		if code >= 100 && code <= 599 {
			cfg.RetryableStatusCodes[code] = struct{}{}
		}
	}
	if len(cfg.RetryableStatusCodes) == 0 {
		for _, code := range operation_setting.DefaultResponsesBootstrapRetryableStatusCodes() {
			cfg.RetryableStatusCodes[code] = struct{}{}
		}
	}
	return cfg
}

// IsResponsesBootstrapRecoveryPath reports whether the request path supports bootstrap recovery.
func IsResponsesBootstrapRecoveryPath(path string) bool {
	if path != "/v1/responses" && !strings.HasPrefix(path, "/v1/responses/") {
		return false
	}
	return !strings.HasPrefix(path, "/v1/responses/compact")
}

// GetResponsesBootstrapRecoveryState returns the request-scoped bootstrap recovery state.
func GetResponsesBootstrapRecoveryState(c *gin.Context) (*ResponsesBootstrapRecoveryState, bool) {
	if c == nil {
		return nil, false
	}
	return common.GetContextKeyType[*ResponsesBootstrapRecoveryState](c, constant.ContextKeyResponsesBootstrapRecoveryState)
}

// EnsureResponsesBootstrapRecoveryState creates request-scoped recovery state for eligible streams.
func EnsureResponsesBootstrapRecoveryState(c *gin.Context, isStream bool) *ResponsesBootstrapRecoveryState {
	if state, ok := GetResponsesBootstrapRecoveryState(c); ok {
		return state
	}
	if c == nil || c.Request == nil || !isStream || !IsResponsesBootstrapRecoveryPath(c.Request.URL.Path) {
		return nil
	}
	cfg := GetResponsesBootstrapRecoveryConfig()
	if !cfg.Enabled {
		return nil
	}
	now := time.Now()
	state := &ResponsesBootstrapRecoveryState{
		Enabled:       true,
		StartedAt:     now,
		Deadline:      now.Add(cfg.GracePeriod),
		ProbeInterval: cfg.ProbeInterval,
		PingInterval:  cfg.PingInterval,
	}
	if len(cfg.RetryableStatusCodes) > 0 {
		state.RetryableStatusCodes = make(map[int]struct{}, len(cfg.RetryableStatusCodes))
		for code := range cfg.RetryableStatusCodes {
			state.RetryableStatusCodes[code] = struct{}{}
		}
	}
	common.SetContextKey(c, constant.ContextKeyResponsesBootstrapRecoveryState, state)
	return state
}

// EnsureResponsesBootstrapRecoveryStateFromRequest loads stream intent from the request body before creating state.
func EnsureResponsesBootstrapRecoveryStateFromRequest(c *gin.Context) (*ResponsesBootstrapRecoveryState, error) {
	if state, ok := GetResponsesBootstrapRecoveryState(c); ok {
		return state, nil
	}
	if c == nil || c.Request == nil || !IsResponsesBootstrapRecoveryPath(c.Request.URL.Path) {
		return nil, nil
	}
	req := &dto.OpenAIResponsesRequest{}
	if err := common.UnmarshalBodyReusable(c, req); err != nil {
		return nil, err
	}
	return EnsureResponsesBootstrapRecoveryState(c, req.IsStream(c)), nil
}

// MarkResponsesBootstrapHeadersSent records that the SSE response headers have been emitted.
func MarkResponsesBootstrapHeadersSent(c *gin.Context) {
	if state, ok := GetResponsesBootstrapRecoveryState(c); ok && state != nil {
		state.HeadersSent = true
	}
}

// MarkResponsesBootstrapPingSent records the most recent bootstrap keepalive ping.
func MarkResponsesBootstrapPingSent(c *gin.Context, now time.Time) {
	if state, ok := GetResponsesBootstrapRecoveryState(c); ok && state != nil {
		state.HeadersSent = true
		state.LastPingAt = now
	}
}

// MarkResponsesBootstrapPayloadStarted marks the request as having started real payload delivery.
func MarkResponsesBootstrapPayloadStarted(c *gin.Context) {
	if state, ok := GetResponsesBootstrapRecoveryState(c); ok && state != nil {
		state.PayloadStarted = true
	}
}

// CanContinueResponsesBootstrapRecovery reports whether the request may remain in bootstrap recovery.
func CanContinueResponsesBootstrapRecovery(c *gin.Context, newAPIError *types.NewAPIError) bool {
	state, ok := GetResponsesBootstrapRecoveryState(c)
	if !ok || state == nil || !state.Enabled || state.PayloadStarted {
		return false
	}
	if !time.Now().Before(state.Deadline) {
		return false
	}
	if newAPIError == nil {
		return true
	}
	if types.IsChannelError(newAPIError) || newAPIError.GetErrorCode() == types.ErrorCodeGetChannelFailed {
		return true
	}
	if types.IsSkipRetryError(newAPIError) {
		return false
	}
	if newAPIError.StatusCode == 0 {
		return false
	}
	_, ok = state.RetryableStatusCodes[newAPIError.StatusCode]
	return ok
}

// NextResponsesBootstrapWait returns the next wait duration and whether a keepalive ping should be sent.
func NextResponsesBootstrapWait(c *gin.Context, now time.Time) (time.Duration, bool, bool) {
	state, ok := GetResponsesBootstrapRecoveryState(c)
	if !ok || state == nil || !state.Enabled || state.PayloadStarted {
		return 0, false, false
	}
	if !now.Before(state.Deadline) {
		return 0, false, false
	}
	sendPing := !state.HeadersSent
	if !sendPing && state.PingInterval > 0 && (state.LastPingAt.IsZero() || now.Sub(state.LastPingAt) >= state.PingInterval) {
		sendPing = true
	}
	waitDuration := state.ProbeInterval
	remaining := state.Deadline.Sub(now)
	if remaining <= 0 {
		return 0, sendPing, false
	}
	if waitDuration <= 0 || waitDuration > remaining {
		waitDuration = remaining
	}
	if waitDuration <= 0 {
		return 0, sendPing, false
	}
	state.WaitAttempts++
	state.WaitDuration += waitDuration
	return waitDuration, sendPing, true
}

// ShouldWriteResponsesBootstrapStreamError reports whether an SSE error event should be emitted.
func ShouldWriteResponsesBootstrapStreamError(c *gin.Context) bool {
	state, ok := GetResponsesBootstrapRecoveryState(c)
	return ok && state != nil && state.Enabled && state.HeadersSent && !state.PayloadStarted
}
