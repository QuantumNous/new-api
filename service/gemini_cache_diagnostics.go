package service

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
)

func GeminiImplicitCacheMinInputTokens(modelName string) int {
	model := strings.ToLower(strings.TrimSpace(modelName))
	switch {
	case strings.Contains(model, "gemini-2.5-pro"),
		strings.Contains(model, "gemini-3-pro"),
		strings.Contains(model, "gemini-3.1-pro"),
		strings.Contains(model, "gemini-3-flash"),
		strings.Contains(model, "gemini-3.1-flash"):
		return 4096
	case strings.Contains(model, "gemini-2.5-flash-lite"),
		strings.Contains(model, "gemini-2.5-flash"),
		strings.Contains(model, "gemini-2.0-flash"):
		return 2048
	default:
		return 0
	}
}

func MarkGeminiCacheDiagnostics(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, request *dto.GeminiChatRequest, requestInputTokens int) {
	if ctx == nil || relayInfo == nil {
		return
	}
	if requestInputTokens <= 0 {
		requestInputTokens = relayInfo.GetEstimatePromptTokens()
	}

	hasExplicitCachedContent := request != nil && strings.TrimSpace(request.CachedContent) != ""
	cacheKeySource := "implicit_prefix"
	if hasExplicitCachedContent {
		cacheKeySource = "explicit_cached_content"
	}

	channelID := relayInfo.ChannelId
	if channelID <= 0 {
		channelID = common.GetContextKeyInt(ctx, constant.ContextKeyChannelId)
	}
	channelType := relayInfo.ChannelType
	if channelType <= 0 {
		channelType = common.GetContextKeyInt(ctx, constant.ContextKeyChannelType)
	}
	baseURL := relayInfo.ChannelBaseUrl
	if baseURL == "" {
		baseURL = ctx.GetString(string(constant.ContextKeyChannelBaseUrl))
	}
	minInputTokens := GeminiImplicitCacheMinInputTokens(relayInfo.OriginModelName)
	if minInputTokens == 0 {
		minInputTokens = GeminiImplicitCacheMinInputTokens(relayInfo.UpstreamModelName)
	}

	diagnostics := map[string]any{
		"strategy":                    model_setting.GetGeminiSettings().CacheStrategy,
		"channel_id":                  channelID,
		"channel_type":                channelType,
		"upstream_base_url":           baseURL,
		"request_input_tokens":        requestInputTokens,
		"min_input_tokens":            minInputTokens,
		"eligible_for_implicit_cache": minInputTokens > 0 && requestInputTokens >= minInputTokens,
		"has_explicit_cached_content": hasExplicitCachedContent,
		"cache_key_source":            cacheKeySource,
		"request_relay_format":        relayInfo.GetFinalRequestRelayFormat(),
	}
	common.SetContextKey(ctx, constant.ContextKeyGeminiCacheDiagnostics, diagnostics)
}

func AppendGeminiCacheAdminInfo(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, adminInfo map[string]any, cacheTokens int) {
	if ctx == nil || relayInfo == nil || adminInfo == nil {
		return
	}
	if !strings.Contains(strings.ToLower(relayInfo.OriginModelName), "gemini") && !strings.Contains(strings.ToLower(relayInfo.UpstreamModelName), "gemini") {
		return
	}

	diagnostics, ok := common.GetContextKeyType[map[string]any](ctx, constant.ContextKeyGeminiCacheDiagnostics)
	if !ok || diagnostics == nil {
		diagnostics = map[string]any{
			"strategy":             model_setting.GetGeminiSettings().CacheStrategy,
			"request_relay_format": relayInfo.GetFinalRequestRelayFormat(),
		}
	}
	diagnostics["upstream_cached_tokens"] = cacheTokens
	adminInfo["gemini_cache"] = diagnostics
}

func UpdateGeminiCacheDiagnostics(ctx *gin.Context, updates map[string]any) {
	if ctx == nil || len(updates) == 0 {
		return
	}
	diagnostics, _ := common.GetContextKeyType[map[string]any](ctx, constant.ContextKeyGeminiCacheDiagnostics)
	if diagnostics == nil {
		diagnostics = make(map[string]any)
	}
	for key, value := range updates {
		diagnostics[key] = value
	}
	common.SetContextKey(ctx, constant.ContextKeyGeminiCacheDiagnostics, diagnostics)
}
