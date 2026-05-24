package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

type channelDynamicSettingsUpdateRequest struct {
	Enabled                        *bool    `json:"enabled"`
	DryRun                         *bool    `json:"dry_run"`
	IntervalSeconds                *int     `json:"interval_seconds"`
	PlatformProbeEnabled           *bool    `json:"platform_probe_enabled"`
	PlatformProbeIntervalSeconds   *int     `json:"platform_probe_interval_seconds"`
	DegradedWeightMultiplier       *float64 `json:"degraded_weight_multiplier"`
	ProtectedUnhealthyMultiplier   *float64 `json:"protected_unhealthy_multiplier"`
	PriorityDowngradeLatencyMS     *int     `json:"priority_downgrade_latency_ms"`
	LastAvailableProtectionEnabled *bool    `json:"last_available_protection_enabled"`
}

func GetChannelDynamicSettings(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    operation_setting.GetChannelDynamicAdjustmentSetting(),
	})
}

func UpdateChannelDynamicSettings(c *gin.Context) {
	var req channelDynamicSettingsUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的动态调权设置参数")
		return
	}

	updates := make(map[string]string)
	if req.Enabled != nil {
		updates["channel_dynamic_adjustment.enabled"] = strconv.FormatBool(*req.Enabled)
	}
	if req.DryRun != nil {
		updates["channel_dynamic_adjustment.dry_run"] = strconv.FormatBool(*req.DryRun)
	}
	if req.IntervalSeconds != nil {
		if *req.IntervalSeconds < 60 {
			common.ApiErrorMsg(c, "动态调权间隔不能小于 60 秒")
			return
		}
		updates["channel_dynamic_adjustment.interval_seconds"] = strconv.Itoa(*req.IntervalSeconds)
	}
	if req.PlatformProbeEnabled != nil {
		updates["channel_dynamic_adjustment.platform_probe_enabled"] = strconv.FormatBool(*req.PlatformProbeEnabled)
	}
	if req.PlatformProbeIntervalSeconds != nil {
		if *req.PlatformProbeIntervalSeconds < 60 {
			common.ApiErrorMsg(c, "平台探活间隔不能小于 60 秒")
			return
		}
		updates["channel_dynamic_adjustment.platform_probe_interval_seconds"] = strconv.Itoa(*req.PlatformProbeIntervalSeconds)
	}
	if req.DegradedWeightMultiplier != nil {
		if *req.DegradedWeightMultiplier <= 0 || *req.DegradedWeightMultiplier >= 1 {
			common.ApiErrorMsg(c, "降级权重倍率必须大于 0 且小于 1")
			return
		}
		updates["channel_dynamic_adjustment.degraded_weight_multiplier"] = strconv.FormatFloat(*req.DegradedWeightMultiplier, 'f', -1, 64)
	}
	if req.ProtectedUnhealthyMultiplier != nil {
		if *req.ProtectedUnhealthyMultiplier <= 0 || *req.ProtectedUnhealthyMultiplier >= 1 {
			common.ApiErrorMsg(c, "保护态权重倍率必须大于 0 且小于 1")
			return
		}
		updates["channel_dynamic_adjustment.protected_unhealthy_multiplier"] = strconv.FormatFloat(*req.ProtectedUnhealthyMultiplier, 'f', -1, 64)
	}
	if req.PriorityDowngradeLatencyMS != nil {
		if *req.PriorityDowngradeLatencyMS < 100 {
			common.ApiErrorMsg(c, "优先级降档延迟阈值不能小于 100ms")
			return
		}
		updates["channel_dynamic_adjustment.priority_downgrade_latency_ms"] = strconv.Itoa(*req.PriorityDowngradeLatencyMS)
	}
	if req.LastAvailableProtectionEnabled != nil {
		updates["channel_dynamic_adjustment.last_available_protection_enabled"] = strconv.FormatBool(*req.LastAvailableProtectionEnabled)
	}

	if err := model.UpdateOptionsBulk(updates); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    operation_setting.GetChannelDynamicAdjustmentSetting(),
	})
}

func GetChannelDynamicOverrides(c *gin.Context) {
	records, total, err := model.ListChannelDynamicOverrides(model.ChannelDynamicOverrideQuery{
		ChannelID: parseQueryInt(c, "channel_id"),
		Group:     c.Query("group"),
		Model:     c.Query("model"),
		Provider:  c.Query("provider"),
		State:     c.Query("state"),
		Active:    parseOptionalBool(c, "active"),
		Page:      parseQueryIntDefault(c, "page", 1),
		Limit:     parseQueryIntDefault(c, "limit", 20),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": records, "total": total})
}

func GetChannelDynamicLogs(c *gin.Context) {
	records, total, err := model.ListChannelDynamicAdjustmentLogs(model.ChannelDynamicLogQuery{
		ChannelID: parseQueryInt(c, "channel_id"),
		Group:     c.Query("group"),
		Model:     c.Query("model"),
		Provider:  c.Query("provider"),
		Action:    c.Query("action"),
		State:     c.Query("state"),
		DryRun:    parseOptionalBool(c, "dry_run"),
		Protected: parseOptionalBool(c, "protected"),
		Page:      parseQueryIntDefault(c, "page", 1),
		Limit:     parseQueryIntDefault(c, "limit", 20),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": records, "total": total})
}

func GetChannelDynamicProbes(c *gin.Context) {
	records, total, err := model.ListChannelProbeResults(model.ChannelProbeResultQuery{
		ChannelID: parseQueryInt(c, "channel_id"),
		Group:     c.Query("group"),
		Model:     c.Query("model"),
		Status:    c.Query("status"),
		ProbeType: c.Query("probe_type"),
		Page:      parseQueryIntDefault(c, "page", 1),
		Limit:     parseQueryIntDefault(c, "limit", 20),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": records, "total": total})
}

func parseQueryInt(c *gin.Context, key string) int {
	return parseQueryIntDefault(c, key, 0)
}

func parseQueryIntDefault(c *gin.Context, key string, fallback int) int {
	value := c.Query(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseOptionalBool(c *gin.Context, key string) *bool {
	value := c.Query(key)
	if value == "" {
		return nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return nil
	}
	return &parsed
}
