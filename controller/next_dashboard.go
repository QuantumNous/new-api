package controller

import (
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	dashboardDaySeconds = int64(86400)
	dashboardMaxDays    = int64(366)
)

type nextDashboardKPI struct {
	TotalTokens   int64   `json:"totalTokens"`
	TotalQuota    int64   `json:"totalQuota"`
	TotalRequests int64   `json:"totalRequests"`
	AvgLatency    float64 `json:"avgLatency"`
	SuccessRate   float64 `json:"successRate"`
}

type nextDashboardComparison struct {
	QuotaDelta    *float64 `json:"quotaDelta"`
	RequestsDelta *float64 `json:"requestsDelta"`
}

type nextDashboardModel struct {
	Model      string  `json:"model"`
	Tokens     int64   `json:"tokens"`
	Quota      int64   `json:"quota"`
	Requests   int64   `json:"requests"`
	Share      float64 `json:"share"`
	AvgLatency float64 `json:"avgLatency"`
}

type nextDashboardHourly struct {
	Hour     string `json:"hour"`
	Requests int64  `json:"requests"`
}

type nextDashboardFlow struct {
	Date     string `json:"date"`
	Consume  int64  `json:"consume"`
	Requests int64  `json:"requests"`
	TopUp    int64  `json:"topup"`
}

type nextDashboardStats struct {
	KPI        nextDashboardKPI        `json:"kpi"`
	Comparison nextDashboardComparison `json:"comparison"`
	Models     []nextDashboardModel    `json:"models"`
	Hourly     []nextDashboardHourly   `json:"hourly"`
	Flow       []nextDashboardFlow     `json:"flow"`
}

type nextDashboardDistributionPoint struct {
	Date     string `json:"date"`
	Requests int64  `json:"requests"`
	Consume  int64  `json:"consume"`
	Tokens   int64  `json:"tokens"`
}

type nextDashboardBandwidthSeries struct {
	Up   []float64 `json:"up"`
	Down []float64 `json:"down"`
}

type nextDashboardSystemStatus struct {
	CPUPercent        *float64                      `json:"cpu_percent"`
	MemoryUsedGB      *float64                      `json:"memory_used_gb"`
	MemoryTotalGB     *float64                      `json:"memory_total_gb"`
	BandwidthUpMbps   *float64                      `json:"bandwidth_up_mbps"`
	BandwidthDownMbps *float64                      `json:"bandwidth_down_mbps"`
	DiskUsedGB        *float64                      `json:"disk_used_gb"`
	DiskTotalGB       *float64                      `json:"disk_total_gb"`
	APISuccessRate    *float64                      `json:"api_success_rate"`
	BandwidthSeries   *nextDashboardBandwidthSeries `json:"bandwidth_series"`
}

type nextAdminDashboardRoute struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Supplier string  `json:"supplier"`
	Latency  int     `json:"latency"`
	Quota    float64 `json:"quota"`
	Weight   uint    `json:"weight"`
	Priority int64   `json:"priority"`
	Status   int     `json:"status"`
}

func dashboardTimezoneOffset(c *gin.Context) (int, *time.Location, bool) {
	offset := 0
	if raw := strings.TrimSpace(c.Query("tz_offset")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < -720 || parsed > 840 {
			nextBusinessError(c, "invalid timezone offset", "VALIDATION_ERROR")
			return 0, nil, false
		}
		offset = parsed
	}
	return offset, time.FixedZone("dashboard", offset*60), true
}

func parseDashboardRange(c *gin.Context, now time.Time, location *time.Location) (int64, int64, bool) {
	localNow := now.In(location)
	endTimestamp := now.Unix() + 1
	var start time.Time
	switch strings.ToLower(strings.TrimSpace(c.Query("range"))) {
	case "today":
		start = time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, location)
	case "7d":
		start = time.Date(localNow.Year(), localNow.Month(), localNow.Day()-6, 0, 0, 0, 0, location)
	case "", "30d":
		start = time.Date(localNow.Year(), localNow.Month(), localNow.Day()-29, 0, 0, 0, 0, location)
	case "custom":
		customStart, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(c.Query("start")), location)
		if err != nil {
			nextBusinessError(c, "invalid dashboard date range", "VALIDATION_ERROR")
			return 0, 0, false
		}
		customEnd, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(c.Query("end")), location)
		if err != nil || customEnd.Before(customStart) {
			nextBusinessError(c, "invalid dashboard date range", "VALIDATION_ERROR")
			return 0, 0, false
		}
		start = customStart
		endTimestamp = customEnd.AddDate(0, 0, 1).Unix()
	default:
		nextBusinessError(c, "invalid dashboard range", "VALIDATION_ERROR")
		return 0, 0, false
	}
	startTimestamp := start.Unix()
	if endTimestamp <= startTimestamp || endTimestamp-startTimestamp > dashboardMaxDays*dashboardDaySeconds {
		nextBusinessError(c, "invalid dashboard date range", "VALIDATION_ERROR")
		return 0, 0, false
	}
	return startTimestamp, endTimestamp, true
}

func roundedDashboardPercent(current, previous int64) *float64 {
	if previous <= 0 {
		return nil
	}
	value := math.Round((float64(current-previous)/float64(previous))*1000) / 10
	return &value
}

func dashboardDayLabel(dayStart int64) string {
	return time.Unix(dayStart, 0).UTC().Format("2006-01-02")
}

func buildDashboardStats(current, previous model.DashboardUsage, startTimestamp, endTimestamp int64, offsetMinutes int) nextDashboardStats {
	stats := nextDashboardStats{
		KPI: nextDashboardKPI{
			TotalTokens: current.Tokens, TotalQuota: current.Quota, TotalRequests: current.Requests,
		},
		Comparison: nextDashboardComparison{
			QuotaDelta:    roundedDashboardPercent(current.Quota, previous.Quota),
			RequestsDelta: roundedDashboardPercent(current.Requests, previous.Requests),
		},
		Models: make([]nextDashboardModel, 0, len(current.Models)),
		Hourly: make([]nextDashboardHourly, 0, len(current.HourlyRequests)),
		Flow:   make([]nextDashboardFlow, 0),
	}
	if current.SuccessfulRequests > 0 {
		stats.KPI.AvgLatency = math.Round(float64(current.TotalUseTime)/float64(current.SuccessfulRequests)*100) / 100
	}
	if current.Requests > 0 {
		stats.KPI.SuccessRate = math.Round(float64(current.SuccessfulRequests)/float64(current.Requests)*1000) / 10
	}
	for modelName, item := range current.Models {
		row := nextDashboardModel{
			Model: modelName, Tokens: item.Tokens, Quota: item.Quota, Requests: item.Requests,
		}
		if item.SuccessfulRequests > 0 {
			row.AvgLatency = math.Round(float64(item.TotalUseTime)/float64(item.SuccessfulRequests)*100) / 100
		}
		if current.Quota > 0 {
			row.Share = math.Round(float64(item.Quota)/float64(current.Quota)*1000) / 10
		} else if current.Requests > 0 {
			row.Share = math.Round(float64(item.Requests)/float64(current.Requests)*1000) / 10
		}
		stats.Models = append(stats.Models, row)
	}
	sort.Slice(stats.Models, func(i, j int) bool {
		if stats.Models[i].Quota != stats.Models[j].Quota {
			return stats.Models[i].Quota > stats.Models[j].Quota
		}
		if stats.Models[i].Requests != stats.Models[j].Requests {
			return stats.Models[i].Requests > stats.Models[j].Requests
		}
		return stats.Models[i].Model < stats.Models[j].Model
	})
	for hour, requests := range current.HourlyRequests {
		stats.Hourly = append(stats.Hourly, nextDashboardHourly{
			Hour: strconv.Itoa(hour/10) + strconv.Itoa(hour%10) + ":00", Requests: requests,
		})
	}
	offsetSeconds := int64(offsetMinutes) * 60
	firstDay := startTimestamp + offsetSeconds
	firstDay -= firstDay % dashboardDaySeconds
	lastTimestamp := endTimestamp - 1 + offsetSeconds
	lastDay := lastTimestamp - lastTimestamp%dashboardDaySeconds
	for dayStart := firstDay; dayStart <= lastDay; dayStart += dashboardDaySeconds {
		item := current.Daily[dayStart]
		flow := nextDashboardFlow{Date: dashboardDayLabel(dayStart)}
		if item != nil {
			flow.Consume = item.Quota
			flow.Requests = item.Requests
		}
		stats.Flow = append(stats.Flow, flow)
	}
	return stats
}

func NextGetDashboardStats(c *gin.Context) {
	offset, location, ok := dashboardTimezoneOffset(c)
	if !ok {
		return
	}
	startTimestamp, endTimestamp, ok := parseDashboardRange(c, time.Now(), location)
	if !ok {
		return
	}
	duration := endTimestamp - startTimestamp
	current, err := model.GetUserDashboardUsage(c.GetInt("id"), startTimestamp, endTimestamp, offset)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	previous, err := model.GetUserDashboardUsage(c.GetInt("id"), startTimestamp-duration, startTimestamp, offset)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildDashboardStats(current, previous, startTimestamp, endTimestamp, offset))
}

func NextGetDashboardDistribution(c *gin.Context) {
	offset, _, ok := dashboardTimezoneOffset(c)
	if !ok {
		return
	}
	now := time.Now().Unix() + 1
	start := now - dashboardMaxDays*dashboardDaySeconds
	usage, err := model.GetUserDashboardUsage(c.GetInt("id"), start, now, offset)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	days := make([]int64, 0, len(usage.Daily))
	for day := range usage.Daily {
		days = append(days, day)
	}
	sort.Slice(days, func(i, j int) bool { return days[i] < days[j] })
	points := make([]nextDashboardDistributionPoint, 0, len(days))
	for _, day := range days {
		item := usage.Daily[day]
		points = append(points, nextDashboardDistributionPoint{
			Date: dashboardDayLabel(day), Requests: item.Requests, Consume: item.Quota, Tokens: item.Tokens,
		})
	}
	common.ApiSuccess(c, points)
}

func NextGetDashboardSystemStatus(c *gin.Context) {
	status := common.GetSystemStatus()
	response := nextDashboardSystemStatus{
		APISuccessRate: common.GetRequestSuccessRate(),
	}
	if status.CPUAvailable {
		response.CPUPercent = float64Pointer(status.CPUUsage)
	}
	if status.MemoryAvailable {
		response.MemoryUsedGB = bytesToGBPointer(status.MemoryUsedBytes)
		response.MemoryTotalGB = bytesToGBPointer(status.MemoryTotalBytes)
	}
	if status.DiskAvailable {
		response.DiskUsedGB = bytesToGBPointer(status.DiskUsedBytes)
		response.DiskTotalGB = bytesToGBPointer(status.DiskTotalBytes)
	}
	if status.Network.Available {
		response.BandwidthUpMbps = float64Pointer(status.Network.UpMbps)
		response.BandwidthDownMbps = float64Pointer(status.Network.DownMbps)
		response.BandwidthSeries = &nextDashboardBandwidthSeries{
			Up:   append([]float64(nil), status.Network.UpSeries...),
			Down: append([]float64(nil), status.Network.DownSeries...),
		}
	}
	common.ApiSuccess(c, response)
}

func float64Pointer(value float64) *float64 {
	return &value
}

func bytesToGBPointer(value uint64) *float64 {
	gb := math.Round(float64(value)/float64(1<<30)*10) / 10
	return &gb
}

func NextGetAdminDashboardRoutes(c *gin.Context) {
	channels := make([]model.Channel, 0)
	if err := model.DB.Model(&model.Channel{}).
		Select("id", "name", "type", "status", "weight", "priority", "response_time", "balance").
		Order("priority DESC").Order("id ASC").Find(&channels).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	routes := make([]nextAdminDashboardRoute, 0, len(channels))
	for _, channel := range channels {
		var priority int64
		var weight uint
		if channel.Priority != nil {
			priority = *channel.Priority
		}
		if channel.Weight != nil {
			weight = *channel.Weight
		}
		routes = append(routes, nextAdminDashboardRoute{
			ID: channel.Id, Name: channel.Name, Supplier: constant.GetChannelTypeName(channel.Type),
			Latency: channel.ResponseTime, Quota: channel.Balance, Weight: weight,
			Priority: priority, Status: channel.Status,
		})
	}
	common.ApiSuccess(c, routes)
}
