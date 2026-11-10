package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type TokenDetails struct {
	TextTokens  int
	AudioTokens int
}

type QuotaInfo struct {
	InputDetails  TokenDetails
	OutputDetails TokenDetails
	ModelName     string
	UsePrice      bool
	ModelPrice    float64
	ModelRatio    float64
	GroupRatio    float64
}

func hasCustomModelRatio(modelName string, currentRatio float64) bool {
	defaultRatio, exists := ratio_setting.GetDefaultModelRatioMap()[modelName]
	if !exists {
		return true
	}
	return currentRatio != defaultRatio
}

func calculateAudioQuota(info QuotaInfo) (int, *common.QuotaClamp) {
	if info.UsePrice {
		modelPrice := decimal.NewFromFloat(info.ModelPrice)
		quotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		groupRatio := decimal.NewFromFloat(info.GroupRatio)

		quota := modelPrice.Mul(quotaPerUnit).Mul(groupRatio)
		return common.QuotaFromDecimalChecked(quota)
	}

	completionRatio := decimal.NewFromFloat(ratio_setting.GetCompletionRatio(info.ModelName))
	audioRatio := decimal.NewFromFloat(ratio_setting.GetAudioRatio(info.ModelName))
	audioCompletionRatio := decimal.NewFromFloat(ratio_setting.GetAudioCompletionRatio(info.ModelName))

	groupRatio := decimal.NewFromFloat(info.GroupRatio)
	modelRatio := decimal.NewFromFloat(info.ModelRatio)
	ratio := groupRatio.Mul(modelRatio)

	inputTextTokens := decimal.NewFromInt(int64(info.InputDetails.TextTokens))
	outputTextTokens := decimal.NewFromInt(int64(info.OutputDetails.TextTokens))
	inputAudioTokens := decimal.NewFromInt(int64(info.InputDetails.AudioTokens))
	outputAudioTokens := decimal.NewFromInt(int64(info.OutputDetails.AudioTokens))

	quota := decimal.Zero
	quota = quota.Add(inputTextTokens)
	quota = quota.Add(outputTextTokens.Mul(completionRatio))
	quota = quota.Add(inputAudioTokens.Mul(audioRatio))
	quota = quota.Add(outputAudioTokens.Mul(audioRatio).Mul(audioCompletionRatio))

	quota = quota.Mul(ratio)

	// If ratio is not zero and quota is less than or equal to zero, set quota to 1
	if !ratio.IsZero() && quota.LessThanOrEqual(decimal.Zero) {
		quota = decimal.NewFromInt(1)
	}

	return common.QuotaFromDecimalChecked(quota)
}

func PreWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage) error {
	if relayInfo.UsePrice {
		return nil
	}
	userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
	if err != nil {
		return err
	}

	token, err := model.GetTokenByKey(strings.TrimPrefix(relayInfo.TokenKey, "sk-"), false)
	if err != nil {
		return err
	}

	modelName := relayInfo.OriginModelName
	textInputTokens := usage.InputTokenDetails.TextTokens
	textOutTokens := usage.OutputTokenDetails.TextTokens
	audioInputTokens := usage.InputTokenDetails.AudioTokens
	audioOutTokens := usage.OutputTokenDetails.AudioTokens
	groupRatio := ratio_setting.GetGroupRatio(relayInfo.UsingGroup)
	modelRatio, _, _ := ratio_setting.GetModelRatio(modelName)

	autoGroup, exists := common.GetContextKey(ctx, constant.ContextKeyAutoGroup)
	if exists {
		groupRatio = ratio_setting.GetGroupRatio(autoGroup.(string))
		logger.LogDebug(ctx, "final group ratio: %f", groupRatio)
		relayInfo.UsingGroup = autoGroup.(string)
	}

	actualGroupRatio := groupRatio
	userGroupRatio, ok := ratio_setting.GetGroupGroupRatio(relayInfo.UserGroup, relayInfo.UsingGroup)
	if ok {
		actualGroupRatio = userGroupRatio
	}

	quotaInfo := QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:  textInputTokens,
			AudioTokens: audioInputTokens,
		},
		OutputDetails: TokenDetails{
			TextTokens:  textOutTokens,
			AudioTokens: audioOutTokens,
		},
		ModelName:  modelName,
		UsePrice:   relayInfo.UsePrice,
		ModelRatio: modelRatio,
		GroupRatio: actualGroupRatio,
	}

	quota, clamp := calculateAudioQuota(quotaInfo)
	noteQuotaClamp(relayInfo, clamp)

	if userQuota < quota {
		return fmt.Errorf("user quota is not enough, user quota: %s, need quota: %s", logger.FormatQuota(userQuota), logger.FormatQuota(quota))
	}

	if !token.UnlimitedQuota && token.RemainQuota < quota {
		return fmt.Errorf("token quota is not enough, token remain quota: %s, need quota: %s", logger.FormatQuota(token.RemainQuota), logger.FormatQuota(quota))
	}

	err = PostConsumeQuota(relayInfo, quota, 0, false)
	if err != nil {
		return err
	}
	logger.LogInfo(ctx, common.LogText("realtime streaming consume quota success, quota: %d", quota))
	return nil
}

// RecordRealtimeResponseBilling evaluates one response with the frozen pricing
// expression. Callers deduplicate response IDs and normalize vendor usage first.
// Completed charges remain available if a later response cannot be evaluated.
func RecordRealtimeResponseBilling(info *relaycommon.RelayInfo, responseID string, usage dto.RealtimeUsage) error {
	if info.TieredBillingSnapshot == nil {
		return nil
	}
	if info.RealtimeBilling == nil {
		info.RealtimeBilling = &relaycommon.RealtimeBillingState{}
	}
	if info.RealtimeBilling.ResponseBilling == nil {
		info.RealtimeBilling.ResponseBilling = &relaycommon.RealtimeResponseBilling{}
	}
	responses := info.RealtimeBilling.ResponseBilling
	canonical := &dto.Usage{PromptTokens: usage.InputTokens, CompletionTokens: usage.OutputTokens, TotalTokens: usage.TotalTokens,
		PromptTokensDetails: usage.InputTokenDetails, CompletionTokenDetails: usage.OutputTokenDetails}
	snap := info.TieredBillingSnapshot
	params := BuildTieredTokenParams(canonical, false, billingexpr.UsedVarsByHash(snap.ExprString, snap.ExprHash))
	request := billingexpr.RequestInput{}
	if info.BillingRequestInput != nil {
		request = *info.BillingRequestInput
	}
	result, err := billingexpr.ComputeTieredQuotaWithRequest(snap, params, request)
	if err != nil {
		responses.Failed = true
		return fmt.Errorf("failed to evaluate realtime response billing: %w", err)
	}
	noteQuotaClamp(info, result.Clamp)
	quota, clamp := common.QuotaFromDecimalChecked(decimal.NewFromInt(int64(responses.Quota)).Add(decimal.NewFromInt(int64(result.ActualQuotaAfterGroup))))
	noteQuotaClamp(info, clamp)
	responses.Quota = quota
	responses.Turns = append(responses.Turns, relaycommon.RealtimeTurnCharge{ResponseID: responseID, Usage: usage, Pricing: result})
	return nil
}

// ReserveRealtimeQuota raises the existing billing reservation to the cost of
// the entire session so far. It never charges each response a second time at
// final settlement, and checks available funds even for trusted wallets.
func ReserveRealtimeQuota(ctx *gin.Context, info *relaycommon.RelayInfo, usage *dto.RealtimeUsage) error {
	quota, result, _ := calculateRealtimeQuota(ctx, info, usage)
	if info.QuotaClamp != nil {
		return info.QuotaClamp
	}
	responses := info.RealtimeBilling.ResponseBilling
	if responses != nil && responses.Failed {
		return errors.New("failed to evaluate realtime billing expression")
	}
	if info.TieredBillingSnapshot != nil && result == nil && responses == nil {
		return errors.New("failed to evaluate realtime billing expression")
	}
	if quota == 0 {
		return nil
	}
	if info.Billing == nil {
		if apiErr := PreConsumeBilling(ctx, quota, info); apiErr != nil {
			return apiErr
		}
	}
	if err := info.Billing.ReserveBeforeSubmit(quota); err != nil {
		return err
	}
	info.FinalPreConsumedQuota = info.Billing.GetPreConsumedQuota()
	info.RealtimeBilling.ReservedToolQuota = info.RealtimeBilling.ToolQuota
	return nil
}

// Reservation and settlement must use the same captured rates, audio/text
// categories and vendor-reported tool charges, including mapped model names.
func calculateRealtimeQuota(ctx *gin.Context, info *relaycommon.RelayInfo, usage *dto.RealtimeUsage) (int, *billingexpr.TieredResult, []ToolSurchargeItem) {
	if info.RealtimeBilling == nil {
		info.RealtimeBilling = &relaycommon.RealtimeBillingState{ToolPrices: make(map[string]float64)}
	}
	if info.RealtimeBilling.ToolPrices == nil {
		info.RealtimeBilling.ToolPrices = make(map[string]float64)
	}
	// Keep the provider's raw usage for logs; normalize its nonbillable audio
	// transcript only for pricing, including mixed audio/text-only turns.
	billable := *usage
	companion := min(info.RealtimeBilling.AudioCompanionTextTokens, usage.OutputTokenDetails.TextTokens)
	billable.OutputTokenDetails.TextTokens -= companion
	billable.OutputTokens -= companion
	billable.TotalTokens -= companion
	usage = &billable
	price := info.PriceData
	amount := decimal.NewFromInt(int64(usage.InputTokenDetails.TextTokens))
	amount = amount.Add(decimal.NewFromInt(int64(usage.OutputTokenDetails.TextTokens)).Mul(decimal.NewFromFloat(price.CompletionRatio)))
	amount = amount.Add(decimal.NewFromInt(int64(usage.InputTokenDetails.AudioTokens)).Mul(decimal.NewFromFloat(price.AudioRatio)))
	amount = amount.Add(decimal.NewFromInt(int64(usage.OutputTokenDetails.AudioTokens)).Mul(decimal.NewFromFloat(price.AudioRatio)).Mul(decimal.NewFromFloat(price.AudioCompletionRatio)))
	amount = amount.Mul(decimal.NewFromFloat(price.ModelRatio)).Mul(decimal.NewFromFloat(price.GroupRatioInfo.GroupRatio))
	if price.UsePrice {
		amount = decimal.NewFromFloat(price.ModelPrice).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).Mul(decimal.NewFromFloat(price.GroupRatioInfo.GroupRatio))
	}
	amount = price.ApplyOtherRatiosToDecimal(amount)
	if usage.TotalTokens == 0 {
		amount = decimal.Zero
	}
	quota, clamp := common.QuotaFromDecimalChecked(amount)
	noteQuotaClamp(info, clamp)
	if amount.IsPositive() && quota == 0 {
		quota = 1
	}

	var result *billingexpr.TieredResult
	fallback := false
	if responses := info.RealtimeBilling.ResponseBilling; responses != nil {
		quota = responses.Quota
	} else if snap := info.TieredBillingSnapshot; snap != nil {
		canonical := &dto.Usage{
			PromptTokens: usage.InputTokens, CompletionTokens: usage.OutputTokens, TotalTokens: usage.TotalTokens,
			PromptTokensDetails: usage.InputTokenDetails, CompletionTokenDetails: usage.OutputTokenDetails,
		}
		params := BuildTieredTokenParams(canonical, false, billingexpr.UsedVarsByHash(snap.ExprString, snap.ExprHash))
		if ok, tieredQuota, tieredResult := TryTieredSettle(info, params); ok {
			quota, result = tieredQuota, tieredResult
			fallback = tieredResult == nil
		}
	}
	summary := textQuotaSummary{ModelName: info.GetBillingModelName(), GroupRatio: price.GroupRatioInfo.GroupRatio}
	summary.ToolCallSurchargeQuota = calculateTextToolCallSurcharge(ctx, info, &summary)
	info.RealtimeBilling.ToolQuota = summary.ToolCallSurchargeQuota
	if fallback {
		// The fallback is the complete reservation, including its search fees.
		// Only searches not covered by that reservation may be added again.
		summary.ToolCallSurchargeQuota = decimal.Max(decimal.Zero,
			summary.ToolCallSurchargeQuota.Sub(info.RealtimeBilling.ReservedToolQuota))
	}
	quota = composeTieredTextQuota(info, summary, quota, result)
	if info.RealtimeBilling.UsageIncomplete || info.RealtimeBilling.ResponseBilling != nil && info.RealtimeBilling.ResponseBilling.Failed {
		quota = max(quota, info.FinalPreConsumedQuota)
	}
	return quota, result, summary.ToolSurchargeItems
}

// PostWssConsumeQuota settles a complete realtime session once and records its
// audio/text split, frozen tool charges and any incomplete upstream usage.
func PostWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, modelName string,
	usage *dto.RealtimeUsage, extraContent []*common.Message) {

	quota, tieredResult, toolItems := calculateRealtimeQuota(ctx, relayInfo, usage)
	modelName = relayInfo.GetBillingModelName()
	tokenName := ctx.GetString("token_name")
	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	completionRatio := decimal.NewFromFloat(relayInfo.PriceData.CompletionRatio)
	audioRatio := decimal.NewFromFloat(relayInfo.PriceData.AudioRatio)
	audioCompletionRatio := decimal.NewFromFloat(relayInfo.PriceData.AudioCompletionRatio)
	modelRatio := relayInfo.PriceData.ModelRatio
	groupRatio := relayInfo.PriceData.GroupRatioInfo.GroupRatio
	modelPrice := relayInfo.PriceData.ModelPrice
	usePrice := relayInfo.PriceData.UsePrice

	totalTokens := usage.TotalTokens
	var logContent []*common.Message
	if !usePrice {
		logContent = append(logContent, common.NewMessage("Model ratio {{model_ratio}}, completion ratio {{completion_ratio}}, audio ratio {{audio_ratio}}, audio completion ratio {{audio_completion_ratio}}, group ratio {{group_ratio}}", map[string]any{
			"model_ratio":            fmt.Sprintf("%.2f", modelRatio),
			"completion_ratio":       fmt.Sprintf("%.2f", completionRatio.InexactFloat64()),
			"audio_ratio":            fmt.Sprintf("%.2f", audioRatio.InexactFloat64()),
			"audio_completion_ratio": fmt.Sprintf("%.2f", audioCompletionRatio.InexactFloat64()),
			"group_ratio":            fmt.Sprintf("%.2f", groupRatio),
		}))
	} else {
		logContent = append(logContent, common.NewMessage("Model price {{model_price}}, group ratio {{group_ratio}}", map[string]any{
			"model_price": fmt.Sprintf("%.2f", modelPrice),
			"group_ratio": fmt.Sprintf("%.2f", groupRatio),
		}))
	}

	// record all the consume log even if quota is 0
	failedResponseBilling := relayInfo.RealtimeBilling.ResponseBilling != nil && relayInfo.RealtimeBilling.ResponseBilling.Failed
	if totalTokens == 0 && len(toolItems) == 0 && !relayInfo.RealtimeBilling.UsageIncomplete && !failedResponseBilling {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
		logContent = append(logContent, common.NewMessage("Possibly an upstream timeout"))
		logger.LogError(ctx, common.LogText("total tokens is 0, cannot consume quota, userId %d, channelId %d, tokenId %d, model %s， pre-consumed quota %d",
			relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, modelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}

	if err := SettleBilling(ctx, relayInfo, quota); err != nil {
		logger.LogError(ctx, common.LogText("error settling billing: %s", err.Error()))
	}

	logModel := modelName
	logContent = append(logContent, extraContent...)
	other := GenerateWssOtherInfo(ctx, relayInfo, usage, modelRatio, groupRatio,
		completionRatio.InexactFloat64(), audioRatio.InexactFloat64(), audioCompletionRatio.InexactFloat64(), modelPrice, relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio)
	if tieredResult != nil {
		InjectTieredBillingInfo(other, relayInfo, tieredResult)
	}
	if responses := relayInfo.RealtimeBilling.ResponseBilling; responses != nil {
		// Each turn records its own unit and tier; the aggregate may mix them.
		InjectTieredBillingInfo(other, relayInfo, &billingexpr.TieredResult{MatchedTier: "per_response"})
		other.SetPublic("realtime_responses", responses.Turns)
		if responses.Failed {
			other.SetAdmin("realtime_billing_incomplete", true)
		}
	}
	appendToolSurchargeLogInfo(other, toolItems)
	if relayInfo.RealtimeBilling.UsageIncomplete {
		other.SetAdmin("realtime_usage_incomplete", true)
	}
	attachQuotaSaturation(ctx, relayInfo, other)
	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     usage.InputTokens,
		CompletionTokens: usage.OutputTokens,
		ModelName:        logModel,
		TokenName:        tokenName,
		Quota:            quota,
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
}

func CalcOpenRouterCacheCreateTokens(usage dto.Usage, priceData types.PriceData) int {
	if priceData.CacheCreationRatio == 1 {
		return 0
	}
	quotaPrice := priceData.ModelRatio / common.QuotaPerUnit
	promptCacheCreatePrice := quotaPrice * priceData.CacheCreationRatio
	promptCacheReadPrice := quotaPrice * priceData.CacheRatio
	completionPrice := quotaPrice * priceData.CompletionRatio

	cost, _ := usage.Cost.(float64)
	totalPromptTokens := float64(usage.PromptTokens)
	completionTokens := float64(usage.CompletionTokens)
	promptCacheReadTokens := float64(usage.PromptTokensDetails.CachedTokens)

	value := (cost -
		totalPromptTokens*quotaPrice +
		promptCacheReadTokens*(quotaPrice-promptCacheReadPrice) -
		completionTokens*completionPrice) /
		(promptCacheCreatePrice - quotaPrice)
	quota, clamp := common.QuotaRoundChecked(value)
	if clamp != nil {
		return -1
	}
	return quota
}

func PostAudioConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, extraContent []*common.Message) {
	if usage == nil {
		usage = &dto.Usage{PromptTokens: relayInfo.GetEstimatePromptTokens(), TotalTokens: relayInfo.GetEstimatePromptTokens()}
	}

	var tieredUsedVars map[string]bool
	if snap := relayInfo.TieredBillingSnapshot; snap != nil {
		tieredUsedVars = billingexpr.UsedVarsByHash(snap.ExprString, snap.ExprHash)
	}
	var tieredResult *billingexpr.TieredResult
	tieredOk, tieredQuota, tieredRes := TryTieredSettle(relayInfo, BuildTieredTokenParams(usage, false, tieredUsedVars))
	if tieredOk {
		tieredResult = tieredRes
	}
	fixedPriceBilling := tieredOk && isFixedPriceSettlement(relayInfo, tieredRes)

	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	textInputTokens := usage.PromptTokensDetails.TextTokens
	textOutTokens := usage.CompletionTokenDetails.TextTokens

	audioInputTokens := usage.PromptTokensDetails.AudioTokens
	audioOutTokens := usage.CompletionTokenDetails.AudioTokens

	tokenName := ctx.GetString("token_name")
	billingModelName := relayInfo.GetBillingModelName()
	completionRatio := decimal.NewFromFloat(ratio_setting.GetCompletionRatio(billingModelName))
	audioRatio := decimal.NewFromFloat(ratio_setting.GetAudioRatio(billingModelName))
	audioCompletionRatio := decimal.NewFromFloat(ratio_setting.GetAudioCompletionRatio(billingModelName))

	modelRatio := relayInfo.PriceData.ModelRatio
	groupRatio := relayInfo.PriceData.GroupRatioInfo.GroupRatio
	modelPrice := relayInfo.PriceData.ModelPrice
	usePrice := relayInfo.PriceData.UsePrice

	quotaInfo := QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:  textInputTokens,
			AudioTokens: audioInputTokens,
		},
		OutputDetails: TokenDetails{
			TextTokens:  textOutTokens,
			AudioTokens: audioOutTokens,
		},
		ModelName:  billingModelName,
		UsePrice:   usePrice,
		ModelRatio: modelRatio,
		GroupRatio: groupRatio,
	}

	quota, clamp := calculateAudioQuota(quotaInfo)
	noteQuotaClamp(relayInfo, clamp)
	if tieredOk {
		quota = tieredQuota
	}

	totalTokens := usage.TotalTokens
	var logContent []*common.Message
	if !usePrice {
		logContent = append(logContent, common.NewMessage("Model ratio {{model_ratio}}, completion ratio {{completion_ratio}}, audio ratio {{audio_ratio}}, audio completion ratio {{audio_completion_ratio}}, group ratio {{group_ratio}}", map[string]any{
			"model_ratio":            fmt.Sprintf("%.2f", modelRatio),
			"completion_ratio":       fmt.Sprintf("%.2f", completionRatio.InexactFloat64()),
			"audio_ratio":            fmt.Sprintf("%.2f", audioRatio.InexactFloat64()),
			"audio_completion_ratio": fmt.Sprintf("%.2f", audioCompletionRatio.InexactFloat64()),
			"group_ratio":            fmt.Sprintf("%.2f", groupRatio),
		}))
	} else {
		logContent = append(logContent, common.NewMessage("Model price {{model_price}}, group ratio {{group_ratio}}", map[string]any{
			"model_price": fmt.Sprintf("%.2f", modelPrice),
			"group_ratio": fmt.Sprintf("%.2f", groupRatio),
		}))
	}

	// record all the consume log even if quota is 0
	if totalTokens == 0 && !fixedPriceBilling {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
		logContent = append(logContent, common.NewMessage("Possibly an upstream timeout"))
		logger.LogError(ctx, common.LogText("total tokens is 0, cannot consume quota, userId %d, channelId %d, tokenId %d, model %s， pre-consumed quota %d",
			relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, billingModelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}

	if err := SettleBilling(ctx, relayInfo, quota); err != nil {
		logger.LogError(ctx, common.LogText("error settling billing: %s", err.Error()))
	}

	logModel := billingModelName
	logContent = append(logContent, extraContent...)
	other := GenerateAudioOtherInfo(ctx, relayInfo, usage, modelRatio, groupRatio,
		completionRatio.InexactFloat64(), audioRatio.InexactFloat64(), audioCompletionRatio.InexactFloat64(), modelPrice, relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio)
	if tieredResult != nil {
		InjectTieredBillingInfo(other, relayInfo, tieredResult)
	}
	attachQuotaSaturation(ctx, relayInfo, other)
	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		ModelName:        logModel,
		TokenName:        tokenName,
		Quota:            quota,
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
	relayInfo.PerformanceOutputTokens = int64(usage.CompletionTokens)
}

func PreConsumeTokenQuota(relayInfo *relaycommon.RelayInfo, quota int) error {
	if quota < 0 {
		return errors.New("quota cannot be negative")
	}
	if relayInfo.IsPlayground {
		return nil
	}
	// 原子预扣：检查与扣减在同一操作中完成，并发请求不可能同时通过检查后超扣。
	reserved, err := model.TryReserveTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, quota, relayInfo.TokenUnlimited)
	if err != nil {
		return err
	}
	if !reserved {
		remainQuota := 0
		if token, tokenErr := model.GetTokenByKey(relayInfo.TokenKey, false); tokenErr == nil && token != nil {
			remainQuota = token.RemainQuota
		}
		return fmt.Errorf("token quota is not enough, token remain quota: %s, need quota: %s", logger.FormatQuota(remainQuota), logger.FormatQuota(quota))
	}
	return nil
}

type postConsumeQuotaResult struct {
	FundingApplied bool
	TokenApplied   bool
}

func PostConsumeQuota(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int, sendEmail bool) error {
	_, err := postConsumeQuotaWithResult(relayInfo, quota, preConsumedQuota, sendEmail)
	return err
}

func postConsumeQuotaWithResult(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int, sendEmail bool) (result postConsumeQuotaResult, err error) {

	// 1) Consume from wallet quota OR subscription item
	if relayInfo != nil && relayInfo.BillingSource == BillingSourceSubscription {
		if relayInfo.SubscriptionId == 0 {
			return result, errors.New("subscription id is missing")
		}
		delta := int64(quota)
		if delta != 0 {
			if err := model.PostConsumeUserSubscriptionDelta(relayInfo.SubscriptionId, delta); err != nil {
				return result, err
			}
			relayInfo.SubscriptionPostDelta += delta
		}
	} else {
		// Wallet
		if quota > 0 {
			err = model.DecreaseUserQuota(relayInfo.UserId, quota, false)
		} else {
			err = model.IncreaseUserQuota(relayInfo.UserId, -quota, false)
		}
		if err != nil {
			return result, err
		}
	}
	result.FundingApplied = true

	if !relayInfo.IsPlayground {
		if quota > 0 {
			err = model.DecreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, quota)
		} else {
			err = model.IncreaseTokenQuota(relayInfo.TokenId, relayInfo.TokenKey, -quota)
		}
		if err != nil {
			return result, err
		}
		result.TokenApplied = true
	}

	if sendEmail {
		if (quota + preConsumedQuota) != 0 {
			checkAndSendQuotaNotify(relayInfo, quota, preConsumedQuota)
		}
	}

	return result, nil
}

func checkAndSendQuotaNotify(relayInfo *relaycommon.RelayInfo, quota int, preConsumedQuota int) {
	gopool.Go(func() {
		userSetting := relayInfo.UserSetting
		// UserQuota is the balance before this request; quota plus
		// preConsumedQuota is what the request finally cost.
		balanceAfter := relayInfo.UserQuota - (quota + preConsumedQuota)
		if !quotaReminderDue(userSetting, int64(relayInfo.UserQuota), int64(balanceAfter)) {
			return
		}
		lang := userSetting.Language
		prompt := i18n.Translate(lang, i18n.MsgNotifyQuotaLowTitle)
		content, values := quotaNotifyContent(lang, userSetting.NotifyType, prompt, logger.FormatQuota(balanceAfter))
		err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values))
		if err != nil {
			common.SysError(common.LogText("failed to send quota notify to user %d: %s", relayInfo.UserId, err.Error()))
		}
	})
}

func checkAndSendSubscriptionQuotaNotify(relayInfo *relaycommon.RelayInfo) {
	gopool.Go(func() {
		if relayInfo == nil {
			return
		}
		if relayInfo.SubscriptionId == 0 || relayInfo.SubscriptionAmountTotal <= 0 {
			return
		}

		userSetting := relayInfo.UserSetting
		usedBefore := relayInfo.SubscriptionAmountUsedAfterPreConsume - relayInfo.SubscriptionPreConsumed
		usedAfter := relayInfo.SubscriptionAmountUsedAfterPreConsume + relayInfo.SubscriptionPostDelta
		remaining := relayInfo.SubscriptionAmountTotal - usedAfter
		if !quotaReminderDue(userSetting, relayInfo.SubscriptionAmountTotal-usedBefore, remaining) {
			return
		}

		lang := userSetting.Language
		prompt := i18n.Translate(lang, i18n.MsgNotifySubscriptionQuotaLowTitle)
		content, values := quotaNotifyContent(lang, userSetting.NotifyType, prompt, logger.FormatQuota(int(remaining)))
		if err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values)); err != nil {
			common.SysError(common.LogText("failed to send subscription quota notify to user %d: %s", relayInfo.UserId, err.Error()))
		}
	})
}

// quotaReminderDue reports whether a charge that moved a balance (wallet or
// subscription) from before to after earns a low-balance reminder. The site
// and the user must both have reminders on, and the charge must cross the
// user's threshold, or the site default when the user set none. A balance
// already below the threshold earns nothing more until a top-up lifts it back
// above, so a user gets one reminder per drop.
func quotaReminderDue(userSetting dto.UserSetting, before int64, after int64) bool {
	if !common.QuotaRemindEnabled {
		return false
	}
	if userSetting.QuotaWarningEnabled != nil && !*userSetting.QuotaWarningEnabled {
		return false
	}
	threshold := float64(common.QuotaRemindThreshold)
	if userSetting.QuotaWarningThreshold != 0 {
		threshold = userSetting.QuotaWarningThreshold
	}
	return float64(before) >= threshold && float64(after) < threshold
}

// quotaNotifyContent renders a low-quota notice in the user's saved language.
// Bark and Gotify get plain text; email and webhook get HTML with the top-up
// link. values stay in the notify payload for webhook receivers.
func quotaNotifyContent(lang string, notifyType string, prompt string, remaining string) (string, []any) {
	switch notifyType {
	case dto.NotifyTypeBark:
		// Bark推送使用简短文本，不支持HTML
		return i18n.Translate(lang, i18n.MsgNotifyQuotaLowBark, map[string]any{"Prompt": prompt, "Quota": remaining}), []any{prompt, remaining}
	case dto.NotifyTypeGotify:
		return i18n.Translate(lang, i18n.MsgNotifyQuotaLowGotify, map[string]any{"Prompt": prompt, "Quota": remaining}), []any{prompt, remaining}
	default:
		topUpLink := PaymentReturnURL("/wallet")
		return i18n.Translate(lang, i18n.MsgNotifyQuotaLowEmail, map[string]any{"Prompt": prompt, "Quota": remaining, "Link": topUpLink}), []any{prompt, remaining, topUpLink, topUpLink}
	}
}
