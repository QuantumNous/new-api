package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ListRegionRoutes 分页列出区域路由策略。
func ListRegionRoutes(c *gin.Context) {
	page, pageSize := parsePage(c)
	region := c.Query("region")
	modelName := c.Query("model")
	items, total, err := model.SearchRegionRoutes(page, pageSize, region, modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total})
}

// CreateRegionRoute 创建区域路由策略。
func CreateRegionRoute(c *gin.Context) {
	var req struct {
		Region     string `json:"region"`
		Model      string `json:"model"`
		ChannelIds string `json:"channel_ids"`
		Tag        string `json:"tag"`
		Strategy   string `json:"strategy"`
		Priority   int    `json:"priority"`
		Weight     int    `json:"weight"`
		Enabled    *bool  `json:"enabled"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Region == "" {
		common.ApiErrorMsg(c, "region is required")
		return
	}
	if req.Model == "" {
		req.Model = "*"
	}
	strategy := req.Strategy
	if strategy == "" {
		strategy = "availability"
	}
	if !model.AllowedRegionRouteStrategies[strategy] {
		common.ApiErrorMsg(c, "invalid strategy (expected cost|latency|availability|fixed)")
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	m := &model.RegionRoute{
		Region:     req.Region,
		Model:      req.Model,
		ChannelIds: req.ChannelIds,
		Tag:        req.Tag,
		Strategy:   strategy,
		Priority:   req.Priority,
		Weight:     req.Weight,
		Enabled:    enabled,
	}
	if err := model.CreateRegionRoute(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": m.Id})
}

// GetRegionRoute 获取单个策略。
func GetRegionRoute(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	m, err := model.GetRegionRouteById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, m)
}

// UpdateRegionRoute 更新策略。
func UpdateRegionRoute(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var req struct {
		Region     string `json:"region"`
		Model      string `json:"model"`
		ChannelIds string `json:"channel_ids"`
		Tag        string `json:"tag"`
		Strategy   string `json:"strategy"`
		Priority   int    `json:"priority"`
		Weight     int    `json:"weight"`
		Enabled    *bool  `json:"enabled"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if !model.AllowedRegionRouteStrategies[req.Strategy] {
		common.ApiErrorMsg(c, "invalid strategy (expected cost|latency|availability|fixed)")
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	m := &model.RegionRoute{
		Id:         id,
		Region:     req.Region,
		Model:      req.Model,
		ChannelIds: req.ChannelIds,
		Tag:        req.Tag,
		Strategy:   req.Strategy,
		Priority:   req.Priority,
		Weight:     req.Weight,
		Enabled:    enabled,
	}
	if err := model.UpdateRegionRoute(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// DeleteRegionRoute 删除策略。
func DeleteRegionRoute(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeleteRegionRoute(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}
