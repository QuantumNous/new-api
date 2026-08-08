package controller

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// StatusCardRecent 前端色条的单元
type StatusCardRecent struct {
	Level string `json:"level"`
}

// StatusCard 单个分组的状态卡片
// Status 取值：normal | degraded | error | unknown（尚无探测数据）
type StatusCard struct {
	Id                string             `json:"id"`
	Group             string             `json:"group"`
	Name              string             `json:"name"`
	Provider          string             `json:"provider,omitempty"`
	Model             string             `json:"model,omitempty"`
	Status            string             `json:"status"`
	StatusLabel       string             `json:"status_label"`
	LatencyMs         *int               `json:"latency_ms"`
	PingMs            *int               `json:"ping_ms"`
	Availability7d    *float64           `json:"availability_7d"`
	AvailableChannels int                `json:"available_channels"`
	TotalChannels     int                `json:"total_channels"`
	Recent            []StatusCardRecent `json:"recent"`
	RecentLimit       int                `json:"recent_limit"`
	UpdatedAt         int64              `json:"updated_at"`
}

// GetStatusPageCards 返回用户侧只读的状态卡片列表
func GetStatusPageCards(c *gin.Context) {
	setting := operation_setting.GetStatusPageSetting()
	if !setting.Enabled {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"enabled":         false,
				"refresh_seconds": setting.RefreshSeconds,
				"updated_at":      time.Now().Unix(),
				"cards":           []StatusCard{},
			},
		})
		return
	}

	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	cards := buildStatusCards(setting, channels)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"enabled":         true,
			"refresh_seconds": setting.RefreshSeconds,
			"updated_at":      time.Now().Unix(),
			"cards":           cards,
		},
	})
}

func buildStatusCards(setting operation_setting.StatusPageSetting, channels []*model.Channel) []StatusCard {
	cards := make([]StatusCard, 0, len(setting.Groups))
	for _, groupCfg := range setting.Groups {
		if !groupCfg.Enabled {
			continue
		}
		card := buildStatusCardForGroup(setting, groupCfg, channels)
		cards = append(cards, card)
	}
	return cards
}

func buildStatusCardForGroup(setting operation_setting.StatusPageSetting, groupCfg operation_setting.StatusPageGroupConfig, channels []*model.Channel) StatusCard {
	displayName := groupCfg.DisplayName
	if displayName == "" {
		displayName = groupCfg.Group
	}
	card := StatusCard{
		Id:          groupCfg.Group,
		Group:       groupCfg.Group,
		Name:        displayName,
		Provider:    groupCfg.Provider,
		Model:       groupCfg.DisplayModel,
		Recent:      []StatusCardRecent{},
		RecentLimit: 60,
		UpdatedAt:   time.Now().Unix(),
	}

	groupChannels := filterChannelsByGroup(channels, groupCfg.Group)
	card.TotalChannels = len(groupChannels)

	enabledChannels := make([]*model.Channel, 0, len(groupChannels))
	enabledChannelIds := make([]int, 0, len(groupChannels))
	for _, ch := range groupChannels {
		if ch.Status == common.ChannelStatusEnabled {
			enabledChannels = append(enabledChannels, ch)
			enabledChannelIds = append(enabledChannelIds, ch.Id)
		}
	}
	card.AvailableChannels = len(enabledChannels)

	// 无可用渠道 → 异常
	if card.AvailableChannels == 0 {
		card.Status = "error"
		card.StatusLabel = "异常"
		return card
	}

	// 聚合最新延迟
	latencies := make([]int, 0, len(enabledChannels))
	pings := make([]int, 0, len(enabledChannels))
	successCount := 0
	channelsWithLog := 0
	for _, ch := range enabledChannels {
		latest, err := model.GetLatestProbeLogByChannel(ch.Id)
		if err != nil {
			common.SysError("status page: fetch latest probe log failed: " + err.Error())
			continue
		}
		if latest == nil {
			continue
		}
		channelsWithLog++
		if latest.Success {
			successCount++
			if latest.LatencyMs > 0 {
				latencies = append(latencies, latest.LatencyMs)
			}
		}
		if latest.PingMs > 0 {
			pings = append(pings, latest.PingMs)
		}
	}

	if len(latencies) > 0 {
		v := medianInt(latencies)
		card.LatencyMs = &v
	}
	if len(pings) > 0 {
		v := averageInt(pings)
		card.PingMs = &v
	}

	// 7 天可用率
	availabilityMap, err := model.GetChannelStatusAvailabilityByChannels(enabledChannelIds, 7*24*3600)
	if err != nil {
		common.SysError("status page: fetch 7d availability failed: " + err.Error())
	} else {
		var totalCount, successTotal int64
		for _, w := range availabilityMap {
			totalCount += w.Total
			successTotal += w.Success
		}
		if totalCount > 0 {
			ratio := float64(successTotal) / float64(totalCount)
			card.Availability7d = &ratio
		}
	}

	// 状态徽标
	card.Status, card.StatusLabel = decideStatusLevel(setting, enabledChannels, successCount, channelsWithLog, latencies)

	// 色条：代表渠道最近 60 条（Priority 最高，Weight 最大，Id 最小）
	representative := pickRepresentativeChannel(enabledChannels)
	if representative != nil {
		logs, err := model.GetRecentProbeLogsByChannel(representative.Id, card.RecentLimit)
		if err != nil {
			common.SysError("status page: fetch recent probe logs failed: " + err.Error())
		} else {
			// logs 是时间倒序（NOW → PAST），前端色条要求 PAST → NOW，需反转
			card.Recent = make([]StatusCardRecent, 0, len(logs))
			for i := len(logs) - 1; i >= 0; i-- {
				card.Recent = append(card.Recent, StatusCardRecent{Level: logs[i].Level})
			}
		}
	}

	return card
}

func filterChannelsByGroup(channels []*model.Channel, group string) []*model.Channel {
	target := strings.TrimSpace(group)
	if target == "" {
		return nil
	}
	result := make([]*model.Channel, 0)
	for _, ch := range channels {
		if ch == nil {
			continue
		}
		for _, g := range ch.GetGroups() {
			if strings.EqualFold(strings.TrimSpace(g), target) {
				result = append(result, ch)
				break
			}
		}
	}
	return result
}

func decideStatusLevel(setting operation_setting.StatusPageSetting, enabledChannels []*model.Channel, successCount int, channelsWithLog int, latencies []int) (string, string) {
	if len(enabledChannels) == 0 {
		return "error", "异常"
	}
	// 尚无探测数据：区分「异常」与「等待首次探测」
	if channelsWithLog == 0 {
		return "unknown", "等待探测"
	}
	if successCount == 0 {
		return "error", "异常"
	}
	total := len(enabledChannels)
	if successCount < total {
		return "degraded", "降级"
	}
	if setting.DegradedLatencyMs > 0 && len(latencies) > 0 {
		avg := averageInt(latencies)
		if avg >= setting.DegradedLatencyMs {
			return "degraded", "降级"
		}
	}
	return "normal", "正常"
}

func pickRepresentativeChannel(channels []*model.Channel) *model.Channel {
	if len(channels) == 0 {
		return nil
	}
	sorted := make([]*model.Channel, len(channels))
	copy(sorted, channels)
	sort.SliceStable(sorted, func(i, j int) bool {
		pi := int64(0)
		pj := int64(0)
		if sorted[i].Priority != nil {
			pi = *sorted[i].Priority
		}
		if sorted[j].Priority != nil {
			pj = *sorted[j].Priority
		}
		if pi != pj {
			return pi > pj
		}
		wi := uint(0)
		wj := uint(0)
		if sorted[i].Weight != nil {
			wi = *sorted[i].Weight
		}
		if sorted[j].Weight != nil {
			wj = *sorted[j].Weight
		}
		if wi != wj {
			return wi > wj
		}
		return sorted[i].Id < sorted[j].Id
	})
	return sorted[0]
}

func medianInt(values []int) int {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]int, len(values))
	copy(sorted, values)
	sort.Ints(sorted)
	n := len(sorted)
	if n%2 == 1 {
		return sorted[n/2]
	}
	return (sorted[n/2-1] + sorted[n/2]) / 2
}

func averageInt(values []int) int {
	if len(values) == 0 {
		return 0
	}
	sum := 0
	for _, v := range values {
		sum += v
	}
	return sum / len(values)
}

// ---------------- 管理侧：读写状态页配置 ----------------

// StatusPageSettingsPayload 管理端请求/响应体
type StatusPageSettingsPayload struct {
	Enabled            bool                                          `json:"enabled"`
	RefreshSeconds     int                                           `json:"refresh_seconds"`
	DegradedLatencyMs  int                                           `json:"degraded_latency_ms"`
	EnablePingProbe    bool                                          `json:"enable_ping_probe"`
	PingProbeTimeoutMs int                                           `json:"ping_probe_timeout_ms"`
	Groups             []operation_setting.StatusPageGroupConfig     `json:"groups"`
	AvailableGroups    []string                                      `json:"available_groups,omitempty"`
}

// GetStatusPageSettings 返回状态页配置以及可选分组列表（供前端多选）
func GetStatusPageSettings(c *gin.Context) {
	setting := operation_setting.GetStatusPageSetting()
	payload := StatusPageSettingsPayload{
		Enabled:            setting.Enabled,
		RefreshSeconds:     setting.RefreshSeconds,
		DegradedLatencyMs:  setting.DegradedLatencyMs,
		EnablePingProbe:    setting.EnablePingProbe,
		PingProbeTimeoutMs: setting.PingProbeTimeoutMs,
		Groups:             setting.Groups,
		AvailableGroups:    listAllChannelGroups(),
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    payload,
	})
}

// UpdateStatusPageSettings 全量覆盖状态页配置
func UpdateStatusPageSettings(c *gin.Context) {
	var payload StatusPageSettingsPayload
	if err := common.DecodeJson(c.Request.Body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	next := operation_setting.StatusPageSetting{
		Enabled:            payload.Enabled,
		RefreshSeconds:     payload.RefreshSeconds,
		DegradedLatencyMs:  payload.DegradedLatencyMs,
		EnablePingProbe:    payload.EnablePingProbe,
		PingProbeTimeoutMs: payload.PingProbeTimeoutMs,
		Groups:             payload.Groups,
	}
	operation_setting.SetStatusPageSetting(next)

	// 持久化：将 status_page.* 一次性写入 option 表
	current := operation_setting.GetStatusPageSetting()
	groupsJSON, err := common.Marshal(current.Groups)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	values := map[string]string{
		"status_page.enabled":               statusBoolToString(current.Enabled),
		"status_page.refresh_seconds":       statusIntToString(current.RefreshSeconds),
		"status_page.degraded_latency_ms":   statusIntToString(current.DegradedLatencyMs),
		"status_page.enable_ping_probe":     statusBoolToString(current.EnablePingProbe),
		"status_page.ping_probe_timeout_ms": statusIntToString(current.PingProbeTimeoutMs),
		"status_page.groups":                string(groupsJSON),
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": StatusPageSettingsPayload{
			Enabled:            current.Enabled,
			RefreshSeconds:     current.RefreshSeconds,
			DegradedLatencyMs:  current.DegradedLatencyMs,
			EnablePingProbe:    current.EnablePingProbe,
			PingProbeTimeoutMs: current.PingProbeTimeoutMs,
			Groups:             current.Groups,
			AvailableGroups:    listAllChannelGroups(),
		},
	})
}

// listAllChannelGroups 汇总所有渠道使用中的分组名 + 全局 group_ratio 配置里出现的分组名
func listAllChannelGroups() []string {
	seen := make(map[string]struct{})
	// 1. 已有的 group_ratio 配置
	for name := range ratio_setting.GetGroupRatioCopy() {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		seen[name] = struct{}{}
	}
	// 2. 渠道 Group 字段（可能是逗号分隔的多组）
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err == nil {
		for _, ch := range channels {
			for _, g := range ch.GetGroups() {
				g = strings.TrimSpace(g)
				if g != "" {
					seen[g] = struct{}{}
				}
			}
		}
	}
	result := make([]string, 0, len(seen))
	for name := range seen {
		result = append(result, name)
	}
	sort.Strings(result)
	return result
}

func statusBoolToString(v bool) string {
	if v {
		return "true"
	}
	return "false"
}

func statusIntToString(v int) string {
	return strconv.Itoa(v)
}
