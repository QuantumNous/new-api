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
		// Fallback: if model_price_ratio is set, derive pricing from romaapi public prices.
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

// RefreshPublicModelPrices fetches the reference model prices from romaapi and
// upserts them into the public_model_prices table. Call this once at startup (if
// the table is empty) or via the admin "刷新公开价格" button.
func RefreshPublicModelPrices() error {
	ctx := context.Background()
	const romaURL = "https://api.romaapi.com/api/pricing"
	body, status, err := doPricingGet(ctx, romaURL, "")
	if err != nil || status != http.StatusOK {
		return fmt.Errorf("romaapi fetch failed (status=%d): %w", status, err)
	}

	type pricingItem struct {
		ModelName        string  `json:"model_name"`
		QuotaType        int     `json:"quota_type"`
		ModelRatio       float64 `json:"model_ratio"`
		ModelPrice       float64 `json:"model_price"`
		CompletionRatio  float64 `json:"completion_ratio"`
		CacheRatio       float64 `json:"cache_ratio"`
		CreateCacheRatio float64 `json:"create_cache_ratio"`
	}
	type pricingResp struct {
		Success *bool         `json:"success"`
		Data    []pricingItem `json:"data"`
	}
	var parsed pricingResp
	if err := common.Unmarshal(body, &parsed); err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	if parsed.Success != nil && !*parsed.Success {
		return fmt.Errorf("romaapi returned success=false")
	}

	now := time.Now().Unix()
	rows := make([]model.PublicModelPrice, 0, len(parsed.Data))
	for _, item := range parsed.Data {
		if item.ModelName == "" {
			continue
		}
		var inputPrice, outputPrice, cachePrice, cacheCreationPrice float64
		if item.QuotaType == 1 {
			inputPrice = item.ModelPrice
		} else {
			inputPrice = item.ModelRatio * 2
			outputPrice = item.ModelRatio * item.CompletionRatio * 2
			if item.CacheRatio > 0 {
				cachePrice = item.ModelRatio * item.CacheRatio * 2
			}
			if item.CreateCacheRatio > 0 {
				cacheCreationPrice = item.ModelRatio * item.CreateCacheRatio * 2
			}
		}
		rows = append(rows, model.PublicModelPrice{
			ModelName:          item.ModelName,
			ModelRatio:         item.ModelRatio,
			CompletionRatio:    item.CompletionRatio,
			CacheRatio:         item.CacheRatio,
			CreateCacheRatio:   item.CreateCacheRatio,
			QuotaType:          item.QuotaType,
			ModelPrice:         item.ModelPrice,
			InputPrice:         inputPrice,
			OutputPrice:        outputPrice,
			CachePrice:         cachePrice,
			CacheCreationPrice: cacheCreationPrice,
			FetchedAt:          now,
		})
	}
	if len(rows) == 0 {
		return fmt.Errorf("no pricing rows in response")
	}
	if err := model.UpsertPublicModelPrices(rows); err != nil {
		return fmt.Errorf("upsert: %w", err)
	}
	logger.LogInfo(context.Background(), fmt.Sprintf("public-model-prices: refreshed %d rows from romaapi", len(rows)))
	return nil
}

// fetchModelPriceRatioFallback uses the operator-set model_price_ratio to derive
// pricing from the cached public_model_prices table (populated by RefreshPublicModelPrices).
//
// Formula:
//   input_price  = public_input  × model_price_ratio × groupMul
//   output_price = public_output × model_price_ratio × groupMul
//   group_ratio  = groupMul  (shown in GRATIO column)
//   model_price  = input_price / group_ratio = public_input × model_price_ratio
//
// groupMul priority: manual_group_ratio > 1.0 default
func fetchModelPriceRatioFallback(ctx context.Context, channel *model.Channel) {
	ratio := ExtractModelPriceRatio(channel.Setting)
	if ratio <= 0 {
		return
	}

	// Both model_price_ratio AND manual_group_ratio must be set for the fallback
	// to produce pricing data. If group_ratio is missing, actual_price would be
	// computed as 0, which is worse than showing "—".
	groupMul := ExtractManualGroupRatio(channel.Setting)
	if groupMul <= 0 {
		return
	}

	// Read from DB cache; if empty try a one-time live fetch.
	pubPrices, err := model.GetAllPublicModelPrices()
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: model_price_ratio fallback: DB read: %v", channel.Id, err))
		return
	}
	if len(pubPrices) == 0 {
		logger.LogInfo(ctx, "channel-pricing: public_model_prices table empty, attempting one-time refresh from romaapi")
		if rerr := RefreshPublicModelPrices(); rerr != nil {
			logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: model_price_ratio fallback: refresh failed: %v", channel.Id, rerr))
			return
		}
		pubPrices, err = model.GetAllPublicModelPrices()
		if err != nil || len(pubPrices) == 0 {
			return
		}
	}

	// Only store pricing for models this channel actually serves.
	channelModels := make(map[string]bool)
	if channel.Models != "" {
		for _, m := range strings.Split(channel.Models, ",") {
			if t := strings.TrimSpace(m); t != "" {
				channelModels[t] = true
			}
		}
	}

	now := time.Now().Unix()
	rows := make([]model.ChannelModelPricing, 0)
	for _, pub := range pubPrices {
		if len(channelModels) > 0 && !channelModels[pub.ModelName] {
			continue
		}
		rows = append(rows, model.ChannelModelPricing{
			ChannelId:          channel.Id,
			ModelName:          pub.ModelName,
			InputPrice:         pub.InputPrice * ratio * groupMul,
			OutputPrice:        pub.OutputPrice * ratio * groupMul,
			CachePrice:         pub.CachePrice * ratio * groupMul,
			CacheCreationPrice: pub.CacheCreationPrice * ratio * groupMul,
			GroupRatio:         groupMul,
			Currency:           "USD",
			PricingSource:      "manual",
			FetchedAt:          now,
		})
	}

	if len(rows) == 0 {
		logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: model_price_ratio fallback: no matching models", channel.Id))
		return
	}
	if err := model.UpsertChannelModelPricings(rows); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: model_price_ratio fallback upsert: %v", channel.Id, err))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: model_price_ratio=%.3f groupMul=%.3f fallback: stored %d model prices from DB cache",
		channel.Id, ratio, groupMul, len(rows)))
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

// ExtractModelPriceRatio reads the model_price_ratio fallback from channel.Setting JSON.
// When > 0 and upstream has no /api/pricing, romaapi public prices × this ratio are used.
// Returns 0 when absent — callers treat 0 as "disabled".
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
