package service

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func withResponsesBootstrapRecoverySetting(t *testing.T) {
	t.Helper()
	settings := operation_setting.GetGeneralSetting()
	oldEnabled := settings.ResponsesStreamBootstrapRecoveryEnabled
	oldGrace := settings.ResponsesStreamBootstrapGracePeriodSeconds
	oldProbe := settings.ResponsesStreamBootstrapProbeIntervalMilliseconds
	oldPing := settings.ResponsesStreamBootstrapPingIntervalSeconds
	oldCodes := append([]int(nil), settings.ResponsesStreamBootstrapRetryableStatusCodes...)
	settings.ResponsesStreamBootstrapRecoveryEnabled = true
	settings.ResponsesStreamBootstrapGracePeriodSeconds = 180
	settings.ResponsesStreamBootstrapProbeIntervalMilliseconds = 1000
	settings.ResponsesStreamBootstrapPingIntervalSeconds = 10
	settings.ResponsesStreamBootstrapRetryableStatusCodes = []int{401, 403, 429, 500, 502, 503, 504}
	t.Cleanup(func() {
		settings.ResponsesStreamBootstrapRecoveryEnabled = oldEnabled
		settings.ResponsesStreamBootstrapGracePeriodSeconds = oldGrace
		settings.ResponsesStreamBootstrapProbeIntervalMilliseconds = oldProbe
		settings.ResponsesStreamBootstrapPingIntervalSeconds = oldPing
		settings.ResponsesStreamBootstrapRetryableStatusCodes = oldCodes
	})
}

func newResponsesBootstrapTestContext(path string, body string) *gin.Context {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", gin.MIMEJSON)
	return ctx
}

func TestEnsureResponsesBootstrapRecoveryStateFromRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withResponsesBootstrapRecoverySetting(t)

	ctx := newResponsesBootstrapTestContext("/v1/responses", `{"model":"gpt-5","stream":true}`)
	state, err := EnsureResponsesBootstrapRecoveryStateFromRequest(ctx)
	require.NoError(t, err)
	require.NotNil(t, state)
	require.True(t, state.Enabled)
	require.False(t, state.PayloadStarted)
	require.Equal(t, 1*time.Second, state.ProbeInterval)
	require.Equal(t, 10*time.Second, state.PingInterval)
}

func TestEnsureResponsesBootstrapRecoveryStateFromRequestIgnoresNonStream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withResponsesBootstrapRecoverySetting(t)

	ctx := newResponsesBootstrapTestContext("/v1/responses", `{"model":"gpt-5","stream":false}`)
	state, err := EnsureResponsesBootstrapRecoveryStateFromRequest(ctx)
	require.NoError(t, err)
	require.Nil(t, state)
}

func TestEnsureResponsesBootstrapRecoveryStateFromRequestIgnoresCompact(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withResponsesBootstrapRecoverySetting(t)

	ctx := newResponsesBootstrapTestContext("/v1/responses/compact", `{"model":"gpt-5"}`)
	state, err := EnsureResponsesBootstrapRecoveryStateFromRequest(ctx)
	require.NoError(t, err)
	require.Nil(t, state)
}

func TestCanContinueResponsesBootstrapRecovery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withResponsesBootstrapRecoverySetting(t)

	ctx := newResponsesBootstrapTestContext("/v1/responses", `{"model":"gpt-5","stream":true}`)
	state, err := EnsureResponsesBootstrapRecoveryStateFromRequest(ctx)
	require.NoError(t, err)
	require.NotNil(t, state)

	retryableErr := types.NewOpenAIError(
		errors.New("retryable"),
		types.ErrorCodeDoRequestFailed,
		http.StatusUnauthorized,
	)
	require.True(t, CanContinueResponsesBootstrapRecovery(ctx, retryableErr))

	nonRetryableErr := types.NewOpenAIError(
		errors.New("bad request"),
		types.ErrorCodeInvalidRequest,
		http.StatusBadRequest,
	)
	require.False(t, CanContinueResponsesBootstrapRecovery(ctx, nonRetryableErr))

	channelErr := types.NewError(errors.New("channel unavailable"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	require.True(t, CanContinueResponsesBootstrapRecovery(ctx, channelErr))

	MarkResponsesBootstrapPayloadStarted(ctx)
	require.False(t, CanContinueResponsesBootstrapRecovery(ctx, retryableErr))
}

func TestNextResponsesBootstrapWaitSchedulesInitialPing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withResponsesBootstrapRecoverySetting(t)

	ctx := newResponsesBootstrapTestContext("/v1/responses", `{"model":"gpt-5","stream":true}`)
	state, err := EnsureResponsesBootstrapRecoveryStateFromRequest(ctx)
	require.NoError(t, err)
	require.NotNil(t, state)

	waitDuration, sendPing, ok := NextResponsesBootstrapWait(ctx, time.Now())
	require.True(t, ok)
	require.Equal(t, time.Second, waitDuration)
	require.True(t, sendPing)

	MarkResponsesBootstrapHeadersSent(ctx)
	MarkResponsesBootstrapPingSent(ctx, time.Now())

	waitDuration, sendPing, ok = NextResponsesBootstrapWait(ctx, time.Now().Add(2*time.Second))
	require.True(t, ok)
	require.Equal(t, time.Second, waitDuration)
	require.False(t, sendPing)
}

func TestNextResponsesBootstrapWaitUsesProvidedNow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withResponsesBootstrapRecoverySetting(t)

	ctx := newResponsesBootstrapTestContext("/v1/responses", `{"model":"gpt-5","stream":true}`)
	state, err := EnsureResponsesBootstrapRecoveryStateFromRequest(ctx)
	require.NoError(t, err)
	require.NotNil(t, state)

	state.ProbeInterval = 30 * time.Second
	state.Deadline = state.StartedAt.Add(5 * time.Second)

	waitDuration, sendPing, ok := NextResponsesBootstrapWait(ctx, state.StartedAt.Add(4*time.Second))
	require.True(t, ok)
	require.True(t, sendPing)
	require.Equal(t, time.Second, waitDuration)
}

func TestShouldWriteResponsesBootstrapStreamError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withResponsesBootstrapRecoverySetting(t)

	ctx := newResponsesBootstrapTestContext("/v1/responses", `{"model":"gpt-5","stream":true}`)
	state, err := EnsureResponsesBootstrapRecoveryStateFromRequest(ctx)
	require.NoError(t, err)
	require.NotNil(t, state)
	require.False(t, ShouldWriteResponsesBootstrapStreamError(ctx))

	MarkResponsesBootstrapHeadersSent(ctx)
	require.True(t, ShouldWriteResponsesBootstrapStreamError(ctx))

	MarkResponsesBootstrapPayloadStarted(ctx)
	require.False(t, ShouldWriteResponsesBootstrapStreamError(ctx))
}

func TestEnsureResponsesBootstrapRecoveryStateFromRequestKeepsBodyReusable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withResponsesBootstrapRecoverySetting(t)

	ctx := newResponsesBootstrapTestContext("/v1/responses", `{"model":"gpt-5","stream":true}`)
	state, err := EnsureResponsesBootstrapRecoveryStateFromRequest(ctx)
	require.NoError(t, err)
	require.NotNil(t, state)

	var req struct {
		Model  string `json:"model"`
		Stream bool   `json:"stream"`
	}
	err = common.UnmarshalBodyReusable(ctx, &req)
	require.NoError(t, err)
	require.Equal(t, "gpt-5", req.Model)
	require.True(t, req.Stream)
}
