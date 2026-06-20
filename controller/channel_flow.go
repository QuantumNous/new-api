package controller

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	channelflowmetrics "github.com/QuantumNous/new-api/pkg/channel_flow_metrics"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type channelFlowPoolRequest struct {
	Id                 int    `json:"id"`
	Name               string `json:"name"`
	Description        string `json:"description"`
	Enabled            *bool  `json:"enabled"`
	Backend            string `json:"backend"`
	MaxInflight        int    `json:"max_inflight"`
	MaxInflightPerUser int    `json:"max_inflight_per_user"`
	MaxQueueSize       int    `json:"max_queue_size"`
	MaxQueuePerUser    int    `json:"max_queue_per_user"`
	QueueTimeoutMs     int64  `json:"queue_timeout_ms"`
	QueuePolicy        string `json:"queue_policy"`
	OnLimit            string `json:"on_limit"`
	RedisFailurePolicy string `json:"redis_failure_policy"`
	MaxContextTokens   int    `json:"max_context_tokens"`
	MaxContextChars    int    `json:"max_context_chars"`
	MaxProcessingMs    int64  `json:"max_processing_ms"`
	LeaseMs            int64  `json:"lease_ms"`
	RenewIntervalMs    int64  `json:"renew_interval_ms"`
	ScheduleMode       string `json:"schedule_mode"`
	ScheduleTimezone   string `json:"schedule_timezone"`
	EffectiveStartTime int64  `json:"effective_start_time"`
	EffectiveEndTime   int64  `json:"effective_end_time"`
	ScheduleWindows    string `json:"schedule_windows"`
}

type channelFlowBindingRequest struct {
	ChannelId     int    `json:"channel_id"`
	UpstreamModel string `json:"upstream_model"`
	MatchMode     string `json:"match_mode"`
	Enabled       *bool  `json:"enabled"`
}

func ListChannelFlowPools(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	var pools []*model.ChannelFlowPool
	query := model.DB.Model(&model.ChannelFlowPool{})
	if keyword := c.Query("keyword"); keyword != "" {
		query = query.Where("name LIKE ? OR pool_key LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if err := query.Order("id DESC").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&pools).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(pools)
	common.ApiSuccess(c, pageInfo)
}

func GetChannelFlowPool(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pool, err := model.GetChannelFlowPoolByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, pool)
}

func CreateChannelFlowPool(c *gin.Context) {
	var req channelFlowPoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	pool := channelFlowPoolFromRequest(req, nil)
	if err := pool.Validate(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Create(pool).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, pool)
}

func UpdateChannelFlowPool(c *gin.Context) {
	var req channelFlowPoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Id <= 0 {
		req.Id = id
	}
	if req.Id != id {
		common.ApiErrorMsg(c, "Flow Pool ID 与 URL 不一致")
		return
	}
	if id <= 0 {
		common.ApiErrorMsg(c, "缺少 Flow Pool ID")
		return
	}
	pool, err := model.GetChannelFlowPoolByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	updated := channelFlowPoolFromRequest(req, pool)
	if err := updated.Validate(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Save(updated).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, updated)
}

func DeleteChannelFlowPool(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	count, err := model.CountChannelFlowPoolBindings(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if count > 0 {
		common.ApiError(c, fmt.Errorf("Flow Pool 仍有绑定渠道，请先删除绑定"))
		return
	}
	if err := model.DB.Delete(&model.ChannelFlowPool{}, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetChannelFlowPoolStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pool, err := model.GetChannelFlowPoolByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	status, err := service.GetChannelFlowPoolStatus(c.Request.Context(), *pool)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, status)
}

func GetChannelFlowPoolTrend(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pool, err := model.GetChannelFlowPoolByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	hours := 6
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, parseErr := strconv.Atoi(rawHours); parseErr == nil {
			hours = parsed
		}
	}
	minutes := 0
	if rawMinutes := c.Query("minutes"); rawMinutes != "" {
		if parsed, parseErr := strconv.Atoi(rawMinutes); parseErr == nil {
			minutes = parsed
		}
	}
	trend, err := channelflowmetrics.Query(channelflowmetrics.QueryParams{
		PoolKey: pool.PoolKey,
		Hours:   hours,
		Minutes: minutes,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, trend)
}

func ListChannelFlowPoolBindings(c *gin.Context) {
	poolID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var bindings []*model.ChannelFlowPoolBinding
	if err := model.DB.Where("pool_id = ?", poolID).Order("id DESC").Find(&bindings).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, bindings)
}

func CreateChannelFlowPoolBinding(c *gin.Context) {
	poolID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err := model.GetChannelFlowPoolByID(poolID); err != nil {
		common.ApiError(c, err)
		return
	}
	var req channelFlowBindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	binding := &model.ChannelFlowPoolBinding{
		PoolId:        poolID,
		ChannelId:     req.ChannelId,
		UpstreamModel: req.UpstreamModel,
		MatchMode:     req.MatchMode,
		Enabled:       enabled,
	}
	if err := binding.Validate(); err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err := model.GetChannelById(binding.ChannelId, false); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "渠道不存在，无法绑定 Flow Pool")
			return
		}
		common.ApiError(c, err)
		return
	}
	if binding.MatchMode != model.ChannelFlowMatchModeChannel {
		common.ApiErrorMsg(c, "Phase 1 仅支持按渠道绑定，upstream_model 绑定将在后续阶段开放")
		return
	}
	var existing int64
	if err := model.DB.Model(&model.ChannelFlowPoolBinding{}).
		Where("channel_id = ? AND match_mode = ? AND enabled = ?", binding.ChannelId, model.ChannelFlowMatchModeChannel, true).
		Count(&existing).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if existing > 0 {
		common.ApiErrorMsg(c, "该渠道已绑定 Flow Pool，请先删除原绑定")
		return
	}
	if err := model.DB.Create(binding).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, binding)
}

func DeleteChannelFlowPoolBinding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DB.Delete(&model.ChannelFlowPoolBinding{}, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func channelFlowPoolFromRequest(req channelFlowPoolRequest, existing *model.ChannelFlowPool) *model.ChannelFlowPool {
	pool := &model.ChannelFlowPool{}
	if existing != nil {
		*pool = *existing
	}
	pool.Name = req.Name
	pool.Description = req.Description
	if req.Enabled != nil {
		pool.Enabled = *req.Enabled
	} else if existing == nil {
		pool.Enabled = true
	}
	pool.Backend = req.Backend
	pool.MaxInflight = req.MaxInflight
	pool.MaxInflightPerUser = req.MaxInflightPerUser
	pool.MaxQueueSize = req.MaxQueueSize
	pool.MaxQueuePerUser = req.MaxQueuePerUser
	pool.QueueTimeoutMs = req.QueueTimeoutMs
	pool.QueuePolicy = req.QueuePolicy
	pool.OnLimit = req.OnLimit
	pool.RedisFailurePolicy = req.RedisFailurePolicy
	pool.MaxContextTokens = req.MaxContextTokens
	pool.MaxContextChars = req.MaxContextChars
	pool.MaxProcessingMs = req.MaxProcessingMs
	pool.LeaseMs = req.LeaseMs
	pool.RenewIntervalMs = req.RenewIntervalMs
	pool.ScheduleMode = req.ScheduleMode
	pool.ScheduleTimezone = req.ScheduleTimezone
	pool.EffectiveStartTime = req.EffectiveStartTime
	pool.EffectiveEndTime = req.EffectiveEndTime
	pool.ScheduleWindows = req.ScheduleWindows
	pool.Normalize()
	return pool
}
