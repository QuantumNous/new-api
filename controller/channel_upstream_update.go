package controller

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/gemini"
	"github.com/QuantumNous/new-api/relay/channel/ollama"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

const (
	channelUpstreamModelUpdateTaskDefaultIntervalMinutes = 30
	channelUpstreamModelUpdateTaskBatchSize              = 100
	channelUpstreamModelUpdateMinCheckIntervalSeconds    = 300
)

var (
	channelUpstreamModelUpdateTaskOnce    sync.Once
	channelUpstreamModelUpdateTaskRunning atomic.Bool
)

type applyChannelUpstreamModelUpdatesRequest struct {
	ID           int      `json:"id"`
	AddModels    []string `json:"add_models"`
	IgnoreModels []string `json:"ignore_models"`
}

type applyAllChannelUpstreamModelUpdatesResult struct {
	ChannelID       int      `json:"channel_id"`
	ChannelName     string   `json:"channel_name"`
	AddedModels     []string `json:"added_models"`
	RemainingModels []string `json:"remaining_models"`
}

func normalizeModelNames(models []string) []string {
	return lo.Uniq(lo.FilterMap(models, func(model string, _ int) (string, bool) {
		trimmed := strings.TrimSpace(model)
		return trimmed, trimmed != ""
	}))
}

func mergeModelNames(base []string, appended []string) []string {
	merged := normalizeModelNames(base)
	seen := make(map[string]struct{}, len(merged))
	for _, model := range merged {
		seen[model] = struct{}{}
	}
	for _, model := range normalizeModelNames(appended) {
		if _, ok := seen[model]; ok {
			continue
		}
		seen[model] = struct{}{}
		merged = append(merged, model)
	}
	return merged
}

func subtractModelNames(base []string, removed []string) []string {
	removeSet := make(map[string]struct{}, len(removed))
	for _, model := range normalizeModelNames(removed) {
		removeSet[model] = struct{}{}
	}
	return lo.Filter(normalizeModelNames(base), func(model string, _ int) bool {
		_, ok := removeSet[model]
		return !ok
	})
}

func collectPendingUpstreamModels(channel *model.Channel, settings dto.ChannelOtherSettings) ([]string, error) {
	upstreamModels, err := fetchChannelUpstreamModelIDs(channel)
	if err != nil {
		return nil, err
	}

	localSet := make(map[string]struct{})
	for _, modelName := range normalizeModelNames(channel.GetModels()) {
		localSet[modelName] = struct{}{}
	}

	ignoredSet := make(map[string]struct{})
	for _, modelName := range normalizeModelNames(settings.UpstreamModelUpdateIgnoredModels) {
		ignoredSet[modelName] = struct{}{}
	}

	pending := lo.Filter(upstreamModels, func(modelName string, _ int) bool {
		if _, ok := localSet[modelName]; ok {
			return false
		}
		if _, ok := ignoredSet[modelName]; ok {
			return false
		}
		return true
	})
	return normalizeModelNames(pending), nil
}

func getUpstreamModelUpdateMinCheckIntervalSeconds() int64 {
	interval := int64(common.GetEnvOrDefault(
		"CHANNEL_UPSTREAM_MODEL_UPDATE_MIN_CHECK_INTERVAL_SECONDS",
		channelUpstreamModelUpdateMinCheckIntervalSeconds,
	))
	if interval < 0 {
		return channelUpstreamModelUpdateMinCheckIntervalSeconds
	}
	return interval
}

func fetchChannelUpstreamModelIDs(channel *model.Channel) ([]string, error) {
	baseURL := constant.ChannelBaseURLs[channel.Type]
	if channel.GetBaseURL() != "" {
		baseURL = channel.GetBaseURL()
	}

	if channel.Type == constant.ChannelTypeOllama {
		key := strings.TrimSpace(strings.Split(channel.Key, "\n")[0])
		models, err := ollama.FetchOllamaModels(baseURL, key)
		if err != nil {
			return nil, err
		}
		return normalizeModelNames(lo.Map(models, func(item ollama.OllamaModel, _ int) string {
			return item.Name
		})), nil
	}

	if channel.Type == constant.ChannelTypeGemini {
		key, _, apiErr := channel.GetNextEnabledKey()
		if apiErr != nil {
			return nil, fmt.Errorf("获取渠道密钥失败: %w", apiErr)
		}
		key = strings.TrimSpace(key)
		models, err := gemini.FetchGeminiModels(baseURL, key, channel.GetSetting().Proxy)
		if err != nil {
			return nil, err
		}
		return normalizeModelNames(models), nil
	}

	var url string
	switch channel.Type {
	case constant.ChannelTypeAli:
		url = fmt.Sprintf("%s/compatible-mode/v1/models", baseURL)
	case constant.ChannelTypeZhipu_v4:
		if plan, ok := constant.ChannelSpecialBases[baseURL]; ok && plan.OpenAIBaseURL != "" {
			url = fmt.Sprintf("%s/models", plan.OpenAIBaseURL)
		} else {
			url = fmt.Sprintf("%s/api/paas/v4/models", baseURL)
		}
	case constant.ChannelTypeVolcEngine:
		if plan, ok := constant.ChannelSpecialBases[baseURL]; ok && plan.OpenAIBaseURL != "" {
			url = fmt.Sprintf("%s/v1/models", plan.OpenAIBaseURL)
		} else {
			url = fmt.Sprintf("%s/v1/models", baseURL)
		}
	case constant.ChannelTypeMoonshot:
		if plan, ok := constant.ChannelSpecialBases[baseURL]; ok && plan.OpenAIBaseURL != "" {
			url = fmt.Sprintf("%s/models", plan.OpenAIBaseURL)
		} else {
			url = fmt.Sprintf("%s/v1/models", baseURL)
		}
	default:
		url = fmt.Sprintf("%s/v1/models", baseURL)
	}

	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return nil, fmt.Errorf("获取渠道密钥失败: %w", apiErr)
	}
	key = strings.TrimSpace(key)

	headers, err := buildFetchModelsHeaders(channel, key)
	if err != nil {
		return nil, err
	}

	body, err := GetResponseBody(http.MethodGet, url, channel, headers)
	if err != nil {
		return nil, err
	}

	var result OpenAIModelsResponse
	if err := common.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	ids := lo.Map(result.Data, func(item OpenAIModel, _ int) string {
		if channel.Type == constant.ChannelTypeGemini {
			return strings.TrimPrefix(item.ID, "models/")
		}
		return item.ID
	})

	return normalizeModelNames(ids), nil
}

func updateChannelUpstreamModelSettings(channel *model.Channel, settings dto.ChannelOtherSettings, updateModels bool) error {
	channel.SetOtherSettings(settings)
	updates := map[string]interface{}{
		"settings": channel.OtherSettings,
	}
	if updateModels {
		updates["models"] = channel.Models
	}
	return model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(updates).Error
}

func checkAndPersistChannelUpstreamModelUpdates(channel *model.Channel, settings *dto.ChannelOtherSettings, force bool) (modelsChanged bool, autoAdded int, err error) {
	now := common.GetTimestamp()
	if !force {
		minInterval := getUpstreamModelUpdateMinCheckIntervalSeconds()
		if settings.UpstreamModelUpdateLastCheckTime > 0 &&
			now-settings.UpstreamModelUpdateLastCheckTime < minInterval {
			return false, 0, nil
		}
	}

	pendingModels, fetchErr := collectPendingUpstreamModels(channel, *settings)
	settings.UpstreamModelUpdateLastCheckTime = now
	if fetchErr != nil {
		if err = updateChannelUpstreamModelSettings(channel, *settings, false); err != nil {
			return false, 0, err
		}
		return false, 0, fetchErr
	}

	if settings.UpstreamModelUpdateAutoSyncEnabled && len(pendingModels) > 0 {
		originModels := normalizeModelNames(channel.GetModels())
		mergedModels := mergeModelNames(originModels, pendingModels)
		if len(mergedModels) > len(originModels) {
			channel.Models = strings.Join(mergedModels, ",")
			autoAdded = len(mergedModels) - len(originModels)
			modelsChanged = true
		}
		settings.UpstreamModelUpdateLastDetectedModels = []string{}
	} else {
		settings.UpstreamModelUpdateLastDetectedModels = pendingModels
	}

	if err = updateChannelUpstreamModelSettings(channel, *settings, modelsChanged); err != nil {
		return false, autoAdded, err
	}
	if modelsChanged {
		if err = channel.UpdateAbilities(nil); err != nil {
			return true, autoAdded, err
		}
	}
	return modelsChanged, autoAdded, nil
}

func refreshChannelRuntimeCache() {
	if common.MemoryCacheEnabled {
		func() {
			defer func() {
				if r := recover(); r != nil {
					common.SysLog(fmt.Sprintf("InitChannelCache panic: %v", r))
				}
			}()
			model.InitChannelCache()
		}()
	}
	service.ResetProxyClientCache()
}

func runChannelUpstreamModelUpdateTaskOnce() {
	if !channelUpstreamModelUpdateTaskRunning.CompareAndSwap(false, true) {
		return
	}
	defer channelUpstreamModelUpdateTaskRunning.Store(false)

	checkedChannels := 0
	failedChannels := 0
	autoAddedModels := 0
	refreshNeeded := false

	offset := 0
	for {
		var channels []*model.Channel
		err := model.DB.
			Select("id", "name", "type", "key", "status", "base_url", "models", "settings", "setting", "other", "group", "priority", "weight", "tag", "channel_info", "header_override").
			Where("status = ?", common.ChannelStatusEnabled).
			Order("id asc").
			Limit(channelUpstreamModelUpdateTaskBatchSize).
			Offset(offset).
			Find(&channels).Error
		if err != nil {
			common.SysLog(fmt.Sprintf("upstream model update task query failed: %v", err))
			break
		}
		if len(channels) == 0 {
			break
		}
		offset += channelUpstreamModelUpdateTaskBatchSize

		for _, channel := range channels {
			if channel == nil {
				continue
			}

			settings := channel.GetOtherSettings()
			if !settings.UpstreamModelUpdateCheckEnabled {
				continue
			}

			checkedChannels++
			modelsChanged, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, false)
			if err != nil {
				failedChannels++
				common.SysLog(fmt.Sprintf("upstream model update check failed: channel_id=%d channel_name=%s err=%v", channel.Id, channel.Name, err))
				continue
			}
			if modelsChanged {
				refreshNeeded = true
			}
			autoAddedModels += autoAdded

			if common.RequestInterval > 0 {
				time.Sleep(common.RequestInterval)
			}
		}

		if len(channels) < channelUpstreamModelUpdateTaskBatchSize {
			break
		}
	}

	if refreshNeeded {
		refreshChannelRuntimeCache()
	}

	if checkedChannels > 0 || common.DebugEnabled {
		common.SysLog(fmt.Sprintf(
			"upstream model update task done: checked_channels=%d failed_channels=%d auto_added_models=%d",
			checkedChannels,
			failedChannels,
			autoAddedModels,
		))
	}
}

func StartChannelUpstreamModelUpdateTask() {
	channelUpstreamModelUpdateTaskOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		if !common.GetEnvOrDefaultBool("CHANNEL_UPSTREAM_MODEL_UPDATE_TASK_ENABLED", true) {
			common.SysLog("upstream model update task disabled by CHANNEL_UPSTREAM_MODEL_UPDATE_TASK_ENABLED")
			return
		}

		intervalMinutes := common.GetEnvOrDefault(
			"CHANNEL_UPSTREAM_MODEL_UPDATE_TASK_INTERVAL_MINUTES",
			channelUpstreamModelUpdateTaskDefaultIntervalMinutes,
		)
		if intervalMinutes < 1 {
			intervalMinutes = channelUpstreamModelUpdateTaskDefaultIntervalMinutes
		}
		interval := time.Duration(intervalMinutes) * time.Minute

		go func() {
			common.SysLog(fmt.Sprintf("upstream model update task started: interval=%s", interval))
			runChannelUpstreamModelUpdateTaskOnce()
			ticker := time.NewTicker(interval)
			defer ticker.Stop()
			for range ticker.C {
				runChannelUpstreamModelUpdateTaskOnce()
			}
		}()
	})
}

func ApplyChannelUpstreamModelUpdates(c *gin.Context) {
	var req applyChannelUpstreamModelUpdatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.ID <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid channel id",
		})
		return
	}

	channel, err := model.GetChannelById(req.ID, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	remainingModels, modelsChanged, err := applyChannelUpstreamModelUpdates(channel, req.AddModels, req.IgnoreModels)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if modelsChanged {
		refreshChannelRuntimeCache()
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"id":               channel.Id,
			"added_models":     normalizeModelNames(req.AddModels),
			"ignored_models":   normalizeModelNames(req.IgnoreModels),
			"remaining_models": remainingModels,
			"models":           channel.Models,
			"settings":         channel.OtherSettings,
		},
	})
}

func applyChannelUpstreamModelUpdates(channel *model.Channel, addModelsInput []string, ignoreModelsInput []string) (remainingModels []string, modelsChanged bool, err error) {
	settings := channel.GetOtherSettings()
	pendingModels := normalizeModelNames(settings.UpstreamModelUpdateLastDetectedModels)
	addModels := normalizeModelNames(addModelsInput)
	ignoreModels := normalizeModelNames(ignoreModelsInput)

	originModels := normalizeModelNames(channel.GetModels())
	mergedModels := mergeModelNames(originModels, addModels)
	modelsChanged = len(mergedModels) > len(originModels)
	if modelsChanged {
		channel.Models = strings.Join(mergedModels, ",")
	}

	settings.UpstreamModelUpdateIgnoredModels = mergeModelNames(settings.UpstreamModelUpdateIgnoredModels, ignoreModels)
	if len(addModels) > 0 {
		settings.UpstreamModelUpdateIgnoredModels = subtractModelNames(settings.UpstreamModelUpdateIgnoredModels, addModels)
	}
	remainingModels = subtractModelNames(pendingModels, append(addModels, ignoreModels...))
	settings.UpstreamModelUpdateLastDetectedModels = remainingModels
	settings.UpstreamModelUpdateLastCheckTime = common.GetTimestamp()

	if err := updateChannelUpstreamModelSettings(channel, settings, modelsChanged); err != nil {
		return nil, false, err
	}

	if modelsChanged {
		if err := channel.UpdateAbilities(nil); err != nil {
			return remainingModels, true, err
		}
	}
	return remainingModels, modelsChanged, nil
}

func ApplyAllChannelUpstreamModelUpdates(c *gin.Context) {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	results := make([]applyAllChannelUpstreamModelUpdatesResult, 0)
	failed := make([]int, 0)
	refreshNeeded := false
	addedModelCount := 0

	for _, channel := range channels {
		if channel == nil {
			continue
		}
		if channel.Status != common.ChannelStatusEnabled {
			continue
		}
		settings := channel.GetOtherSettings()
		if !settings.UpstreamModelUpdateCheckEnabled {
			continue
		}
		pendingModels := normalizeModelNames(settings.UpstreamModelUpdateLastDetectedModels)
		if len(pendingModels) == 0 {
			continue
		}

		remainingModels, modelsChanged, err := applyChannelUpstreamModelUpdates(channel, pendingModels, nil)
		if err != nil {
			failed = append(failed, channel.Id)
			continue
		}
		if modelsChanged {
			refreshNeeded = true
		}
		addedModelCount += len(pendingModels)
		results = append(results, applyAllChannelUpstreamModelUpdatesResult{
			ChannelID:       channel.Id,
			ChannelName:     channel.Name,
			AddedModels:     pendingModels,
			RemainingModels: remainingModels,
		})
	}

	if refreshNeeded {
		refreshChannelRuntimeCache()
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"processed_channels": len(results),
			"added_models":       addedModelCount,
			"failed_channel_ids": failed,
			"results":            results,
		},
	})
}
