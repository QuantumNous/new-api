package gemini

import (
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func TestPrepareExplicitCacheReusesExistingEntry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/messages", nil)

	prevStrategy := model_setting.GetGeminiSettings().CacheStrategy
	prevMinTokens := model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens
	model_setting.GetGeminiSettings().CacheStrategy = model_setting.GeminiCacheStrategyExplicitCache
	model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens = 1
	defer func() {
		model_setting.GetGeminiSettings().CacheStrategy = prevStrategy
		model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens = prevMinTokens
	}()

	request := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: "shared context " + repeatedText(6000)}}},
			{Role: "user", Parts: []dto.GeminiPart{{Text: "latest question"}}},
		},
		SystemInstructions: &dto.GeminiChatContent{Parts: []dto.GeminiPart{{Text: "system"}}},
		Tools:              []byte(`[{"functionDeclarations":[]}]`),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "google/gemini-2.5-pro",
		RelayFormat:     types.RelayFormatGemini,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:         23,
			UpstreamModelName: "google/gemini-2.5-pro",
		},
	}

	prefixRequest, _, ok := buildExplicitCachePrefix(request)
	if !ok {
		t.Fatal("expected prefix request")
	}
	_, prefixHash, err := explicitCachePrefixMeta(info, prefixRequest)
	if err != nil {
		t.Fatalf("explicitCachePrefixMeta() error = %v", err)
	}
	putExplicitCacheEntry(explicitCacheRedisKey(info, prefixHash), explicitCacheEntry{Name: "cachedContents/reused"}, time.Hour)

	prepareExplicitCache(ctx, info, request)
	if request.CachedContent != "cachedContents/reused" {
		t.Fatalf("expected reused cached content, got %q", request.CachedContent)
	}
	if len(request.Contents) != 1 || request.Contents[0].Parts[0].Text != "latest question" {
		t.Fatalf("expected only tail content, got %#v", request.Contents)
	}
	if request.SystemInstructions != nil || len(request.Tools) != 0 {
		t.Fatalf("expected prefix fields stripped, got %#v", request)
	}
}

func TestPrepareExplicitCacheCreatesEntryOnMiss(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/messages", nil)

	prevStrategy := model_setting.GetGeminiSettings().CacheStrategy
	prevMinTokens := model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens
	prevTTL := model_setting.GetGeminiSettings().ExplicitCacheTTLSeconds
	prevCreate := createCachedContentFunc
	model_setting.GetGeminiSettings().CacheStrategy = model_setting.GeminiCacheStrategyExplicitCache
	model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens = 1
	model_setting.GetGeminiSettings().ExplicitCacheTTLSeconds = 300
	defer func() {
		model_setting.GetGeminiSettings().CacheStrategy = prevStrategy
		model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens = prevMinTokens
		model_setting.GetGeminiSettings().ExplicitCacheTTLSeconds = prevTTL
		createCachedContentFunc = prevCreate
	}()

	var createdPrefix *dto.GeminiChatRequest
	createCachedContentFunc = func(c *gin.Context, info *relaycommon.RelayInfo, prefixRequest *dto.GeminiChatRequest) (string, error) {
		createdPrefix = prefixRequest
		return "cachedContents/created", nil
	}

	request := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: fmt.Sprintf("prefix %s", string(make([]byte, 0)))}}},
			{Role: "user", Parts: []dto.GeminiPart{{Text: "tail"}}},
		},
		SystemInstructions: &dto.GeminiChatContent{Parts: []dto.GeminiPart{{Text: "system"}}},
	}
	request.Contents[0].Parts[0].Text = "prefix " + repeatedText(7000)
	info := &relaycommon.RelayInfo{
		OriginModelName: "google/gemini-2.5-pro",
		RelayFormat:     types.RelayFormatGemini,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:         56,
			UpstreamModelName: "google/gemini-2.5-pro",
		},
	}

	prepareExplicitCache(ctx, info, request)
	if createdPrefix == nil {
		t.Fatal("expected cached content creation")
	}
	if request.CachedContent != "cachedContents/created" {
		t.Fatalf("expected created cached content, got %q", request.CachedContent)
	}
	if len(request.Contents) != 1 || request.Contents[0].Parts[0].Text != "tail" {
		t.Fatalf("expected tail-only request, got %#v", request.Contents)
	}
}

func TestPrepareExplicitCacheBatchReuseAfterCreate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/messages", nil)

	prevStrategy := model_setting.GetGeminiSettings().CacheStrategy
	prevMinTokens := model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens
	prevTTL := model_setting.GetGeminiSettings().ExplicitCacheTTLSeconds
	prevCreate := createCachedContentFunc
	model_setting.GetGeminiSettings().CacheStrategy = model_setting.GeminiCacheStrategyExplicitCache
	model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens = 1
	model_setting.GetGeminiSettings().ExplicitCacheTTLSeconds = 300
	defer func() {
		model_setting.GetGeminiSettings().CacheStrategy = prevStrategy
		model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens = prevMinTokens
		model_setting.GetGeminiSettings().ExplicitCacheTTLSeconds = prevTTL
		createCachedContentFunc = prevCreate
	}()

	createCalls := 0
	createCachedContentFunc = func(c *gin.Context, info *relaycommon.RelayInfo, prefixRequest *dto.GeminiChatRequest) (string, error) {
		createCalls++
		return "cachedContents/batch", nil
	}

	info := &relaycommon.RelayInfo{
		OriginModelName: "google/gemini-2.5-pro",
		RelayFormat:     types.RelayFormatGemini,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:         78,
			UpstreamModelName: "google/gemini-2.5-pro",
		},
	}

	for i := 0; i < 20; i++ {
		request := &dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{Role: "user", Parts: []dto.GeminiPart{{Text: "prefix " + repeatedText(7000)}}},
				{Role: "user", Parts: []dto.GeminiPart{{Text: fmt.Sprintf("tail-%d", i)}}},
			},
			SystemInstructions: &dto.GeminiChatContent{Parts: []dto.GeminiPart{{Text: "system"}}},
		}
		prepareExplicitCache(ctx, info, request)
		if request.CachedContent != "cachedContents/batch" {
			t.Fatalf("iteration %d expected cached content reuse, got %q", i, request.CachedContent)
		}
		if len(request.Contents) != 1 || request.Contents[0].Parts[0].Text != fmt.Sprintf("tail-%d", i) {
			t.Fatalf("iteration %d expected tail-only request, got %#v", i, request.Contents)
		}
	}

	if createCalls != 1 {
		t.Fatalf("expected exactly one cached content creation, got %d", createCalls)
	}
}

func repeatedText(n int) string {
	buf := make([]byte, 0, n*2)
	for i := 0; i < n; i++ {
		buf = append(buf, 'a', ' ')
	}
	return string(buf)
}
