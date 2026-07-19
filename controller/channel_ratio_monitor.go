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
	Excluded *bool `json:"excluded"`
}

type channelMonitorUpstreamRequest struct {
	Type                    string                                      `json:"type"`
	BaseURL                 string                                      `json:"base_url"`
	Group                   string                                      `json:"group"`
	AuthType                string                                      `json:"auth_type"`
	UserId                  int                                         `json:"user_id"`
	AccessToken             string                                      `json:"access_token"`
	SingleChannelAction     string                                      `json:"single_channel_action"`
	MultipleChannelsAction  string                                      `json:"multiple_channels_action"`
	BalanceWarningThreshold json.RawMessage                             `json:"balance_warning_threshold"`
	RatioSyncEnabled        *bool                                       `json:"ratio_sync_enabled"`
	BalanceSyncEnabled      *bool                                       `json:"balance_sync_enabled"`
	CostConversion          *service.ChannelMonitorCostConversion       `json:"cost_conversion"`
	CustomConfig            *service.ChannelMonitorCustomUpstreamConfig `json:"custom_config"`
}

type channelMonitorUpstreamConfig struct {
	Type                    string                                      `json:"type"`
	BaseURL                 string                                      `json:"base_url"`
	Group                   string                                      `json:"group"`
	AuthType                string                                      `json:"auth_type"`
	UserId                  int                                         `json:"user_id"`
	HasAccessToken          bool                                        `json:"has_access_token"`
	SingleChannelAction     string                                      `json:"single_channel_action"`
	MultipleChannelsAction  string                                      `json:"multiple_channels_action"`
	BalanceWarningThreshold *float64                                    `json:"balance_warning_threshold"`
	RatioSyncEnabled        bool                                        `json:"ratio_sync_enabled"`
	BalanceSyncEnabled      bool                                        `json:"balance_sync_enabled"`
	CostConversion          service.ChannelMonitorCostConversion        `json:"cost_conversion"`
	CustomConfig            *service.ChannelMonitorCustomUpstreamConfig `json:"custom_config,omitempty"`
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
	CostRatio             *float64                      `json:"cost_ratio"`
	PreviousCostRatio     *float64                      `json:"previous_cost_ratio"`
	ConversionFactor      *float64                      `json:"conversion_factor"`
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
	costConversion, err := service.ParseChannelMonitorCostConversion(monitor.CostConversion)
	if err != nil {
		costConversion = service.ChannelMonitorCostConversion{Mode: service.ChannelMonitorCostConversionNone}
	}
	var customConfig *service.ChannelMonitorCustomUpstreamConfig
	if monitor.UpstreamType == service.CustomUpstreamType {
		parsed, parseErr := service.ParseChannelMonitorCustomUpstreamConfig(monitor.CustomUpstreamConfig)
		if parseErr == nil {
			sanitized := service.SanitizeChannelMonitorCustomUpstreamConfig(parsed)
			customConfig = &sanitized
		}
	}
	return &channelMonitorUpstreamConfig{
		Type:                    monitor.UpstreamType,
		BaseURL:                 monitor.UpstreamBaseURL,
		Group:                   monitor.UpstreamGroup,
		AuthType:                monitor.UpstreamAuthType,
		UserId:                  monitor.UpstreamUserId,
		HasAccessToken:          monitor.UpstreamAccessToken != "",
		SingleChannelAction:     normalizeChannelMonitorPolicyAction(monitor.SingleChannelAction),
		MultipleChannelsAction:  normalizeChannelMonitorPolicyAction(monitor.MultipleChannelsAction),
		BalanceWarningThreshold: monitor.BalanceWarningThreshold,
		RatioSyncEnabled:        !monitor.UpstreamRatioSyncDisabled,
		BalanceSyncEnabled:      !monitor.UpstreamBalanceSyncDisabled,
		CostConversion:          costConversion,
		CustomConfig:            customConfig,
	}
}

func channelMonitorCostRatioFromModel(monitor model.ChannelRatioMonitor, upstreamRatio float64) (float64, float64, error) {
	costConversion, err := service.ParseChannelMonitorCostConversion(monitor.CostConversion)
	if err != nil {
		return 0, 0, err
	}
	return service.CalculateChannelMonitorCostRatio(upstreamRatio, costConversion)
}

func channelMonitorCostConversionLabel(config service.ChannelMonitorCostConversion) string {
	switch config.Mode {
	case service.ChannelMonitorCostConversionRecharge:
		return "充值换算"
	case service.ChannelMonitorCostConversionSubscription:
		return "订阅换算"
	default:
		return "不换算"
	}
}

func channelMonitorUpstreamTypeLabel(upstreamType string) string {
	switch upstreamType {
	case service.NewAPIUpstreamType:
		return "New API"
	case service.Sub2APIUpstreamType:
		return "Sub2API"
	case service.CustomUpstreamType:
		return "自定义上游"
	default:
		return upstreamType
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
	request.Type = strings.TrimSpace(request.Type)
	if request.Type == "" {
		request.Type = service.NewAPIUpstreamType
	}
	request.Group = strings.TrimSpace(request.Group)
	if (requireGroup && request.Type != service.CustomUpstreamType && request.Group == "") || utf8.RuneCountInString(request.Group) > 64 {
		return service.ChannelMonitorUpstreamConfig{}, errors.New("上游分组名称无效")
	}

	baseURL := strings.TrimSpace(request.BaseURL)
	if baseURL == "" {
		baseURL = channel.GetBaseURL()
	}
	var normalizedBaseURL string
	var err error
	if request.Type == service.CustomUpstreamType {
		normalizedBaseURL, err = service.NormalizeChannelMonitorCustomBaseURL(baseURL)
	} else {
		normalizedBaseURL, err = service.NormalizeNewAPIBaseURL(baseURL)
	}
	if err != nil {
		return service.ChannelMonitorUpstreamConfig{}, err
	}

	costConversion := service.ChannelMonitorCostConversion{Mode: service.ChannelMonitorCostConversionNone}
	if request.CostConversion != nil {
		costConversion, err = service.NormalizeChannelMonitorCostConversion(*request.CostConversion)
		if err != nil {
			return service.ChannelMonitorUpstreamConfig{}, err
		}
	}

	request.AuthType = strings.TrimSpace(request.AuthType)
	config := service.ChannelMonitorUpstreamConfig{
		Type:           request.Type,
		BaseURL:        normalizedBaseURL,
		Group:          request.Group,
		AuthType:       request.AuthType,
		Proxy:          channel.GetSetting().Proxy,
		SkipBalance:    request.BalanceSyncEnabled != nil && !*request.BalanceSyncEnabled,
		CostConversion: costConversion,
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
		if request.AuthType == service.Sub2APIAuthAPIKey {
			if len(channel.GetKeys()) == 0 {
				return service.ChannelMonitorUpstreamConfig{}, errors.New("Sub2API API Key 认证需要先在渠道中配置上游 API Key")
			}
			config.ChannelKeys = channel.GetKeys()
			return config, nil
		}
		if request.AuthType != service.Sub2APIAuthToken {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("Sub2API 认证方式无效")
		}
		config.AccessToken = strings.TrimSpace(request.AccessToken)
		if utf8.RuneCountInString(config.AccessToken) > 4096 {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("Sub2API Token 过长")
		}
		if config.AccessToken == "" {
			monitor, findErr := model.GetChannelRatioMonitor(channel.Id)
			if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
				return service.ChannelMonitorUpstreamConfig{}, findErr
			}
			if findErr == nil &&
				monitor.UpstreamType == config.Type &&
				monitor.UpstreamBaseURL == config.BaseURL &&
				monitor.UpstreamAuthType == config.AuthType {
				config.AccessToken = monitor.UpstreamAccessToken
			}
		}
		if config.AccessToken == "" {
			return service.ChannelMonitorUpstreamConfig{}, errors.New("Sub2API Token 不能为空")
		}
		return config, nil
	case service.CustomUpstreamType:
		config.AuthType = service.CustomUpstreamAuthType
		var existingConfig *service.ChannelMonitorCustomUpstreamConfig
		monitor, findErr := model.GetChannelRatioMonitor(channel.Id)
		if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
			return service.ChannelMonitorUpstreamConfig{}, findErr
		}
		if findErr == nil && monitor.UpstreamType == service.CustomUpstreamType && monitor.UpstreamBaseURL == normalizedBaseURL {
			parsed, parseErr := service.ParseChannelMonitorCustomUpstreamConfig(monitor.CustomUpstreamConfig)
			if parseErr == nil {
				existingConfig = &parsed
			}
		}
		if request.CustomConfig == nil {
			if existingConfig == nil {
				return service.ChannelMonitorUpstreamConfig{}, errors.New("自定义上游配置不能为空")
			}
			config.CustomConfig = *existingConfig
			return config, nil
		}
		customConfig, normalizeErr := service.NormalizeChannelMonitorCustomUpstreamConfigWithExisting(*request.CustomConfig, existingConfig)
		if normalizeErr != nil {
			return service.ChannelMonitorUpstreamConfig{}, normalizeErr
		}
		config.CustomConfig = customConfig
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
			item.LastScheduleStatus = monitor.LastScheduleStatus
			item.LastScheduleError = monitor.LastScheduleError
			item.LastScheduleScore = monitor.LastScheduleScore
			item.LastSchedulePriority = monitor.LastSchedulePriority
			item.LastScheduleWeight = monitor.LastScheduleWeight
			item.LastScheduleTime = monitor.LastScheduleTime
			if monitor.UpdatedTime > 0 {
				item.Ratio = &monitor.Ratio
				item.PreviousRatio = monitor.PreviousRatio
				costRatio, factor, conversionErr := channelMonitorCostRatioFromModel(monitor, monitor.Ratio)
				if conversionErr == nil {
					item.CostRatio = &costRatio
					item.ConversionFactor = &factor
					if monitor.PreviousRatio != nil {
						previousCostRatio, _, previousErr := channelMonitorCostRatioFromModel(monitor, *monitor.PreviousRatio)
						if previousErr == nil {
							item.PreviousCostRatio = &previousCostRatio
						}
					}
				}
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
	if _, err := model.GetChannelById(channelId, false); err != nil {
		common.ApiError(c, err)
		return
	}

	var request channelSmartScheduleConfigUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	if request.Excluded == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请提供要更新的调度设置"})
		return
	}

	monitor, err := model.SaveChannelSmartScheduleConfig(channelId, *request.Excluded)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_smart_schedule_config_update", map[string]interface{}{
		"id": channelId, "excluded": *request.Excluded,
	})
	common.ApiSuccess(c, gin.H{
		"excluded": monitor.SmartScheduleExcluded,
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
	highestCostRatio := -1.0
	highestConversionFactor := 1.0
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
		costRatio, factor, conversionErr := channelMonitorCostRatioFromModel(monitor, monitor.Ratio)
		if conversionErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": fmt.Sprintf("渠道 %s（ID %d）倍率换算失败：%s", channel.Name, channel.Id, conversionErr.Error()),
			})
			return
		}
		if costRatio > highestCostRatio {
			highestCostRatio = costRatio
			highestUpstreamRatio = monitor.Ratio
			highestConversionFactor = factor
		}
	}
	if highestCostRatio < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该分组没有已记录倍率的启用渠道"})
		return
	}
	targetRatio := highestCostRatio * *request.Coefficient
	if !validateChannelMonitorRatio(&targetRatio) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "成本倍率乘以系数后的结果超出范围"})
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
		"group": request.Group, "upstream_ratio": highestUpstreamRatio,
		"conversion_factor": highestConversionFactor, "cost_ratio": highestCostRatio,
		"coefficient": *request.Coefficient, "ratio": targetRatio,
	})
	common.ApiSuccess(c, gin.H{
		"group": request.Group, "upstream_ratio": highestUpstreamRatio,
		"conversion_factor": highestConversionFactor, "cost_ratio": highestCostRatio,
		"coefficient": *request.Coefficient, "ratio": targetRatio,
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
	if request.CostConversion == nil && hasExistingMonitor {
		config.CostConversion, err = service.ParseChannelMonitorCostConversion(existingMonitor.CostConversion)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
	}
	ratioSyncEnabled := true
	balanceSyncEnabled := true
	if hasExistingMonitor {
		ratioSyncEnabled = !existingMonitor.UpstreamRatioSyncDisabled
		balanceSyncEnabled = !existingMonitor.UpstreamBalanceSyncDisabled
	}
	if request.RatioSyncEnabled != nil {
		ratioSyncEnabled = *request.RatioSyncEnabled
	}
	if request.BalanceSyncEnabled != nil {
		balanceSyncEnabled = *request.BalanceSyncEnabled
	}

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
	if hasExistingMonitor && existingMonitor.UpdatedTime > 0 {
		if _, _, err := service.CalculateChannelMonitorCostRatio(existingMonitor.Ratio, config.CostConversion); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
	}
	costConversion, err := service.MarshalChannelMonitorCostConversion(config.CostConversion)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	conversionFactor, err := service.ChannelMonitorCostConversionFactor(config.CostConversion)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	customConfig := ""
	if config.Type == service.CustomUpstreamType {
		if config.CustomConfig.Ratio.Source == service.ChannelMonitorCustomSourceFixed {
			if _, _, err := service.CalculateChannelMonitorCostRatio(*config.CustomConfig.Ratio.FixedValue, config.CostConversion); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
				return
			}
		}
		customConfig, err = service.MarshalChannelMonitorCustomUpstreamConfig(config.CustomConfig)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
	}

	monitor, err := model.SaveChannelRatioUpstreamConfig(
		channelId,
		config.Type,
		config.BaseURL,
		config.Group,
		config.AuthType,
		config.UserID,
		config.AccessToken,
		model.ChannelRatioUpstreamOptions{
			SingleChannelAction:     singleChannelAction,
			MultipleChannelsAction:  multipleChannelAction,
			BalanceWarningThreshold: balanceWarningThreshold,
			RatioSyncEnabled:        ratioSyncEnabled,
			BalanceSyncEnabled:      balanceSyncEnabled,
			CostConversion:          costConversion,
			CustomUpstreamConfig:    customConfig,
		},
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if config.Type == service.CustomUpstreamType {
		operatorId, operatorUsername := getChannelMonitorOperator(c)
		if config.CustomConfig.Ratio.Source == service.ChannelMonitorCustomSourceFixed {
			monitor, _, _, err = model.UpdateChannelRatioMonitorFromUpstream(
				channelId,
				*config.CustomConfig.Ratio.FixedValue,
				"已应用自定义上游固定倍率",
				operatorId,
				operatorUsername,
			)
			if err != nil {
				common.ApiError(c, fmt.Errorf("自定义上游配置已保存，但固定倍率写入失败: %w", err))
				return
			}
		}
		if config.CustomConfig.Balance.Source == service.ChannelMonitorCustomSourceFixed {
			if err := model.RecordChannelRatioMonitorBalance(channelId, config.CustomConfig.Balance.FixedValue, ""); err != nil {
				common.ApiError(c, fmt.Errorf("自定义上游配置已保存，但固定余额写入失败: %w", err))
				return
			}
			monitor, err = model.GetChannelRatioMonitor(channelId)
			if err != nil {
				common.ApiError(c, err)
				return
			}
		}
	}
	auditDetails := map[string]interface{}{
		"id": channelId, "upstream_type": config.Type, "upstream_type_label": channelMonitorUpstreamTypeLabel(config.Type), "group": config.Group, "auth_type": config.AuthType,
		"single_channel_action": singleChannelAction, "multiple_channels_action": multipleChannelAction,
		"balance_warning_threshold": balanceWarningThreshold,
		"ratio_sync_enabled":        ratioSyncEnabled, "balance_sync_enabled": balanceSyncEnabled,
		"cost_conversion":   channelMonitorCostConversionLabel(config.CostConversion),
		"conversion_factor": conversionFactor,
	}
	if config.Type == service.CustomUpstreamType {
		auditDetails["custom_ratio_source"] = config.CustomConfig.Ratio.Source
		auditDetails["custom_balance_source"] = config.CustomConfig.Balance.Source
	}
	recordManageAudit(c, "channel.monitor_upstream_config_update", auditDetails)
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
		if config.AuthType != service.Sub2APIAuthToken {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Sub2API API Key 认证不支持获取或应用分组，请手动填写分组或切换为 Token 认证",
			})
			return
		}
	}
	if config.Type == service.CustomUpstreamType {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "自定义上游不支持自动获取分组，请手动填写上游分组",
		})
		return
	}

	result, fetchErr := service.FetchChannelMonitorUpstreamGroups(c.Request.Context(), config, channel.GetKeys())
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
	config, err := resolveChannelMonitorUpstreamRequest(channel, request, true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if config.Type != service.CustomUpstreamType && request.RatioSyncEnabled != nil && !*request.RatioSyncEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "上游倍率同步已关闭，无需测试获取"})
		return
	}
	if config.Type == service.Sub2APIUpstreamType {
		config.ChannelKeys = channel.GetKeys()
	}
	config.CustomDebug = config.Type == service.CustomUpstreamType
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

func fetchAndRecordChannelMonitorUpstreamRatio(ctx context.Context, monitor model.ChannelRatioMonitor, channelKeys []string, proxyURL string, operatorId int, operatorUsername string) (outcome channelMonitorFetchOutcome, err error) {
	if monitor.UpstreamType != service.NewAPIUpstreamType && monitor.UpstreamType != service.Sub2APIUpstreamType && monitor.UpstreamType != service.CustomUpstreamType {
		return outcome, errors.New("请先保存上游配置")
	}
	if monitor.UpstreamRatioSyncDisabled {
		return outcome, errors.New("该渠道已关闭上游倍率同步")
	}
	defer func() {
		if err == nil {
			return
		}
		if statusErr := model.RecordChannelRatioMonitorFetchFailure(monitor.ChannelId, err.Error()); statusErr != nil {
			err = fmt.Errorf("%w（记录失败状态失败：%v）", err, statusErr)
		}
	}()
	if monitor.UpstreamType == service.Sub2APIUpstreamType {
		switch monitor.UpstreamAuthType {
		case service.Sub2APIAuthAPIKey:
			if len(channelKeys) == 0 {
				return outcome, errors.New("Sub2API API Key 认证需要当前渠道配置上游 API Key")
			}
		case service.Sub2APIAuthToken:
			if monitor.UpstreamAccessToken == "" {
				return outcome, errors.New("请重新保存 Sub2API Token 配置")
			}
		default:
			return outcome, errors.New("Sub2API 认证方式无效")
		}
	}
	costConversion, err := service.ParseChannelMonitorCostConversion(monitor.CostConversion)
	if err != nil {
		return outcome, err
	}
	customConfig := service.ChannelMonitorCustomUpstreamConfig{}
	if monitor.UpstreamType == service.CustomUpstreamType {
		customConfig, err = service.ParseChannelMonitorCustomUpstreamConfig(monitor.CustomUpstreamConfig)
		if err != nil {
			return outcome, err
		}
	}

	result, fetchErr := service.FetchChannelMonitorUpstreamGroupRatio(ctx, service.ChannelMonitorUpstreamConfig{
		Type:           monitor.UpstreamType,
		BaseURL:        monitor.UpstreamBaseURL,
		Group:          monitor.UpstreamGroup,
		AuthType:       monitor.UpstreamAuthType,
		UserID:         monitor.UpstreamUserId,
		AccessToken:    monitor.UpstreamAccessToken,
		ChannelKeys:    channelKeys,
		Proxy:          proxyURL,
		SkipBalance:    monitor.UpstreamBalanceSyncDisabled,
		CostConversion: costConversion,
		CustomConfig:   customConfig,
	})
	outcome.Result = result
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

	upstreamName := channelMonitorUpstreamTypeLabel(monitor.UpstreamType)
	remark := fmt.Sprintf("从上游 %s 获取倍率", upstreamName)
	if strings.TrimSpace(monitor.UpstreamGroup) != "" {
		remark += fmt.Sprintf("（分组 %s）", monitor.UpstreamGroup)
	}
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

func fetchAndRecordChannelMonitorUpstreamBalance(ctx context.Context, monitor model.ChannelRatioMonitor, channelKeys []string, proxyURL string) (result service.ChannelMonitorUpstreamBalanceResult, err error) {
	if monitor.UpstreamType != service.NewAPIUpstreamType && monitor.UpstreamType != service.Sub2APIUpstreamType && monitor.UpstreamType != service.CustomUpstreamType {
		return result, errors.New("请先保存上游配置")
	}
	if monitor.UpstreamBalanceSyncDisabled {
		return result, errors.New("该渠道已关闭上游余额同步")
	}

	customConfig := service.ChannelMonitorCustomUpstreamConfig{}
	if monitor.UpstreamType == service.CustomUpstreamType {
		customConfig, err = service.ParseChannelMonitorCustomUpstreamConfig(monitor.CustomUpstreamConfig)
		if err != nil {
			return result, err
		}
	}
	result, fetchErr := service.FetchChannelMonitorUpstreamBalance(
		ctx,
		service.ChannelMonitorUpstreamConfig{
			Type:         monitor.UpstreamType,
			BaseURL:      monitor.UpstreamBaseURL,
			AuthType:     monitor.UpstreamAuthType,
			UserID:       monitor.UpstreamUserId,
			AccessToken:  monitor.UpstreamAccessToken,
			ChannelKeys:  channelKeys,
			Proxy:        proxyURL,
			CustomConfig: customConfig,
		},
	)
	if fetchErr == nil && result.Amount == nil {
		fetchErr = errors.New("上游未返回余额")
	}
	if fetchErr != nil {
		if recordErr := model.RecordChannelRatioMonitorBalance(monitor.ChannelId, nil, fetchErr.Error()); recordErr != nil {
			fetchErr = fmt.Errorf("%w（记录余额失败状态失败：%v）", fetchErr, recordErr)
		}
		return result, fetchErr
	}
	if err := model.RecordChannelRatioMonitorBalance(monitor.ChannelId, result.Amount, ""); err != nil {
		return result, err
	}
	return result, nil
}

func FetchChannelMonitorUpstreamRatio(c *gin.Context) {
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
	if monitor.UpstreamRatioSyncDisabled {
		common.ApiErrorMsg(c, "该渠道已关闭上游倍率同步")
		return
	}
	operatorId, operatorUsername := getChannelMonitorOperator(c)
	outcome, err := fetchAndRecordChannelMonitorUpstreamRatio(c.Request.Context(), monitor, channel.GetKeys(), channel.GetSetting().Proxy, operatorId, operatorUsername)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_upstream_ratio_fetch", map[string]interface{}{
		"id": channelId, "upstream_type": monitor.UpstreamType, "group": monitor.UpstreamGroup,
		"ratio": outcome.Result.Ratio, "cost_ratio": outcome.Result.CostRatio,
		"conversion_factor": outcome.Result.ConversionFactor, "changed": outcome.Changed,
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
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
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
	if monitor.UpstreamBalanceSyncDisabled {
		common.ApiErrorMsg(c, "该渠道已关闭上游余额同步")
		return
	}

	result, err := fetchAndRecordChannelMonitorUpstreamBalance(c.Request.Context(), monitor, channel.GetKeys(), channel.GetSetting().Proxy)
	if err != nil {
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
	costConversion, err := service.ParseChannelMonitorCostConversion(monitor.CostConversion)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	applyResult, applyErr := service.ApplyChannelMonitorUpstreamGroup(
		c.Request.Context(),
		service.ChannelMonitorUpstreamConfig{
			Type:           monitor.UpstreamType,
			BaseURL:        monitor.UpstreamBaseURL,
			Group:          monitor.UpstreamGroup,
			AuthType:       monitor.UpstreamAuthType,
			UserID:         monitor.UpstreamUserId,
			AccessToken:    monitor.UpstreamAccessToken,
			Proxy:          channel.GetSetting().Proxy,
			CostConversion: costConversion,
		},
		channel.GetKeys(),
	)
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
		"id":                channelId,
		"upstream_type":     monitor.UpstreamType,
		"group":             monitor.UpstreamGroup,
		"keys_updated":      applyResult.KeysUpdated,
		"ratio":             applyResult.Result.Ratio,
		"cost_ratio":        applyResult.Result.CostRatio,
		"conversion_factor": applyResult.Result.ConversionFactor,
		"changed":           changed,
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
