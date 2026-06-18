package helper

import (
	"fmt"
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
	"github.com/shopspring/decimal"
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
		logger.LogDebug(ctx, "final group: %s", autoGroup)
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

	if modelGroupRatio, ok := model.GetModelGroupRatio(relayInfo.OriginModelName, relayInfo.UsingGroup); ok {
		groupRatioInfo.ModelGroupRatio = modelGroupRatio
		groupRatioInfo.GroupRatio = modelGroupRatio
		groupRatioInfo.HasModelGroupRatio = true
	}
	if modelGroupPricing, ok := model.GetModelGroupPriceOverrides(relayInfo.OriginModelName, relayInfo.UsingGroup); ok {
		groupRatioInfo.ModelGroupPricing = &modelGroupPricing
		groupRatioInfo.HasModelGroupPricing = true
	}

	return groupRatioInfo
}

// resolveGroupBillingMode returns the group's explicitly-pinned billing mode.
// ok=false means the group did not pin a mode (inherit the model default).
func resolveGroupBillingMode(groupRatioInfo types.GroupRatioInfo) (mode string, ok bool) {
	if !groupRatioInfo.HasModelGroupPricing || groupRatioInfo.ModelGroupPricing == nil {
		return "", false
	}
	if groupRatioInfo.ModelGroupPricing.BillingMode == nil {
		return "", false
	}
	return *groupRatioInfo.ModelGroupPricing.BillingMode, true
}

func priceToQuotaPerToken(price float64) float64 {
	return price / 1_000_000 * common.QuotaPerUnit
}

// minFeeToQuota 把「美元最低费用」折算成内部 quota；fee<=0 返回 0。
func minFeeToQuota(fee float64, groupRatio float64) int {
	if fee <= 0 {
		return 0
	}
	return int(decimal.NewFromFloat(fee).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Mul(decimal.NewFromFloat(groupRatio)).
		Round(0).
		IntPart())
}

// computeMinQuota 解析最低费用下限：分组强制值优先（不乘倍率），否则模型级默认值（乘倍率）。
func computeMinQuota(override *types.ModelGroupPricing, modelName string, groupRatio float64) int {
	if override != nil && override.MinFee != nil {
		return minFeeToQuota(*override.MinFee, 1.0)
	}
	if modelMinFee, ok := ratio_setting.GetModelMinFee(modelName); ok {
		return minFeeToQuota(modelMinFee, groupRatio)
	}
	return 0
}

func applyTokenPriceOverrides(priceData *types.PriceData, promptTokens int) {
	if priceData == nil || priceData.GroupPriceOverride == nil || priceData.UsePrice {
		return
	}
	override := priceData.GroupPriceOverride
	if override.PromptPrice == nil {
		return
	}
	preConsumedTokens := float64(promptTokens)
	if preConsumedTokens <= 0 {
		return
	}
	priceData.QuotaToPreConsume = int(preConsumedTokens * priceToQuotaPerToken(*override.PromptPrice))
	if priceData.QuotaToPreConsume == 0 && *override.PromptPrice > 0 {
		priceData.QuotaToPreConsume = 1
	}
}

func applyPerCallPriceOverrides(priceData *types.PriceData) {
	if priceData == nil || priceData.GroupPriceOverride == nil || !priceData.UsePrice {
		return
	}
	if priceData.GroupPriceOverride.ModelPrice == nil {
		return
	}
	priceData.ModelPrice = *priceData.GroupPriceOverride.ModelPrice
	priceData.Quota = int(priceData.ModelPrice * common.QuotaPerUnit)
	priceData.QuotaToPreConsume = priceData.Quota
	if priceData.Quota == 0 && priceData.ModelPrice > 0 {
		priceData.Quota = 1
		priceData.QuotaToPreConsume = 1
	}
}

func ModelPriceHelper(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta) (types.PriceData, error) {
	modelPrice, usePrice := ratio_setting.GetModelPrice(info.OriginModelName, false)

	groupRatioInfo := HandleGroupRatio(c, info)

	// Per-group billing-mode override (group pin wins; else inherit the model default).
	groupMode, groupHasMode := resolveGroupBillingMode(groupRatioInfo)
	modelTiered := billing_setting.GetBillingMode(info.OriginModelName) == billing_setting.BillingModeTieredExpr

	if groupHasMode {
		switch groupMode {
		case types.GroupBillingModeTieredExpr:
			groupExpr := ""
			if groupRatioInfo.ModelGroupPricing != nil && groupRatioInfo.ModelGroupPricing.BillingExpr != nil {
				groupExpr = *groupRatioInfo.ModelGroupPricing.BillingExpr
			}
			return modelPriceHelperTiered(c, info, promptTokens, meta, groupRatioInfo, groupExpr)
		case types.GroupBillingModePerRequest:
			usePrice = true
			if modelPrice < 0 {
				// 分组强制按次计费，但模型级未配置按次价（GetModelPrice 返回 -1 哨兵）。
				// 归零等分组 override 填充；分组也未填则保持 0（免费），
				// 避免 -1 哨兵进入预扣/结算产生负 quota（资损）。
				modelPrice = 0
			}
		case types.GroupBillingModePerToken:
			usePrice = false
		}
	} else if modelTiered {
		return modelPriceHelperTiered(c, info, promptTokens, meta, groupRatioInfo, "")
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
	preConsumedTokens := common.Max(promptTokens, common.PreConsumedQuota)
	if meta.MaxTokens != 0 {
		preConsumedTokens += meta.MaxTokens
	}
	if !usePrice {
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
		GroupPriceOverride:   groupRatioInfo.ModelGroupPricing,
	}
	if !usePrice {
		priceData.MinQuota = computeMinQuota(groupRatioInfo.ModelGroupPricing, info.OriginModelName, groupRatioInfo.GroupRatio)
	}
	applyTokenPriceOverrides(&priceData, preConsumedTokens)
	applyPerCallPriceOverrides(&priceData)

	if common.DebugEnabled {
		logger.LogDebug(c, "model_price_helper result: %s", priceData.ToSetting())
	}
	info.PriceData = priceData
	return priceData, nil
}

// ModelPriceHelperPerCall 按次/按量计费的 PriceHelper (MJ、Task)
func ModelPriceHelperPerCall(c *gin.Context, info *relaycommon.RelayInfo) (types.PriceData, error) {
	groupRatioInfo := HandleGroupRatio(c, info)

	groupMode, groupHasMode := resolveGroupBillingMode(groupRatioInfo)
	forceGroupPerRequest := groupHasMode && groupMode == types.GroupBillingModePerRequest
	if groupHasMode && groupMode == types.GroupBillingModeTieredExpr {
		// tiered_expr has no token context on the task surface; fall back to the
		// model's own task billing. Documented boundary (see spec section 5.5/8).
		logger.LogDebug(c, "group %s pins tiered_expr; not supported on task surface, using model task billing", info.UsingGroup)
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
		FreeModel:          freeModel,
		ModelPrice:         modelPrice,
		ModelRatio:         modelRatio,
		UsePrice:           usePrice,
		Quota:              quota,
		GroupRatioInfo:     groupRatioInfo,
		GroupPriceOverride: groupRatioInfo.ModelGroupPricing,
	}
	if forceGroupPerRequest && !priceData.UsePrice {
		// Switch this group to per-call billing; the group's ModelPrice (if any)
		// is applied by applyPerCallPriceOverrides below. Empty group model_price
		// -> stays 0 (free), matching the documented fallback chain.
		priceData.UsePrice = true
		priceData.ModelPrice = 0
		priceData.Quota = 0
		priceData.QuotaToPreConsume = 0
	}
	applyPerCallPriceOverrides(&priceData)
	return priceData, nil
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

func modelPriceHelperTiered(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta, groupRatioInfo types.GroupRatioInfo, exprOverride string) (types.PriceData, error) {
	exprStr := strings.TrimSpace(exprOverride)
	if exprStr == "" {
		var ok bool
		exprStr, ok = billing_setting.GetBillingExpr(info.OriginModelName)
		if !ok {
			return types.PriceData{}, fmt.Errorf("model %s is configured as tiered_expr but has no billing expression", info.OriginModelName)
		}
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

	logger.LogDebug(c, "model_price_helper_tiered result: model=%s preConsume=%d quotaBeforeGroup=%.2f groupRatio=%.2f tier=%s", info.OriginModelName, preConsumedQuota, quotaBeforeGroup, groupRatioInfo.GroupRatio, trace.MatchedTier)

	info.PriceData = priceData
	return priceData, nil
}
