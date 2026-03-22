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

type ResponsesBootstrapRecoveryConfig struct {
	Enabled              bool
	GracePeriod          time.Duration
	ProbeInterval        time.Duration
	PingInterval         time.Duration
	RetryableStatusCodes map[int]struct{}
}

type ResponsesBootstrapRecoveryState struct {
	Enabled        bool
	StartedAt      time.Time
	Deadline       time.Time
	ProbeInterval  time.Duration
	PingInterval   time.Duration
	LastPingAt     time.Time
	HeadersSent    bool
	PayloadStarted bool
	WaitAttempts   int
	WaitDuration   time.Duration
}

func GetResponsesBootstrapRecoveryConfig() ResponsesBootstrapRecoveryConfig {
	settings := operation_setting.GetGeneralSetting()
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
		for _, code := range []int{401, 403, 408, 429, 500, 502, 503, 504} {
			cfg.RetryableStatusCodes[code] = struct{}{}
		}
	}
	return cfg
}

func IsResponsesBootstrapRecoveryPath(path string) bool {
	return strings.HasPrefix(path, "/v1/responses") &&
		!strings.HasPrefix(path, "/v1/responses/compact")
}

func GetResponsesBootstrapRecoveryState(c *gin.Context) (*ResponsesBootstrapRecoveryState, bool) {
	if c == nil {
		return nil, false
	}
	return common.GetContextKeyType[*ResponsesBootstrapRecoveryState](c, constant.ContextKeyResponsesBootstrapRecoveryState)
}

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
	common.SetContextKey(c, constant.ContextKeyResponsesBootstrapRecoveryState, state)
	return state
}

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

func MarkResponsesBootstrapHeadersSent(c *gin.Context) {
	if state, ok := GetResponsesBootstrapRecoveryState(c); ok && state != nil {
		state.HeadersSent = true
	}
}

func MarkResponsesBootstrapPingSent(c *gin.Context, now time.Time) {
	if state, ok := GetResponsesBootstrapRecoveryState(c); ok && state != nil {
		state.HeadersSent = true
		state.LastPingAt = now
	}
}

func MarkResponsesBootstrapPayloadStarted(c *gin.Context) {
	if state, ok := GetResponsesBootstrapRecoveryState(c); ok && state != nil {
		state.PayloadStarted = true
	}
}

func CanContinueResponsesBootstrapRecovery(c *gin.Context, newAPIError *types.NewAPIError) bool {
	state, ok := GetResponsesBootstrapRecoveryState(c)
	if !ok || state == nil || !state.Enabled || state.PayloadStarted {
		return false
	}
	if time.Now().After(state.Deadline) {
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
	_, ok = GetResponsesBootstrapRecoveryConfig().RetryableStatusCodes[newAPIError.StatusCode]
	return ok
}

func NextResponsesBootstrapWait(c *gin.Context, now time.Time) (time.Duration, bool, bool) {
	state, ok := GetResponsesBootstrapRecoveryState(c)
	if !ok || state == nil || !state.Enabled || state.PayloadStarted {
		return 0, false, false
	}
	if now.After(state.Deadline) {
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

func ShouldWriteResponsesBootstrapStreamError(c *gin.Context) bool {
	state, ok := GetResponsesBootstrapRecoveryState(c)
	return ok && state != nil && state.Enabled && state.HeadersSent && !state.PayloadStarted
}
