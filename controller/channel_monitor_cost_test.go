package controller

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetChannelMonitorCostOverviewAggregatesBeijingDaysAndCoverage(t *testing.T) {
	db := setupChannelMonitorControllerTestDB(t)

	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500_000
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"vip":2,"free":0}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
	})

	require.NoError(t, db.Create(&[]model.Channel{
		{Id: 1, Name: "已配置渠道", Key: "key-1", Group: "vip"},
		{Id: 2, Name: "未配置换算", Key: "key-2", Group: "vip"},
		{Id: 3, Name: "免费分组渠道", Key: "key-3", Group: "free"},
	}).Error)
	costConversion, err := service.MarshalChannelMonitorCostConversion(service.ChannelMonitorCostConversion{
		Mode:        service.ChannelMonitorCostConversionRecharge,
		PaidCNY:     10,
		CreditedUSD: 2,
	})
	require.NoError(t, err)
	require.NoError(t, db.Create(&[]model.ChannelRatioMonitor{
		{ChannelId: 1, Ratio: 0.5, UpdatedTime: 1, CostConversion: costConversion},
		{ChannelId: 2, Ratio: 1, UpdatedTime: 1},
		{ChannelId: 3, Ratio: 0.5, UpdatedTime: 1, CostConversion: costConversion},
	}).Error)

	yesterday := time.Date(2026, 7, 21, 15, 58, 0, 0, time.UTC).Unix()
	today := time.Date(2026, 7, 21, 16, 0, 0, 0, time.UTC).Unix()
	require.NoError(t, db.Create(&[]model.Log{
		{CreatedAt: yesterday, Type: model.LogTypeConsume, ChannelId: 1, Group: "vip", Quota: 1_000_000},
		{CreatedAt: yesterday + 60, Type: model.LogTypeRefund, ChannelId: 1, Group: "vip", Quota: 250_000},
		{CreatedAt: today, Type: model.LogTypeConsume, ChannelId: 1, Group: "vip", Quota: 500_000},
		{CreatedAt: today + 60, Type: model.LogTypeRefund, ChannelId: 1, Group: "vip", Quota: 750_000},
		{CreatedAt: today, Type: model.LogTypeConsume, ChannelId: 2, Group: "vip", Quota: 500_000},
		{CreatedAt: today, Type: model.LogTypeConsume, ChannelId: 3, Group: "free", Quota: 500_000},
	}).Error)

	now := time.Date(2026, 7, 22, 4, 0, 0, 0, time.UTC).Unix()
	overview, err := getChannelMonitorCostOverview(context.Background(), 2, now)
	require.NoError(t, err)
	require.Len(t, overview.Items, 2)
	assert.Equal(t, "2026-07-21", overview.Items[0].Date)
	assert.Equal(t, "2026-07-22", overview.Items[1].Date)
	assert.InDelta(t, 1.875, overview.YesterdayCostCNY, 1e-9)
	assert.InDelta(t, -0.625, overview.TodayCostCNY, 1e-9)
	assert.InDelta(t, 1.25, overview.TotalCostCNY, 1e-9)
	assert.Equal(t, 1, overview.Coverage.IncludedChannelCount)
	assert.Equal(t, 1, overview.Coverage.UnresolvedChannelCount)
	assert.Equal(t, 1, overview.Coverage.FreeGroupChannelCount)
	require.Len(t, overview.Channels, 1)
	assert.Equal(t, 1, overview.Channels[0].ChannelId)
	assert.Equal(t, "已配置渠道", overview.Channels[0].ChannelName)
	assert.InDelta(t, 1.25, overview.Channels[0].CostCNY, 1e-9)
}

func TestGetChannelMonitorCostOverviewRejectsInvalidDays(t *testing.T) {
	setupChannelMonitorControllerTestDB(t)
	for _, days := range []string{"0", "91", "invalid"} {
		t.Run(days, func(t *testing.T) {
			ctx, recorder := newChannelMonitorControllerContext(t, "GET", "/api/channel_monitor/cost?days="+days, nil)

			GetChannelMonitorCostOverview(ctx)

			assert.Equal(t, 400, recorder.Code)
			assert.Contains(t, recorder.Body.String(), "统计天数必须在 1 到 90 之间")
		})
	}
}
