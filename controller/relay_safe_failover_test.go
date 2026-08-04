package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func setupSafeFailoverTest(t *testing.T) {
	t.Helper()
	oldEnabled := common.SafeFailoverV1Enabled
	oldMaxAttempts := common.SafeFailoverMaxAttempts
	oldGuard := common.SafeFailoverImageGuardSeconds
	oldRetryTimes := common.RetryTimes
	t.Cleanup(func() {
		common.SafeFailoverV1Enabled = oldEnabled
		common.SafeFailoverMaxAttempts = oldMaxAttempts
		common.SafeFailoverImageGuardSeconds = oldGuard
		common.RetryTimes = oldRetryTimes
	})
	common.SafeFailoverV1Enabled = true
	common.SafeFailoverMaxAttempts = 0
	common.SafeFailoverImageGuardSeconds = 60
	common.RetryTimes = 10
}

func safeFailoverContext() *gin.Context {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

func TestEffectiveRelayRetryTimesSafeModeUsesExhaustiveSetting(t *testing.T) {
	setupSafeFailoverTest(t)
	require.Equal(t, 0, effectiveRelayRetryTimes())

	common.SafeFailoverV1Enabled = false
	require.Equal(t, 10, effectiveRelayRetryTimes())
}

func TestInitialContextChannelIsNeverReusedForRetry(t *testing.T) {
	info := &relaycommon.RelayInfo{}
	retryParam := &service.RetryParam{Retry: common.GetPointer(0)}
	require.True(t, shouldUseInitialContextChannel(info, retryParam))

	retryParam.SetRetry(1)
	require.False(t, shouldUseInitialContextChannel(info, retryParam))

	info.ChannelMeta = &relaycommon.ChannelMeta{}
	retryParam.SetRetry(0)
	require.False(t, shouldUseInitialContextChannel(info, retryParam))
}

func TestGetChannelKeepsSpecificallySelectedInitialChannel(t *testing.T) {
	c := safeFailoverContext()
	c.Set("specific_channel_id", "47")
	c.Set("channel_id", 47)
	c.Set("channel_type", 1)
	c.Set("channel_name", "pinned-adobe")
	c.Set("auto_ban", true)

	info := &relaycommon.RelayInfo{OriginModelName: "gpt-image-2"}
	retryParam := &service.RetryParam{
		Retry:        common.GetPointer(0),
		Image2Router: nil, // NewImage2SmartRouter bypasses pinned requests.
	}

	channel, err := getChannel(c, info, retryParam)
	require.Nil(t, err)
	require.Equal(t, 47, channel.Id)
	require.Equal(t, "pinned-adobe", channel.Name)
}

func TestShouldRetrySafeModeAllowsChannelErrorsUntilCandidatesExhaust(t *testing.T) {
	setupSafeFailoverTest(t)
	c := safeFailoverContext()
	info := &relaycommon.RelayInfo{RetryIndex: 0}
	channelErr := types.NewErrorWithStatusCode(
		errors.New("channel has no available key"),
		types.ErrorCodeChannelNoAvailableKey,
		http.StatusInternalServerError,
	)

	require.True(t, shouldRetry(c, info, channelErr, 1, time.Second))

	info.RetryIndex = 1
	require.True(t, shouldRetry(c, info, channelErr, 0, time.Second))

	common.SafeFailoverMaxAttempts = 1
	require.False(t, shouldRetry(c, info, channelErr, 0, time.Second))
}

func TestShouldRetrySafeModeContinuesLongImageServerFailure(t *testing.T) {
	setupSafeFailoverTest(t)
	c := safeFailoverContext()
	info := &relaycommon.RelayInfo{
		RetryIndex:      0,
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "gpt-image-2",
	}
	upstreamErr := types.NewErrorWithStatusCode(
		errors.New("generation failed"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadGateway,
	)

	require.True(t, shouldRetry(c, info, upstreamErr, 1, 61*time.Second))
}

func TestShouldRetryImage2RouterUsesStrictReplayAllowlist(t *testing.T) {
	setupSafeFailoverTest(t)
	common.SafeFailoverV1Enabled = false
	c := safeFailoverContext()
	c.Set("image2_smart_router_active", true)
	info := &relaycommon.RelayInfo{
		RetryIndex:      0,
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "gpt-image-2",
	}

	for _, status := range []int{
		http.StatusBadRequest,
		http.StatusUnauthorized,
		http.StatusForbidden,
		http.StatusNotFound,
	} {
		err := types.NewErrorWithStatusCode(
			errors.New("deterministic client or mapping error"),
			types.ErrorCodeBadResponseStatusCode,
			status,
		)
		require.False(t, shouldRetry(c, info, err, 10, time.Second), "status %d must not switch Image2 channels", status)
	}

	for _, status := range []int{http.StatusTooManyRequests, http.StatusBadGateway, http.StatusServiceUnavailable} {
		err := types.NewErrorWithStatusCode(
			errors.New("replayable upstream failure"),
			types.ErrorCodeBadResponseStatusCode,
			status,
		)
		require.True(t, shouldRetry(c, info, err, 0, time.Second), "status %d may switch to a compatible Image2 channel", status)
	}
}

func TestShouldRetryLegacyModePreservesChannelErrorBehavior(t *testing.T) {
	setupSafeFailoverTest(t)
	common.SafeFailoverV1Enabled = false
	c := safeFailoverContext()
	c.Set("specific_channel_id", 25)
	info := &relaycommon.RelayInfo{}
	channelErr := types.NewErrorWithStatusCode(
		errors.New("channel has no available key"),
		types.ErrorCodeChannelNoAvailableKey,
		http.StatusInternalServerError,
	)

	require.True(t, shouldRetry(c, info, channelErr, 0, time.Second))
}
