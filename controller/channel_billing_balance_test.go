package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateChannelBalanceRefreshesOnlyRequestedNewAPIChannel(t *testing.T) {
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer upstream-token", r.Header.Get("Authorization"))
		switch r.URL.Path {
		case "/api/usage/token/":
			writeControllerBalanceJSON(t, w, map[string]any{
				"code": true,
				"data": map[string]any{"total_available": 3625000, "unlimited_quota": false, "expires_at": 0},
			})
		case "/api/status":
			writeControllerBalanceJSON(t, w, map[string]any{
				"success": true,
				"data":    map[string]any{"quota_per_unit": 500000, "quota_display_type": "USD"},
			})
		default:
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
	}))
	defer upstream.Close()

	baseURL := upstream.URL
	requested := &model.Channel{Id: 980001, Type: constant.ChannelTypeNewAPI, Key: "upstream-token", Name: "requested", Status: common.ChannelStatusEnabled, BaseURL: &baseURL}
	untouched := &model.Channel{Id: 980002, Type: constant.ChannelTypeNewAPI, Key: "upstream-token", Name: "untouched", Status: common.ChannelStatusEnabled, BaseURL: &baseURL}
	require.NoError(t, db.Create(requested).Error)
	require.NoError(t, db.Create(untouched).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/channel/update_balance/%d", requested.Id), nil)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(requested.Id)}}
	UpdateChannelBalance(ctx)

	var response struct {
		Success bool                      `json:"success"`
		Balance float64                   `json:"balance"`
		Data    *model.ChannelBalanceInfo `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	assert.Equal(t, 7.25, response.Balance)
	require.NotNil(t, response.Data)
	assert.Equal(t, "7.25", response.Data.Remaining)

	persisted, err := model.GetChannelById(requested.Id, true)
	require.NoError(t, err)
	require.NotNil(t, persisted.BalanceInfo)
	assert.Equal(t, "7.25", persisted.BalanceInfo.Remaining)
	persisted, err = model.GetChannelById(untouched.Id, true)
	require.NoError(t, err)
	assert.Nil(t, persisted.BalanceInfo)
}

func TestNormalizeNewAPIBalancePreservesUpstreamDisplay(t *testing.T) {
	quotaPerUnit := decimal.NewFromInt(500000)
	exchangeRate := decimal.RequireFromString("7.3")

	cny, legacy := normalizeNewAPIBalance(decimal.NewFromInt(2500000), false, &newAPIStatusData{
		QuotaPerUnit:     &quotaPerUnit,
		QuotaDisplayType: "CNY",
		USDExchangeRate:  &exchangeRate,
	})
	assert.Equal(t, model.ChannelBalanceUnitMoney, cny.Unit)
	assert.Equal(t, "CNY", cny.Currency)
	assert.Equal(t, "36.5", cny.Remaining)
	assert.Nil(t, legacy)

	unlimited, legacy := normalizeNewAPIBalance(decimal.Zero, true, &newAPIStatusData{
		QuotaPerUnit:     &quotaPerUnit,
		QuotaDisplayType: "USD",
	})
	assert.True(t, unlimited.Unlimited)
	assert.Empty(t, unlimited.Remaining)
	assert.Nil(t, legacy)
}

func TestNormalizeNewAPIBalanceClampsNegativeRemaining(t *testing.T) {
	credits, legacy := normalizeNewAPIBalance(decimal.NewFromInt(-1), false, nil)
	assert.Equal(t, "0", credits.Remaining)
	assert.Nil(t, legacy)

	quotaPerUnit := decimal.NewFromInt(500000)
	usd, legacy := normalizeNewAPIBalance(decimal.NewFromInt(-500000), false, &newAPIStatusData{
		QuotaPerUnit:     &quotaPerUnit,
		QuotaDisplayType: "USD",
	})
	assert.Equal(t, "0", usd.Remaining)
	require.NotNil(t, legacy)
	assert.Zero(t, *legacy)
	assert.True(t, newAPIBalanceExhausted(&usd))
}

func writeControllerBalanceJSON(t *testing.T, writer http.ResponseWriter, value any) {
	t.Helper()
	payload, err := common.Marshal(value)
	require.NoError(t, err)
	_, err = writer.Write(payload)
	require.NoError(t, err)
}
