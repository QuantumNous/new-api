package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func imageAutoCooldownPlanForTest(t *testing.T) *types.ImageRoutingPlan {
	t.Helper()
	plan, err := (types.ImageRoutingConfig{
		Version:     1,
		Revision:    7,
		Enabled:     true,
		PublicModel: imageAutoPublicModel,
		PublicGroup: "imageauto",
		MaxN:        4,
		Routes: []types.ImageRoutingRoute{
			{ID: "primary", ChannelID: 36, Priority: 2, Enabled: true, BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 200000},
			{ID: "fallback", ChannelID: 108, Priority: 1, Enabled: true, BillingMode: types.ImageRoutingBillingFixed, UpstreamModel: "gpt-image-2", FixedQuotaPerImage: 100000},
		},
	}).BuildPlan("medium", 1)
	require.NoError(t, err)
	return plan
}

func TestImageAutoCooldownCoversSlowUpstreamCompletionWindow(t *testing.T) {
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)
	registry := newImageAutoCooldownRegistry(func() time.Time { return now })

	registry.Record(36, imageAutoAmbiguousCooldownDuration)
	require.True(t, registry.IsCooling(36))
	require.Equal(t, []imageAutoCooldownSnapshot{{
		ChannelID:         36,
		CooldownStartedAt: now,
		CooldownExpiresAt: now.Add(15 * time.Minute),
	}}, registry.Snapshot())

	now = now.Add(15*time.Minute - time.Nanosecond)
	require.True(t, registry.IsCooling(36))
	now = now.Add(time.Nanosecond)
	require.False(t, registry.IsCooling(36))
	require.Empty(t, registry.Snapshot())
}

func TestFilterImageAutoPlanCooldownsRemovesRouteBeforeReserve(t *testing.T) {
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)
	registry := newImageAutoCooldownRegistry(func() time.Time { return now })
	registry.Record(36, imageAutoAmbiguousCooldownDuration)
	original := imageAutoCooldownPlanForTest(t)

	filtered, err := filterImageAutoPlanCooldowns(original, registry)

	require.NoError(t, err)
	require.Equal(t, []int{108}, []int{filtered.Routes[0].ChannelID})
	require.Equal(t, 100000, filtered.ReserveQuota)
	require.Len(t, original.Routes, 2, "request filtering must not mutate the source plan")
}

func TestFilterImageAutoPlanCooldownsFailsClosedWhenEveryRouteIsCooling(t *testing.T) {
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)
	registry := newImageAutoCooldownRegistry(func() time.Time { return now })
	registry.Record(36, imageAutoAmbiguousCooldownDuration)
	registry.Record(108, imageAutoAmbiguousCooldownDuration)

	filtered, err := filterImageAutoPlanCooldowns(imageAutoCooldownPlanForTest(t), registry)

	require.Nil(t, filtered)
	require.ErrorContains(t, err, "cooldown")
}

func TestRecordImageAutoCooldownForAmbiguousFailureAndRateLimit(t *testing.T) {
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)
	registry := newImageAutoCooldownRegistry(func() time.Time { return now })
	state := relaycommon.NewImageRoutingState(imageAutoCooldownPlanForTest(t))
	require.NoError(t, state.ActivateRoute(0))
	info := &relaycommon.RelayInfo{ImageRouting: state}

	recorded := recordImageAutoCooldown(registry, info, types.NewOpenAIError(errors.New("upstream timeout"), types.ErrorCodeBadResponseStatusCode, 524))

	require.True(t, recorded)
	require.True(t, registry.IsCooling(36))
	require.False(t, registry.IsCooling(108))

	badGateway := types.NewOpenAIError(errors.New("bad gateway"), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)
	require.True(t, recordImageAutoCooldown(registry, info, badGateway))
	require.Len(t, registry.Snapshot(), 1)

	state = relaycommon.NewImageRoutingState(imageAutoCooldownPlanForTest(t))
	require.NoError(t, state.ActivateRoute(1))
	info = &relaycommon.RelayInfo{ImageRouting: state}
	rateLimited := types.ClassifyImageRoutingUpstreamResponse(types.NewOpenAIError(errors.New("rate limited"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests))
	rateLimited.StatusCode = http.StatusServiceUnavailable
	require.True(t, recordImageAutoCooldown(registry, info, rateLimited))
	require.Equal(t, now.Add(imageAutoRateLimitCooldownDuration), registry.Snapshot()[1].CooldownExpiresAt)

	notSent := types.NewOpenAIError(errors.New("dial failed"), types.ErrorCodeDoRequestFailed, http.StatusInternalServerError, types.ErrOptionWithRequestNotSent())
	require.False(t, recordImageAutoCooldown(registry, info, notSent))
}

func TestImageAuto524IsNeverRetriedInCurrentRequest(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	state := relaycommon.NewImageRoutingState(imageAutoCooldownPlanForTest(t))
	require.NoError(t, state.ActivateRoute(0))
	info := &relaycommon.RelayInfo{ImageRouting: state}
	err := types.NewOpenAIError(errors.New("upstream timeout"), types.ErrorCodeBadResponseStatusCode, 524)

	require.False(t, isImageAutoRetryable(c, info, err, 0))
}

func TestGetImageRoutingCooldownsReturnsOnlyChannelAndTimestamps(t *testing.T) {
	now := time.Date(2026, time.July, 25, 8, 0, 0, 0, time.UTC)
	registry := newImageAutoCooldownRegistry(func() time.Time { return now })
	registry.Record(36, imageAutoAmbiguousCooldownDuration)
	original := imageAutoCooldowns
	imageAutoCooldowns = registry
	t.Cleanup(func() { imageAutoCooldowns = original })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	GetImageRoutingCooldowns(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, true, response["success"])
	data, ok := response["data"].([]any)
	require.True(t, ok)
	require.Len(t, data, 1)
	entry, ok := data[0].(map[string]any)
	require.True(t, ok)
	require.ElementsMatch(t, []string{"channel_id", "cooldown_started_at", "cooldown_expires_at"}, mapKeys(entry))
	require.Equal(t, float64(36), entry["channel_id"])
	require.NotContains(t, recorder.Body.String(), "model")
	require.NotContains(t, recorder.Body.String(), "key")
}

func mapKeys(value map[string]any) []string {
	keys := make([]string, 0, len(value))
	for key := range value {
		keys = append(keys, key)
	}
	return keys
}
