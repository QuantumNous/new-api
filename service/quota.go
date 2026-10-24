package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
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

// realtimeSessionQuota is the absolute charge for the cumulative realtime usage.
// Tier inputs stay P/C/Len from the input and output totals. Splitting audio and
// cache out of those totals is a separate change.
func realtimeSessionQuota(relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage) (quota int, tiered *billingexpr.TieredResult, clamp *common.QuotaClamp) {
	if relayInfo.PriceData.FreeModel {
		return 0, nil, nil
	}
	if snap := relayInfo.TieredBillingSnapshot; snap != nil && snap.BillingMode == "tiered_expr" {
		ok, q, res := TryTieredSettle(relayInfo, billingexpr.TokenParams{
			P:   float64(usage.InputTokens),
			C:   float64(usage.OutputTokens),
			Len: float64(usage.InputTokens),
		})
		if ok {
			return q, res, relayInfo.QuotaClamp
		}
	}
	billingName := relayInfo.GetBillingModelName()
	q, audioClamp := calculateAudioQuota(QuotaInfo{
		InputDetails: TokenDetails{
			TextTokens:  usage.InputTokenDetails.TextTokens,
			AudioTokens: usage.InputTokenDetails.AudioTokens,
		},
		OutputDetails: TokenDetails{
			TextTokens:  usage.OutputTokenDetails.TextTokens,
			AudioTokens: usage.OutputTokenDetails.AudioTokens,
		},
		ModelName:  billingName,
		UsePrice:   relayInfo.PriceData.UsePrice,
		ModelPrice: relayInfo.PriceData.ModelPrice,
		ModelRatio: relayInfo.PriceData.ModelRatio,
		GroupRatio: relayInfo.PriceData.GroupRatioInfo.GroupRatio,
	})
	return q, nil, audioClamp
}

func PreWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage) error {
	if relayInfo == nil || usage == nil || relayInfo.PriceData.FreeModel {
		return nil
	}
	quota, _, clamp := realtimeSessionQuota(relayInfo, usage)
	noteQuotaClamp(relayInfo, clamp)
	if quota < 0 {
		return fmt.Errorf("realtime quota is negative")
	}
	if relayInfo.Billing == nil || quota <= relayInfo.RealtimeCommittedQuota && quota <= relayInfo.Billing.GetPreConsumedQuota() {
		relayInfo.RealtimeCommittedQuota = quota
		return nil
	}
	if err := relayInfo.Billing.Reserve(quota); err != nil {
		return err
	}
	relayInfo.RealtimeCommittedQuota = quota
	logger.LogInfo(ctx, common.LogText("realtime streaming consume quota success, quota: %d", quota))
	return nil
}

func PostWssConsumeQuota(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.RealtimeUsage, extraContent []*common.Message) {
	if usage == nil {
		usage = &dto.RealtimeUsage{}
	}
	billingName := relayInfo.GetBillingModelName()
	empty := usage.TotalTokens == 0 && usage.InputTokens == 0 && usage.OutputTokens == 0 &&
		usage.InputTokenDetails.TextTokens == 0 && usage.InputTokenDetails.AudioTokens == 0 &&
		usage.InputTokenDetails.CachedTokens == 0 &&
		usage.OutputTokenDetails.TextTokens == 0 && usage.OutputTokenDetails.AudioTokens == 0

	var tieredResult *billingexpr.TieredResult
	var payable int
	if empty && relayInfo.RealtimeCommittedQuota == 0 {
		payable = 0
	} else if empty {
		payable = relayInfo.RealtimeCommittedQuota
	} else {
		var clamp *common.QuotaClamp
		payable, tieredResult, clamp = realtimeSessionQuota(relayInfo, usage)
		noteQuotaClamp(relayInfo, clamp)
	}
	if payable < 0 {
		payable = 0
	}

	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	tokenName := ctx.GetString("token_name")
	completionRatio := decimal.NewFromFloat(ratio_setting.GetCompletionRatio(billingName))
	audioRatio := decimal.NewFromFloat(ratio_setting.GetAudioRatio(billingName))
	audioCompletionRatio := decimal.NewFromFloat(ratio_setting.GetAudioCompletionRatio(billingName))

	modelRatio := relayInfo.PriceData.ModelRatio
	groupRatio := relayInfo.PriceData.GroupRatioInfo.GroupRatio
	modelPrice := relayInfo.PriceData.ModelPrice
	usePrice := relayInfo.PriceData.UsePrice

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

	// An empty session with nothing committed is the existing upstream-timeout
	// refund. Empty usage after a committed turn must keep that charge.
	if empty && relayInfo.RealtimeCommittedQuota == 0 {
		logContent = append(logContent, common.NewMessage("Possibly an upstream timeout"))
		logger.LogError(ctx, common.LogText("total tokens is 0, cannot consume quota, userId %d, channelId %d, tokenId %d, model %s， pre-consumed quota %d",
			relayInfo.UserId, relayInfo.ChannelId, relayInfo.TokenId, billingName, relayInfo.FinalPreConsumedQuota))
	} else {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, payable)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, payable)
	}

	if err := SettleBilling(ctx, relayInfo, payable); err != nil {
		logger.LogError(ctx, common.LogText("error settling billing: %s", err.Error()))
	}

	logContent = append(logContent, extraContent...)
	other := GenerateWssOtherInfo(ctx, relayInfo, usage, modelRatio, groupRatio,
		completionRatio.InexactFloat64(), audioRatio.InexactFloat64(), audioCompletionRatio.InexactFloat64(), modelPrice, relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio)
	if tieredResult != nil {
		InjectTieredBillingInfo(other, relayInfo, tieredResult)
	}
	attachQuotaSaturation(ctx, relayInfo, other)
	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     usage.InputTokens,
		CompletionTokens: usage.OutputTokens,
		ModelName:        billingName,
		TokenName:        tokenName,
		Quota:            payable,
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
		ModelPrice: modelPrice,
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
