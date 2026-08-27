package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type TokenDetails struct {
	TextTokens        int
	AudioTokens       int
	ImageTokens       int
	ReasoningTokens   int
	CachedTextTokens  int
	CachedAudioTokens int
	CachedImageTokens int
}

type QuotaInfo struct {
	InputDetails         TokenDetails
	OutputDetails        TokenDetails
	UsePrice             bool
	ModelPrice           float64
	ModelRatio           float64
	GroupRatio           float64
	CompletionRatio      float64
	ImageRatio           float64
	CacheRatio           float64
	AudioCacheRatio      float64
	ImageCacheRatio      float64
	AudioRatio           float64
	AudioCompletionRatio float64
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

	completionRatio := decimal.NewFromFloat(info.CompletionRatio)
	audioRatio := decimal.NewFromFloat(info.AudioRatio)
	audioCompletionRatio := decimal.NewFromFloat(info.AudioCompletionRatio)
	imageRatio := decimal.NewFromFloat(info.ImageRatio)
	cacheRatio := decimal.NewFromFloat(info.CacheRatio)
	audioCacheRatio := decimal.NewFromFloat(info.AudioCacheRatio)
	imageCacheRatio := decimal.NewFromFloat(info.ImageCacheRatio)

	groupRatio := decimal.NewFromFloat(info.GroupRatio)
	modelRatio := decimal.NewFromFloat(info.ModelRatio)
	ratio := groupRatio.Mul(modelRatio)

	inputTextTokens := decimal.NewFromInt(int64(info.InputDetails.TextTokens))
	outputTextTokens := decimal.NewFromInt(int64(info.OutputDetails.TextTokens + info.OutputDetails.ReasoningTokens))
	inputAudioTokens := decimal.NewFromInt(int64(info.InputDetails.AudioTokens))
	outputAudioTokens := decimal.NewFromInt(int64(info.OutputDetails.AudioTokens))
	inputImageTokens := decimal.NewFromInt(int64(info.InputDetails.ImageTokens))
	outputImageTokens := decimal.NewFromInt(int64(info.OutputDetails.ImageTokens))
	cachedTextTokens := decimal.NewFromInt(int64(info.InputDetails.CachedTextTokens))
	cachedAudioTokens := decimal.NewFromInt(int64(info.InputDetails.CachedAudioTokens))
	cachedImageTokens := decimal.NewFromInt(int64(info.InputDetails.CachedImageTokens))

	baseInputTokens := inputTextTokens.Sub(cachedTextTokens)
	baseInputAudioTokens := inputAudioTokens.Sub(cachedAudioTokens)
	baseInputImageTokens := inputImageTokens.Sub(cachedImageTokens)
	if baseInputTokens.IsNegative() {
		baseInputTokens = decimal.Zero
	}
	if baseInputAudioTokens.IsNegative() {
		baseInputAudioTokens = decimal.Zero
	}
	if baseInputImageTokens.IsNegative() {
		baseInputImageTokens = decimal.Zero
	}

	quota := decimal.Zero
	quota = quota.Add(baseInputTokens)
	quota = quota.Add(outputTextTokens.Add(outputImageTokens).Mul(completionRatio))
	quota = quota.Add(baseInputAudioTokens.Mul(audioRatio))
	quota = quota.Add(outputAudioTokens.Mul(audioRatio).Mul(audioCompletionRatio))
	quota = quota.Add(baseInputImageTokens.Mul(imageRatio))
	quota = quota.Add(cachedTextTokens.Mul(cacheRatio))
	quota = quota.Add(cachedAudioTokens.Mul(audioCacheRatio))
	quota = quota.Add(cachedImageTokens.Mul(imageCacheRatio))

	quota = quota.Mul(ratio)

	// If ratio is not zero and quota is less than or equal to zero, set quota to 1
	if !ratio.IsZero() && quota.LessThanOrEqual(decimal.Zero) {
		quota = decimal.NewFromInt(1)
	}

	return common.QuotaFromDecimalChecked(quota)
}

func newRealtimeQuotaInfo(relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage) QuotaInfo {
	cachedDetails := usage.InputTokenDetails.CachedTokensDetails
	cachedTextTokens := cachedDetails.TextTokens
	cachedDetailTotal := cachedDetails.TextTokens + cachedDetails.AudioTokens + cachedDetails.ImageTokens
	if uncategorizedCachedTokens := usage.InputTokenDetails.CachedTokens - cachedDetailTotal; uncategorizedCachedTokens > 0 {
		// Legacy Realtime usage only exposes cached_tokens. Preserve the historic
		// text-cache interpretation until an upstream supplies modality details.
		cachedTextTokens += uncategorizedCachedTokens
	}
	return QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:        usage.InputTokenDetails.TextTokens,
			AudioTokens:       usage.InputTokenDetails.AudioTokens,
			ImageTokens:       usage.InputTokenDetails.ImageTokens,
			CachedTextTokens:  cachedTextTokens,
			CachedAudioTokens: cachedDetails.AudioTokens,
			CachedImageTokens: cachedDetails.ImageTokens,
		},
		OutputDetails: TokenDetails{
			TextTokens:      usage.OutputTokenDetails.TextTokens,
			AudioTokens:     usage.OutputTokenDetails.AudioTokens,
			ImageTokens:     usage.OutputTokenDetails.ImageTokens,
			ReasoningTokens: usage.OutputTokenDetails.ReasoningTokens,
		},
		UsePrice:             relayInfo.PriceData.UsePrice,
		ModelPrice:           relayInfo.PriceData.ModelPrice,
		ModelRatio:           relayInfo.PriceData.ModelRatio,
		GroupRatio:           relayInfo.PriceData.GroupRatioInfo.GroupRatio,
		CompletionRatio:      relayInfo.PriceData.CompletionRatio,
		ImageRatio:           relayInfo.PriceData.ImageRatio,
		CacheRatio:           relayInfo.PriceData.CacheRatio,
		AudioCacheRatio:      relayInfo.PriceData.AudioCacheRatio,
		ImageCacheRatio:      relayInfo.PriceData.ImageCacheRatio,
		AudioRatio:           relayInfo.PriceData.AudioRatio,
		AudioCompletionRatio: relayInfo.PriceData.AudioCompletionRatio,
	}
}

func newRealtimeUsage(usage *dto.RealtimeUsage) *dto.Usage {
	return &dto.Usage{
		PromptTokens:           usage.InputTokens,
		CompletionTokens:       usage.OutputTokens,
		PromptTokensDetails:    usage.InputTokenDetails,
		CompletionTokenDetails: usage.OutputTokenDetails,
	}
}

func trySettleRealtimeTieredQuota(relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage) (int, bool) {
	if relayInfo.TieredBillingSnapshot == nil {
		return 0, false
	}
	usedVars := billingexpr.UsedVars(relayInfo.TieredBillingSnapshot.ExprString)
	tieredOk, tieredQuota, _ := TryTieredSettle(relayInfo, BuildTieredTokenParams(newRealtimeUsage(usage), false, usedVars))
	return tieredQuota, tieredOk
}

func PreWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage, totalUsage *dto.RealtimeUsage) error {
	if relayInfo.UsePrice {
		return nil
	}

	var quota int
	if relayInfo.Billing != nil {
		var clamp *common.QuotaClamp
		quota, clamp = calculateAudioQuota(newRealtimeQuotaInfo(relayInfo, totalUsage))
		noteQuotaClamp(relayInfo, clamp)
		if tieredQuota, ok := trySettleRealtimeTieredQuota(relayInfo, totalUsage); ok {
			quota = tieredQuota
		}
		if err := relayInfo.Billing.Reserve(quota); err != nil {
			return err
		}
	} else {
		var clamp *common.QuotaClamp
		quota, clamp = calculateAudioQuota(newRealtimeQuotaInfo(relayInfo, usage))
		noteQuotaClamp(relayInfo, clamp)
		userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
		if err != nil {
			return err
		}
		token, err := model.GetTokenByKey(strings.TrimPrefix(relayInfo.TokenKey, "sk-"), false)
		if err != nil {
			return err
		}
		if userQuota < quota {
			return fmt.Errorf("user quota is not enough, user quota: %s, need quota: %s", logger.FormatQuota(userQuota), logger.FormatQuota(quota))
		}
		if !token.UnlimitedQuota && token.RemainQuota < quota {
			return fmt.Errorf("token quota is not enough, token remain quota: %s, need quota: %s", logger.FormatQuota(token.RemainQuota), logger.FormatQuota(quota))
		}
		if err := PostConsumeQuota(relayInfo, quota, 0, false); err != nil {
			return err
		}
	}
	logger.LogInfo(ctx, "realtime streaming consume quota success, quota: "+fmt.Sprintf("%d", quota))
	return nil
}

func PostWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, modelName string,
	usage *dto.RealtimeUsage, extraContent string) {

	var tieredUsedVars map[string]bool
	if snap := relayInfo.TieredBillingSnapshot; snap != nil {
		tieredUsedVars = billingexpr.UsedVars(snap.ExprString)
	}
	var tieredResult *billingexpr.TieredResult
	tieredOk, tieredQuota, tieredRes := TryTieredSettle(relayInfo, BuildTieredTokenParams(newRealtimeUsage(usage), false, tieredUsedVars))
	if tieredOk {
		tieredResult = tieredRes
	}

	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	cachedTokens := usage.InputTokenDetails.CachedTokens

	tokenName := ctx.GetString("token_name")
	completionRatio := decimal.NewFromFloat(relayInfo.PriceData.CompletionRatio)
	audioRatio := decimal.NewFromFloat(relayInfo.PriceData.AudioRatio)
	audioCompletionRatio := decimal.NewFromFloat(relayInfo.PriceData.AudioCompletionRatio)
	imageRatio := relayInfo.PriceData.ImageRatio
	cacheRatio := relayInfo.PriceData.CacheRatio
	audioCacheRatio := relayInfo.PriceData.AudioCacheRatio
	imageCacheRatio := relayInfo.PriceData.ImageCacheRatio

	modelRatio := relayInfo.PriceData.ModelRatio
	groupRatio := relayInfo.PriceData.GroupRatioInfo.GroupRatio
	modelPrice := relayInfo.PriceData.ModelPrice
	usePrice := relayInfo.PriceData.UsePrice

	quota, clamp := calculateAudioQuota(newRealtimeQuotaInfo(relayInfo, usage))
	noteQuotaClamp(relayInfo, clamp)
	if tieredOk {
		quota = tieredQuota
	}

	totalTokens := usage.TotalTokens
	var logContent string
	if !usePrice {
		logContent = fmt.Sprintf("模型倍率 %.2f，补全倍率 %.2f，文本缓存倍率 %.2f，音频缓存倍率 %.2f，图片缓存倍率 %.2f，图片倍率 %.2f，音频倍率 %.2f，音频补全倍率 %.2f，分组倍率 %.2f",
			modelRatio, completionRatio.InexactFloat64(), cacheRatio, audioCacheRatio, imageCacheRatio, imageRatio, audioRatio.InexactFloat64(), audioCompletionRatio.InexactFloat64(), groupRatio)
	} else {
		logContent = fmt.Sprintf("模型价格 %.2f，分组倍率 %.2f", modelPrice, groupRatio)
	}

	// record all the consume log even if quota is 0
	if totalTokens == 0 {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
		logContent += "（可能是上游超时）"
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, "+
			"tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, modelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}

	if err := SettleBilling(ctx, relayInfo, quota); err != nil {
		logger.LogError(ctx, "error settling billing: "+err.Error())
	}

	logModel := modelName
	if extraContent != "" {
		logContent += ", " + extraContent
	}
	other := GenerateWssOtherInfo(ctx, relayInfo, usage, modelRatio, groupRatio,
		completionRatio.InexactFloat64(), cachedTokens, cacheRatio, audioCacheRatio, imageCacheRatio, imageRatio, audioRatio.InexactFloat64(), audioCompletionRatio.InexactFloat64(), modelPrice, relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio)
	if tieredResult != nil {
		InjectTieredBillingInfo(other, relayInfo, tieredResult)
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

func PostAudioConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, extraContent string) {

	var tieredUsedVars map[string]bool
	if snap := relayInfo.TieredBillingSnapshot; snap != nil {
		tieredUsedVars = billingexpr.UsedVars(snap.ExprString)
	}
	var tieredResult *billingexpr.TieredResult
	tieredOk, tieredQuota, tieredRes := TryTieredSettle(relayInfo, BuildTieredTokenParams(usage, false, tieredUsedVars))
	if tieredOk {
		tieredResult = tieredRes
	}

	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	textInputTokens := usage.PromptTokensDetails.TextTokens
	textOutTokens := usage.CompletionTokenDetails.TextTokens

	audioInputTokens := usage.PromptTokensDetails.AudioTokens
	audioOutTokens := usage.CompletionTokenDetails.AudioTokens

	tokenName := ctx.GetString("token_name")
	completionRatio := decimal.NewFromFloat(relayInfo.PriceData.CompletionRatio)
	audioRatio := decimal.NewFromFloat(relayInfo.PriceData.AudioRatio)
	audioCompletionRatio := decimal.NewFromFloat(relayInfo.PriceData.AudioCompletionRatio)

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
		UsePrice:             usePrice,
		ModelPrice:           modelPrice,
		ModelRatio:           modelRatio,
		GroupRatio:           groupRatio,
		CompletionRatio:      relayInfo.PriceData.CompletionRatio,
		ImageRatio:           relayInfo.PriceData.ImageRatio,
		CacheRatio:           relayInfo.PriceData.CacheRatio,
		AudioRatio:           relayInfo.PriceData.AudioRatio,
		AudioCompletionRatio: relayInfo.PriceData.AudioCompletionRatio,
	}

	quota, clamp := calculateAudioQuota(quotaInfo)
	noteQuotaClamp(relayInfo, clamp)
	if tieredOk {
		quota = tieredQuota
	}

	totalTokens := usage.TotalTokens
	var logContent string
	if !usePrice {
		logContent = fmt.Sprintf("模型倍率 %.2f，补全倍率 %.2f，音频倍率 %.2f，音频补全倍率 %.2f，分组倍率 %.2f",
			modelRatio, completionRatio.InexactFloat64(), audioRatio.InexactFloat64(), audioCompletionRatio.InexactFloat64(), groupRatio)
	} else {
		logContent = fmt.Sprintf("模型价格 %.2f，分组倍率 %.2f", modelPrice, groupRatio)
	}

	// record all the consume log even if quota is 0
	if totalTokens == 0 {
		// in this case, must be some error happened
		// we cannot just return, because we may have to return the pre-consumed quota
		quota = 0
		logContent += "（可能是上游超时）"
		logger.LogError(ctx, fmt.Sprintf("total tokens is 0, cannot consume quota, userId %d, channelId %d, "+
			"tokenId %d, model %s， pre-consumed quota %d", relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, relayInfo.OriginModelName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}

	if err := SettleBilling(ctx, relayInfo, quota); err != nil {
		logger.LogError(ctx, "error settling billing: "+err.Error())
	}

	logModel := relayInfo.OriginModelName
	if extraContent != "" {
		logContent += ", " + extraContent
	}
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
	gopool.Go(func() {
		perfmetrics.RecordRelaySample(relayInfo, true, int64(usage.CompletionTokens))
	})
}

func PreConsumeTokenQuota(relayInfo *relaycommon.RelayInfo, quota int) error {
	if quota < 0 {
		return errors.New("quota 不能为负数！")
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
		threshold := common.QuotaRemindThreshold
		if userSetting.QuotaWarningThreshold != 0 {
			threshold = int(userSetting.QuotaWarningThreshold)
		}

		//noMoreQuota := userCache.Quota-(quota+preConsumedQuota) <= 0
		quotaTooLow := false
		consumeQuota := quota + preConsumedQuota
		if relayInfo.UserQuota-consumeQuota < threshold {
			quotaTooLow = true
		}
		if quotaTooLow {
			prompt := "您的额度即将用尽"
			topUpLink := PaymentReturnURL("/wallet")

			// 根据通知方式生成不同的内容格式
			var content string
			var values []interface{}

			notifyType := userSetting.NotifyType
			if notifyType == "" {
				notifyType = dto.NotifyTypeEmail
			}

			if notifyType == dto.NotifyTypeBark {
				// Bark推送使用简短文本，不支持HTML
				content = "{{value}}，剩余额度：{{value}}，请及时充值"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota)}
			} else if notifyType == dto.NotifyTypeGotify {
				content = "{{value}}，当前剩余额度为 {{value}}，请及时充值。"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota)}
			} else {
				// 默认内容格式，适用于Email和Webhook（支持HTML）
				content = "{{value}}，当前剩余额度为 {{value}}，为了不影响您的使用，请及时充值。<br/>充值链接：<a href='{{value}}'>{{value}}</a>"
				values = []interface{}{prompt, logger.FormatQuota(relayInfo.UserQuota), topUpLink, topUpLink}
			}

			err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values))
			if err != nil {
				common.SysError(fmt.Sprintf("failed to send quota notify to user %d: %s", relayInfo.UserId, err.Error()))
			}
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
		threshold := common.QuotaRemindThreshold
		if userSetting.QuotaWarningThreshold != 0 {
			threshold = int(userSetting.QuotaWarningThreshold)
		}

		usedAfter := relayInfo.SubscriptionAmountUsedAfterPreConsume + relayInfo.SubscriptionPostDelta
		remaining := relayInfo.SubscriptionAmountTotal - usedAfter
		if remaining >= int64(threshold) {
			return
		}

		prompt := "您的订阅额度即将用尽"
		topUpLink := PaymentReturnURL("/wallet")

		var content string
		var values []interface{}
		notifyType := userSetting.NotifyType
		if notifyType == "" {
			notifyType = dto.NotifyTypeEmail
		}

		if notifyType == dto.NotifyTypeBark {
			content = "{{value}}，剩余额度：{{value}}，请及时充值"
			values = []interface{}{prompt, logger.FormatQuota(int(remaining))}
		} else if notifyType == dto.NotifyTypeGotify {
			content = "{{value}}，当前剩余额度为 {{value}}，请及时充值。"
			values = []interface{}{prompt, logger.FormatQuota(int(remaining))}
		} else {
			content = "{{value}}，当前剩余额度为 {{value}}，为了不影响您的使用，请及时充值。<br/>充值链接：<a href='{{value}}'>{{value}}</a>"
			values = []interface{}{prompt, logger.FormatQuota(int(remaining)), topUpLink, topUpLink}
		}

		if err := NotifyUser(relayInfo.UserId, relayInfo.UserEmail, relayInfo.UserSetting, dto.NewNotify(dto.NotifyTypeQuotaExceed, prompt, content, values)); err != nil {
			common.SysError(fmt.Sprintf("failed to send subscription quota notify to user %d: %s", relayInfo.UserId, err.Error()))
		}
	})
}
