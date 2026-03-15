package gemini

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
)

const geminiExplicitCacheNamespace = "new-api:gemini_explicit_cache:v1"

type explicitCacheEntry struct {
	Name string `json:"name"`
}

type createCachedContentRequest struct {
	Model             string                  `json:"model,omitempty"`
	Contents          []dto.GeminiChatContent `json:"contents,omitempty"`
	Tools             any                     `json:"tools,omitempty"`
	ToolConfig        *dto.ToolConfig         `json:"toolConfig,omitempty"`
	SystemInstruction *dto.GeminiChatContent  `json:"systemInstruction,omitempty"`
	TTL               string                  `json:"ttl,omitempty"`
}

type cachedContentResponse struct {
	Name string `json:"name,omitempty"`
}

var explicitCacheLocal sync.Map
var createCachedContentFunc = createGeminiCachedContent

func prepareExplicitCache(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) {
	if c == nil || info == nil || request == nil {
		return
	}
	if model_setting.GetGeminiSettings().CacheStrategy != model_setting.GeminiCacheStrategyExplicitCache {
		return
	}
	if strings.TrimSpace(request.CachedContent) != "" {
		service.UpdateGeminiCacheDiagnostics(c, map[string]any{"cache_action": "preconfigured_cached_content"})
		return
	}
	if len(request.Requests) > 0 || len(request.Contents) <= 1 {
		service.UpdateGeminiCacheDiagnostics(c, map[string]any{"cache_action": "skipped", "cache_reason": "insufficient_prefix"})
		return
	}

	prefixRequest, tail, ok := buildExplicitCachePrefix(request)
	if !ok {
		service.UpdateGeminiCacheDiagnostics(c, map[string]any{"cache_action": "skipped", "cache_reason": "insufficient_prefix"})
		return
	}
	prefixTokens, prefixHash, err := explicitCachePrefixMeta(info, prefixRequest)
	if err != nil {
		service.UpdateGeminiCacheDiagnostics(c, map[string]any{"cache_action": "skipped", "cache_reason": "prefix_hash_failed"})
		return
	}

	minTokens := model_setting.GetGeminiSettings().ExplicitCacheMinInputTokens
	if modelMin := service.GeminiImplicitCacheMinInputTokens(info.UpstreamModelName); modelMin > minTokens {
		minTokens = modelMin
	}
	service.UpdateGeminiCacheDiagnostics(c, map[string]any{"explicit_prefix_tokens": prefixTokens, "explicit_prefix_hash": prefixHash[:16], "explicit_cache_min_input_tokens": minTokens})
	if minTokens > 0 && prefixTokens < minTokens {
		service.UpdateGeminiCacheDiagnostics(c, map[string]any{"cache_action": "skipped", "cache_reason": "prefix_below_min_tokens"})
		return
	}

	cacheKey := explicitCacheRedisKey(info, prefixHash)
	if entry, ok := getExplicitCacheEntry(cacheKey); ok && strings.TrimSpace(entry.Name) != "" {
		applyExplicitCachedContent(request, tail, entry.Name)
		service.UpdateGeminiCacheDiagnostics(c, map[string]any{"cache_action": "reused", "cached_content_name": entry.Name})
		return
	}

	name, err := createCachedContentFunc(c, info, prefixRequest)
	if err != nil {
		logger.LogWarn(c, "create gemini cached content failed: "+err.Error())
		service.UpdateGeminiCacheDiagnostics(c, map[string]any{"cache_action": "create_failed", "cache_reason": err.Error()})
		return
	}

	putExplicitCacheEntry(cacheKey, explicitCacheEntry{Name: name}, explicitCacheTTL())
	applyExplicitCachedContent(request, tail, name)
	service.UpdateGeminiCacheDiagnostics(c, map[string]any{"cache_action": "created", "cached_content_name": name})
}

func buildExplicitCachePrefix(request *dto.GeminiChatRequest) (*dto.GeminiChatRequest, []dto.GeminiChatContent, bool) {
	if request == nil || len(request.Contents) <= 1 {
		return nil, nil, false
	}
	prefixRequest, err := common.DeepCopy(request)
	if err != nil {
		return nil, nil, false
	}
	tail := make([]dto.GeminiChatContent, 1)
	tail[0] = request.Contents[len(request.Contents)-1]
	prefixRequest.Contents = append([]dto.GeminiChatContent(nil), request.Contents[:len(request.Contents)-1]...)
	prefixRequest.CachedContent = ""
	return prefixRequest, tail, len(prefixRequest.Contents) > 0
}

func explicitCachePrefixMeta(info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (int, string, error) {
	body, err := common.Marshal(request)
	if err != nil {
		return 0, "", err
	}
	return service.CountTokenInput(string(body), info.UpstreamModelName), fmt.Sprintf("%x", common.Sha256Raw(body)), nil
}

func explicitCacheRedisKey(info *relaycommon.RelayInfo, prefixHash string) string {
	return fmt.Sprintf("%s:%d:%s:%s", geminiExplicitCacheNamespace, info.ChannelId, info.UpstreamModelName, prefixHash)
}

func explicitCacheTTL() time.Duration {
	ttlSeconds := model_setting.GetGeminiSettings().ExplicitCacheTTLSeconds
	if ttlSeconds <= 0 {
		ttlSeconds = 3600
	}
	return time.Duration(ttlSeconds) * time.Second
}

func getExplicitCacheEntry(key string) (explicitCacheEntry, bool) {
	if common.RedisEnabled && common.RDB != nil {
		if raw, err := common.RedisGet(key); err == nil && raw != "" {
			var entry explicitCacheEntry
			if err := common.UnmarshalJsonStr(raw, &entry); err == nil && entry.Name != "" {
				return entry, true
			}
		}
	}
	if raw, ok := explicitCacheLocal.Load(key); ok {
		if entry, ok := raw.(explicitCacheEntry); ok && entry.Name != "" {
			return entry, true
		}
	}
	return explicitCacheEntry{}, false
}

func putExplicitCacheEntry(key string, entry explicitCacheEntry, ttl time.Duration) {
	if entry.Name == "" {
		return
	}
	if common.RedisEnabled && common.RDB != nil {
		if data, err := common.Marshal(entry); err == nil {
			_ = common.RedisSet(key, string(data), ttl)
		}
	}
	explicitCacheLocal.Store(key, entry)
}

func applyExplicitCachedContent(request *dto.GeminiChatRequest, tail []dto.GeminiChatContent, cachedContent string) {
	request.CachedContent = cachedContent
	request.Contents = tail
	request.SystemInstructions = nil
	request.Tools = nil
	request.ToolConfig = nil
}

func createGeminiCachedContent(c *gin.Context, info *relaycommon.RelayInfo, prefixRequest *dto.GeminiChatRequest) (string, error) {
	if prefixRequest == nil {
		return "", fmt.Errorf("prefix request is nil")
	}
	version := model_setting.GetGeminiVersionSetting(info.UpstreamModelName)
	url := fmt.Sprintf("%s/%s/cachedContents", info.ChannelBaseUrl, version)

	var tools any
	if len(prefixRequest.Tools) > 0 {
		if err := common.Unmarshal(prefixRequest.Tools, &tools); err != nil {
			return "", fmt.Errorf("unmarshal tools failed: %w", err)
		}
	}
	body := createCachedContentRequest{
		Model:             fmt.Sprintf("models/%s", info.UpstreamModelName),
		Contents:          prefixRequest.Contents,
		Tools:             tools,
		ToolConfig:        prefixRequest.ToolConfig,
		SystemInstruction: prefixRequest.SystemInstructions,
		TTL:               fmt.Sprintf("%ds", int(explicitCacheTTL().Seconds())),
	}
	jsonData, err := common.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("marshal cached content request failed: %w", err)
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, url, bytes.NewReader(jsonData))
	if err != nil {
		return "", fmt.Errorf("new cached content request failed: %w", err)
	}
	headers := req.Header
	adaptor := &Adaptor{}
	if err := adaptor.SetupRequestHeader(c, &headers, info); err != nil {
		return "", fmt.Errorf("setup cached content header failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client, err := service.GetHttpClientWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return "", fmt.Errorf("get cached content client failed: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("create cached content request failed: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("cached content upstream status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var created cachedContentResponse
	if err := common.Unmarshal(respBody, &created); err != nil {
		return "", fmt.Errorf("decode cached content response failed: %w", err)
	}
	if strings.TrimSpace(created.Name) == "" {
		return "", fmt.Errorf("cached content response missing name")
	}
	return created.Name, nil
}
