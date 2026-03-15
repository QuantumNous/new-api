package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func TestGenerateTextOtherInfoIncludesGeminiCacheDiagnostics(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := &gin.Context{}
	ctx.Set(string(constant.ContextKeyChannelBaseUrl), "https://example.com")
	ctx.Set("use_channel", []string{"23"})

	relayInfo := &relaycommon.RelayInfo{
		StartTime:         time.UnixMilli(1000),
		FirstResponseTime: time.UnixMilli(1500),
		OriginModelName:   "google/gemini-2.5-pro",
		RelayFormat:       types.RelayFormatGemini,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "google/gemini-2.5-pro",
			ChannelBaseUrl:    "https://example.com",
		},
	}
	common.SetContextKey(ctx, constant.ContextKeyChannelId, 23)
	common.SetContextKey(ctx, constant.ContextKeyChannelType, constant.ChannelTypeVertexAi)
	common.SetContextKey(ctx, constant.ContextKeyTokenId, 34)
	common.SetContextKey(ctx, constant.ContextKeyChannelOrganization, "us-central1")

	request := &dto.GeminiChatRequest{CachedContent: "cachedContents/demo"}
	MarkGeminiCacheDiagnostics(ctx, relayInfo, request, 4809)

	prevStrategy := model_setting.GetGeminiSettings().CacheStrategy
	model_setting.GetGeminiSettings().CacheStrategy = model_setting.GeminiCacheStrategyStrictAffinity
	defer func() {
		model_setting.GetGeminiSettings().CacheStrategy = prevStrategy
	}()

	other := GenerateTextOtherInfo(ctx, relayInfo, 0.625, 1, 8, 0, 0.1, -1, -1)
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected admin_info map, got %#v", other["admin_info"])
	}
	geminiCache, ok := adminInfo["gemini_cache"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected gemini_cache map, got %#v", adminInfo["gemini_cache"])
	}

	if geminiCache["strategy"] != model_setting.GeminiCacheStrategyStrictAffinity {
		t.Fatalf("unexpected strategy %#v", geminiCache["strategy"])
	}
	if geminiCache["min_input_tokens"] != 4096 {
		t.Fatalf("unexpected min_input_tokens %#v", geminiCache["min_input_tokens"])
	}
	if geminiCache["request_input_tokens"] != 4809 {
		t.Fatalf("unexpected request_input_tokens %#v", geminiCache["request_input_tokens"])
	}
	if geminiCache["eligible_for_implicit_cache"] != true {
		t.Fatalf("unexpected eligible_for_implicit_cache %#v", geminiCache["eligible_for_implicit_cache"])
	}
	if geminiCache["has_explicit_cached_content"] != true {
		t.Fatalf("unexpected has_explicit_cached_content %#v", geminiCache["has_explicit_cached_content"])
	}
	if geminiCache["channel_id"] != 23 {
		t.Fatalf("unexpected channel_id %#v", geminiCache["channel_id"])
	}
	if geminiCache["channel_type"] != constant.ChannelTypeVertexAi {
		t.Fatalf("unexpected channel_type %#v", geminiCache["channel_type"])
	}
	if geminiCache["upstream_base_url"] != "https://example.com" {
		t.Fatalf("unexpected upstream_base_url %#v", geminiCache["upstream_base_url"])
	}
	if geminiCache["cache_key_source"] != "explicit_cached_content" {
		t.Fatalf("unexpected cache_key_source %#v", geminiCache["cache_key_source"])
	}
}
