package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const (
	channelMonitorAutoUpdateIntervalOption             = "ChannelMonitorAutoUpdateIntervalMinutes"
	channelMonitorAutoUpdateRetryCountOption           = "ChannelMonitorAutoUpdateRetryCount"
	channelMonitorAutoDisableOnUpdateFailureOption     = "ChannelMonitorAutoDisableOnUpdateFailure"
	channelMonitorEmailNotificationOption              = "ChannelMonitorEmailNotificationEnabled"
	channelMonitorNotificationEmailOption              = "ChannelMonitorNotificationEmail"
	channelMonitorGroupCoefficientsOption              = "ChannelMonitorGroupCoefficients"
	channelMonitorChannelOrderOption                   = "ChannelMonitorChannelOrder"
	channelMonitorSmartScheduleEnabledOption           = "ChannelMonitorSmartScheduleEnabled"
	channelMonitorSmartScheduleIntervalOption          = "ChannelMonitorSmartScheduleIntervalMinutes"
	channelMonitorSmartScheduleStrategyOption          = "ChannelMonitorSmartScheduleStrategy"
	channelMonitorSmartScheduleStabilityOption         = "ChannelMonitorSmartScheduleStabilityEnabled"
	channelMonitorSmartScheduleApplyModeOption         = "ChannelMonitorSmartScheduleApplyMode"
	channelMonitorSmartScheduleRangeOption             = "ChannelMonitorSmartSchedulePerformanceMinutes"
	channelMonitorSmartScheduleModelOption             = "ChannelMonitorSmartScheduleModel"
	channelMonitorSmartScheduleSamplesOption           = "ChannelMonitorSmartScheduleMinSamples"
	channelMonitorPolicyActionNone                     = "none"
	channelMonitorPolicyActionUpdateGroupRatio         = "update_group_ratio"
	channelMonitorPolicyActionDisableChannel           = "disable_channel"
	channelMonitorPolicyActionRemoveFromGroup          = "remove_from_group"
	channelMonitorSmartScheduleStrategyRatio           = "ratio"
	channelMonitorSmartScheduleStrategyFirstToken      = "first_token"
	channelMonitorSmartScheduleStrategyTPS             = "tps"
	channelMonitorSmartScheduleStrategySmart           = "smart"
	legacyChannelMonitorSmartScheduleStrategyStability = "stability"
	channelMonitorSmartScheduleApplyWeight             = "weight"
	channelMonitorSmartScheduleApplyPriorityWeight     = "priority_weight"
	maxChannelMonitorAutoUpdateIntervalMinutes         = 525600
	maxChannelMonitorAutoUpdateRetryCount              = 10
	maxChannelMonitorNotificationEmailLength           = 254
	maxChannelMonitorChannelOrderCount                 = 100000
	maxChannelMonitorSmartScheduleModelLength          = 255
	maxChannelMonitorSmartScheduleMinSamples           = 100000
	defaultChannelMonitorAutoUpdateRetryCount          = 2
	defaultChannelMonitorGroupCoefficient              = 1
	defaultChannelMonitorSmartScheduleInterval         = 10
	defaultChannelMonitorSmartScheduleRange            = 60
	defaultChannelMonitorSmartScheduleSamples          = 5
)

type channelMonitorSettings struct {
	AutoUpdateIntervalMinutes          int    `json:"auto_update_interval_minutes"`
	AutoUpdateRetryCount               int    `json:"auto_update_retry_count"`
	AutoDisableOnUpdateFailure         bool   `json:"auto_disable_on_update_failure"`
	EmailNotificationEnabled           bool   `json:"email_notification_enabled"`
	NotificationEmail                  string `json:"notification_email"`
	SmartScheduleEnabled               bool   `json:"smart_schedule_enabled"`
	SmartScheduleIntervalMinutes       int    `json:"smart_schedule_interval_minutes"`
	SmartScheduleStrategy              string `json:"smart_schedule_strategy"`
	SmartScheduleStabilityEnabled      bool   `json:"smart_schedule_stability_enabled"`
	SmartScheduleApplyMode             string `json:"smart_schedule_apply_mode"`
	SmartSchedulePerformanceMinutes    int    `json:"smart_schedule_performance_minutes"`
	SmartScheduleModel                 string `json:"smart_schedule_model"`
	SmartScheduleMinSamples            int    `json:"smart_schedule_min_samples"`
	SmartScheduleForceResetTaskCreated *bool  `json:"smart_schedule_force_reset_task_created,omitempty"`
	SmartScheduleForceResetTaskId      string `json:"smart_schedule_force_reset_task_id,omitempty"`
	SmartScheduleForceResetTaskError   string `json:"smart_schedule_force_reset_task_error,omitempty"`
}

type channelMonitorSettingsUpdateRequest struct {
	AutoUpdateIntervalMinutes       *int    `json:"auto_update_interval_minutes"`
	AutoUpdateRetryCount            *int    `json:"auto_update_retry_count"`
	AutoDisableOnUpdateFailure      *bool   `json:"auto_disable_on_update_failure"`
	EmailNotificationEnabled        *bool   `json:"email_notification_enabled"`
	NotificationEmail               *string `json:"notification_email"`
	SmartScheduleEnabled            *bool   `json:"smart_schedule_enabled"`
	SmartScheduleIntervalMinutes    *int    `json:"smart_schedule_interval_minutes"`
	SmartScheduleStrategy           *string `json:"smart_schedule_strategy"`
	SmartScheduleStabilityEnabled   *bool   `json:"smart_schedule_stability_enabled"`
	SmartScheduleApplyMode          *string `json:"smart_schedule_apply_mode"`
	SmartSchedulePerformanceMinutes *int    `json:"smart_schedule_performance_minutes"`
	SmartScheduleModel              *string `json:"smart_schedule_model"`
	SmartScheduleMinSamples         *int    `json:"smart_schedule_min_samples"`
	SmartScheduleForceReset         *bool   `json:"smart_schedule_force_reset"`
}

type channelMonitorOrderUpdateRequest struct {
	ChannelIds *[]int `json:"channel_ids"`
}

func getChannelMonitorSettings() channelMonitorSettings {
	common.OptionMapRWMutex.RLock()
	rawInterval := common.OptionMap[channelMonitorAutoUpdateIntervalOption]
	rawRetryCount := common.OptionMap[channelMonitorAutoUpdateRetryCountOption]
	rawAutoDisableOnUpdateFailure := common.OptionMap[channelMonitorAutoDisableOnUpdateFailureOption]
	rawEmailNotificationEnabled := common.OptionMap[channelMonitorEmailNotificationOption]
	rawNotificationEmail := common.OptionMap[channelMonitorNotificationEmailOption]
	rawSmartScheduleEnabled := common.OptionMap[channelMonitorSmartScheduleEnabledOption]
	rawSmartScheduleInterval := common.OptionMap[channelMonitorSmartScheduleIntervalOption]
	rawSmartScheduleStrategy := common.OptionMap[channelMonitorSmartScheduleStrategyOption]
	rawSmartScheduleStabilityEnabled := common.OptionMap[channelMonitorSmartScheduleStabilityOption]
	rawSmartScheduleApplyMode := common.OptionMap[channelMonitorSmartScheduleApplyModeOption]
	rawSmartScheduleRange := common.OptionMap[channelMonitorSmartScheduleRangeOption]
	rawSmartScheduleModel := common.OptionMap[channelMonitorSmartScheduleModelOption]
	rawSmartScheduleSamples := common.OptionMap[channelMonitorSmartScheduleSamplesOption]
	common.OptionMapRWMutex.RUnlock()

	interval, err := strconv.Atoi(rawInterval)
	if err != nil || interval < 0 || interval > maxChannelMonitorAutoUpdateIntervalMinutes {
		interval = 0
	}
	retryCount, err := strconv.Atoi(rawRetryCount)
	if err != nil || retryCount < 0 || retryCount > maxChannelMonitorAutoUpdateRetryCount {
		retryCount = defaultChannelMonitorAutoUpdateRetryCount
	}
	autoDisableOnUpdateFailure, err := strconv.ParseBool(rawAutoDisableOnUpdateFailure)
	if err != nil {
		autoDisableOnUpdateFailure = false
	}
	notificationEmail, err := normalizeChannelMonitorNotificationEmail(rawNotificationEmail)
	if err != nil {
		notificationEmail = ""
	}
	emailNotificationEnabled, err := strconv.ParseBool(rawEmailNotificationEnabled)
	if err != nil {
		emailNotificationEnabled = false
	}
	smartScheduleEnabled, err := strconv.ParseBool(rawSmartScheduleEnabled)
	if err != nil {
		smartScheduleEnabled = false
	}
	smartScheduleStabilityEnabled, err := strconv.ParseBool(rawSmartScheduleStabilityEnabled)
	if err != nil {
		smartScheduleStabilityEnabled = strings.TrimSpace(rawSmartScheduleStrategy) == legacyChannelMonitorSmartScheduleStrategyStability
	}
	smartScheduleInterval, err := strconv.Atoi(rawSmartScheduleInterval)
	if err != nil || smartScheduleInterval <= 0 || smartScheduleInterval > maxChannelMonitorAutoUpdateIntervalMinutes {
		smartScheduleInterval = defaultChannelMonitorSmartScheduleInterval
	}
	smartScheduleRange, err := strconv.Atoi(rawSmartScheduleRange)
	if err != nil || !isChannelMonitorPerformanceRangeSupported(smartScheduleRange) {
		smartScheduleRange = defaultChannelMonitorSmartScheduleRange
	}
	smartScheduleSamples, err := strconv.Atoi(rawSmartScheduleSamples)
	if err != nil || smartScheduleSamples <= 0 || smartScheduleSamples > maxChannelMonitorSmartScheduleMinSamples {
		smartScheduleSamples = defaultChannelMonitorSmartScheduleSamples
	}
	smartScheduleModel := strings.TrimSpace(rawSmartScheduleModel)
	if utf8.RuneCountInString(smartScheduleModel) > maxChannelMonitorSmartScheduleModelLength {
		smartScheduleModel = ""
	}
	return channelMonitorSettings{
		AutoUpdateIntervalMinutes:       interval,
		AutoUpdateRetryCount:            retryCount,
		AutoDisableOnUpdateFailure:      autoDisableOnUpdateFailure,
		EmailNotificationEnabled:        emailNotificationEnabled,
		NotificationEmail:               notificationEmail,
		SmartScheduleEnabled:            smartScheduleEnabled,
		SmartScheduleIntervalMinutes:    smartScheduleInterval,
		SmartScheduleStrategy:           normalizeChannelMonitorSmartScheduleStrategy(rawSmartScheduleStrategy),
		SmartScheduleStabilityEnabled:   smartScheduleStabilityEnabled,
		SmartScheduleApplyMode:          normalizeChannelMonitorSmartScheduleApplyMode(rawSmartScheduleApplyMode),
		SmartSchedulePerformanceMinutes: smartScheduleRange,
		SmartScheduleModel:              smartScheduleModel,
		SmartScheduleMinSamples:         smartScheduleSamples,
	}
}

func normalizeChannelMonitorSmartScheduleStrategy(strategy string) string {
	strategy = strings.TrimSpace(strategy)
	switch strategy {
	case channelMonitorSmartScheduleStrategyRatio,
		channelMonitorSmartScheduleStrategyFirstToken,
		channelMonitorSmartScheduleStrategyTPS,
		channelMonitorSmartScheduleStrategySmart:
		return strategy
	default:
		return channelMonitorSmartScheduleStrategySmart
	}
}

func normalizeChannelMonitorSmartScheduleApplyMode(mode string) string {
	switch strings.TrimSpace(mode) {
	case channelMonitorSmartScheduleApplyWeight,
		channelMonitorSmartScheduleApplyPriorityWeight:
		return strings.TrimSpace(mode)
	default:
		return channelMonitorSmartScheduleApplyWeight
	}
}

func isChannelMonitorPerformanceRangeSupported(minutes int) bool {
	switch minutes {
	case 15, 60, 360, 1440:
		return true
	default:
		return false
	}
}

func normalizeChannelMonitorNotificationEmail(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if utf8.RuneCountInString(value) > maxChannelMonitorNotificationEmailLength {
		return "", fmt.Errorf("通知邮箱不能超过 %d 个字符", maxChannelMonitorNotificationEmailLength)
	}
	address, err := mail.ParseAddress(value)
	if err != nil || address.Name != "" || address.Address != value {
		return "", errors.New("请输入有效的通知邮箱")
	}
	return address.Address, nil
}

func normalizeChannelMonitorPolicyAction(action string) string {
	switch action {
	case channelMonitorPolicyActionUpdateGroupRatio,
		channelMonitorPolicyActionDisableChannel,
		channelMonitorPolicyActionRemoveFromGroup:
		return action
	default:
		return channelMonitorPolicyActionNone
	}
}

func getChannelMonitorGroupCoefficients() map[string]float64 {
	common.OptionMapRWMutex.RLock()
	rawCoefficients := common.OptionMap[channelMonitorGroupCoefficientsOption]
	common.OptionMapRWMutex.RUnlock()

	coefficients := make(map[string]float64)
	if rawCoefficients == "" || common.UnmarshalJsonStr(rawCoefficients, &coefficients) != nil {
		return map[string]float64{}
	}
	if coefficients == nil {
		return map[string]float64{}
	}
	for group, coefficient := range coefficients {
		if group == "" || math.IsNaN(coefficient) || math.IsInf(coefficient, 0) || coefficient < 0 || coefficient > maxChannelMonitorRatio {
			delete(coefficients, group)
		}
	}
	return coefficients
}

func getChannelMonitorGroupCoefficient(coefficients map[string]float64, group string) float64 {
	coefficient, exists := coefficients[group]
	if !exists || !validateChannelMonitorRatio(&coefficient) {
		return defaultChannelMonitorGroupCoefficient
	}
	return coefficient
}

func normalizeChannelMonitorChannelOrder(channels []*model.Channel, channelIds []int) []int {
	availableChannelIds := make(map[int]struct{}, len(channels))
	for _, channel := range channels {
		availableChannelIds[channel.Id] = struct{}{}
	}

	orderedChannelIds := make([]int, 0, len(channels))
	seenChannelIds := make(map[int]struct{}, len(channels))
	for _, channelId := range channelIds {
		if _, exists := availableChannelIds[channelId]; !exists {
			continue
		}
		if _, exists := seenChannelIds[channelId]; exists {
			continue
		}
		orderedChannelIds = append(orderedChannelIds, channelId)
		seenChannelIds[channelId] = struct{}{}
	}
	for _, channel := range channels {
		if _, exists := seenChannelIds[channel.Id]; exists {
			continue
		}
		orderedChannelIds = append(orderedChannelIds, channel.Id)
	}
	return orderedChannelIds
}

func getChannelMonitorChannelOrder(channels []*model.Channel) []int {
	common.OptionMapRWMutex.RLock()
	rawChannelOrder := common.OptionMap[channelMonitorChannelOrderOption]
	common.OptionMapRWMutex.RUnlock()

	var channelIds []int
	if rawChannelOrder != "" && common.UnmarshalJsonStr(rawChannelOrder, &channelIds) != nil {
		channelIds = nil
	}
	return normalizeChannelMonitorChannelOrder(channels, channelIds)
}

func UpdateChannelMonitorChannelOrder(c *gin.Context) {
	var request channelMonitorOrderUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || request.ChannelIds == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	if len(*request.ChannelIds) > maxChannelMonitorChannelOrderCount {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "渠道排序数量过多"})
		return
	}

	channels, err := model.GetAllChannelsForMonitor()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	availableChannelIds := make(map[int]struct{}, len(channels))
	for _, channel := range channels {
		availableChannelIds[channel.Id] = struct{}{}
	}
	seenChannelIds := make(map[int]struct{}, len(*request.ChannelIds))
	for _, channelId := range *request.ChannelIds {
		if _, exists := availableChannelIds[channelId]; !exists {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": fmt.Sprintf("渠道 %d 不存在，请刷新后重试", channelId),
			})
			return
		}
		if _, exists := seenChannelIds[channelId]; exists {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "渠道排序中存在重复渠道"})
			return
		}
		seenChannelIds[channelId] = struct{}{}
	}

	channelOrder := normalizeChannelMonitorChannelOrder(channels, *request.ChannelIds)
	channelOrderBytes, err := common.Marshal(channelOrder)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateOptionsBulk(map[string]string{
		channelMonitorChannelOrderOption: string(channelOrderBytes),
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "channel.monitor_order_update", map[string]interface{}{
		"channel_count": len(channelOrder),
	})
	common.ApiSuccess(c, gin.H{"channel_order": channelOrder})
}

func UpdateChannelMonitorSettings(c *gin.Context) {
	var request channelMonitorSettingsUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的参数"})
		return
	}
	if request.AutoUpdateIntervalMinutes == nil &&
		request.AutoUpdateRetryCount == nil &&
		request.AutoDisableOnUpdateFailure == nil &&
		request.EmailNotificationEnabled == nil &&
		request.NotificationEmail == nil &&
		request.SmartScheduleEnabled == nil &&
		request.SmartScheduleIntervalMinutes == nil &&
		request.SmartScheduleStrategy == nil &&
		request.SmartScheduleStabilityEnabled == nil &&
		request.SmartScheduleApplyMode == nil &&
		request.SmartSchedulePerformanceMinutes == nil &&
		request.SmartScheduleModel == nil &&
		request.SmartScheduleMinSamples == nil &&
		request.SmartScheduleForceReset == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请提供要更新的设置"})
		return
	}
	settings := getChannelMonitorSettings()
	smartScheduleWasEnabled := settings.SmartScheduleEnabled
	values := make(map[string]string, 13)
	if request.AutoUpdateIntervalMinutes != nil && (*request.AutoUpdateIntervalMinutes < 0 ||
		*request.AutoUpdateIntervalMinutes > maxChannelMonitorAutoUpdateIntervalMinutes) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "自动更新间隔必须在 0 到 525600 分钟之间",
		})
		return
	}
	if request.AutoUpdateIntervalMinutes != nil {
		settings.AutoUpdateIntervalMinutes = *request.AutoUpdateIntervalMinutes
		values[channelMonitorAutoUpdateIntervalOption] = strconv.Itoa(settings.AutoUpdateIntervalMinutes)
	}
	if request.AutoUpdateRetryCount != nil && (*request.AutoUpdateRetryCount < 0 ||
		*request.AutoUpdateRetryCount > maxChannelMonitorAutoUpdateRetryCount) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "失败重试次数必须在 0 到 10 次之间",
		})
		return
	}
	if request.AutoUpdateRetryCount != nil {
		settings.AutoUpdateRetryCount = *request.AutoUpdateRetryCount
		values[channelMonitorAutoUpdateRetryCountOption] = strconv.Itoa(settings.AutoUpdateRetryCount)
	}
	if request.AutoDisableOnUpdateFailure != nil {
		settings.AutoDisableOnUpdateFailure = *request.AutoDisableOnUpdateFailure
		values[channelMonitorAutoDisableOnUpdateFailureOption] = strconv.FormatBool(settings.AutoDisableOnUpdateFailure)
	}
	if request.EmailNotificationEnabled != nil {
		settings.EmailNotificationEnabled = *request.EmailNotificationEnabled
		values[channelMonitorEmailNotificationOption] = strconv.FormatBool(settings.EmailNotificationEnabled)
	}
	if request.NotificationEmail != nil {
		notificationEmail, err := normalizeChannelMonitorNotificationEmail(*request.NotificationEmail)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		settings.NotificationEmail = notificationEmail
		values[channelMonitorNotificationEmailOption] = notificationEmail
	}
	if settings.EmailNotificationEnabled && settings.NotificationEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "开启邮件通知时请填写通知邮箱"})
		return
	}
	if request.SmartScheduleEnabled != nil {
		settings.SmartScheduleEnabled = *request.SmartScheduleEnabled
		values[channelMonitorSmartScheduleEnabledOption] = strconv.FormatBool(settings.SmartScheduleEnabled)
	}
	if request.SmartScheduleIntervalMinutes != nil && (*request.SmartScheduleIntervalMinutes <= 0 ||
		*request.SmartScheduleIntervalMinutes > maxChannelMonitorAutoUpdateIntervalMinutes) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "智能调度间隔必须在 1 到 525600 分钟之间",
		})
		return
	}
	if request.SmartScheduleIntervalMinutes != nil {
		settings.SmartScheduleIntervalMinutes = *request.SmartScheduleIntervalMinutes
		values[channelMonitorSmartScheduleIntervalOption] = strconv.Itoa(settings.SmartScheduleIntervalMinutes)
	}
	if request.SmartScheduleStrategy != nil {
		strategy := strings.TrimSpace(*request.SmartScheduleStrategy)
		if normalizeChannelMonitorSmartScheduleStrategy(strategy) != strategy {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "智能调度方式无效"})
			return
		}
		settings.SmartScheduleStrategy = strategy
		values[channelMonitorSmartScheduleStrategyOption] = strategy
	}
	if request.SmartScheduleStabilityEnabled != nil {
		settings.SmartScheduleStabilityEnabled = *request.SmartScheduleStabilityEnabled
		values[channelMonitorSmartScheduleStabilityOption] = strconv.FormatBool(settings.SmartScheduleStabilityEnabled)
	}
	if request.SmartScheduleApplyMode != nil {
		mode := strings.TrimSpace(*request.SmartScheduleApplyMode)
		if normalizeChannelMonitorSmartScheduleApplyMode(mode) != mode {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "智能调度调整方式无效"})
			return
		}
		settings.SmartScheduleApplyMode = mode
		values[channelMonitorSmartScheduleApplyModeOption] = mode
	}
	if request.SmartSchedulePerformanceMinutes != nil &&
		!isChannelMonitorPerformanceRangeSupported(*request.SmartSchedulePerformanceMinutes) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "智能调度统计范围无效"})
		return
	}
	if request.SmartSchedulePerformanceMinutes != nil {
		settings.SmartSchedulePerformanceMinutes = *request.SmartSchedulePerformanceMinutes
		values[channelMonitorSmartScheduleRangeOption] = strconv.Itoa(settings.SmartSchedulePerformanceMinutes)
	}
	if request.SmartScheduleModel != nil {
		modelName := strings.TrimSpace(*request.SmartScheduleModel)
		if utf8.RuneCountInString(modelName) > maxChannelMonitorSmartScheduleModelLength {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "智能调度基准模型不能超过 255 个字符"})
			return
		}
		settings.SmartScheduleModel = modelName
		values[channelMonitorSmartScheduleModelOption] = modelName
	}
	if request.SmartScheduleMinSamples != nil && (*request.SmartScheduleMinSamples <= 0 ||
		*request.SmartScheduleMinSamples > maxChannelMonitorSmartScheduleMinSamples) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "智能调度最少样本数必须在 1 到 100000 之间"})
		return
	}
	if request.SmartScheduleMinSamples != nil {
		settings.SmartScheduleMinSamples = *request.SmartScheduleMinSamples
		values[channelMonitorSmartScheduleSamplesOption] = strconv.Itoa(settings.SmartScheduleMinSamples)
	}
	forceResetSmartSchedule := request.SmartScheduleForceReset != nil && *request.SmartScheduleForceReset
	resetSmartScheduleChannels := request.SmartScheduleEnabled != nil &&
		*request.SmartScheduleEnabled && !smartScheduleWasEnabled && !forceResetSmartSchedule
	resetChannelCount := 0
	if resetSmartScheduleChannels {
		var err error
		resetChannelCount, err = model.ExcludeAllChannelsFromSmartSchedule()
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}
	forceResetTaskCreated := false
	forceResetTaskId := ""
	forceResetTaskError := ""
	if forceResetSmartSchedule {
		task, created, err := service.EnqueueSystemTask(
			channelMonitorSmartScheduleTaskType,
			channelSmartScheduleTaskPayload{ForceReset: true},
		)
		forceResetTaskCreated = created
		if err != nil {
			forceResetTaskError = err.Error()
		} else {
			forceResetTaskId = task.TaskID
		}
		settings.SmartScheduleForceResetTaskCreated = &forceResetTaskCreated
		settings.SmartScheduleForceResetTaskId = forceResetTaskId
		settings.SmartScheduleForceResetTaskError = forceResetTaskError
	}
	recordManageAudit(c, "channel.monitor_settings_update", map[string]interface{}{
		"auto_update_interval_minutes":       settings.AutoUpdateIntervalMinutes,
		"auto_update_retry_count":            settings.AutoUpdateRetryCount,
		"auto_disable_on_update_failure":     settings.AutoDisableOnUpdateFailure,
		"email_notification_enabled":         settings.EmailNotificationEnabled,
		"notification_email_configured":      settings.NotificationEmail != "",
		"smart_schedule_enabled":             settings.SmartScheduleEnabled,
		"smart_schedule_interval_minutes":    settings.SmartScheduleIntervalMinutes,
		"smart_schedule_strategy":            settings.SmartScheduleStrategy,
		"smart_schedule_stability_enabled":   settings.SmartScheduleStabilityEnabled,
		"smart_schedule_apply_mode":          settings.SmartScheduleApplyMode,
		"smart_schedule_performance_minutes": settings.SmartSchedulePerformanceMinutes,
		"smart_schedule_model":               settings.SmartScheduleModel,
		"smart_schedule_min_samples":         settings.SmartScheduleMinSamples,
		"smart_schedule_channels_reset":      resetSmartScheduleChannels,
		"smart_schedule_reset_channel_count": resetChannelCount,
		"smart_schedule_force_reset":         forceResetSmartSchedule,
		"smart_schedule_force_reset_created": forceResetTaskCreated,
		"smart_schedule_force_reset_task_id": forceResetTaskId,
		"smart_schedule_force_reset_error":   forceResetTaskError,
	})
	common.ApiSuccess(c, settings)
}
