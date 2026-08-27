package controller

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"regexp"
	"slices"
	"strings"
	"sync"
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
	"gorm.io/gorm"
)

const (
	channelUpstreamModelUpdateTaskDefaultIntervalMinutes  = 30
	channelUpstreamModelUpdateTaskBatchSize               = 100
	channelUpstreamModelUpdateMinCheckIntervalSeconds     = 300
	channelUpstreamModelUpdateNotifySuppressWindowSeconds = 86400
	channelUpstreamModelUpdateNotifyMaxChannelDetails     = 8
	channelUpstreamModelUpdateNotifyMaxModelDetails       = 12
	channelUpstreamModelUpdateNotifyMaxFailedChannelIDs   = 10
)

var channelUpstreamModelUpdateSelectFields = []string{
	"id",
	"name",
	"type",
	"key",
	"status",
	"base_url",
	"models",
	"model_mapping",
	"settings",
	"setting",
	"other",
	"group",
	"priority",
	"weight",
	"tag",
	"channel_info",
	"header_override",
}

var fetchChannelUpstreamModelIDsFn = fetchChannelUpstreamModelIDs

type channelUpstreamModelFetchFingerprint struct {
	Type               int
	Key                string
	EffectiveBaseURL   string
	Proxy              string
	HeaderOverride     string
	IsMultiKey         bool
	MultiKeySize       int
	MultiKeyStatusList map[int]int
	DisabledReason     map[int]string
	DisabledTime       map[int]int64
	MultiKeyMode       constant.MultiKeyMode
}

var channelUpstreamModelUpdateNotifyState = struct {
	sync.Mutex
	lastNotifiedAt      int64
	lastChangedChannels int
	lastFailedChannels  int
}{}

type applyChannelUpstreamModelUpdatesRequest struct {
	ID           int      `json:"id"`
	AddModels    []string `json:"add_models"`
	RemoveModels []string `json:"remove_models"`
	IgnoreModels []string `json:"ignore_models"`
}

type applyAllChannelUpstreamModelUpdatesResult struct {
	ChannelID             int      `json:"channel_id"`
	ChannelName           string   `json:"channel_name"`
	AddedModels           []string `json:"added_models"`
	RemovedModels         []string `json:"removed_models"`
	RemainingModels       []string `json:"remaining_models"`
	RemainingRemoveModels []string `json:"remaining_remove_models"`
}

type detectChannelUpstreamModelUpdatesResult struct {
	ChannelID       int      `json:"channel_id"`
	ChannelName     string   `json:"channel_name"`
	AddModels       []string `json:"add_models"`
	RemoveModels    []string `json:"remove_models"`
	LastCheckTime   int64    `json:"last_check_time"`
	AutoAddedModels int      `json:"auto_added_models"`
}

type upstreamModelUpdateChannelSummary struct {
	ChannelName string
	AddCount    int
	RemoveCount int
}

type appliedChannelUpstreamModelUpdates struct {
	AddedModels           []string
	RemovedModels         []string
	IgnoredModels         []string
	RemainingModels       []string
	RemainingRemoveModels []string
	ModelsChanged         bool
	MappingChanged        bool
	HadPending            bool
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

func intersectModelNames(base []string, allowed []string) []string {
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, model := range normalizeModelNames(allowed) {
		allowedSet[model] = struct{}{}
	}
	return lo.Filter(normalizeModelNames(base), func(model string, _ int) bool {
		_, ok := allowedSet[model]
		return ok
	})
}

func applySelectedModelChanges(originModels []string, addModels []string, removeModels []string) []string {
	// Add wins when the same model appears in both selected lists.
	normalizedAdd := normalizeModelNames(addModels)
	normalizedRemove := subtractModelNames(normalizeModelNames(removeModels), normalizedAdd)
	return subtractModelNames(mergeModelNames(originModels, normalizedAdd), normalizedRemove)
}

func normalizeChannelModelMapping(channel *model.Channel) (map[string]string, error) {
	if channel == nil || channel.ModelMapping == nil {
		return nil, nil
	}
	rawMapping := *channel.ModelMapping
	trimmedMapping := strings.TrimSpace(rawMapping)
	if trimmedMapping == "" || trimmedMapping == "{}" {
		return nil, nil
	}
	parsed := make(map[string]string)
	if err := common.UnmarshalJsonStr(rawMapping, &parsed); err != nil {
		return nil, fmt.Errorf("invalid model mapping: %w", err)
	}
	if err := validateResolvableChannelModelMapping(parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func validateResolvableChannelModelMapping(modelMapping map[string]string) error {
	if err := validateChannelModelMappingEntries(modelMapping); err != nil {
		return err
	}
	for source := range modelMapping {
		if _, err := resolveExactChannelModelTarget(source, modelMapping); err != nil {
			return err
		}
	}
	return nil
}

func resolveExactChannelModelTarget(modelName string, modelMapping map[string]string) (string, error) {
	if strings.TrimSpace(modelName) == "" {
		return "", model.ErrModelNameEmpty
	}

	currentModel := modelName
	visitedModels := map[string]bool{currentModel: true}
	for {
		mappedModel, exists := modelMapping[currentModel]
		if !exists {
			return currentModel, nil
		}
		if mappedModel == currentModel {
			return currentModel, nil
		}
		if visitedModels[mappedModel] {
			return "", model.ErrModelMappingCycle
		}
		visitedModels[mappedModel] = true
		currentModel = mappedModel
	}
}

func validateChannelModelMappingEntries(modelMapping map[string]string) error {
	for source, target := range modelMapping {
		if strings.TrimSpace(source) == "" {
			return model.ErrModelMappingSourceEmpty
		}
		if strings.TrimSpace(target) == "" {
			return model.ErrModelMappingTargetEmpty
		}
	}
	return nil
}

func parseChannelOtherSettings(channel *model.Channel) (dto.ChannelOtherSettings, error) {
	settings := dto.ChannelOtherSettings{}
	if channel == nil {
		return settings, fmt.Errorf("channel is nil")
	}
	if channel.OtherSettings == "" {
		return settings, nil
	}
	if err := common.UnmarshalJsonStr(channel.OtherSettings, &settings); err != nil {
		return dto.ChannelOtherSettings{}, fmt.Errorf("invalid channel other settings: %w", err)
	}
	return settings, nil
}

func collectPendingUpstreamModelChangesFromModels(
	localModels []string,
	upstreamModels []string,
	ignoredModels []string,
	modelMapping map[string]string,
) (pendingAddModels []string, pendingRemoveModels []string, err error) {
	if err := validateResolvableChannelModelMapping(modelMapping); err != nil {
		return nil, nil, err
	}
	localModels = normalizeModelNames(localModels)
	upstreamModels = normalizeModelNames(upstreamModels)
	upstreamSet := make(map[string]struct{}, len(upstreamModels))
	for _, modelName := range upstreamModels {
		upstreamSet[modelName] = struct{}{}
	}

	normalizedIgnoredModels := normalizeModelNames(ignoredModels)
	coveredUpstreamSet := make(map[string]struct{}, len(localModels))
	for _, modelName := range localModels {
		terminalTarget, resolveErr := resolveExactChannelModelTarget(modelName, modelMapping)
		if resolveErr != nil {
			return nil, nil, resolveErr
		}
		coveredUpstreamSet[terminalTarget] = struct{}{}
		if _, ok := upstreamSet[terminalTarget]; !ok {
			pendingRemoveModels = append(pendingRemoveModels, modelName)
		}
	}

	pendingAdd := lo.Filter(upstreamModels, func(modelName string, _ int) bool {
		if _, ok := coveredUpstreamSet[modelName]; ok {
			return false
		}
		if lo.ContainsBy(normalizedIgnoredModels, func(ignoredModel string) bool {
			if regexBody, ok := strings.CutPrefix(ignoredModel, "regex:"); ok {
				matched, err := regexp.MatchString(strings.TrimSpace(regexBody), modelName)
				return err == nil && matched
			}
			return ignoredModel == modelName
		}) {
			return false
		}
		return true
	})
	return normalizeModelNames(pendingAdd), normalizeModelNames(pendingRemoveModels), nil
}

func rejectSameNameModelMappingReplacement(pendingAddModels []string, pendingRemoveModels []string) error {
	conflictingModels := intersectModelNames(pendingAddModels, pendingRemoveModels)
	if len(conflictingModels) == 0 {
		return nil
	}
	return fmt.Errorf(
		"%w: canonical model %q is pending both addition and removal",
		model.ErrModelMappingConflict,
		conflictingModels[0],
	)
}

func collectPendingUpstreamModelChanges(channel *model.Channel, settings dto.ChannelOtherSettings) (pendingAddModels []string, pendingRemoveModels []string, err error) {
	upstreamModels, err := fetchChannelUpstreamModelIDs(channel)
	if err != nil {
		return nil, nil, err
	}
	modelMapping, err := normalizeChannelModelMapping(channel)
	if err != nil {
		return nil, nil, err
	}
	pendingAddModels, pendingRemoveModels, err = collectPendingUpstreamModelChangesFromModels(
		channel.GetModels(),
		upstreamModels,
		settings.UpstreamModelUpdateIgnoredModels,
		modelMapping,
	)
	return pendingAddModels, pendingRemoveModels, err
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

func selectChannelUpstreamModelDiscoveryKey(channel *model.Channel) (string, error) {
	if channel == nil {
		return "", fmt.Errorf("channel is nil")
	}
	if !channel.ChannelInfo.IsMultiKey {
		return channel.Key, nil
	}

	keys := channel.GetKeys()
	if len(keys) == 0 {
		return "", fmt.Errorf("no keys available")
	}
	start := 0
	if channel.ChannelInfo.MultiKeyMode == constant.MultiKeyModePolling {
		start = channel.ChannelInfo.MultiKeyPollingIndex
		if start < 0 || start >= len(keys) {
			start = 0
		}
	}
	for offset := 0; offset < len(keys); offset++ {
		index := (start + offset) % len(keys)
		status := common.ChannelStatusEnabled
		if configuredStatus, ok := channel.ChannelInfo.MultiKeyStatusList[index]; ok {
			status = configuredStatus
		}
		if status == common.ChannelStatusEnabled {
			return keys[index], nil
		}
	}
	return "", fmt.Errorf("no enabled keys")
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
		key, keyErr := selectChannelUpstreamModelDiscoveryKey(channel)
		if keyErr != nil {
			return nil, fmt.Errorf("获取渠道密钥失败: %w", keyErr)
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

	key, keyErr := selectChannelUpstreamModelDiscoveryKey(channel)
	if keyErr != nil {
		return nil, fmt.Errorf("获取渠道密钥失败: %w", keyErr)
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

func buildChannelUpstreamModelFetchFingerprint(channel *model.Channel) (channelUpstreamModelFetchFingerprint, error) {
	if channel == nil {
		return channelUpstreamModelFetchFingerprint{}, fmt.Errorf("channel is nil")
	}

	setting := dto.ChannelSettings{}
	if channel.Setting != nil && strings.TrimSpace(*channel.Setting) != "" {
		if err := common.UnmarshalJsonStr(*channel.Setting, &setting); err != nil {
			return channelUpstreamModelFetchFingerprint{}, fmt.Errorf("invalid channel setting: %w", err)
		}
	}

	effectiveBaseURL := constant.ChannelBaseURLs[channel.Type]
	if channel.GetBaseURL() != "" {
		effectiveBaseURL = channel.GetBaseURL()
	}
	headerOverride := ""
	if channel.HeaderOverride != nil {
		headerOverride = *channel.HeaderOverride
	}

	statusList := make(map[int]int, len(channel.ChannelInfo.MultiKeyStatusList))
	for index, status := range channel.ChannelInfo.MultiKeyStatusList {
		statusList[index] = status
	}
	disabledReason := make(map[int]string, len(channel.ChannelInfo.MultiKeyDisabledReason))
	for index, reason := range channel.ChannelInfo.MultiKeyDisabledReason {
		disabledReason[index] = reason
	}
	disabledTime := make(map[int]int64, len(channel.ChannelInfo.MultiKeyDisabledTime))
	for index, disabledAt := range channel.ChannelInfo.MultiKeyDisabledTime {
		disabledTime[index] = disabledAt
	}

	return channelUpstreamModelFetchFingerprint{
		Type:               channel.Type,
		Key:                channel.Key,
		EffectiveBaseURL:   effectiveBaseURL,
		Proxy:              setting.Proxy,
		HeaderOverride:     headerOverride,
		IsMultiKey:         channel.ChannelInfo.IsMultiKey,
		MultiKeySize:       channel.ChannelInfo.MultiKeySize,
		MultiKeyStatusList: statusList,
		DisabledReason:     disabledReason,
		DisabledTime:       disabledTime,
		MultiKeyMode:       channel.ChannelInfo.MultiKeyMode,
	}, nil
}

func persistChannelUpstreamModelState(
	tx *gorm.DB,
	channel *model.Channel,
	settings dto.ChannelOtherSettings,
	configChanged bool,
) error {
	channel.SetOtherSettings(settings)
	updates := map[string]interface{}{
		"settings": channel.OtherSettings,
	}
	if configChanged {
		updates["models"] = channel.Models
		updates["model_mapping"] = channel.ModelMapping
	}
	if err := tx.Model(&model.Channel{}).Where("id = ?", channel.Id).Updates(updates).Error; err != nil {
		return err
	}
	if configChanged {
		return channel.UpdateAbilities(tx)
	}
	return nil
}

func checkAndPersistChannelUpstreamModelUpdates(
	channel *model.Channel,
	settings *dto.ChannelOtherSettings,
	force bool,
	allowAutoApply bool,
	requireEnabled bool,
) (configChanged bool, autoAdded int, err error) {
	now := common.GetTimestamp()
	if !force {
		minInterval := getUpstreamModelUpdateMinCheckIntervalSeconds()
		if settings.UpstreamModelUpdateLastCheckTime > 0 &&
			now-settings.UpstreamModelUpdateLastCheckTime < minInterval {
			return false, 0, nil
		}
	}

	fetchFingerprint, err := buildChannelUpstreamModelFetchFingerprint(channel)
	if err != nil {
		return false, 0, err
	}
	upstreamModels, fetchErr := fetchChannelUpstreamModelIDsFn(channel)

	var freshChannel *model.Channel
	var freshSettings dto.ChannelOtherSettings
	freshCheckDisabled := false
	persistErr := model.DB.Transaction(func(tx *gorm.DB) error {
		freshChannel, err = model.GetChannelByIdForUpdate(tx, channel.Id)
		if err != nil {
			return err
		}
		freshFingerprint, fingerprintErr := buildChannelUpstreamModelFetchFingerprint(freshChannel)
		if fingerprintErr != nil {
			return fingerprintErr
		}
		if !reflect.DeepEqual(fetchFingerprint, freshFingerprint) {
			return fmt.Errorf("channel fetch configuration changed during upstream model discovery")
		}
		if requireEnabled && freshChannel.Status != common.ChannelStatusEnabled {
			freshCheckDisabled = true
			return nil
		}

		freshSettings, err = parseChannelOtherSettings(freshChannel)
		if err != nil {
			return err
		}
		if !force {
			if !freshSettings.UpstreamModelUpdateCheckEnabled {
				freshCheckDisabled = true
				return nil
			}
			minInterval := getUpstreamModelUpdateMinCheckIntervalSeconds()
			if freshSettings.UpstreamModelUpdateLastCheckTime > 0 &&
				now-freshSettings.UpstreamModelUpdateLastCheckTime < minInterval {
				return nil
			}
		}
		freshSettings.UpstreamModelUpdateLastCheckTime = now
		if fetchErr != nil {
			return persistChannelUpstreamModelState(tx, freshChannel, freshSettings, false)
		}

		modelMapping, mappingErr := normalizeChannelModelMapping(freshChannel)
		if mappingErr != nil {
			return mappingErr
		}
		pendingAddModels, pendingRemoveModels, collectErr := collectPendingUpstreamModelChangesFromModels(
			freshChannel.GetModels(),
			upstreamModels,
			freshSettings.UpstreamModelUpdateIgnoredModels,
			modelMapping,
		)
		if collectErr != nil {
			return collectErr
		}

		if allowAutoApply && freshSettings.UpstreamModelUpdateAutoSyncEnabled && len(pendingAddModels) > 0 {
			if conflictErr := rejectSameNameModelMappingReplacement(pendingAddModels, pendingRemoveModels); conflictErr != nil {
				return conflictErr
			}
			originModels := normalizeModelNames(freshChannel.GetModels())
			freshChannel.Models = strings.Join(mergeModelNames(originModels, pendingAddModels), ",")
			if canonicalizeErr := freshChannel.CanonicalizeModelConfig(); canonicalizeErr != nil {
				return canonicalizeErr
			}
			nextModels := normalizeModelNames(freshChannel.GetModels())
			modelsChanged := !slices.Equal(originModels, nextModels)
			nextModelMapping, mappingErr := normalizeChannelModelMapping(freshChannel)
			if mappingErr != nil {
				return mappingErr
			}
			mappingChanged := !reflect.DeepEqual(modelMapping, nextModelMapping)
			configChanged = modelsChanged || mappingChanged
			if modelsChanged {
				autoAdded = len(nextModels) - len(originModels)
			}
			freshSettings.UpstreamModelUpdateLastDetectedModels = []string{}
		} else {
			freshSettings.UpstreamModelUpdateLastDetectedModels = pendingAddModels
		}
		freshSettings.UpstreamModelUpdateLastRemovedModels = pendingRemoveModels
		return persistChannelUpstreamModelState(tx, freshChannel, freshSettings, configChanged)
	})
	if persistErr != nil {
		return false, 0, persistErr
	}
	if freshChannel != nil {
		*channel = *freshChannel
		*settings = freshSettings
	}
	if freshCheckDisabled {
		return false, 0, nil
	}
	if fetchErr != nil {
		return false, 0, fetchErr
	}
	return configChanged, autoAdded, nil
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

func shouldSendUpstreamModelUpdateNotification(now int64, changedChannels int, failedChannels int) bool {
	if changedChannels <= 0 && failedChannels <= 0 {
		return true
	}

	channelUpstreamModelUpdateNotifyState.Lock()
	defer channelUpstreamModelUpdateNotifyState.Unlock()

	if channelUpstreamModelUpdateNotifyState.lastNotifiedAt > 0 &&
		now-channelUpstreamModelUpdateNotifyState.lastNotifiedAt < channelUpstreamModelUpdateNotifySuppressWindowSeconds &&
		channelUpstreamModelUpdateNotifyState.lastChangedChannels == changedChannels &&
		channelUpstreamModelUpdateNotifyState.lastFailedChannels == failedChannels {
		return false
	}

	channelUpstreamModelUpdateNotifyState.lastNotifiedAt = now
	channelUpstreamModelUpdateNotifyState.lastChangedChannels = changedChannels
	channelUpstreamModelUpdateNotifyState.lastFailedChannels = failedChannels
	return true
}

func buildUpstreamModelUpdateTaskNotificationContent(
	checkedChannels int,
	changedChannels int,
	detectedAddModels int,
	detectedRemoveModels int,
	autoAddedModels int,
	failedChannelIDs []int,
	channelSummaries []upstreamModelUpdateChannelSummary,
	addModelSamples []string,
	removeModelSamples []string,
) string {
	var builder strings.Builder
	failedChannels := len(failedChannelIDs)
	builder.WriteString(fmt.Sprintf(
		"上游模型巡检摘要：检测渠道 %d 个，发现变更 %d 个，新增 %d 个，删除 %d 个，自动同步新增 %d 个，失败 %d 个。",
		checkedChannels,
		changedChannels,
		detectedAddModels,
		detectedRemoveModels,
		autoAddedModels,
		failedChannels,
	))

	if len(channelSummaries) > 0 {
		displayCount := min(len(channelSummaries), channelUpstreamModelUpdateNotifyMaxChannelDetails)
		builder.WriteString(fmt.Sprintf("\n\n变更渠道明细（展示 %d/%d）：", displayCount, len(channelSummaries)))
		for _, summary := range channelSummaries[:displayCount] {
			builder.WriteString(fmt.Sprintf("\n- %s (+%d / -%d)", summary.ChannelName, summary.AddCount, summary.RemoveCount))
		}
		if len(channelSummaries) > displayCount {
			builder.WriteString(fmt.Sprintf("\n- 其余 %d 个渠道已省略", len(channelSummaries)-displayCount))
		}
	}

	normalizedAddModelSamples := normalizeModelNames(addModelSamples)
	if len(normalizedAddModelSamples) > 0 {
		displayCount := min(len(normalizedAddModelSamples), channelUpstreamModelUpdateNotifyMaxModelDetails)
		builder.WriteString(fmt.Sprintf("\n\n新增模型示例（展示 %d/%d）：%s",
			displayCount,
			len(normalizedAddModelSamples),
			strings.Join(normalizedAddModelSamples[:displayCount], ", "),
		))
		if len(normalizedAddModelSamples) > displayCount {
			builder.WriteString(fmt.Sprintf("（其余 %d 个已省略）", len(normalizedAddModelSamples)-displayCount))
		}
	}

	normalizedRemoveModelSamples := normalizeModelNames(removeModelSamples)
	if len(normalizedRemoveModelSamples) > 0 {
		displayCount := min(len(normalizedRemoveModelSamples), channelUpstreamModelUpdateNotifyMaxModelDetails)
		builder.WriteString(fmt.Sprintf("\n\n删除模型示例（展示 %d/%d）：%s",
			displayCount,
			len(normalizedRemoveModelSamples),
			strings.Join(normalizedRemoveModelSamples[:displayCount], ", "),
		))
		if len(normalizedRemoveModelSamples) > displayCount {
			builder.WriteString(fmt.Sprintf("（其余 %d 个已省略）", len(normalizedRemoveModelSamples)-displayCount))
		}
	}

	if failedChannels > 0 {
		displayCount := min(failedChannels, channelUpstreamModelUpdateNotifyMaxFailedChannelIDs)
		displayIDs := lo.Map(failedChannelIDs[:displayCount], func(channelID int, _ int) string {
			return fmt.Sprintf("%d", channelID)
		})
		builder.WriteString(fmt.Sprintf(
			"\n\n失败渠道 ID（展示 %d/%d）：%s",
			displayCount,
			failedChannels,
			strings.Join(displayIDs, ", "),
		))
		if failedChannels > displayCount {
			builder.WriteString(fmt.Sprintf("（其余 %d 个已省略）", failedChannels-displayCount))
		}
	}
	return builder.String()
}

type upstreamModelUpdateSummary struct {
	CheckedChannels      int `json:"checked_channels"`
	ChangedChannels      int `json:"changed_channels"`
	DetectedAddModels    int `json:"detected_add_models"`
	DetectedRemoveModels int `json:"detected_remove_models"`
	FailedChannels       int `json:"failed_channels"`
	AutoAddedModels      int `json:"auto_added_models"`
}

// runChannelUpstreamModelUpdateTaskOnce runs one synchronous upstream model
// detection cycle and returns a summary for system task history. It honors ctx
// cancellation between batches so a runner that loses its lease stops promptly.
// force bypasses the per-channel minimum check interval and allowAutoApply lets
// channels with auto-sync enabled adopt detected models automatically. The
// scheduled job calls (force=false, allowAutoApply=true); the manual "detect
// all" trigger calls (force=true, allowAutoApply=false) so it always re-checks
// and only stages changes for explicit review.
func runChannelUpstreamModelUpdateTaskOnce(ctx context.Context, force bool, allowAutoApply bool, report func(processed, total int)) upstreamModelUpdateSummary {
	checkedChannels := 0
	failedChannels := 0
	failedChannelIDs := make([]int, 0)
	changedChannels := 0
	detectedAddModels := 0
	detectedRemoveModels := 0
	autoAddedModels := 0
	channelSummaries := make([]upstreamModelUpdateChannelSummary, 0)
	addModelSamples := make([]string, 0)
	removeModelSamples := make([]string, 0)
	refreshNeeded := false

	// Count the enabled channels up front so progress can be reported as a
	// percentage; a count error is non-fatal (progress just won't show a %).
	var totalChannels int64
	if err := model.DB.Model(&model.Channel{}).Where("status = ?", common.ChannelStatusEnabled).Count(&totalChannels).Error; err != nil {
		totalChannels = 0
	}
	processed := 0

	lastID := 0
scanLoop:
	for {
		if ctx != nil && ctx.Err() != nil {
			break
		}
		var channels []*model.Channel
		query := model.DB.
			Select(channelUpstreamModelUpdateSelectFields).
			Where("status = ?", common.ChannelStatusEnabled).
			Order("id asc").
			Limit(channelUpstreamModelUpdateTaskBatchSize)
		if lastID > 0 {
			query = query.Where("id > ?", lastID)
		}
		err := query.Find(&channels).Error
		if err != nil {
			common.SysLog(fmt.Sprintf("upstream model update task query failed: %v", err))
			break
		}
		if len(channels) == 0 {
			break
		}
		lastID = channels[len(channels)-1].Id

		for _, channel := range channels {
			if channel == nil {
				continue
			}
			if ctx != nil && ctx.Err() != nil {
				break scanLoop
			}

			processed++
			if report != nil {
				report(processed, int(totalChannels))
			}

			settings, settingsErr := parseChannelOtherSettings(channel)
			if settingsErr != nil {
				failedChannels++
				failedChannelIDs = append(failedChannelIDs, channel.Id)
				common.SysLog(fmt.Sprintf("upstream model update settings invalid: channel_id=%d channel_name=%s err=%v", channel.Id, channel.Name, settingsErr))
				continue
			}
			if !settings.UpstreamModelUpdateCheckEnabled {
				continue
			}

			checkedChannels++
			configChanged, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, force, allowAutoApply, true)
			if err != nil {
				failedChannels++
				failedChannelIDs = append(failedChannelIDs, channel.Id)
				common.SysLog(fmt.Sprintf("upstream model update check failed: channel_id=%d channel_name=%s err=%v", channel.Id, channel.Name, err))
				continue
			}
			currentAddModels := normalizeModelNames(settings.UpstreamModelUpdateLastDetectedModels)
			currentRemoveModels := normalizeModelNames(settings.UpstreamModelUpdateLastRemovedModels)
			currentAddCount := len(currentAddModels) + autoAdded
			currentRemoveCount := len(currentRemoveModels)
			detectedAddModels += currentAddCount
			detectedRemoveModels += currentRemoveCount
			if currentAddCount > 0 || currentRemoveCount > 0 {
				changedChannels++
				channelSummaries = append(channelSummaries, upstreamModelUpdateChannelSummary{
					ChannelName: channel.Name,
					AddCount:    currentAddCount,
					RemoveCount: currentRemoveCount,
				})
			}
			addModelSamples = mergeModelNames(addModelSamples, currentAddModels)
			removeModelSamples = mergeModelNames(removeModelSamples, currentRemoveModels)
			if configChanged {
				refreshNeeded = true
			}
			autoAddedModels += autoAdded

			if common.RequestInterval > 0 {
				if ctx == nil {
					time.Sleep(common.RequestInterval)
				} else {
					select {
					case <-ctx.Done():
						break scanLoop
					case <-time.After(common.RequestInterval):
					}
				}
			}
		}

		if len(channels) < channelUpstreamModelUpdateTaskBatchSize {
			break
		}
	}

	if report != nil && (ctx == nil || ctx.Err() == nil) {
		report(int(totalChannels), int(totalChannels)) // mark complete only when the full scan finished
	}

	if refreshNeeded {
		refreshChannelRuntimeCache()
	}

	summary := upstreamModelUpdateSummary{
		CheckedChannels:      checkedChannels,
		ChangedChannels:      changedChannels,
		DetectedAddModels:    detectedAddModels,
		DetectedRemoveModels: detectedRemoveModels,
		FailedChannels:       failedChannels,
		AutoAddedModels:      autoAddedModels,
	}

	if checkedChannels > 0 || common.DebugEnabled {
		common.SysLog(fmt.Sprintf(
			"upstream model update task done: checked_channels=%d changed_channels=%d detected_add_models=%d detected_remove_models=%d failed_channels=%d auto_added_models=%d",
			checkedChannels,
			changedChannels,
			detectedAddModels,
			detectedRemoveModels,
			failedChannels,
			autoAddedModels,
		))
	}
	if changedChannels > 0 || failedChannels > 0 {
		now := common.GetTimestamp()
		if !shouldSendUpstreamModelUpdateNotification(now, changedChannels, failedChannels) {
			common.SysLog(fmt.Sprintf(
				"upstream model update notification skipped in 24h window: changed_channels=%d failed_channels=%d",
				changedChannels,
				failedChannels,
			))
			return summary
		}
		service.NotifyUpstreamModelUpdateWatchers(
			"上游模型巡检通知",
			buildUpstreamModelUpdateTaskNotificationContent(
				checkedChannels,
				changedChannels,
				detectedAddModels,
				detectedRemoveModels,
				autoAddedModels,
				failedChannelIDs,
				channelSummaries,
				addModelSamples,
				removeModelSamples,
			),
		)
	}
	return summary
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
	result, err := applyChannelUpstreamModelUpdatesWithMode(
		channel,
		req.AddModels,
		req.IgnoreModels,
		req.RemoveModels,
		false,
		false,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if result.ModelsChanged || result.MappingChanged {
		refreshChannelRuntimeCache()
	}

	recordManageAudit(c, "channel.upstream_apply", map[string]interface{}{
		"id": channel.Id,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"id":                      channel.Id,
			"added_models":            result.AddedModels,
			"removed_models":          result.RemovedModels,
			"ignored_models":          result.IgnoredModels,
			"remaining_models":        result.RemainingModels,
			"remaining_remove_models": result.RemainingRemoveModels,
			"models":                  channel.Models,
			"settings":                channel.OtherSettings,
		},
	})
}

func DetectChannelUpstreamModelUpdates(c *gin.Context) {
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

	settings, err := parseChannelOtherSettings(channel)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	configChanged, autoAdded, err := checkAndPersistChannelUpstreamModelUpdates(channel, &settings, true, false, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if configChanged {
		refreshChannelRuntimeCache()
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": detectChannelUpstreamModelUpdatesResult{
			ChannelID:       channel.Id,
			ChannelName:     channel.Name,
			AddModels:       normalizeModelNames(settings.UpstreamModelUpdateLastDetectedModels),
			RemoveModels:    normalizeModelNames(settings.UpstreamModelUpdateLastRemovedModels),
			LastCheckTime:   settings.UpstreamModelUpdateLastCheckTime,
			AutoAddedModels: autoAdded,
		},
	})
}

func applyChannelUpstreamModelUpdates(
	channel *model.Channel,
	addModelsInput []string,
	ignoreModelsInput []string,
	removeModelsInput []string,
) (
	addedModels []string,
	removedModels []string,
	remainingModels []string,
	remainingRemoveModels []string,
	modelsChanged bool,
	err error,
) {
	result, err := applyChannelUpstreamModelUpdatesWithMode(
		channel,
		addModelsInput,
		ignoreModelsInput,
		removeModelsInput,
		false,
		false,
	)
	return result.AddedModels,
		result.RemovedModels,
		result.RemainingModels,
		result.RemainingRemoveModels,
		result.ModelsChanged,
		err
}

func applyChannelUpstreamModelUpdatesWithMode(
	channel *model.Channel,
	addModelsInput []string,
	ignoreModelsInput []string,
	removeModelsInput []string,
	applyAll bool,
	requireCheckEnabled bool,
) (result appliedChannelUpstreamModelUpdates, err error) {
	if _, err = parseChannelOtherSettings(channel); err != nil {
		return result, err
	}
	fetchFingerprint, err := buildChannelUpstreamModelFetchFingerprint(channel)
	if err != nil {
		return result, err
	}
	upstreamModels, err := fetchChannelUpstreamModelIDsFn(channel)
	if err != nil {
		return result, err
	}

	var freshChannel *model.Channel
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		freshChannel, err = model.GetChannelByIdForUpdate(tx, channel.Id)
		if err != nil {
			return err
		}
		freshFingerprint, fingerprintErr := buildChannelUpstreamModelFetchFingerprint(freshChannel)
		if fingerprintErr != nil {
			return fingerprintErr
		}
		if !reflect.DeepEqual(fetchFingerprint, freshFingerprint) {
			return fmt.Errorf("channel fetch configuration changed during upstream model discovery")
		}
		if requireCheckEnabled && freshChannel.Status != common.ChannelStatusEnabled {
			return nil
		}

		settings, settingsErr := parseChannelOtherSettings(freshChannel)
		if settingsErr != nil {
			return settingsErr
		}
		if requireCheckEnabled && !settings.UpstreamModelUpdateCheckEnabled {
			return nil
		}
		modelMapping, mappingErr := normalizeChannelModelMapping(freshChannel)
		if mappingErr != nil {
			return mappingErr
		}
		pendingAddModels, pendingRemoveModels, collectErr := collectPendingUpstreamModelChangesFromModels(
			freshChannel.GetModels(),
			upstreamModels,
			settings.UpstreamModelUpdateIgnoredModels,
			modelMapping,
		)
		if collectErr != nil {
			return collectErr
		}
		if conflictErr := rejectSameNameModelMappingReplacement(pendingAddModels, pendingRemoveModels); conflictErr != nil {
			return conflictErr
		}
		result.HadPending = len(pendingAddModels) > 0 || len(pendingRemoveModels) > 0
		if applyAll {
			result.AddedModels = pendingAddModels
			result.RemovedModels = pendingRemoveModels
		} else {
			result.AddedModels = intersectModelNames(addModelsInput, pendingAddModels)
			result.IgnoredModels = intersectModelNames(ignoreModelsInput, pendingAddModels)
			result.RemovedModels = intersectModelNames(removeModelsInput, pendingRemoveModels)
		}
		result.RemovedModels = subtractModelNames(result.RemovedModels, result.AddedModels)

		originModels := normalizeModelNames(freshChannel.GetModels())
		nextModels := applySelectedModelChanges(originModels, result.AddedModels, result.RemovedModels)
		if !slices.Equal(originModels, nextModels) {
			freshChannel.Models = strings.Join(nextModels, ",")
			if canonicalizeErr := freshChannel.CanonicalizeModelConfig(); canonicalizeErr != nil {
				return canonicalizeErr
			}
			nextModels = normalizeModelNames(freshChannel.GetModels())
		}
		result.ModelsChanged = !slices.Equal(originModels, nextModels)
		nextModelMapping, mappingErr := normalizeChannelModelMapping(freshChannel)
		if mappingErr != nil {
			return mappingErr
		}
		result.MappingChanged = !reflect.DeepEqual(modelMapping, nextModelMapping)

		settings.UpstreamModelUpdateIgnoredModels = mergeModelNames(settings.UpstreamModelUpdateIgnoredModels, result.IgnoredModels)
		if len(result.AddedModels) > 0 {
			settings.UpstreamModelUpdateIgnoredModels = subtractModelNames(settings.UpstreamModelUpdateIgnoredModels, result.AddedModels)
		}
		result.RemainingModels = subtractModelNames(pendingAddModels, append(result.AddedModels, result.IgnoredModels...))
		result.RemainingRemoveModels = subtractModelNames(pendingRemoveModels, result.RemovedModels)
		settings.UpstreamModelUpdateLastDetectedModels = result.RemainingModels
		settings.UpstreamModelUpdateLastRemovedModels = result.RemainingRemoveModels
		settings.UpstreamModelUpdateLastCheckTime = common.GetTimestamp()

		return persistChannelUpstreamModelState(tx, freshChannel, settings, result.ModelsChanged || result.MappingChanged)
	})
	if err != nil {
		return result, err
	}
	*channel = *freshChannel
	return result, nil
}

func collectPendingApplyUpstreamModelChanges(settings dto.ChannelOtherSettings) (pendingAddModels []string, pendingRemoveModels []string) {
	return normalizeModelNames(settings.UpstreamModelUpdateLastDetectedModels), normalizeModelNames(settings.UpstreamModelUpdateLastRemovedModels)
}

func findEnabledChannelsAfterID(lastID int, batchSize int) ([]*model.Channel, error) {
	var channels []*model.Channel
	query := model.DB.
		Select(channelUpstreamModelUpdateSelectFields).
		Where("status = ?", common.ChannelStatusEnabled).
		Order("id asc").
		Limit(batchSize)
	if lastID > 0 {
		query = query.Where("id > ?", lastID)
	}
	return channels, query.Find(&channels).Error
}

func ApplyAllChannelUpstreamModelUpdates(c *gin.Context) {
	results := make([]applyAllChannelUpstreamModelUpdatesResult, 0)
	failed := make([]int, 0)
	refreshNeeded := false
	addedModelCount := 0
	removedModelCount := 0

	lastID := 0
	for {
		channels, err := findEnabledChannelsAfterID(lastID, channelUpstreamModelUpdateTaskBatchSize)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if len(channels) == 0 {
			break
		}
		lastID = channels[len(channels)-1].Id

		for _, channel := range channels {
			if channel == nil {
				continue
			}

			settings, settingsErr := parseChannelOtherSettings(channel)
			if settingsErr != nil {
				failed = append(failed, channel.Id)
				continue
			}
			if !settings.UpstreamModelUpdateCheckEnabled {
				continue
			}

			result, err := applyChannelUpstreamModelUpdatesWithMode(
				channel,
				nil,
				nil,
				nil,
				true,
				true,
			)
			if err != nil {
				failed = append(failed, channel.Id)
				continue
			}
			if !result.HadPending {
				continue
			}
			if result.ModelsChanged || result.MappingChanged {
				refreshNeeded = true
			}
			addedModelCount += len(result.AddedModels)
			removedModelCount += len(result.RemovedModels)
			results = append(results, applyAllChannelUpstreamModelUpdatesResult{
				ChannelID:             channel.Id,
				ChannelName:           channel.Name,
				AddedModels:           result.AddedModels,
				RemovedModels:         result.RemovedModels,
				RemainingModels:       result.RemainingModels,
				RemainingRemoveModels: result.RemainingRemoveModels,
			})
		}

		if len(channels) < channelUpstreamModelUpdateTaskBatchSize {
			break
		}
	}

	if refreshNeeded {
		refreshChannelRuntimeCache()
	}

	recordManageAudit(c, "channel.upstream_apply_all", map[string]interface{}{
		"count": len(results),
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"processed_channels": len(results),
			"added_models":       addedModelCount,
			"removed_models":     removedModelCount,
			"failed_channel_ids": failed,
			"results":            results,
		},
	})
}

// DetectAllChannelUpstreamModelUpdates enqueues a model_update system task
// (manual variant) instead of scanning inline. Routing the manual trigger
// through the framework gives it the same cross-instance lease dedup and run
// history as the scheduled scan. If any model_update task is already active, the
// manual run is rejected so the caller does not mistake a scheduled run for this
// manual one.
func DetectAllChannelUpstreamModelUpdates(c *gin.Context) {
	task, created, err := service.EnqueueSystemTask(model.SystemTaskTypeModelUpdate, modelUpdateTaskPayload{Manual: true})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !created {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"message": "已有模型更新任务正在运行或等待中，不能启动本次手动任务",
			"data": gin.H{
				"task_id": task.TaskID,
				"status":  task.Status,
				"type":    task.Type,
			},
		})
		return
	}

	recordManageAudit(c, "channel.upstream_detect_all", map[string]interface{}{
		"task_id": task.TaskID,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"task_id": task.TaskID,
			"status":  task.Status,
		},
	})
}
