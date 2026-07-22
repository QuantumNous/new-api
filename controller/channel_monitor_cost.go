package controller

import (
	"context"
	"errors"
	"math"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

const (
	channelMonitorCostDefaultDays = 30
	channelMonitorCostMaxDays     = 90
	channelMonitorCostDaySeconds  = int64(24 * 60 * 60)
	channelMonitorCostOffset      = int64(8 * 60 * 60)
)

type channelMonitorCostDay struct {
	Date    string  `json:"date"`
	StartAt int64   `json:"start_at"`
	CostCNY float64 `json:"cost_cny"`
}

type channelMonitorCostChannel struct {
	ChannelId   int     `json:"channel_id"`
	ChannelName string  `json:"channel_name"`
	CostCNY     float64 `json:"cost_cny"`
}

type channelMonitorCostCoverage struct {
	IncludedChannelCount   int `json:"included_channel_count"`
	UnresolvedChannelCount int `json:"unresolved_channel_count"`
	FreeGroupChannelCount  int `json:"free_group_channel_count"`
}

type channelMonitorCostOverview struct {
	Days             int                         `json:"days"`
	GeneratedAt      int64                       `json:"generated_at"`
	TodayCostCNY     float64                     `json:"today_cost_cny"`
	YesterdayCostCNY float64                     `json:"yesterday_cost_cny"`
	TotalCostCNY     float64                     `json:"total_cost_cny"`
	Coverage         channelMonitorCostCoverage  `json:"coverage"`
	Items            []channelMonitorCostDay     `json:"items"`
	Channels         []channelMonitorCostChannel `json:"channels"`
}

func GetChannelMonitorCostOverview(c *gin.Context) {
	days := channelMonitorCostDefaultDays
	if rawDays := c.Query("days"); rawDays != "" {
		parsedDays, err := strconv.Atoi(rawDays)
		if err != nil || parsedDays < 1 || parsedDays > channelMonitorCostMaxDays {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "统计天数必须在 1 到 90 之间"})
			return
		}
		days = parsedDays
	}

	overview, err := getChannelMonitorCostOverview(c.Request.Context(), days, common.GetTimestamp())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, overview)
}

func getChannelMonitorCostOverview(ctx context.Context, days int, now int64) (channelMonitorCostOverview, error) {
	todayStart := channelMonitorCostDayStart(now)
	startTimestamp := todayStart - int64(days-1)*channelMonitorCostDaySeconds
	endTimestamp := todayStart + channelMonitorCostDaySeconds

	quotas, err := model.GetChannelMonitorDailyQuotas(ctx, startTimestamp, endTimestamp)
	if err != nil {
		return channelMonitorCostOverview{}, err
	}
	monitors, err := model.GetChannelRatioMonitors()
	if err != nil {
		return channelMonitorCostOverview{}, err
	}
	channels, err := model.GetAllChannelsForMonitor()
	if err != nil {
		return channelMonitorCostOverview{}, err
	}

	costRatios := make(map[int]float64, len(monitors))
	for _, monitor := range monitors {
		if monitor.UpdatedTime == 0 {
			continue
		}
		conversion, parseErr := service.ParseChannelMonitorCostConversion(monitor.CostConversion)
		if parseErr != nil || conversion.Mode == service.ChannelMonitorCostConversionNone {
			continue
		}
		costRatio, _, ratioErr := service.CalculateChannelMonitorCostRatio(monitor.Ratio, conversion)
		if ratioErr != nil || !validChannelMonitorCostValue(costRatio) || costRatio < 0 {
			continue
		}
		costRatios[monitor.ChannelId] = costRatio
	}

	channelNames := make(map[int]string, len(channels))
	for _, channel := range channels {
		channelNames[channel.Id] = channel.Name
	}
	groupRatios := ratio_setting.GetGroupRatioCopy()
	quotaPerUnit := common.QuotaPerUnit
	if math.IsNaN(quotaPerUnit) || math.IsInf(quotaPerUnit, 0) || quotaPerUnit <= 0 {
		return channelMonitorCostOverview{}, errors.New("额度单位配置无效，无法回算渠道成本")
	}
	dailyCosts := make(map[int64]float64, days)
	channelCosts := make(map[int]float64)
	includedChannels := make(map[int]struct{})
	unresolvedChannels := make(map[int]struct{})
	freeGroupChannels := make(map[int]struct{})

	for _, quota := range quotas {
		if quota.Quota == 0 {
			continue
		}
		costRatio, configured := costRatios[quota.ChannelId]
		if !configured {
			unresolvedChannels[quota.ChannelId] = struct{}{}
			continue
		}
		groupRatio, exists := groupRatios[quota.Group]
		if !exists {
			groupRatio = 1
		}
		if math.IsNaN(groupRatio) || math.IsInf(groupRatio, 0) || groupRatio <= 0 {
			freeGroupChannels[quota.ChannelId] = struct{}{}
			continue
		}

		baseCostUSD := float64(quota.Quota) / quotaPerUnit / groupRatio
		costCNY := baseCostUSD * costRatio
		if !validChannelMonitorCostValue(costCNY) {
			common.SysError("渠道监控成本统计跳过异常成本值")
			continue
		}
		dailyCosts[quota.DayStart] += costCNY
		channelCosts[quota.ChannelId] += costCNY
		includedChannels[quota.ChannelId] = struct{}{}
	}

	items := make([]channelMonitorCostDay, 0, days)
	totalCostCNY := 0.0
	for dayStart := startTimestamp; dayStart < endTimestamp; dayStart += channelMonitorCostDaySeconds {
		costCNY := dailyCosts[dayStart]
		if !validChannelMonitorCostValue(costCNY) {
			common.SysError("渠道监控成本统计跳过异常每日汇总值")
			costCNY = 0
		}
		items = append(items, channelMonitorCostDay{
			Date:    channelMonitorCostDate(dayStart),
			StartAt: dayStart,
			CostCNY: costCNY,
		})
		totalCostCNY += costCNY
	}

	costChannels := make([]channelMonitorCostChannel, 0, len(channelCosts))
	for channelId, costCNY := range channelCosts {
		if !validChannelMonitorCostValue(costCNY) || costCNY == 0 {
			continue
		}
		channelName := channelNames[channelId]
		if channelName == "" {
			channelName = "已删除渠道"
		}
		costChannels = append(costChannels, channelMonitorCostChannel{
			ChannelId:   channelId,
			ChannelName: channelName,
			CostCNY:     costCNY,
		})
	}
	sort.Slice(costChannels, func(i int, j int) bool {
		if costChannels[i].CostCNY == costChannels[j].CostCNY {
			return costChannels[i].ChannelId < costChannels[j].ChannelId
		}
		return costChannels[i].CostCNY > costChannels[j].CostCNY
	})

	overview := channelMonitorCostOverview{
		Days:         days,
		GeneratedAt:  now,
		TotalCostCNY: totalCostCNY,
		Coverage: channelMonitorCostCoverage{
			IncludedChannelCount:   len(includedChannels),
			UnresolvedChannelCount: len(unresolvedChannels),
			FreeGroupChannelCount:  len(freeGroupChannels),
		},
		Items:    items,
		Channels: costChannels,
	}
	if len(items) > 0 {
		overview.TodayCostCNY = items[len(items)-1].CostCNY
	}
	if len(items) > 1 {
		overview.YesterdayCostCNY = items[len(items)-2].CostCNY
	}
	return overview, nil
}

func channelMonitorCostDayStart(timestamp int64) int64 {
	return ((timestamp+channelMonitorCostOffset)/channelMonitorCostDaySeconds)*channelMonitorCostDaySeconds - channelMonitorCostOffset
}

func channelMonitorCostDate(dayStart int64) string {
	return time.Unix(dayStart+channelMonitorCostOffset, 0).UTC().Format("2006-01-02")
}

func validChannelMonitorCostValue(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}
