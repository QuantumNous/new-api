package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

// hub.romaapi.com is a relay-pricing aggregator. We use it as a fallback for
// channels whose own /api/pricing endpoint is unreachable (cookie-only auth,
// Cloudflare bot protection, or no endpoint at all).
var (
	hubBaseURL = common.GetEnvOrDefaultString("ROMA_HUB_URL", "https://hub.romaapi.com")
	hubAPIKey  = common.GetEnvOrDefaultString("ROMA_HUB_API_KEY",
		"a04993d06bcb87e2da77528452ee2b739738ddaaeb7fe62fc37e4054a8567eee")
)

// FetchChannelPricing calls {base_url}/api/pricing (public, no auth required)
// and stores per-model USD costs into channel_model_pricing.
// Actual cost = model_ratio × group_ratio[key_group] × $2/1M tokens.
// Errors are logged, not returned — this runs in a background goroutine.
func FetchChannelPricing(channel *model.Channel) {
	ctx := context.Background()
	if channel == nil || channel.BaseURL == nil || *channel.BaseURL == "" {
		return
	}

	if channel.Type == constant.ChannelTypeOpenRouter {
		if fetchOpenRouterChannelPricing(ctx, channel) {
			return
		}
		fetchModelPriceRatioFallback(ctx, channel)
		return
	}

	// Resolve the key_group + manual group-ratio fallback from the setting JSON.
	keyGroup := ExtractKeyGroup(channel.Setting)

	baseURL := strings.TrimRight(*channel.BaseURL, "/")
	url := baseURL + "/api/pricing"

	// Many newapi-compatible relays (e.g. rightcode) gate /api/pricing behind
	// Bearer auth and return 401 to anonymous requests. Try with the channel's
	// own API key first; if that fails non-auth-related, fall back to anonymous.
	firstKey := firstAPIKey(channel.Key)

	body, status, err := doPricingGet(ctx, url, firstKey)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: request: %v", channel.Id, err))
		fetchModelPriceRatioFallback(ctx, channel)
		return
	}
	if status == http.StatusUnauthorized && firstKey != "" {
		// Some sites reject Bearer for /api/pricing — retry anonymous.
		body, status, err = doPricingGet(ctx, url, "")
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: anon retry: %v", channel.Id, err))
			fetchModelPriceRatioFallback(ctx, channel)
			return
		}
	}
	if status != http.StatusOK {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: upstream returned HTTP %d", channel.Id, status))
		fetchModelPriceRatioFallback(ctx, channel)
		return
	}

	type pricingItem struct {
		ModelName         string  `json:"model_name"`
		QuotaType         int     `json:"quota_type"`          // 0=ratio-based 1=price-based
		ModelRatio        float64 `json:"model_ratio"`         // 1 ratio = $2/1M input tokens
		ModelPrice        float64 `json:"model_price"`         // direct USD/request (quota_type=1)
		CompletionRatio   float64 `json:"completion_ratio"`    // output/input multiplier
		CacheRatio        float64 `json:"cache_ratio"`         // cache-read / input multiplier
		CreateCacheRatio  float64 `json:"create_cache_ratio"`  // cache-write / input multiplier
	}
	type pricingResp struct {
		Success    *bool              `json:"success"`
		GroupRatio map[string]float64 `json:"group_ratio"`
		Data       []pricingItem      `json:"data"`
	}

	var parsed pricingResp
	if err := common.Unmarshal(body, &parsed); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: decode: %v", channel.Id, err))
		fetchModelPriceRatioFallback(ctx, channel)
		return
	}
	// Some sites (nekocode) return HTTP 200 + {"success":false,"message":"未登录"}
	// for cookie-only auth. Treat that as "no pricing available" — try fallback.
	if parsed.Success != nil && !*parsed.Success {
		logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: upstream returned success=false (likely auth required)", channel.Id))
		fetchModelPriceRatioFallback(ctx, channel)
		return
	}

	// Resolve group multiplier.
	// key_group must be set AND found in the API's group_ratio map to produce pricing.
	// - key_group empty                   → no API pricing; fall through to manual fallback
	// - key_group set + found in API map  → use upstream group_ratio value
	// - key_group set + NOT found         → misconfigured; clear stale rows + manual fallback
	if keyGroup == "" {
		logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: key_group not set — skipping API pricing", channel.Id))
		_ = model.DB.Where("channel_id = ?", channel.Id).Delete(&model.ChannelModelPricing{}).Error
		fetchModelPriceRatioFallback(ctx, channel)
		return
	}
	v, ok := parsed.GroupRatio[keyGroup]
	if !ok || v <= 0 {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: key_group=%q not found in group_ratio map %v — clearing stale pricing",
			channel.Id, keyGroup, keysOf(parsed.GroupRatio)))
		_ = model.DB.Where("channel_id = ?", channel.Id).Delete(&model.ChannelModelPricing{}).Error
		fetchModelPriceRatioFallback(ctx, channel)
		return
	}
	groupMul := v

	now := time.Now().Unix()
	rows := make([]model.ChannelModelPricing, 0, len(parsed.Data))
	for _, item := range parsed.Data {
		if item.ModelName == "" {
			continue
		}
		var inputPrice, outputPrice, cachePrice, cacheCreationPrice float64
		if item.QuotaType == 1 {
			inputPrice = item.ModelPrice * groupMul
		} else {
			inputPrice = item.ModelRatio * groupMul * 2
			outputPrice = item.ModelRatio * item.CompletionRatio * groupMul * 2
			if item.CacheRatio > 0 {
				cachePrice = item.ModelRatio * item.CacheRatio * groupMul * 2
			}
			if item.CreateCacheRatio > 0 {
				cacheCreationPrice = item.ModelRatio * item.CreateCacheRatio * groupMul * 2
			}
		}
		rows = append(rows, model.ChannelModelPricing{
			ChannelId:          channel.Id,
			ModelName:          item.ModelName,
			InputPrice:         inputPrice,
			OutputPrice:        outputPrice,
			CachePrice:         cachePrice,
			CacheCreationPrice: cacheCreationPrice,
			GroupRatio:         groupMul,
			Currency:           "USD",
			PricingSource:      "api",
			FetchedAt:          now,
		})
	}

	if len(rows) == 0 {
		logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: no pricing rows in response", channel.Id))
		// Fallback: if model_price_ratio is set, derive pricing from the unified 官方原价.
		fetchModelPriceRatioFallback(ctx, channel)
		return
	}

	if err := model.UpsertChannelModelPricings(rows); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: upsert: %v", channel.Id, err))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d] group=%q mul=%.3f: stored %d model prices",
		channel.Id, keyGroup, groupMul, len(rows)))
}

// fetchModelPriceRatioFallback handles channels priced via the operator-set
// model_price_ratio + manual_group_ratio (no upstream /api/pricing). It does
// NOT write a channel_model_pricings snapshot — that would freeze
// 渠道原价/采购价 at whatever 官方原价 was at write time, going stale the moment
// an admin edits 系统设置 → 模型定价 (silently under- or over-charging manual
// channels until someone remembers to click "刷新价格" again).
//
// Instead, any existing pricing_source='manual' row for this channel is
// deleted. Both display (controller.applyPublicManualPricingToRow) and
// billing (service.ChannelModelPriceData) treat a missing row as "resolve
// live" via LookupPublicManualPricing, which reads the current 官方原价 ×
// model_price_ratio × manual_group_ratio on every request — so manual
// channels track 官方原价 changes immediately, with no snapshot to go stale.
func fetchModelPriceRatioFallback(ctx context.Context, channel *model.Channel) {
	if ExtractManualGroupRatio(channel.Setting) <= 0 {
		return
	}
	if err := model.DB.Where("channel_id = ? AND pricing_source = ?", channel.Id, "manual").
		Delete(&model.ChannelModelPricing{}).Error; err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: clearing stale manual rows: %v", channel.Id, err))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: manual pricing now resolved live from 官方原价, cleared any stale snapshot rows", channel.Id))
}

// ── hub.romaapi.com pricing fallback ───────────────────────────────────────

type hubPricingEntry struct {
	Model      string  `json:"model"`
	GroupName  string  `json:"groupName"`
	InputPrice float64 `json:"inputPrice"`
}

type hubRelay struct {
	Name       string            `json:"name"`
	WebsiteUrl string            `json:"websiteUrl"`
	Pricing    []hubPricingEntry `json:"pricing"`
}

type hubResp struct {
	Relays []hubRelay `json:"relays"`
}

// normalizeHost reduces a URL to a bare comparable host: lowercased, scheme and
// path stripped, leading "www."/"api." removed.
func normalizeHost(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.TrimPrefix(s, "https://")
	s = strings.TrimPrefix(s, "http://")
	if i := strings.IndexAny(s, "/:"); i >= 0 {
		s = s[:i]
	}
	s = strings.TrimPrefix(s, "www.")
	s = strings.TrimPrefix(s, "api.")
	return s
}

// normalizeGroupName lowercases and normalizes punctuation variants so channel
// key_group values typed with halfwidth parens still match hub-scraped names
// that use fullwidth Chinese brackets (common on ddshub and similar relays).
func normalizeGroupName(s string) string {
	s = strings.TrimSpace(s)
	replacer := strings.NewReplacer(
		"（", "(",
		"）", ")",
		"【", "[",
		"】", "]",
		"　", " ",
	)
	return strings.ToLower(replacer.Replace(s))
}


// hub pricing is cached in-memory — the aggregator only refreshes every few
// minutes, and model-data should not pay a hub round-trip on every page load.
var (
	hubCacheMu  sync.Mutex
	hubCache    *hubResp
	hubCacheAt  time.Time
	hubCacheTTL = 5 * time.Minute
)

// GetHubPricing returns the full hub relay list, cached for hubCacheTTL.
func GetHubPricing(ctx context.Context) (*hubResp, error) {
	hubCacheMu.Lock()
	defer hubCacheMu.Unlock()
	if hubCache != nil && time.Since(hubCacheAt) < hubCacheTTL {
		return hubCache, nil
	}
	body, status, err := doPricingGet(ctx, hubBaseURL+"/api/v1/pricing/relays", hubAPIKey)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("hub returned HTTP %d", status)
	}
	var hub hubResp
	if err := common.Unmarshal(body, &hub); err != nil {
		return nil, fmt.Errorf("hub decode: %w", err)
	}
	hubCache = &hub
	hubCacheAt = time.Now()
	return hubCache, nil
}

// RefreshHubPricing clears the TTL cache and re-fetches the hub aggregator
// pricing immediately. Returns the relay count on success.
func RefreshHubPricing(ctx context.Context) (int, error) {
	hubCacheMu.Lock()
	hubCache = nil
	hubCacheAt = time.Time{}
	hubCacheMu.Unlock()
	hub, err := GetHubPricing(ctx)
	if err != nil {
		return 0, err
	}
	return len(hub.Relays), nil
}

// HubInputPrice returns the hub-listed inputPrice ($/1M, before recharge) for
// a channel+model, matched by host URL and then key_group == groupName.
// The caller multiplies by the channel's own recharge_rate for display.
// ok=false when the relay/model/group isn't found — caller renders "—".
func HubInputPrice(hub *hubResp, baseURL, keyGroup, modelName string) (price float64, ok bool) {
	if hub == nil {
		return 0, false
	}
	host := normalizeHost(baseURL)
	for i := range hub.Relays {
		if normalizeHost(hub.Relays[i].WebsiteUrl) != host {
			continue
		}
		for _, p := range hub.Relays[i].Pricing {
			if !strings.EqualFold(p.Model, modelName) {
				continue
			}
			if normalizeGroupName(p.GroupName) != normalizeGroupName(keyGroup) {
				continue
			}
			if p.InputPrice <= 0 {
				return 0, false
			}
			return p.InputPrice, true
		}
		return 0, false
	}
	return 0, false
}

// doPricingGet performs a single GET on the pricing URL, optionally with Bearer auth.
// Returns (body, status, err) where body is fully read.
func doPricingGet(ctx context.Context, url, bearer string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	const maxBody = 2 * 1024 * 1024
	buf := make([]byte, 0, 4096)
	chunk := make([]byte, 8192)
	for {
		n, rerr := resp.Body.Read(chunk)
		if n > 0 {
			if len(buf)+n > maxBody {
				buf = append(buf, chunk[:maxBody-len(buf)]...)
				break
			}
			buf = append(buf, chunk[:n]...)
		}
		if rerr != nil {
			break
		}
	}
	return buf, resp.StatusCode, nil
}

// firstAPIKey returns the first non-empty line from channel.Key (which may be
// newline-separated for multi-key channels).
func firstAPIKey(raw string) string {
	if idx := strings.IndexByte(raw, '\n'); idx >= 0 {
		return strings.TrimSpace(raw[:idx])
	}
	return strings.TrimSpace(raw)
}

// keysOf returns the keys of a map[string]float64 as a slice (for log messages).
func keysOf(m map[string]float64) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// ExtractKeyGroup reads the key_group field from channel.Setting JSON.
// Returns empty string if setting is nil or key_group is absent.
func ExtractKeyGroup(setting *string) string {
	if setting == nil || *setting == "" {
		return ""
	}
	var s struct {
		KeyGroup string `json:"key_group"`
	}
	if err := json.Unmarshal([]byte(*setting), &s); err != nil {
		return ""
	}
	return s.KeyGroup
}

// ExtractManualGroupRatio reads the operator-set manual_group_ratio fallback
// from channel.Setting JSON. Returns 0 when absent or unparseable — callers
// treat 0 as "no manual override".
func ExtractManualGroupRatio(setting *string) float64 {
	if setting == nil || *setting == "" {
		return 0
	}
	var s struct {
		ManualGroupRatio float64 `json:"manual_group_ratio"`
	}
	if err := json.Unmarshal([]byte(*setting), &s); err != nil {
		return 0
	}
	return s.ManualGroupRatio
}

// effectiveModelPriceRatio returns the multiplier for public_model_prices fallback.
// manual_group_ratio must already be > 0. model_price_ratio 0/absent defaults to 1.0
// when manual group is configured (operator expects manual fallback, not "disabled").
func effectiveModelPriceRatio(setting *string, manualGroupRatio float64) float64 {
	if manualGroupRatio <= 0 {
		return 0
	}
	ratio := ExtractModelPriceRatio(setting)
	if ratio <= 0 {
		return 1.0
	}
	return ratio
}

// PublicManualPricing holds USD/1M prices derived from 官方原价 (global ratio
// settings) × model_price_ratio × manual_group_ratio (used when upstream
// /api/pricing is unavailable).
type PublicManualPricing struct {
	InputPrice         float64
	OutputPrice        float64
	CachePrice         float64
	CacheCreationPrice float64
	GroupRatio         float64
	ModelPriceRatio    float64
}

// LookupPublicManualPricing resolves pricing for one model from the unified 官方原价
// and the channel's manual_group_ratio (+ optional model_price_ratio) settings.
func LookupPublicManualPricing(setting *string, modelName string) (PublicManualPricing, bool) {
	groupMul := ExtractManualGroupRatio(setting)
	if groupMul <= 0 {
		return PublicManualPricing{}, false
	}
	ratio := effectiveModelPriceRatio(setting, groupMul)

	official, ok := lookupOfficialModelPrice(modelName)
	if !ok {
		return PublicManualPricing{}, false
	}
	return PublicManualPricing{
		InputPrice:         official.InputPrice * ratio * groupMul,
		OutputPrice:        official.OutputPrice * ratio * groupMul,
		CachePrice:         official.CachePrice * ratio * groupMul,
		CacheCreationPrice: official.CacheCreationPrice * ratio * groupMul,
		GroupRatio:         groupMul,
		ModelPriceRatio:    ratio,
	}, true
}

// officialModelPrice holds the unified 官方原价 in USD/1M for one model.
type officialModelPrice struct {
	InputPrice         float64
	OutputPrice        float64
	CachePrice         float64
	CacheCreationPrice float64
}

// lookupOfficialModelPrice resolves the unified 官方原价 from the global ratio
// settings (系统设置 → 模型定价) — the same store /api/pricing serves.
func lookupOfficialModelPrice(modelName string) (officialModelPrice, bool) {
	in, out, cache, cacheCreation, ok := GlobalModelPricingUSD(modelName)
	if !ok || in <= 0 {
		return officialModelPrice{}, false
	}
	return officialModelPrice{
		InputPrice:         in,
		OutputPrice:        out,
		CachePrice:         cache,
		CacheCreationPrice: cacheCreation,
	}, true
}

// ExtractModelPriceRatio reads the model_price_ratio fallback from channel.Setting JSON.
// When > 0 and upstream has no /api/pricing, 官方原价 × this ratio is used.
// Returns 0 when absent — use effectiveModelPriceRatio when manual_group_ratio is set.
func ExtractModelPriceRatio(setting *string) float64 {
	if setting == nil || *setting == "" {
		return 0
	}
	var s struct {
		ModelPriceRatio float64 `json:"model_price_ratio"`
	}
	if err := json.Unmarshal([]byte(*setting), &s); err != nil {
		return 0
	}
	return s.ModelPriceRatio
}
