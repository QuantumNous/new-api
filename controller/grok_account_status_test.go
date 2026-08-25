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
			Limit             *float64 `json:"limit"`
			Used              *float64 `json:"used"`
			Remaining         *float64 `json:"remaining"`
			Unit              string   `json:"unit"`
			PeriodType        string   `json:"period_type"`
			PeriodStart       string   `json:"period_start"`
			PeriodEnd         string   `json:"period_end"`
			OnDemandCap       *float64 `json:"on_demand_cap"`
			OnDemandUsed      *float64 `json:"on_demand_used"`
			OnDemandRemaining *float64 `json:"on_demand_remaining"`
			PrepaidBalance    *float64 `json:"prepaid_balance"`
		} `json:"monthly"`
		Weekly *struct {
			StatusCode        int      `json:"status_code"`
			UsagePercent      *float64 `json:"usage_percent"`
			UsedPercent       *float64 `json:"used_percent"`
			MonthlyLimitCents *int64   `json:"monthly_limit_cents"`
			Limit             *float64 `json:"limit"`
			Used              *float64 `json:"used"`
			Remaining         *float64 `json:"remaining"`
			Unit              string   `json:"unit"`
			PeriodType        string   `json:"period_type"`
			PeriodStart       string   `json:"period_start"`
			PeriodEnd         string   `json:"period_end"`
			OnDemandCap       *float64 `json:"on_demand_cap"`
			OnDemandUsed      *float64 `json:"on_demand_used"`
			OnDemandRemaining *float64 `json:"on_demand_remaining"`
			PrepaidBalance    *float64 `json:"prepaid_balance"`
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

func TestGrokAccountStatusHandlerProjectsPackageBalancesWithoutSecrets(t *testing.T) {
	setupGrokAuthTestDB(t)
	channel := seedGrokChannel(t)
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:     channel.Id,
		AuthStatus:    model.GrokAuthStatusActive,
		QuotaSnapshot: `{"version":1,"plan":"SuperGrok","tier":"x_premium","monthly":{"status_code":200,"limit":100,"used":25,"remaining":75,"unit":"credits","period_type":"USAGE_PERIOD_TYPE_MONTHLY","period_start":"2026-08-01T00:00:00Z","period_end":"2026-09-01T00:00:00Z","on_demand_cap":50,"on_demand_used":12.5,"on_demand_remaining":37.5,"prepaid_balance":3},"weekly":{"status_code":200,"limit":100,"used":42.5,"remaining":57.5,"unit":"percent","period_type":"USAGE_PERIOD_TYPE_WEEKLY","period_end":"2026-08-15T00:00:00Z"}}`,
		LastError:     "upstream secret should not be projected",
	}))

	ctx, rec := newGrokAccountStatusContext(t, channel.Id)
	GrokAccountStatusHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, rec.Body.String(), "quota_snapshot")
	require.NotContains(t, rec.Body.String(), "upstream secret")

	var response grokAccountStatusResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.NotNil(t, response.Data.Monthly)
	monthly := response.Data.Monthly
	require.NotNil(t, monthly.Limit)
	require.Equal(t, 100.0, *monthly.Limit)
	require.Equal(t, 25.0, *monthly.Used)
	require.Equal(t, 75.0, *monthly.Remaining)
	require.Equal(t, "credits", monthly.Unit)
	require.Equal(t, "2026-09-01T00:00:00Z", monthly.PeriodEnd)
	require.NotNil(t, monthly.OnDemandRemaining)
	require.Equal(t, 37.5, *monthly.OnDemandRemaining)
	require.NotNil(t, monthly.PrepaidBalance)
	require.Equal(t, 3.0, *monthly.PrepaidBalance)
	require.NotNil(t, response.Data.Weekly)
	require.Equal(t, "percent", response.Data.Weekly.Unit)
	require.Equal(t, "USAGE_PERIOD_TYPE_WEEKLY", response.Data.Weekly.PeriodType)
}

func TestGrokAccountStatusHandlerOmitsUnknownQuotaSnapshotFields(t *testing.T) {
	setupGrokAuthTestDB(t)
	channel := seedGrokChannel(t)
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:     channel.Id,
		AuthStatus:    model.GrokAuthStatusActive,
		QuotaSnapshot: `{"version":1,"monthly":{"status_code":200,"unknown":"raw"},"weekly":{"status_code":200}}`,
	}))

	ctx, rec := newGrokAccountStatusContext(t, channel.Id)
	GrokAccountStatusHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	var response grokAccountStatusResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.Nil(t, response.Data.Monthly)
	require.Nil(t, response.Data.Weekly)
}

func TestGrokAccountStatusHandlerClampsPercentagesForDisplay(t *testing.T) {
	setupGrokAuthTestDB(t)
	channel := seedGrokChannel(t)
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{
		ChannelID:     channel.Id,
		AuthStatus:    model.GrokAuthStatusActive,
		QuotaSnapshot: `{"version":1,"monthly":{"status_code":200,"usage_percent":125,"used_percent":130,"used":130,"limit":100,"remaining":0},"weekly":{"status_code":200}}`,
	}))

	ctx, rec := newGrokAccountStatusContext(t, channel.Id)
	GrokAccountStatusHandler(ctx)
	require.Equal(t, http.StatusOK, rec.Code)
	var response grokAccountStatusResponse
	require.NoError(t, common.Unmarshal(rec.Body.Bytes(), &response))
	require.NotNil(t, response.Data.Monthly)
	require.NotNil(t, response.Data.Monthly.UsagePercent)
	require.Equal(t, 100.0, *response.Data.Monthly.UsagePercent)
	require.NotNil(t, response.Data.Monthly.UsedPercent)
	require.Equal(t, 100.0, *response.Data.Monthly.UsedPercent)
	require.Equal(t, 130.0, *response.Data.Monthly.Used)
}
