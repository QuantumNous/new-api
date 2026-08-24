package controller

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newGrokAccountStatusContext(t *testing.T, id int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/channel/grok/status/"+strconv.Itoa(id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(id)}}
	return ctx, rec
}

type grokAccountStatusResponse struct {
	Success bool `json:"success"`
	Data    struct {
		ChannelID         int    `json:"channel_id"`
		AuthStatus        string `json:"auth_status"`
		BillingPlan       string `json:"billing_plan"`
		TierRaw           string `json:"tier_raw"`
		BillingObservedAt int64  `json:"billing_observed_at"`
		LastRefreshAt     int64  `json:"last_refresh_at"`
		Monthly           *struct {
			StatusCode        int      `json:"status_code"`
			UsagePercent      *float64 `json:"usage_percent"`
			UsedPercent       *float64 `json:"used_percent"`
			MonthlyLimitCents *int64   `json:"monthly_limit_cents"`
		} `json:"monthly"`
		Weekly *struct {
			StatusCode        int      `json:"status_code"`
			UsagePercent      *float64 `json:"usage_percent"`
			UsedPercent       *float64 `json:"used_percent"`
			MonthlyLimitCents *int64   `json:"monthly_limit_cents"`
		} `json:"weekly"`
	} `json:"data"`
}

func TestGrokAccountStatusHandlerReturnsSafeSummary(t *testing.T) {
	setupGrokAuthTestDB(t)
	channel := seedGrokChannel(t)
	usage := 12.5
	limit := int64(15000)
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:         channel.Id,
		AuthStatus:        model.GrokAuthStatusActive,
		BillingPlan:       "SuperGrok",
		TierRaw:           "x_premium",
		BillingObservedAt: 1700000010,
		LastRefreshAt:     1700000020,
		QuotaSnapshot:     `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200,"usage_percent":12.5,"monthly_limit_cents":15000},"weekly":{"status_code":503}}`,
		LastError:         "SENSITIVE-upstream-body-with-token",
		RefreshLeaseOwner: "SENSITIVE-lease-owner",
	}))

	ctx, rec := newGrokAccountStatusContext(t, channel.Id)
	GrokAccountStatusHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, rec.Body.String(), "SENSITIVE")
	require.NotContains(t, rec.Body.String(), "quota_snapshot")
	require.NotContains(t, rec.Body.String(), "access_token")

	var response grokAccountStatusResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, channel.Id, response.Data.ChannelID)
	require.Equal(t, model.GrokAuthStatusActive, response.Data.AuthStatus)
	require.Equal(t, "SuperGrok", response.Data.BillingPlan)
	require.Equal(t, "x_premium", response.Data.TierRaw)
	require.Equal(t, int64(1700000010), response.Data.BillingObservedAt)
	require.Equal(t, int64(1700000020), response.Data.LastRefreshAt)
	require.NotNil(t, response.Data.Monthly)
	require.Equal(t, 200, response.Data.Monthly.StatusCode)
	require.NotNil(t, response.Data.Monthly.UsagePercent)
	require.Equal(t, usage, *response.Data.Monthly.UsagePercent)
	require.NotNil(t, response.Data.Monthly.MonthlyLimitCents)
	require.Equal(t, limit, *response.Data.Monthly.MonthlyLimitCents)
}

func TestGrokAccountStatusHandlerMissingStateIsPending(t *testing.T) {
	setupGrokAuthTestDB(t)
	channel := seedGrokChannel(t)
	ctx, rec := newGrokAccountStatusContext(t, channel.Id)
	GrokAccountStatusHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	var response grokAccountStatusResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, model.GrokAuthStatusPending, response.Data.AuthStatus)
	require.Nil(t, response.Data.Monthly)
}

func TestGrokAccountStatusHandlerRejectsNonGrokChannel(t *testing.T) {
	setupGrokAuthTestDB(t)
	channel := model.Channel{
		Type:   constant.ChannelTypeOpenAI,
		Key:    "sk-test",
		Models: "gpt-4o",
		Group:  "default",
		Status: 1,
	}
	require.NoError(t, model.DB.Create(&channel).Error)

	ctx, rec := newGrokAccountStatusContext(t, channel.Id)
	GrokAccountStatusHandler(ctx)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Contains(t, rec.Body.String(), "not Grok subscription")
}

func TestGrokAccountStatusHandlerOmitsCorruptQuotaSnapshot(t *testing.T) {
	setupGrokAuthTestDB(t)
	channel := seedGrokChannel(t)
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:     channel.Id,
		AuthStatus:    model.GrokAuthStatusActive,
		BillingPlan:   "SuperGrok",
		QuotaSnapshot: `{"version":1,"monthly":` + "broken-upstream-body" + `}`,
		LastError:     "SENSITIVE-corrupt-upstream-body",
	}))

	ctx, rec := newGrokAccountStatusContext(t, channel.Id)
	GrokAccountStatusHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, rec.Body.String(), "broken-upstream-body")
	require.NotContains(t, rec.Body.String(), "SENSITIVE-corrupt-upstream-body")

	var response grokAccountStatusResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Equal(t, model.GrokAuthStatusActive, response.Data.AuthStatus)
	require.Nil(t, response.Data.Monthly)
	require.Nil(t, response.Data.Weekly)
}

func TestGrokAccountStatusHandlerProjectsBothQuotaWindows(t *testing.T) {
	setupGrokAuthTestDB(t)
	channel := seedGrokChannel(t)
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:     channel.Id,
		AuthStatus:    model.GrokAuthStatusActive,
		QuotaSnapshot: `{"version":1,"monthly":{"status_code":200,"used_percent":21.5},"weekly":{"status_code":429,"usage_percent":88.25}}`,
	}))

	ctx, rec := newGrokAccountStatusContext(t, channel.Id)
	GrokAccountStatusHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)

	var response grokAccountStatusResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.NotNil(t, response.Data.Monthly)
	require.Equal(t, 200, response.Data.Monthly.StatusCode)
	require.NotNil(t, response.Data.Monthly.UsedPercent)
	require.Equal(t, 21.5, *response.Data.Monthly.UsedPercent)
	require.NotNil(t, response.Data.Weekly)
	require.Equal(t, 429, response.Data.Weekly.StatusCode)
	require.NotNil(t, response.Data.Weekly.UsagePercent)
	require.Equal(t, 88.25, *response.Data.Weekly.UsagePercent)
}
