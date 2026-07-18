package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	maxChannelMonitorRatio                   = 1_000_000
	maxChannelMonitorBalanceWarningThreshold = 1_000_000_000_000
)

type channelRatioUpdateRequest struct {
	Ratio  *float64 `json:"ratio"`
	Remark string   `json:"remark"`
}

type groupRatioUpdateRequest struct {
	Group string   `json:"group"`
	Ratio *float64 `json:"ratio"`
}

type groupRatioSyncRequest struct {
	Group       string   `json:"group"`
	Coefficient *float64 `json:"coefficient"`
}

type channelSmartScheduleConfigUpdateRequest struct {
	Excluded *bool   `json:"excluded"`
	Group    *string `json:"group"`
}

type channelMonitorUpstreamRequest struct {
	Type                    string          `json:"type"`
	BaseURL                 string          `json:"base_url"`
	Group                   string          `json:"group"`
	AuthType                string          `json:"auth_type"`
	UserId                  int             `json:"user_id"`
	AccessToken             string          `json:"access_token"`
	RefreshToken            string          `json:"refresh_token"`
	SingleChannelAction     string          `json:"single_channel_action"`
	MultipleChannelsAction  string          `json:"multiple_channels_action"`
	BalanceWarningThreshold json.RawMessage `json:"balance_warning_threshold"`
}

type channelMonitorUpstreamConfig struct {
	Type                    string   `json:"type"`
	BaseURL                 string   `json:"base_url"`
	Group                   string   `json:"group"`
	AuthType                string   `json:"auth_type"`
	UserId                  int      `json:"user_id"`
	HasAccessToken          bool     `json:"has_access_token"`
	HasRefreshToken         bool     `json:"has_refresh_token"`
	SingleChannelAction     string   `json:"single_channel_action"`
	MultipleChannelsAction  string   `json:"multiple_channels_action"`
	BalanceWarningThreshold *float64 `json:"balance_warning_threshold"`
}

type channelMonitorItem struct {
	Id                    int                           `json:"id"`
	Name                  string                        `json:"name"`
	Type                  int                           `json:"type"`
	Status                int                           `json:"status"`
	Priority              int64                         `json:"priority"`
	Weight                int                           `json:"weight"`
	BaseURL               string                        `json:"base_url"`
	Models                string                        `json:"models"`
	TestModel             *string                       `json:"test_model"`
	Groups                []string                      `json:"groups"`
	Ratio                 *float64                      `json:"ratio"`
	PreviousRatio         *float64                      `json:"previous_ratio"`
	Remark                string                        `json:"remark"`
	ChannelRemark         string                        `json:"channel_remark"`
	UpdatedTime           int64                         `json:"updated_time"`
	UpdatedBy             int                           `json:"updated_by"`
	UpdatedByUsername     string                        `json:"updated_by_username"`
	LastFetchStatus       string                        `json:"last_fetch_status"`
	LastFetchError        string                        `json:"last_fetch_error"`
	LastFetchTime         int64                         `json:"last_fetch_time"`
	ConsecutiveFailures   int                           `json:"consecutive_failures"`
	UpstreamBalance       *float64                      `json:"upstream_balance"`
	LastBalanceTime       int64                         `json:"last_balance_time"`
	LastBalanceError      string                        `json:"last_balance_error"`
	SmartScheduleExcluded bool                          `json:"smart_schedule_excluded"`
	SmartScheduleGroup    string                        `json:"smart_schedule_group"`
	LastScheduleStatus    string                        `json:"last_schedule_status"`
	LastScheduleError     string                        `json:"last_schedule_error"`
	LastScheduleScore     *float64                      `json:"last_schedule_score"`
	LastSchedulePriority  int64                         `json:"last_schedule_priority"`
	LastScheduleWeight    uint                          `json:"last_schedule_weight"`
	LastScheduleTime      int64                         `json:"last_schedule_time"`
	Upstream              *channelMonitorUpstreamConfig `json:"upstream"`
}

func validateChannelMonitorRatio(ratio *float64) bool {
	return ratio != nil && !math.IsNaN(*ratio) && !math.IsInf(*ratio, 0) && *ratio >= 0 && *ratio <= maxChannelMonitorRatio
}

func channelMonitorUpstreamFromModel(monitor model.ChannelRatioMonitor) *channelMonitorUpstreamConfig {
	if monitor.UpstreamType == "" {
		return nil
	}
	return &channelMonitorUpstreamConfig{
		Type:                    monitor.UpstreamType,
		BaseURL:                 monitor.UpstreamBaseURL,
		Group:                   monitor.UpstreamGroup,
		AuthType:                monitor.UpstreamAuthType,
		UserId:                  monitor.UpstreamUserId,
		HasAccessToken:          monitor.UpstreamAccessToken != "",
		HasRefreshToken:         monitor.UpstreamRefreshToken != "",
		SingleChannelAction:     normalizeChannelMonitorPolicyAction(monitor.SingleChannelAction),
		MultipleChannelsAction:  normalizeChannelMonitorPolicyAction(monitor.MultipleChannelsAction),
		BalanceWarningThreshold: monitor.BalanceWarningThreshold,
	}
}

func resolveChannelMonitorBalanceWarningThreshold(raw json.RawMessage, existing *float64) (*float64, error) {
	if len(raw) == 0 {
		if existing == nil {
			return nil, nil
		}
		value := *existing
		return &value, nil
	}
	if strings.TrimSpace(string(raw)) == "null" {
		return nil, nil
	}

	var threshold float64
	if err := common.Unmarshal(raw, &threshold); err != nil ||
		math.IsNaN(threshold) || math.IsInf(threshold, 0) ||
		threshold < 0 || threshold > maxChannelMonitorBalanceWarningThreshold {
		return nil, errors.New("余额预警值无效")
	}
	return &threshold, nil
}

func resolveChannelMonitorUpstreamRequest(channel *model.Channel, request channelMonitorUpstreamRequest, requireGroup bool) (service.ChannelMonitorUpstreamConfig, error) {
	baseURL := strings.TrimSpace(request.BaseURL)
	if baseURL == "" {
		baseURL = channel.GetBaseURL()
	}
	normalizedBaseURL, err := service.NormalizeNewAPIBaseURL(baseURL)
	if err != nil {
		return service.ChannelMonitorUpstreamConfig{}, err
	}

	request.Group = strings.TrimSpace(request.Group)
	if (requireGroup && request.Group == "") || utf8.RuneCountInString(request.Group) > 64 {
		return service.ChannelMonitorUpstreamConfig{}, errors.New("上游分组名称无效")
	}
	request.Type = strings.TrimSpace(request.Type)
	if request.Type == "" {
		request.Type = service.NewAPIUpstreamType
	}
	request.AuthType = strings.TrimSpace(request.AuthType)
	config := service.ChannelMonitorUpstreamConfig{
		Type:     request.Type,
		BaseURL:  normalizedBaseURL,
		Group:    request.Group,
		AuthType: request.AuthType,
	}
	switch request.Type {
	case service.NewAPIUpstreamType:
		if request.AuthType != service.NewAPIUpstreamAuthPublic && request.AuthType != service.NewAPIUpstreamAuthUser {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("New API 认证方式无效")
		}
		if request.AuthType == service.NewAPIUpstreamAuthPublic {
			return config, nil
		}
		if request.UserId <= 0 {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("上游用户 ID 必须大于 0")
		}
		config.UserID = request.UserId
		config.AccessToken = strings.TrimSpace(request.AccessToken)
		if utf8.RuneCountInString(config.AccessToken) > 4096 {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("上游访问令牌过长")
		}
		if config.AccessToken == "" {
			monitor, findErr := model.GetChannelRatioMonitor(channel.Id)
			if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
				return service.ChannelMonitorUpstreamConfig{}, findErr
			}
			if findErr == nil &&
				monitor.UpstreamType == config.Type &&
				monitor.UpstreamBaseURL == config.BaseURL &&
				monitor.UpstreamAuthType == config.AuthType &&
				monitor.UpstreamUserId == config.UserID {
				config.AccessToken = monitor.UpstreamAccessToken
			}
		}
		if config.AccessToken == "" {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("上游访问令牌不能为空")
		}
		return config, nil
	case service.Sub2APIUpstreamType:
		if request.AuthType != service.Sub2APIAuthRefreshToken {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("Sub2API 认证方式无效")
		}
		config.RefreshToken = strings.TrimSpace(request.RefreshToken)
		if utf8.RuneCountInString(config.RefreshToken) > 4096 {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("Sub2API Refresh Token 过长")
		}
		if config.RefreshToken == "" {
			monitor, findErr := model.GetChannelRatioMonitor(channel.Id)
			if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
				return service.ChannelMonitorUpstreamConfig{}, findErr
			}
			if findErr == nil &&
				monitor.UpstreamType == config.Type &&
				monitor.UpstreamBaseURL == config.BaseURL &&
				monitor.UpstreamAuthType == config.AuthType {
				config.RefreshToken = monitor.UpstreamRefreshToken
			}
		}
		if config.RefreshToken == "" {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("Sub2API Refresh Token 不能为空")
		}
		return config, nil
	default:
		return service.ChannelMonitorUpstreamConfig{}, errors.New("上游类型无效")
	}
}

func getChannelMonitorOperator(c *gin.Context) (int, string) {
	operatorId := c.GetInt("id")
	operatorUsername := c.GetString("username")
	if operatorUsername == "" {
		operatorUsername, _ = model.GetUsernameById(operatorId, false)
	}
	return operatorId, operatorUsername
}

func GetChannelMonitorOverview(c *gin.Context) {
	channels, err := model.GetAllChannelsForMonitor()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	monitors, err := model.GetChannelRatioMonitors()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	monitorByChannel := make(map[int]model.ChannelRatioMonitor, len(monitors))
	for _, monitor := range monitors {
		monitorByChannel[monitor.ChannelId] = monitor
	}

	groupRatios := ratio_setting.GetGroupRatioCopy()
	channelOrder := getChannelMonitorChannelOrder(channels)
	items := make([]channelMonitorItem, 0, len(channels))
	for _, channel := range channels {
		groups := channel.GetGroups()
		for _, group := range groups {
			if _, exists := groupRatios[group]; !exists {
				groupRatios[group] = 1
			}
		}
		channelRemark := ""
		if channel.Remark != nil {
			channelRemark = strings.TrimSpace(*channel.Remark)
		}
		item := channelMonitorItem{
			Id:            channel.Id,
			Name:          channel.Name,
			Type:          channel.Type,
			Status:        channel.Status,
			Priority:      channel.GetPriority(),
			Weight:        channel.GetWeight(),
			BaseURL:       channel.GetBaseURL(),
			Models:        channel.Models,
			TestModel:     channel.TestModel,
			Groups:        groups,
			ChannelRemark: channelRemark,
		}
		if monitor, exists := monitorByChannel[channel.Id]; exists {
			item.LastFetchStatus = monitor.LastFetchStatus
			item.LastFetchError = monitor.LastFetchError
			item.LastFetchTime = monitor.LastFetchTime
			item.ConsecutiveFailures = monitor.ConsecutiveFailures
			item.UpstreamBalance = monitor.UpstreamBalance
			item.LastBalanceTime = monitor.LastBalanceTime
			item.LastBalanceError = monitor.LastBalanceError
			item.SmartScheduleExcluded = monitor.SmartScheduleExcluded
			item.SmartScheduleGroup = monitor.SmartScheduleGroup
			item.LastScheduleStatus = monitor.LastScheduleStatus
			item.LastScheduleError = monitor.LastScheduleError
			item.LastScheduleScore = monitor.LastScheduleScore
			item.LastSchedulePriority = monitor.LastSchedulePriority
			item.LastScheduleWeight = monitor.LastScheduleWeight
			item.LastScheduleTime = monitor.LastScheduleTime
			if monitor.UpdatedTime > 0 {
				item.Ratio = &monitor.Ratio
				item.PreviousRatio = monitor.PreviousRatio
				item.Remark = monitor.Remark
				item.UpdatedTime = monitor.UpdatedTime
				item.UpdatedBy = monitor.UpdatedBy
				item.UpdatedByUsername = monitor.UpdatedByUsername
			}
			item.Upstream = channelMonitorUpstreamFromModel(monitor)
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"channels":           items,
			"channel_order":      channelOrder,
			"group_ratios":       groupRatios,
			"group_coefficients": getChannelMonitorGroupCoefficients(),
			"settings":           getChannelMonitorSettings(),
		},
	})
}

func UpdateChannelMonitorSmartScheduleConfig(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	channel, err := model.GetChannelById(channelId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var request channelSmartScheduleConfigUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	if request.Excluded == nil && request.Group == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请提供要更新的调度设置"})
		return
	}

	excluded := false
	group := ""
	existing, findErr := model.GetChannelRatioMonitor(channelId)
	if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		common.ApiError(c, findErr)
		return
	}
	if findErr == nil {
		excluded = existing.SmartScheduleExcluded
		group = existing.SmartScheduleGroup
	}
	if request.Excluded != nil {
		excluded = *request.Excluded
	}
	if request.Group != nil {
		group = strings.TrimSpace(*request.Group)
		if utf8.RuneCountInString(group) > 64 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "调度归属分组不能超过 64 个字符"})
			return
		}
	}
	if group != "" {
		belongsToGroup := false
		for _, channelGroup := range channel.GetGroups() {
			if channelGroup == group {
				belongsToGroup = true
				break
			}
		}
		if !belongsToGroup {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "调度归属分组必须是渠道已关联的分组"})
			return
		}
	}

	monitor, err := model.SaveChannelSmartScheduleConfig(channelId, excluded, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_smart_schedule_config_update", map[string]interface{}{
		"id": channelId, "excluded": excluded, "group": group,
	})
	common.ApiSuccess(c, gin.H{
		"excluded": monitor.SmartScheduleExcluded,
		"group":    monitor.SmartScheduleGroup,
	})
}

func SyncChannelMonitorGroupRatio(c *gin.Context) {
	var request groupRatioSyncRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	request.Group = strings.TrimSpace(request.Group)
	if request.Group == "" || utf8.RuneCountInString(request.Group) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "分组名称无效"})
		return
	}
	if !validateChannelMonitorRatio(request.Coefficient) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "系数必须在 0 到 1000000 之间"})
		return
	}

	channels, err := model.GetAllChannelsForMonitor()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	monitors, err := model.GetChannelRatioMonitors()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	monitorByChannel := make(map[int]model.ChannelRatioMonitor, len(monitors))
	for _, monitor := range monitors {
		monitorByChannel[monitor.ChannelId] = monitor
	}

	highestUpstreamRatio := -1.0
	for _, channel := range channels {
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		associated := false
		for _, group := range channel.GetGroups() {
			if group == request.Group {
				associated = true
				break
			}
		}
		if !associated {
			continue
		}
		monitor, exists := monitorByChannel[channel.Id]
		if !exists || monitor.UpdatedTime <= 0 {
			continue
		}
		if monitor.Ratio > highestUpstreamRatio {
			highestUpstreamRatio = monitor.Ratio
		}
	}
	if highestUpstreamRatio < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该分组没有已记录倍率的启用渠道"})
		return
	}
	targetRatio := highestUpstreamRatio * *request.Coefficient
	if !validateChannelMonitorRatio(&targetRatio) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "上游倍率乘以系数后的结果超出范围"})
		return
	}

	groupRatios := ratio_setting.GetGroupRatioCopy()
	groupRatios[request.Group] = targetRatio
	coefficients := getChannelMonitorGroupCoefficients()
	coefficients[request.Group] = *request.Coefficient
	groupRatioBytes, err := common.Marshal(groupRatios)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	coefficientBytes, err := common.Marshal(coefficients)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOptionsBulk(map[string]string{
		"GroupRatio":                          string(groupRatioBytes),
		channelMonitorGroupCoefficientsOption: string(coefficientBytes),
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_group_ratio_sync", map[string]interface{}{
		"group": request.Group, "upstream_ratio": highestUpstreamRatio, "coefficient": *request.Coefficient, "ratio": targetRatio,
	})
	common.ApiSuccess(c, gin.H{
		"group": request.Group, "upstream_ratio": highestUpstreamRatio, "coefficient": *request.Coefficient, "ratio": targetRatio,
	})
}

func UpdateChannelMonitorRatio(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	if _, err := model.GetChannelById(channelId, false); err != nil {
		common.ApiError(c, err)
		return
	}

	var request channelRatioUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	request.Remark = strings.TrimSpace(request.Remark)
	if !validateChannelMonitorRatio(request.Ratio) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "倍率必须在 0 到 1000000 之间"})
		return
	}
	if utf8.RuneCountInString(request.Remark) > 255 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "备注不能超过 255 个字符"})
		return
	}

	operatorId, operatorUsername := getChannelMonitorOperator(c)
	monitor, created, changed, err := model.UpdateChannelRatioMonitor(
		channelId,
		*request.Ratio,
		request.Remark,
		operatorId,
		operatorUsername,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_ratio_update", map[string]interface{}{
		"id": channelId, "ratio": *request.Ratio, "changed": changed,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"monitor": monitor,
			"created": created,
			"changed": changed,
		},
	})
}

func SaveChannelMonitorUpstreamConfig(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	channel, err := model.GetChannelById(channelId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var request channelMonitorUpstreamRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	config, err := resolveChannelMonitorUpstreamRequest(channel, request, true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	existingMonitor, findErr := model.GetChannelRatioMonitor(channelId)
	if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		common.ApiError(c, findErr)
		return
	}
	hasExistingMonitor := findErr == nil

	singleChannelAction := strings.TrimSpace(request.SingleChannelAction)
	multipleChannelAction := strings.TrimSpace(request.MultipleChannelsAction)
	if singleChannelAction == "" || multipleChannelAction == "" {
		if hasExistingMonitor {
			if singleChannelAction == "" {
				singleChannelAction = normalizeChannelMonitorPolicyAction(existingMonitor.SingleChannelAction)
			}
			if multipleChannelAction == "" {
				multipleChannelAction = normalizeChannelMonitorPolicyAction(existingMonitor.MultipleChannelsAction)
			}
		}
	}
	if singleChannelAction == "" {
		singleChannelAction = channelMonitorPolicyActionNone
	}
	if multipleChannelAction == "" {
		multipleChannelAction = channelMonitorPolicyActionNone
	}
	if normalizeChannelMonitorPolicyAction(singleChannelAction) != singleChannelAction {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "单渠道处理策略无效"})
		return
	}
	if normalizeChannelMonitorPolicyAction(multipleChannelAction) != multipleChannelAction {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "多渠道处理策略无效"})
		return
	}
	var existingBalanceWarningThreshold *float64
	if hasExistingMonitor {
		existingBalanceWarningThreshold = existingMonitor.BalanceWarningThreshold
	}
	balanceWarningThreshold, err := resolveChannelMonitorBalanceWarningThreshold(
		request.BalanceWarningThreshold,
		existingBalanceWarningThreshold,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	monitor, err := model.SaveChannelRatioUpstreamConfig(
		channelId,
		config.Type,
		config.BaseURL,
		config.Group,
		config.AuthType,
		config.UserID,
		config.AccessToken,
		config.RefreshToken,
		singleChannelAction,
		multipleChannelAction,
		balanceWarningThreshold,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_upstream_config_update", map[string]interface{}{
		"id": channelId, "upstream_type": config.Type, "group": config.Group, "auth_type": config.AuthType,
		"single_channel_action": singleChannelAction, "multiple_channels_action": multipleChannelAction,
		"balance_warning_threshold": balanceWarningThreshold,
	})
	common.ApiSuccess(c, channelMonitorUpstreamFromModel(monitor))
}

func ListChannelMonitorUpstreamGroups(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var request channelMonitorUpstreamRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	config, err := resolveChannelMonitorUpstreamRequest(channel, request, false)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if config.Type == service.Sub2APIUpstreamType {
		monitor, findErr := model.GetChannelRatioMonitor(channelId)
		if findErr != nil ||
			monitor.UpstreamType != config.Type ||
			monitor.UpstreamBaseURL != config.BaseURL ||
			monitor.UpstreamAuthType != config.AuthType ||
			monitor.UpstreamRefreshToken != config.RefreshToken {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Sub2API 请先保存上游配置，再获取可用分组",
			})
			return
		}
	}

	result, fetchErr := service.FetchChannelMonitorUpstreamGroups(c.Request.Context(), config, channel.GetKeys())
	if result.NextRefreshToken != "" {
		if err := model.RotateChannelRatioUpstreamRefreshToken(
			channelId,
			config.RefreshToken,
			result.NextRefreshToken,
		); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if fetchErr != nil {
		common.ApiError(c, fetchErr)
		return
	}
	common.ApiSuccess(c, result)
}

func TestChannelMonitorUpstreamConfig(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	channel, err := model.GetChannelById(channelId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var request channelMonitorUpstreamRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	config, err := resolveChannelMonitorUpstreamRequest(channel, request, true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if config.Type == service.Sub2APIUpstreamType {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Sub2API Refresh Token 使用后会轮换，请先保存配置，再从渠道列表获取倍率",
		})
		return
	}
	result, err := service.FetchChannelMonitorUpstreamGroupRatio(c.Request.Context(), config)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

type channelMonitorFetchOutcome struct {
	Result          service.NewAPIGroupRatioResult
	Monitor         model.ChannelRatioMonitor
	Created         bool
	Changed         bool
	BalanceRecorded bool
}

func fetchAndRecordChannelMonitorUpstreamRatio(ctx context.Context, monitor model.ChannelRatioMonitor, operatorId int, operatorUsername string) (outcome channelMonitorFetchOutcome, err error) {
	defer func() {
		if err == nil {
			return
		}
		if statusErr := model.RecordChannelRatioMonitorFetchFailure(monitor.ChannelId, err.Error()); statusErr != nil {
			err = fmt.Errorf("%w（记录失败状态失败：%v）", err, statusErr)
		}
	}()

	if monitor.UpstreamType != service.NewAPIUpstreamType && monitor.UpstreamType != service.Sub2APIUpstreamType {
		return outcome, errors.New("请先保存上游配置")
	}
	if monitor.UpstreamType == service.Sub2APIUpstreamType &&
		(monitor.UpstreamAuthType != service.Sub2APIAuthRefreshToken || monitor.UpstreamRefreshToken == "") {
		return outcome, errors.New("请重新保存 Sub2API Refresh Token 配置")
	}

	result, fetchErr := service.FetchChannelMonitorUpstreamGroupRatio(ctx, service.ChannelMonitorUpstreamConfig{
		Type:         monitor.UpstreamType,
		BaseURL:      monitor.UpstreamBaseURL,
		Group:        monitor.UpstreamGroup,
		AuthType:     monitor.UpstreamAuthType,
		UserID:       monitor.UpstreamUserId,
		AccessToken:  monitor.UpstreamAccessToken,
		RefreshToken: monitor.UpstreamRefreshToken,
	})
	outcome.Result = result
	if result.NextRefreshToken != "" {
		if err := model.RotateChannelRatioUpstreamRefreshToken(
			monitor.ChannelId,
			monitor.UpstreamRefreshToken,
			result.NextRefreshToken,
		); err != nil {
			return outcome, err
		}
	}
	if result.Balance.Amount != nil || strings.TrimSpace(result.Balance.Error) != "" {
		if balanceErr := model.RecordChannelRatioMonitorBalance(
			monitor.ChannelId,
			result.Balance.Amount,
			result.Balance.Error,
		); balanceErr != nil {
			return outcome, fmt.Errorf("记录上游余额失败: %w", balanceErr)
		}
		outcome.BalanceRecorded = result.Balance.Amount != nil
	}
	if fetchErr != nil {
		return outcome, fetchErr
	}

	upstreamName := "New API"
	if monitor.UpstreamType == service.Sub2APIUpstreamType {
		upstreamName = "Sub2API"
	}
	remark := fmt.Sprintf("从上游 %s 获取分组 %s", upstreamName, monitor.UpstreamGroup)
	updatedMonitor, created, changed, err := model.UpdateChannelRatioMonitorFromUpstream(
		monitor.ChannelId,
		result.Ratio,
		remark,
		operatorId,
		operatorUsername,
	)
	if err != nil {
		return outcome, err
	}
	outcome.Monitor = updatedMonitor
	outcome.Created = created
	outcome.Changed = changed
	return outcome, nil
}

func FetchChannelMonitorUpstreamRatio(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	if _, err := model.GetChannelById(channelId, false); err != nil {
		common.ApiError(c, err)
		return
	}
	monitor, err := model.GetChannelRatioMonitor(channelId)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "请先保存上游配置")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	operatorId, operatorUsername := getChannelMonitorOperator(c)
	outcome, err := fetchAndRecordChannelMonitorUpstreamRatio(c.Request.Context(), monitor, operatorId, operatorUsername)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_upstream_ratio_fetch", map[string]interface{}{
		"id": channelId, "upstream_type": monitor.UpstreamType, "group": monitor.UpstreamGroup, "ratio": outcome.Result.Ratio, "changed": outcome.Changed,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"result":  outcome.Result,
			"monitor": outcome.Monitor,
			"created": outcome.Created,
			"changed": outcome.Changed,
		},
	})
}

func FetchChannelMonitorUpstreamBalance(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	if _, err := model.GetChannelById(channelId, false); err != nil {
		common.ApiError(c, err)
		return
	}
	monitor, err := model.GetChannelRatioMonitor(channelId)
	if errors.Is(err, gorm.ErrRecordNotFound) || monitor.UpstreamType == "" {
		common.ApiErrorMsg(c, "请先保存上游配置")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	result, fetchErr := service.FetchChannelMonitorUpstreamBalance(
		c.Request.Context(),
		service.ChannelMonitorUpstreamConfig{
			Type:         monitor.UpstreamType,
			BaseURL:      monitor.UpstreamBaseURL,
			AuthType:     monitor.UpstreamAuthType,
			UserID:       monitor.UpstreamUserId,
			AccessToken:  monitor.UpstreamAccessToken,
			RefreshToken: monitor.UpstreamRefreshToken,
		},
	)
	if result.NextRefreshToken != "" {
		if rotateErr := model.RotateChannelRatioUpstreamRefreshToken(
			channelId,
			monitor.UpstreamRefreshToken,
			result.NextRefreshToken,
		); rotateErr != nil {
			fetchErr = fmt.Errorf("保存 Sub2API 新 Refresh Token 失败: %w", rotateErr)
		}
	}
	if fetchErr == nil && result.Amount == nil {
		fetchErr = errors.New("上游未返回余额")
	}
	if fetchErr != nil {
		if recordErr := model.RecordChannelRatioMonitorBalance(channelId, nil, fetchErr.Error()); recordErr != nil {
			fetchErr = fmt.Errorf("%w（记录余额失败状态失败：%v）", fetchErr, recordErr)
		}
		common.ApiError(c, fetchErr)
		return
	}
	if err := model.RecordChannelRatioMonitorBalance(channelId, result.Amount, ""); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_upstream_balance_fetch", map[string]interface{}{
		"id": channelId, "upstream_type": monitor.UpstreamType, "balance": *result.Amount,
	})
	common.ApiSuccess(c, result)
}

func ApplyChannelMonitorUpstreamGroup(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	monitor, err := model.GetChannelRatioMonitor(channelId)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "请先保存上游配置")
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	applyResult, applyErr := service.ApplyChannelMonitorUpstreamGroup(
		c.Request.Context(),
		service.ChannelMonitorUpstreamConfig{
			Type:         monitor.UpstreamType,
			BaseURL:      monitor.UpstreamBaseURL,
			Group:        monitor.UpstreamGroup,
			AuthType:     monitor.UpstreamAuthType,
			UserID:       monitor.UpstreamUserId,
			AccessToken:  monitor.UpstreamAccessToken,
			RefreshToken: monitor.UpstreamRefreshToken,
		},
		channel.GetKeys(),
	)
	if applyResult.Result.NextRefreshToken != "" {
		if rotateErr := model.RotateChannelRatioUpstreamRefreshToken(
			channelId,
			monitor.UpstreamRefreshToken,
			applyResult.Result.NextRefreshToken,
		); rotateErr != nil {
			applyErr = fmt.Errorf("保存 Sub2API 新 Refresh Token 失败: %w", rotateErr)
		}
	}
	if applyErr != nil {
		if applyResult.KeysUpdated > 0 {
			applyErr = fmt.Errorf("已切换 %d 个上游令牌，但后续操作失败: %w", applyResult.KeysUpdated, applyErr)
		}
		if statusErr := model.RecordChannelRatioMonitorFetchFailure(channelId, applyErr.Error()); statusErr != nil {
			applyErr = fmt.Errorf("%w（记录失败状态失败：%v）", applyErr, statusErr)
		}
		common.ApiError(c, applyErr)
		return
	}

	upstreamName := "New API"
	if monitor.UpstreamType == service.Sub2APIUpstreamType {
		upstreamName = "Sub2API"
	}
	operatorId, operatorUsername := getChannelMonitorOperator(c)
	remark := fmt.Sprintf(
		"已将 %d 个上游 %s 令牌切换到分组 %s",
		applyResult.KeysUpdated,
		upstreamName,
		monitor.UpstreamGroup,
	)
	updatedMonitor, created, changed, err := model.UpdateChannelRatioMonitorFromUpstream(
		channelId,
		applyResult.Result.Ratio,
		remark,
		operatorId,
		operatorUsername,
	)
	if err != nil {
		common.ApiError(c, fmt.Errorf("上游令牌已切换，但记录本地倍率失败: %w", err))
		return
	}
	recordManageAudit(c, "channel.monitor_upstream_group_apply", map[string]interface{}{
		"id":            channelId,
		"upstream_type": monitor.UpstreamType,
		"group":         monitor.UpstreamGroup,
		"keys_updated":  applyResult.KeysUpdated,
		"ratio":         applyResult.Result.Ratio,
		"changed":       changed,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"result":       applyResult.Result,
			"keys_updated": applyResult.KeysUpdated,
			"monitor":      updatedMonitor,
			"created":      created,
			"changed":      changed,
		},
	})
}

func GetChannelMonitorHistory(c *gin.Context) {
	channelId, err := strconv.Atoi(c.Param("id"))
	if err != nil || channelId <= 0 {
		common.ApiErrorMsg(c, "无效的渠道 ID")
		return
	}
	if _, err := model.GetChannelById(channelId, false); err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo := common.GetPageQuery(c)
	history, total, err := model.GetChannelRatioHistory(channelId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(history)
	common.ApiSuccess(c, pageInfo)
}

func UpdateChannelMonitorGroupRatio(c *gin.Context) {
	var request groupRatioUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	request.Group = strings.TrimSpace(request.Group)
	if request.Group == "" || utf8.RuneCountInString(request.Group) > 64 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "分组名称无效"})
		return
	}
	if !validateChannelMonitorRatio(request.Ratio) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "倍率必须在 0 到 1000000 之间"})
		return
	}

	groupRatios := ratio_setting.GetGroupRatioCopy()
	groupRatios[request.Group] = *request.Ratio
	jsonBytes, err := common.Marshal(groupRatios)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOptionsBulk(map[string]string{"GroupRatio": string(jsonBytes)}); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_group_ratio_update", map[string]interface{}{
		"group": request.Group,
		"ratio": *request.Ratio,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"group": request.Group,
			"ratio": *request.Ratio,
		},
	})
}
