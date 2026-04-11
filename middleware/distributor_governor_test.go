package middleware

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func swapPreferredChannelForAffinityTest(fn func(*gin.Context, string, string) (int, bool)) func() {
	previous := getPreferredChannelForAffinity
	getPreferredChannelForAffinity = fn
	return func() {
		getPreferredChannelForAffinity = previous
	}
}

func swapCacheGetChannelForDistributionTest(fn func(int) (*model.Channel, error)) func() {
	previous := cacheGetChannelForDistribution
	cacheGetChannelForDistribution = fn
	return func() {
		cacheGetChannelForDistribution = previous
	}
}

func swapIsChannelEnabledForGroupModelTest(fn func(string, string, int) bool) func() {
	previous := isChannelEnabledForGroupModel
	isChannelEnabledForGroupModel = fn
	return func() {
		isChannelEnabledForGroupModel = previous
	}
}

func swapShouldSkipRetryAfterAffinityFailureTest(fn func(*gin.Context) bool) func() {
	previous := shouldSkipRetryAfterAffinityFailure
	shouldSkipRetryAfterAffinityFailure = fn
	return func() {
		shouldSkipRetryAfterAffinityFailure = previous
	}
}

func swapMarkChannelAffinitySelectionTest(fn func(*gin.Context, string, int)) func() {
	previous := markChannelAffinitySelection
	markChannelAffinitySelection = fn
	return func() {
		markChannelAffinitySelection = previous
	}
}

func runDistributorForGovernorTest(t *testing.T, body string) (int, map[string]any) {
	t.Helper()
	require.NoError(t, i18n.Init())

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")

	Distribute()(ctx)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	return rec.Code, payload
}

func TestDistribute_PreferredAffinityGovernorRejectionReturns429(t *testing.T) {
	restorePreferred := swapPreferredChannelForAffinityTest(func(*gin.Context, string, string) (int, bool) {
		return 101, true
	})
	defer restorePreferred()

	restoreCacheGet := swapCacheGetChannelForDistributionTest(func(id int) (*model.Channel, error) {
		require.Equal(t, 101, id)
		return &model.Channel{
			Id:     101,
			Name:   "preferred",
			Key:    "k1",
			Status: common.ChannelStatusEnabled,
		}, nil
	})
	defer restoreCacheGet()

	restoreEnabled := swapIsChannelEnabledForGroupModelTest(func(group string, modelName string, channelID int) bool {
		return group == "default" && modelName == "gpt-4o" && channelID == 101
	})
	defer restoreEnabled()

	restoreSkipRetry := swapShouldSkipRetryAfterAffinityFailureTest(func(*gin.Context) bool {
		return false
	})
	defer restoreSkipRetry()

	restoreMark := swapMarkChannelAffinitySelectionTest(func(*gin.Context, string, int) {})
	defer restoreMark()

	restoreSetup := swapSetupContextForTest(func(c *gin.Context, channel *model.Channel, modelName string) *types.NewAPIError {
		require.Equal(t, "gpt-4o", modelName)
		if channel.Id == 101 {
			return types.NewErrorWithStatusCode(
				errors.New("channel is cooling"),
				types.ErrorCodeGovernorSelectionRejected,
				http.StatusTooManyRequests,
				types.ErrOptionWithSkipRetry(),
			)
		}
		return nil
	})
	defer restoreSetup()

	restoreSelector := swapSelectChannelForTest(func(param *service.RetryParam) (*model.Channel, string, error) {
		require.True(t, param.IsExcluded(101))
		return nil, "default", nil
	})
	defer restoreSelector()

	status, payload := runDistributorForGovernorTest(t, `{"model":"gpt-4o"}`)
	require.Equal(t, http.StatusTooManyRequests, status)

	errorPayload, ok := payload["error"].(map[string]any)
	require.True(t, ok)
	require.Contains(t, errorPayload["message"], governorSelectionRejectedMessage)
	require.Equal(t, string(types.ErrorCodeGovernorSelectionRejected), errorPayload["code"])
}

func TestDistribute_NoAvailableChannelWithoutGovernorExclusionReturns503(t *testing.T) {
	restorePreferred := swapPreferredChannelForAffinityTest(func(*gin.Context, string, string) (int, bool) {
		return 0, false
	})
	defer restorePreferred()

	restoreSelector := swapSelectChannelForTest(func(param *service.RetryParam) (*model.Channel, string, error) {
		require.Empty(t, param.ExcludedChannelIDs)
		return nil, "default", nil
	})
	defer restoreSelector()

	status, payload := runDistributorForGovernorTest(t, `{"model":"gpt-4o"}`)
	require.Equal(t, http.StatusServiceUnavailable, status)

	errorPayload, ok := payload["error"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, string(types.ErrorCodeModelNotFound), errorPayload["code"])
}
