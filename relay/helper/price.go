package helper

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// https://docs.claude.com/en/docs/build-with-claude/prompt-caching#1-hour-cache-duration
const claudeCacheCreation1hMultiplier = 6 / 3.75

func normalizeResolutionPriceKey(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func extractResolutionKeyFromTaskRequest(req relaycommon.TaskSubmitReq) string {
	candidates := []string{
		req.Quality,
		req.ResolutionName,
		common.Interface2String(req.Metadata["output_resolution"]),
		common.Interface2String(req.Metadata["resolution"]),
		common.Interface2String(req.Metadata["resolution_name"]),
		common.Interface2String(req.Metadata["quality"]),
	}
	for _, candidate := range candidates {
		if key := normalizeResolutionPriceKey(candidate); key != "" {
			return key
		}
	}
	return ""
}

func extractResolutionKeyFromRequest(request dto.Request) string {
	switch req := request.(type) {
	case *dto.GeneralOpenAIRequest:
		candidates := []string{
			req.OutputResolution,
			req.Resolution,
		}
		if req.Quality != nil {
			candidates = append(candidates, *req.Quality)
		}
		for _, candidate := range candidates {
			if key := normalizeResolutionPriceKey(candidate); key != "" {
				return key
			}
		}
	case *dto.ImageRequest:
		for _, candidate := range []string{req.OutputResolution, req.Quality} {
			if key := normalizeResolutionPriceKey(candidate); key != "" {
				return key
			}
		}
	}
	return ""
}

func extractPositiveIntValue(value any) (int, bool) {
	switch v := value.(type) {
	case int:
		if v > 0 {
			return v, true
		}
	case int64:
		if v > 0 {
			return int(v), true
		}
	case float64:
		if v > 0 {
			return int(v), true
		}
	case string:
		if parsed, err := strconv.Atoi(strings.TrimSpace(v)); err == nil && parsed > 0 {
			return parsed, true
		}
	}
	return 0, false
}

func extractSecondsFromRequestMetadata(metadata []byte) (int, bool) {
	if len(metadata) == 0 {
		return 0, false
	}
	var metadataMap map[string]any
	if err := common.Unmarshal(metadata, &metadataMap); err != nil {
		return 0, false
	}
	for _, key := range []string{"durationSeconds", "duration_seconds", "duration", "seconds"} {
		if seconds, ok := extractPositiveIntValue(metadataMap[key]); ok {
			return seconds, true
		}
	}
	return 0, false
}

func extractSecondsFromRequest(request dto.Request) (int, bool) {
	switch req := request.(type) {
	case *dto.GeneralOpenAIRequest:
		if seconds, ok := extractSecondsFromRequestMetadata(req.Metadata); ok {
			return seconds, true
		}
		if req.Duration != nil {
			if seconds, ok := extractPositiveIntValue(*req.Duration); ok {
				return seconds, true
			}
		}
		if req.Seconds != nil {
			if seconds, ok := extractPositiveIntValue(*req.Seconds); ok {
				return seconds, true
			}
		}
	}
	return 0, false
}

func extractSecondsFromTaskRequest(req relaycommon.TaskSubmitReq) (int, bool) {
	if req.Duration > 0 {
		return req.Duration, true
	}
	if seconds, ok := extractPositiveIntValue(req.Seconds); ok {
		return seconds, true
	}
	for _, key := range []string{"durationSeconds", "duration_seconds", "duration", "seconds"} {
		if seconds, ok := extractPositiveIntValue(req.Metadata[key]); ok {
			return seconds, true
		}
	}
	return 0, false
}

func GroupPriceCandidateGroups(info *relaycommon.RelayInfo) []string {
	if info == nil {
		return nil
	}
	seen := make(map[string]bool)
	groups := make([]string, 0, 2)
	for _, group := range []string{info.UserGroup, info.UsingGroup} {
		group = strings.TrimSpace(group)
		if group == "" || seen[group] {
			continue
		}
		seen[group] = true
		groups = append(groups, group)
	}
	return groups
}

func ResolveGroupModelPrice(info *relaycommon.RelayInfo) (float64, string, bool) {
	for _, group := range GroupPriceCandidateGroups(info) {
		if price, ok := ratio_setting.GetGroupModelPrice(group, info.OriginModelName); ok {
			return price, group, true
		}
	}
	return 0, "", false
}

func ResolveGroupModelPriceBySeconds(info *relaycommon.RelayInfo, seconds int) (float64, string, bool) {
	for _, group := range GroupPriceCandidateGroups(info) {
		if price, ok := ratio_setting.GetGroupModelPriceBySeconds(group, info.OriginModelName, seconds); ok {
			return price, group, true
		}
	}
	return 0, "", false
}

func ResolveGroupModelPriceBySecondsMin(info *relaycommon.RelayInfo) (float64, string, bool) {
	for _, group := range GroupPriceCandidateGroups(info) {
		if price, ok := ratio_setting.GetGroupModelPriceBySecondsMin(group, info.OriginModelName); ok {
			return price, group, true
		}
	}
	return 0, "", false
}

func ResolveGroupModelPriceByResolution(info *relaycommon.RelayInfo, resolution string) (float64, string, bool) {
	for _, group := range GroupPriceCandidateGroups(info) {
		if price, ok := ratio_setting.GetGroupModelPriceByResolution(group, info.OriginModelName, resolution); ok {
			return price, group, true
		}
	}
	return 0, "", false
}

func ResolveGroupModelPriceByResolutionMin(info *relaycommon.RelayInfo) (float64, string, bool) {
	for _, group := range GroupPriceCandidateGroups(info) {
		if price, ok := ratio_setting.GetGroupModelPriceByResolutionMin(group, info.OriginModelName); ok {
			return price, group, true
		}
	}
	return 0, "", false
}

func resolveSecondsBasedModelPrice(info *relaycommon.RelayInfo) (float64, bool) {
	if info == nil || info.Request == nil {
		return 0, false
	}
	seconds, ok := extractSecondsFromRequest(info.Request)
	if !ok {
		return 0, false
	}
	return ratio_setting.GetModelPriceBySeconds(info.OriginModelName, seconds)
}

func resolveGroupSecondsBasedModelPrice(info *relaycommon.RelayInfo) (float64, string, bool) {
	if info == nil || info.Request == nil {
		return 0, "", false
	}
	seconds, ok := extractSecondsFromRequest(info.Request)
	if !ok {
		return 0, "", false
	}
	return ResolveGroupModelPriceBySeconds(info, seconds)
}

func resolveGroupTaskSecondsBasedModelPrice(c *gin.Context, info *relaycommon.RelayInfo) (float64, string, bool) {
	if c == nil || info == nil {
		return 0, "", false
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return 0, "", false
	}
	seconds, ok := extractSecondsFromTaskRequest(req)
	if !ok {
		return 0, "", false
	}
	return ResolveGroupModelPriceBySeconds(info, seconds)
}

func resolveResolutionBasedModelPrice(c *gin.Context, info *relaycommon.RelayInfo) (float64, bool) {
	if info == nil {
		return 0, false
	}
	if info != nil && info.Request != nil {
		if resolution := extractResolutionKeyFromRequest(info.Request); resolution != "" {
			return ratio_setting.GetModelPriceByResolution(info.OriginModelName, resolution)
		}
	}
	if c != nil {
		if req, err := relaycommon.GetTaskRequest(c); err == nil {
			if resolution := extractResolutionKeyFromTaskRequest(req); resolution != "" {
				return ratio_setting.GetModelPriceByResolution(info.OriginModelName, resolution)
			}
		}
	}
	return 0, false
}

func resolveGroupResolutionBasedModelPrice(c *gin.Context, info *relaycommon.RelayInfo) (float64, string, bool) {
	if info == nil {
		return 0, "", false
	}
	if info.Request != nil {
		if resolution := extractResolutionKeyFromRequest(info.Request); resolution != "" {
			return ResolveGroupModelPriceByResolution(info, resolution)
		}
	}
	if c != nil {
		if req, err := relaycommon.GetTaskRequest(c); err == nil {
			if resolution := extractResolutionKeyFromTaskRequest(req); resolution != "" {
				return ResolveGroupModelPriceByResolution(info, resolution)
			}
		}
	}
	return 0, "", false
}

func fixedPriceQuota(modelPrice float64, groupRatio float64, groupPriceOverride bool) int {
	if groupPriceOverride {
		return int(modelPrice * common.QuotaPerUnit)
	}
	return int(modelPrice * common.QuotaPerUnit * groupRatio)
}

// HandleGroupRatio checks for "auto_group" in the context and updates the group ratio and relayInfo.UsingGroup if present
func HandleGroupRatio(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) types.GroupRatioInfo {
	groupRatioInfo := types.GroupRatioInfo{
		GroupRatio:        1.0, // default ratio
		GroupSpecialRatio: -1,
	}

	// check auto group
	autoGroup, exists := ctx.Get("auto_group")
	if exists {
		logger.LogDebug(ctx, fmt.Sprintf("final group: %s", autoGroup))
		relayInfo.UsingGroup = autoGroup.(string)
	}

	// check user group special ratio
	userGroupRatio, ok := ratio_setting.GetGroupGroupRatio(relayInfo.UserGroup, relayInfo.UsingGroup)
	if ok {
		// user group special ratio
		groupRatioInfo.GroupSpecialRatio = userGroupRatio
		groupRatioInfo.GroupRatio = userGroupRatio
		groupRatioInfo.HasSpecialRatio = true
	} else {
		// normal group ratio
		groupRatioInfo.GroupRatio = ratio_setting.GetGroupRatio(relayInfo.UsingGroup)
	}

	return groupRatioInfo
}

func ModelPriceHelper(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta) (types.PriceData, error) {
	groupRatioInfo := HandleGroupRatio(c, info)

	var groupPriceOverride bool
	var groupPriceOverrideGroup string
	modelPrice, groupPriceOverrideGroup, usePrice := resolveGroupSecondsBasedModelPrice(info)
	if usePrice {
		groupPriceOverride = true
	}
	if !usePrice {
		if resolutionPrice, overrideGroup, ok := resolveGroupResolutionBasedModelPrice(c, info); ok {
			modelPrice = resolutionPrice
			groupPriceOverrideGroup = overrideGroup
			usePrice = true
			groupPriceOverride = true
		}
	}
	if !usePrice {
		if groupModelPrice, overrideGroup, ok := ResolveGroupModelPrice(info); ok {
			modelPrice = groupModelPrice
			groupPriceOverrideGroup = overrideGroup
			usePrice = true
			groupPriceOverride = true
		}
	}
	if !usePrice {
		if secondsPrice, overrideGroup, ok := ResolveGroupModelPriceBySecondsMin(info); ok {
			modelPrice = secondsPrice
			groupPriceOverrideGroup = overrideGroup
			usePrice = true
			groupPriceOverride = true
		}
	}
	if !usePrice {
		if resolutionPrice, overrideGroup, ok := ResolveGroupModelPriceByResolutionMin(info); ok {
			modelPrice = resolutionPrice
			groupPriceOverrideGroup = overrideGroup
			usePrice = true
			groupPriceOverride = true
		}
	}
	if !usePrice {
		modelPrice, usePrice = ratio_setting.GetModelPrice(info.OriginModelName, false)
	}
	if !usePrice {
		if secondsPrice, ok := resolveSecondsBasedModelPrice(info); ok {
			modelPrice = secondsPrice
			usePrice = true
		}
	}
	if !usePrice {
		if resolutionPrice, ok := resolveResolutionBasedModelPrice(c, info); ok {
			modelPrice = resolutionPrice
			usePrice = true
		}
	}
	if !usePrice {
		if secondsPrice, ok := ratio_setting.GetModelPriceBySecondsMin(info.OriginModelName); ok {
			modelPrice = secondsPrice
			usePrice = true
		}
	}
	if !usePrice {
		if resolutionPrice, ok := ratio_setting.GetModelPriceByResolutionMin(info.OriginModelName); ok {
			modelPrice = resolutionPrice
			usePrice = true
		}
	}

	var preConsumedQuota int
	var modelRatio float64
	var completionRatio float64
	var cacheRatio float64
	var imageRatio float64
	var cacheCreationRatio float64
	var cacheCreationRatio5m float64
	var cacheCreationRatio1h float64
	var audioRatio float64
	var audioCompletionRatio float64
	var freeModel bool
	if !usePrice {
		preConsumedTokens := common.Max(promptTokens, common.PreConsumedQuota)
		if meta.MaxTokens != 0 {
			preConsumedTokens += meta.MaxTokens
		}
		var success bool
		var matchName string
		modelRatio, success, matchName = ratio_setting.GetModelRatio(info.OriginModelName)
		if !success {
			acceptUnsetRatio := false
			if info.UserSetting.AcceptUnsetRatioModel {
				acceptUnsetRatio = true
			}
			if !acceptUnsetRatio {
				return types.PriceData{}, fmt.Errorf("模型 %s 倍率或价格未配置，请联系管理员设置或开始自用模式；Model %s ratio or price not set, please set or start self-use mode", matchName, matchName)
			}
		}
		completionRatio = ratio_setting.GetCompletionRatio(info.OriginModelName)
		cacheRatio, _ = ratio_setting.GetCacheRatio(info.OriginModelName)
		cacheCreationRatio, _ = ratio_setting.GetCreateCacheRatio(info.OriginModelName)
		cacheCreationRatio5m = cacheCreationRatio
		// 固定1h和5min缓存写入价格的比例
		cacheCreationRatio1h = cacheCreationRatio * claudeCacheCreation1hMultiplier
		imageRatio, _ = ratio_setting.GetImageRatio(info.OriginModelName)
		audioRatio = ratio_setting.GetAudioRatio(info.OriginModelName)
		audioCompletionRatio = ratio_setting.GetAudioCompletionRatio(info.OriginModelName)
		ratio := modelRatio * groupRatioInfo.GroupRatio
		preConsumedQuota = int(float64(preConsumedTokens) * ratio)
	} else {
		if meta.ImagePriceRatio != 0 {
			modelPrice = modelPrice * meta.ImagePriceRatio
		}
		preConsumedQuota = fixedPriceQuota(modelPrice, groupRatioInfo.GroupRatio, groupPriceOverride)
	}

	// check if free model pre-consume is disabled
	if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		// if model price or ratio is 0, do not pre-consume quota
		if groupRatioInfo.GroupRatio == 0 {
			preConsumedQuota = 0
			freeModel = true
		} else if usePrice {
			if modelPrice == 0 {
				preConsumedQuota = 0
				freeModel = true
			}
		} else {
			if modelRatio == 0 {
				preConsumedQuota = 0
				freeModel = true
			}
		}
	}

	priceData := types.PriceData{
		FreeModel:               freeModel,
		ModelPrice:              modelPrice,
		ModelRatio:              modelRatio,
		CompletionRatio:         completionRatio,
		GroupRatioInfo:          groupRatioInfo,
		UsePrice:                usePrice,
		GroupPriceOverride:      groupPriceOverride,
		GroupPriceOverrideGroup: groupPriceOverrideGroup,
		CacheRatio:              cacheRatio,
		ImageRatio:              imageRatio,
		AudioRatio:              audioRatio,
		AudioCompletionRatio:    audioCompletionRatio,
		CacheCreationRatio:      cacheCreationRatio,
		CacheCreation5mRatio:    cacheCreationRatio5m,
		CacheCreation1hRatio:    cacheCreationRatio1h,
		QuotaToPreConsume:       preConsumedQuota,
	}

	if common.DebugEnabled {
		println(fmt.Sprintf("model_price_helper result: %s", priceData.ToSetting()))
	}
	info.PriceData = priceData
	return priceData, nil
}

// ModelPriceHelperPerCall 按次计费的 PriceHelper (MJ、Task)
func ModelPriceHelperPerCall(c *gin.Context, info *relaycommon.RelayInfo) (types.PriceData, error) {
	groupRatioInfo := HandleGroupRatio(c, info)

	groupPriceOverride := false
	groupPriceOverrideGroup := ""
	modelPrice, groupPriceOverrideGroup, success := resolveGroupTaskSecondsBasedModelPrice(c, info)
	if success {
		groupPriceOverride = true
	}
	if !success {
		if resolutionPrice, overrideGroup, ok := resolveGroupResolutionBasedModelPrice(c, info); ok {
			modelPrice = resolutionPrice
			groupPriceOverrideGroup = overrideGroup
			success = true
			groupPriceOverride = true
		}
	}
	if !success {
		if groupModelPrice, overrideGroup, ok := ResolveGroupModelPrice(info); ok {
			modelPrice = groupModelPrice
			groupPriceOverrideGroup = overrideGroup
			success = true
			groupPriceOverride = true
		}
	}
	if !success {
		if secondsPrice, overrideGroup, ok := ResolveGroupModelPriceBySecondsMin(info); ok {
			modelPrice = secondsPrice
			groupPriceOverrideGroup = overrideGroup
			success = true
			groupPriceOverride = true
		}
	}
	if !success {
		if resolutionPrice, overrideGroup, ok := ResolveGroupModelPriceByResolutionMin(info); ok {
			modelPrice = resolutionPrice
			groupPriceOverrideGroup = overrideGroup
			success = true
			groupPriceOverride = true
		}
	}
	if !success {
		modelPrice, success = ratio_setting.GetModelPrice(info.OriginModelName, true)
	}
	if !success {
		if resolutionPrice, ok := resolveResolutionBasedModelPrice(c, info); ok {
			modelPrice = resolutionPrice
			success = true
		}
	}
	// 如果没有配置价格，检查模型倍率配置
	if !success {
		if secondsPrice, ok := ratio_setting.GetModelPriceBySecondsMin(info.OriginModelName); ok {
			modelPrice = secondsPrice
			success = true
		}
	}
	if !success {
		if resolutionPrice, ok := ratio_setting.GetModelPriceByResolutionMin(info.OriginModelName); ok {
			modelPrice = resolutionPrice
			success = true
		}
	}
	if !success {

		// 没有配置费用，也要使用默认费用,否则按费率计费模型无法使用
		defaultPrice, ok := ratio_setting.GetDefaultModelPriceMap()[info.OriginModelName]
		if ok {
			modelPrice = defaultPrice
		} else {
			// 没有配置倍率也不接受没配置,那就返回错误
			_, ratioSuccess, matchName := ratio_setting.GetModelRatio(info.OriginModelName)
			acceptUnsetRatio := false
			if info.UserSetting.AcceptUnsetRatioModel {
				acceptUnsetRatio = true
			}
			if !ratioSuccess && !acceptUnsetRatio {
				return types.PriceData{}, fmt.Errorf("模型 %s 倍率或价格未配置，请联系管理员设置或开始自用模式；Model %s ratio or price not set, please set or start self-use mode", matchName, matchName)
			}
			// 未配置价格但配置了倍率，使用默认预扣价格
			modelPrice = float64(common.PreConsumedQuota) / common.QuotaPerUnit
		}

	}
	quota := fixedPriceQuota(modelPrice, groupRatioInfo.GroupRatio, groupPriceOverride)

	// 免费模型检测（与 ModelPriceHelper 对齐）
	freeModel := false
	if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		if groupRatioInfo.GroupRatio == 0 || modelPrice == 0 {
			quota = 0
			freeModel = true
		}
	}

	priceData := types.PriceData{
		FreeModel:               freeModel,
		ModelPrice:              modelPrice,
		Quota:                   quota,
		BaseQuota:               quota,
		GroupRatioInfo:          groupRatioInfo,
		GroupPriceOverride:      groupPriceOverride,
		GroupPriceOverrideGroup: groupPriceOverrideGroup,
	}
	return priceData, nil
}

func ContainPriceOrRatio(modelName string) bool {
	_, ok := ratio_setting.GetModelPrice(modelName, false)
	if ok {
		return true
	}
	_, ok, _ = ratio_setting.GetModelRatio(modelName)
	if ok {
		return true
	}
	return false
}
