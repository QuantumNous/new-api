package types

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func imageAutoConfigForTest() ImageRoutingConfig {
	return ImageRoutingConfig{
		Version:     1,
		Revision:    7,
		Enabled:     true,
		PublicModel: "image-auto",
		PublicGroup: "imageauto",
		MaxN:        4,
		Routes: []ImageRoutingRoute{
			{
				ID:                 "alt",
				ChannelID:          36,
				Priority:           30,
				Enabled:            true,
				BillingMode:        ImageRoutingBillingFixed,
				UpstreamModel:      "gpt-image-2",
				FixedQuotaPerImage: 100000,
			},
			{
				ID:                 "c",
				ChannelID:          15,
				Priority:           20,
				Enabled:            true,
				BillingMode:        ImageRoutingBillingFixed,
				UpstreamModel:      "gpt-image-2",
				FixedQuotaPerImage: 100000,
			},
			{
				ID:            "enterprise",
				ChannelID:     108,
				Priority:      10,
				Enabled:       true,
				BillingMode:   ImageRoutingBillingMetered,
				UpstreamModel: "gpt-image-2",
				BillingModel:  "gpt-image-2",
				BillingGroup:  "GPT企业旗舰",
				ReserveQuotaByQuality: map[string]int{
					"low":    400000,
					"medium": 800000,
					"high":   2000000,
				},
				MissingUsageQuotaByQuality: map[string]int{
					"low":    100000,
					"medium": 400000,
					"high":   1600000,
				},
			},
		},
	}
}

func TestImageRoutingPlanNormalizesQualityAndUsesMaximumReserve(t *testing.T) {
	plan, err := imageAutoConfigForTest().BuildPlan("standard", 2)
	require.NoError(t, err)
	require.Equal(t, "medium", plan.Quality)
	require.Equal(t, uint(2), plan.N)
	require.Equal(t, 1600000, plan.ReserveQuota)
	require.Equal(t, 7, plan.Revision)
	require.Len(t, plan.Routes, 3)
	require.Equal(t, "alt", plan.Routes[0].ID)
	require.Equal(t, "c", plan.Routes[1].ID)
	require.Equal(t, "enterprise", plan.Routes[2].ID)
}

func TestImageRoutingPlanDefaultsLowAndRejectsInvalidRequest(t *testing.T) {
	config := imageAutoConfigForTest()
	plan, err := config.BuildPlan("", 1)
	require.NoError(t, err)
	require.Equal(t, "auto", plan.Quality)

	_, err = config.BuildPlan("ultra", 1)
	require.ErrorContains(t, err, "quality")

	_, err = config.BuildPlan("low", 5)
	require.ErrorContains(t, err, "n")
}

func TestImageRoutingAutoQualityUsesHighReservationWithoutRewritingUpstreamQuality(t *testing.T) {
	plan, err := imageAutoConfigForTest().BuildPlan("auto", 1)
	require.NoError(t, err)
	require.Equal(t, "auto", plan.Quality)
	require.Equal(t, 2000000, plan.ReserveQuota)

	quota, err := plan.Routes[2].MissingUsageQuota(plan.Quality, 1)
	require.NoError(t, err)
	require.Equal(t, 1600000, quota)
}

func TestImageRoutingPlanRejectsDuplicatePriorityAndChannel(t *testing.T) {
	config := imageAutoConfigForTest()
	config.Routes[1].Priority = config.Routes[0].Priority
	_, err := config.BuildPlan("low", 1)
	require.ErrorContains(t, err, "priority")

	config = imageAutoConfigForTest()
	config.Routes[1].ChannelID = config.Routes[0].ChannelID
	_, err = config.BuildPlan("low", 1)
	require.ErrorContains(t, err, "channel")
}

func TestImageRoutingPlanFiltersByReferenceCapacityBeforeCalculatingReserve(t *testing.T) {
	config := imageAutoConfigForTest()
	config.Routes[0].MaxReferenceImages = 16
	config.Routes[1].MaxReferenceImages = 1
	config.Routes[2].MaxReferenceImages = 4

	plan, err := config.BuildPlan("high", 1, 2)
	require.NoError(t, err)
	require.Equal(t, 2, plan.ReferenceCount)
	require.Equal(t, []string{"alt", "enterprise"}, []string{plan.Routes[0].ID, plan.Routes[1].ID})
	require.Equal(t, 2000000, plan.ReserveQuota)

	_, err = config.BuildPlan("high", 1, 16)
	require.NoError(t, err)
	_, err = config.BuildPlan("high", 1, 17)
	require.ErrorContains(t, err, "reference")
}

func TestImageRoutingRouteDefaultsReferenceCapacityToOne(t *testing.T) {
	plan, err := imageAutoConfigForTest().BuildPlan("low", 1, 1)
	require.NoError(t, err)
	for _, route := range plan.Routes {
		require.Equal(t, 1, route.MaxReferenceImages)
	}
	_, err = imageAutoConfigForTest().BuildPlan("low", 1, 2)
	require.ErrorContains(t, err, "no enabled routes support")
}

func TestImageRoutingNeverRetriesAmbiguousPostDispatchFailures(t *testing.T) {
	for _, code := range []ErrorCode{
		ErrorCodeDoRequestFailed,
		ErrorCodeReadResponseBodyFailed,
		ErrorCodeBadResponseBody,
		ErrorCodeEmptyResponse,
	} {
		err := NewOpenAIError(errors.New("ambiguous upstream result"), code, http.StatusInternalServerError)
		require.Falsef(t, IsImageRoutingErrorRetryable(err, false, true), "error code %s", code)
	}

	upstream500 := NewOpenAIError(errors.New("upstream returned 500"), ErrorCodeBadResponseStatusCode, http.StatusInternalServerError)
	require.False(t, IsImageRoutingErrorRetryable(upstream500, false, true))
	require.False(t, IsImageRoutingErrorRetryable(upstream500, true, true))
}

func TestImageRoutingRetriesOnlyDefinitiveUpstreamRejections(t *testing.T) {
	for _, status := range []int{400, 401, 402, 403, 404, 405, 406, 413, 415, 422, 429} {
		err := ClassifyImageRoutingUpstreamResponse(NewOpenAIError(errors.New("rejected"), ErrorCodeBadResponseStatusCode, status))
		require.Truef(t, IsImageRoutingUpstreamRejected(err), "status %d", status)
		require.Truef(t, IsImageRoutingErrorRetryable(err, false, true), "status %d", status)
	}
	for _, status := range []int{408, 409, 500, 502, 503, 504, 524} {
		err := ClassifyImageRoutingUpstreamResponse(NewOpenAIError(errors.New("ambiguous"), ErrorCodeBadResponseStatusCode, status))
		require.Falsef(t, IsImageRoutingUpstreamRejected(err), "status %d", status)
		require.Falsef(t, IsImageRoutingErrorRetryable(err, false, true), "status %d", status)
	}
}

func TestImageRoutingRetriesOnlyTransportFailuresKnownNotToBeSent(t *testing.T) {
	notSent := NewError(
		errors.New("dial tcp: connection refused"),
		ErrorCodeDoRequestFailed,
		ErrOptionWithRequestNotSent(),
	)
	require.True(t, IsImageRoutingErrorRetryable(notSent, false, true))
	require.False(t, IsImageRoutingErrorRetryable(notSent, true, true))
	require.False(t, IsImageRoutingErrorRetryable(notSent, false, false))

	ambiguous := NewError(errors.New("upstream timeout"), ErrorCodeDoRequestFailed)
	require.False(t, IsImageRoutingErrorRetryable(ambiguous, false, true))
}
