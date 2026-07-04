package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
)

//func GetPromptTokens(textRequest dto.GeneralOpenAIRequest, relayMode int) (int, error) {
//	switch relayMode {
//	case constant.RelayModeChatCompletions:
//		return CountTokenMessages(textRequest.Messages, textRequest.Model)
//	case constant.RelayModeCompletions:
//		return CountTokenInput(textRequest.Prompt, textRequest.Model), nil
//	case constant.RelayModeModerations:
//		return CountTokenInput(textRequest.Input, textRequest.Model), nil
//	}
//	return 0, errors.New("unknown relay mode")
//}

func ResponseText2Usage(c *gin.Context, responseText string, modeName string, promptTokens int) *dto.Usage {
	common.SetContextKey(c, constant.ContextKeyLocalCountTokens, true)
	usage := &dto.Usage{}
	usage.PromptTokens = promptTokens
	usage.CompletionTokens = EstimateTokenByModel(modeName, responseText)
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	ApplyLocalCountCacheControlFallback(c, usage)
	return usage
}

func ApplyLocalCountCacheControlFallback(c *gin.Context, usage *dto.Usage) {
	if c == nil || usage == nil {
		return
	}
	if !common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens) ||
		!common.GetContextKeyBool(c, constant.ContextKeyRequestHasCacheControl) {
		return
	}
	if usage.PromptTokens <= 0 ||
		usage.PromptTokensDetails.CachedCreationTokens > 0 ||
		usage.PromptTokensDetails.CachedTokens > 0 ||
		usage.ClaudeCacheCreation5mTokens > 0 ||
		usage.ClaudeCacheCreation1hTokens > 0 {
		return
	}

	cacheControlCount := common.GetContextKeyInt(c, constant.ContextKeyRequestCacheControlCount)
	if cacheControlCount < 1 {
		cacheControlCount = 1
	}
	usage.PromptTokensDetails.CachedCreationTokens = usage.PromptTokens * cacheControlCount
	common.SetContextKey(c, constant.ContextKeyUsageFallback, "local_cache_control_estimate")
	common.SetContextKey(c, constant.ContextKeyUsageFallbackReason, "upstream_usage_missing_with_cache_control")
	common.SetContextKey(c, constant.ContextKeyUsageReliability, "estimated_conservative")
}

func ValidUsage(usage *dto.Usage) bool {
	return usage != nil && (usage.PromptTokens != 0 || usage.CompletionTokens != 0)
}
