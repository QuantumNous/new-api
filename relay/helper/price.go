package helper

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func modelPriceNotConfiguredError(modelName string, userId int) error {
	if model.IsAdmin(userId) {
		return fmt.Errorf(
			"模型 %s 的价格未配置。请前往「系统设置 → 运营设置」开启自用模式，或在「系统设置 → 分组与模型定价设置」中为该模型配置价格；"+
				"Model %s price not configured. Go to System Settings → Operation Settings to enable self-use mode, or configure the model price in System Settings → Group & Model Pricing.",
			modelName, modelName,
		)
	}
	return fmt.Errorf(
		"模型 %s 的价格尚未由管理员配置，暂时无法使用，请联系站点管理员开启该模型；"+
			"Model %s has not been priced by the administrator yet. Please contact the site administrator to enable this model.",
		modelName, modelName,
	)
}

// https://docs.claude.com/en/docs/build-with-claude/prompt-caching#1-hour-cache-duration
const claudeCacheCreation1hMultiplier = 6 / 3.75

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
	modelPrice, usePrice := ratio_setting.GetModelPrice(info.OriginModelName, false)

	groupRatioInfo := HandleGroupRatio(c, info)

	// Check if this model uses tiered_expr billing
	if billing_setting.GetBillingMode(info.OriginModelName) == billing_setting.BillingModeTieredExpr {
		return modelPriceHelperTiered(c, info, promptTokens, meta, groupRatioInfo)
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
				return types.PriceData{}, modelPriceNotConfiguredError(matchName, info.UserId)
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
		preConsumedQuota = int(modelPrice * common.QuotaPerUnit * groupRatioInfo.GroupRatio)
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
		FreeModel:            freeModel,
		ModelPrice:           modelPrice,
		ModelRatio:           modelRatio,
		CompletionRatio:      completionRatio,
		GroupRatioInfo:       groupRatioInfo,
		UsePrice:             usePrice,
		CacheRatio:           cacheRatio,
		ImageRatio:           imageRatio,
		AudioRatio:           audioRatio,
		AudioCompletionRatio: audioCompletionRatio,
		CacheCreationRatio:   cacheCreationRatio,
		CacheCreation5mRatio: cacheCreationRatio5m,
		CacheCreation1hRatio: cacheCreationRatio1h,
		QuotaToPreConsume:    preConsumedQuota,
	}

	if common.DebugEnabled {
		println(fmt.Sprintf("model_price_helper result: %s", priceData.ToSetting()))
	}
	info.PriceData = priceData
	return priceData, nil
}

// ModelPriceHelperPerCall 按次/按量计费的 PriceHelper (MJ、Task)
func ModelPriceHelperPerCall(c *gin.Context, info *relaycommon.RelayInfo) (types.PriceData, error) {
	groupRatioInfo := HandleGroupRatio(c, info)

	if billing_setting.GetBillingMode(info.OriginModelName) == billing_setting.BillingModeVideoSeconds {
		return modelPriceHelperVideoSeconds(c, info, groupRatioInfo)
	}

	modelPrice, success := ratio_setting.GetModelPrice(info.OriginModelName, true)
	usePrice := success
	var modelRatio float64

	if !success {
		defaultPrice, ok := ratio_setting.GetDefaultModelPriceMap()[info.OriginModelName]
		if ok {
			modelPrice = defaultPrice
			usePrice = true
		} else {
			var ratioSuccess bool
			var matchName string
			modelRatio, ratioSuccess, matchName = ratio_setting.GetModelRatio(info.OriginModelName)
			acceptUnsetRatio := false
			if info.UserSetting.AcceptUnsetRatioModel {
				acceptUnsetRatio = true
			}
			if !ratioSuccess && !acceptUnsetRatio {
				return types.PriceData{}, modelPriceNotConfiguredError(matchName, info.UserId)
			}
		}
	}

	var quota int
	freeModel := false

	if usePrice {
		quota = int(modelPrice * common.QuotaPerUnit * groupRatioInfo.GroupRatio)
		if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
			if groupRatioInfo.GroupRatio == 0 || modelPrice == 0 {
				quota = 0
				freeModel = true
			}
		}
	} else {
		// 按量计费：以模型倍率的一半作为预扣额度
		quota = int(modelRatio / 2 * common.QuotaPerUnit * groupRatioInfo.GroupRatio)
		modelPrice = -1
		if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
			if groupRatioInfo.GroupRatio == 0 || modelRatio == 0 {
				quota = 0
				freeModel = true
			}
		}
	}

	priceData := types.PriceData{
		FreeModel:      freeModel,
		ModelPrice:     modelPrice,
		ModelRatio:     modelRatio,
		UsePrice:       usePrice,
		Quota:          quota,
		GroupRatioInfo: groupRatioInfo,
	}
	return priceData, nil
}

type videoSecondsBillingTrace struct {
	Resolution     string
	Duration       float64
	FPS            float64
	BaseFPS        float64
	FPSMultiplier  float64
	PricePerSecond float64
	TotalPrice     float64
}

func (t videoSecondsBillingTrace) toPriceDataTrace() *types.VideoSecondsTrace {
	return &types.VideoSecondsTrace{
		Resolution:     t.Resolution,
		Duration:       t.Duration,
		FPS:            t.FPS,
		BaseFPS:        t.BaseFPS,
		FPSMultiplier:  t.FPSMultiplier,
		PricePerSecond: t.PricePerSecond,
		TotalPrice:     t.TotalPrice,
	}
}

func modelPriceHelperVideoSeconds(c *gin.Context, info *relaycommon.RelayInfo, groupRatioInfo types.GroupRatioInfo) (types.PriceData, error) {
	cfg, ok := billing_setting.GetVideoPriceConfig(info.OriginModelName)
	if !ok || len(cfg.Prices) == 0 {
		return types.PriceData{}, fmt.Errorf("model %s video per-second price not configured", info.OriginModelName)
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return types.PriceData{}, err
	}
	trace, err := calculateVideoSecondsBilling(req, cfg)
	if err != nil {
		return types.PriceData{}, err
	}
	quota := billingexpr.QuotaRound(trace.TotalPrice * common.QuotaPerUnit * groupRatioInfo.GroupRatio)
	priceData := types.PriceData{
		ModelPrice:        trace.TotalPrice,
		UsePrice:          true,
		Quota:             quota,
		GroupRatioInfo:    groupRatioInfo,
		VideoSecondsTrace: trace.toPriceDataTrace(),
	}
	return priceData, nil
}

func calculateVideoSecondsBilling(req relaycommon.TaskSubmitReq, cfg billing_setting.VideoPriceConfig) (videoSecondsBillingTrace, error) {
	resolution := resolveVideoResolution(req)
	if resolution == "" {
		return videoSecondsBillingTrace{}, fmt.Errorf("video resolution is required for video per-second billing")
	}
	pricePerSecond, ok := lookupVideoResolutionPrice(cfg.Prices, resolution)
	if !ok || pricePerSecond <= 0 {
		return videoSecondsBillingTrace{}, fmt.Errorf("video resolution %s price not configured", resolution)
	}
	duration := resolveVideoDuration(req)
	if duration <= 0 {
		return videoSecondsBillingTrace{}, fmt.Errorf("video duration is required for video per-second billing")
	}
	baseFPS := cfg.BaseFPS
	if baseFPS <= 0 {
		baseFPS = 24
	}
	fps := resolveVideoFPS(req)
	if fps <= 0 {
		fps = baseFPS
	}
	fpsMultiplier := fps / baseFPS
	totalPrice := pricePerSecond * duration * fpsMultiplier
	return videoSecondsBillingTrace{
		Resolution:     resolution,
		Duration:       duration,
		FPS:            fps,
		BaseFPS:        baseFPS,
		FPSMultiplier:  fpsMultiplier,
		PricePerSecond: pricePerSecond,
		TotalPrice:     totalPrice,
	}, nil
}

func lookupVideoResolutionPrice(prices map[string]float64, resolution string) (float64, bool) {
	normalized := normalizeVideoResolution(resolution)
	for key, price := range prices {
		if normalizeVideoResolution(key) == normalized {
			return price, true
		}
	}
	return 0, false
}

func resolveVideoDuration(req relaycommon.TaskSubmitReq) float64 {
	if req.Duration > 0 {
		return float64(req.Duration)
	}
	if sec, err := strconv.ParseFloat(strings.TrimSpace(req.Seconds), 64); err == nil && sec > 0 {
		return sec
	}
	return firstPositiveMetadataNumber(req.Metadata, "duration", "seconds", "duration_seconds", "durationSeconds")
}

func resolveVideoFPS(req relaycommon.TaskSubmitReq) float64 {
	for _, v := range []int{req.FPS, req.FrameRate, req.FramesPerSecond, req.FramesPerSecondCamel} {
		if v > 0 {
			return float64(v)
		}
	}
	return firstPositiveMetadataNumber(req.Metadata, "fps", "frame_rate", "frameRate", "framespersecond", "framesPerSecond")
}

func resolveVideoResolution(req relaycommon.TaskSubmitReq) string {
	for _, key := range []string{"resolution", "quality", "size"} {
		if v, ok := req.Metadata[key].(string); ok && strings.TrimSpace(v) != "" {
			return normalizeVideoResolution(v)
		}
	}
	if strings.TrimSpace(req.Size) != "" {
		if res := resolutionFromSize(req.Size); res != "" {
			return res
		}
	}
	width := req.Width
	height := req.Height
	if width <= 0 {
		width = int(firstPositiveMetadataNumber(req.Metadata, "width"))
	}
	if height <= 0 {
		height = int(firstPositiveMetadataNumber(req.Metadata, "height"))
	}
	if width > 0 && height > 0 {
		shortSide := width
		if height < shortSide {
			shortSide = height
		}
		return normalizeVideoResolution(fmt.Sprintf("%dp", shortSide))
	}
	return ""
}

func resolutionFromSize(size string) string {
	parts := strings.FieldsFunc(strings.ToLower(strings.TrimSpace(size)), func(r rune) bool {
		return r == 'x' || r == '*' || r == '×'
	})
	if len(parts) != 2 {
		return normalizeVideoResolution(size)
	}
	width, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
	height, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errW != nil || errH != nil || width <= 0 || height <= 0 {
		return normalizeVideoResolution(size)
	}
	shortSide := width
	if height < shortSide {
		shortSide = height
	}
	return normalizeVideoResolution(fmt.Sprintf("%dp", shortSide))
}

func normalizeVideoResolution(resolution string) string {
	resolution = strings.ToLower(strings.TrimSpace(resolution))
	resolution = strings.ReplaceAll(resolution, " ", "")
	if strings.HasSuffix(resolution, "p") {
		return resolution
	}
	if v, err := strconv.Atoi(resolution); err == nil && v > 0 {
		return fmt.Sprintf("%dp", v)
	}
	return resolution
}

func firstPositiveMetadataNumber(metadata map[string]interface{}, keys ...string) float64 {
	if metadata == nil {
		return 0
	}
	for _, key := range keys {
		value, ok := metadata[key]
		if !ok {
			continue
		}
		switch v := value.(type) {
		case int:
			if v > 0 {
				return float64(v)
			}
		case int64:
			if v > 0 {
				return float64(v)
			}
		case float64:
			if v > 0 {
				return v
			}
		case string:
			if n, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil && n > 0 {
				return n
			}
		}
	}
	return 0
}

func HasModelBillingConfig(modelName string) bool {
	if _, ok := ratio_setting.GetModelPrice(modelName, false); ok {
		return true
	}
	if _, ok, _ := ratio_setting.GetModelRatio(modelName); ok {
		return true
	}
	if billing_setting.GetBillingMode(modelName) != billing_setting.BillingModeTieredExpr {
		return false
	}
	expr, ok := billing_setting.GetBillingExpr(modelName)
	return ok && strings.TrimSpace(expr) != ""
}

func modelPriceHelperTiered(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta, groupRatioInfo types.GroupRatioInfo) (types.PriceData, error) {
	exprStr, ok := billing_setting.GetBillingExpr(info.OriginModelName)
	if !ok {
		return types.PriceData{}, fmt.Errorf("model %s is configured as tiered_expr but has no billing expression", info.OriginModelName)
	}

	estimatedCompletionTokens := 0
	if meta.MaxTokens != 0 {
		estimatedCompletionTokens = meta.MaxTokens
	}

	requestInput, err := ResolveIncomingBillingExprRequestInput(c, info)
	if err != nil {
		return types.PriceData{}, err
	}

	rawCost, trace, err := billingexpr.RunExprWithRequest(exprStr, billingexpr.TokenParams{
		P:   float64(promptTokens),
		C:   float64(estimatedCompletionTokens),
		Len: float64(promptTokens),
	}, requestInput)
	if err != nil {
		return types.PriceData{}, fmt.Errorf("model %s tiered expr run failed: %w", info.OriginModelName, err)
	}

	// Expression coefficients are $/1M tokens prices; convert to quota the same way per-call billing does.
	quotaBeforeGroup := rawCost / 1_000_000 * common.QuotaPerUnit
	preConsumedQuota := billingexpr.QuotaRound(quotaBeforeGroup * groupRatioInfo.GroupRatio)

	freeModel := false
	if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		if groupRatioInfo.GroupRatio == 0 {
			preConsumedQuota = 0
			freeModel = true
		}
	}

	exprHash := billingexpr.ExprHashString(exprStr)
	snapshot := &billingexpr.BillingSnapshot{
		BillingMode:               billing_setting.BillingModeTieredExpr,
		ModelName:                 info.OriginModelName,
		ExprString:                exprStr,
		ExprHash:                  exprHash,
		GroupRatio:                groupRatioInfo.GroupRatio,
		EstimatedPromptTokens:     promptTokens,
		EstimatedCompletionTokens: estimatedCompletionTokens,
		EstimatedQuotaBeforeGroup: quotaBeforeGroup,
		EstimatedQuotaAfterGroup:  preConsumedQuota,
		EstimatedTier:             trace.MatchedTier,
		QuotaPerUnit:              common.QuotaPerUnit,
		ExprVersion:               billingexpr.ExprVersion(exprStr),
	}
	info.TieredBillingSnapshot = snapshot
	info.BillingRequestInput = &requestInput

	priceData := types.PriceData{
		FreeModel:         freeModel,
		GroupRatioInfo:    groupRatioInfo,
		QuotaToPreConsume: preConsumedQuota,
	}

	if common.DebugEnabled {
		println(fmt.Sprintf("model_price_helper_tiered result: model=%s preConsume=%d quotaBeforeGroup=%.2f groupRatio=%.2f tier=%s", info.OriginModelName, preConsumedQuota, quotaBeforeGroup, groupRatioInfo.GroupRatio, trace.MatchedTier))
	}

	info.PriceData = priceData
	return priceData, nil
}
