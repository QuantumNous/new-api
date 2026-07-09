package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

type openRouterModelPrice struct {
	InputPrice         float64
	OutputPrice        float64
	CachePrice         float64
	CacheCreationPrice float64
}

// fetchOpenRouterChannelPricing loads per-model USD/1M prices from OpenRouter /v1/models.
// Returns true when at least one channel model was stored.
func fetchOpenRouterChannelPricing(ctx context.Context, channel *model.Channel) bool {
	if channel == nil || channel.Type != constant.ChannelTypeOpenRouter ||
		channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "" {
		return false
	}

	baseURL := strings.TrimRight(strings.TrimSpace(*channel.BaseURL), "/")
	url := baseURL + "/v1/models"
	key := firstAPIKey(channel.Key)
	if key == "" {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter requires API key", channel.Id))
		return false
	}

	body, status, err := doPricingGet(ctx, url, key)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter request: %v", channel.Id, err))
		return false
	}
	if status != 200 {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter returned HTTP %d", channel.Id, status))
		return false
	}

	priceByID, err := parseOpenRouterModelPrices(body)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter decode: %v", channel.Id, err))
		return false
	}
	if len(priceByID) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter returned no usable pricing", channel.Id))
		return false
	}

	channelModels := channelModelsFromList(channel.Models)
	if len(channelModels) == 0 {
		return false
	}

	now := time.Now().Unix()
	rows := make([]model.ChannelModelPricing, 0, len(channelModels))
	for _, localModel := range channelModels {
		upstream := ModelMappingTarget(channel.ModelMapping, localModel)
		candidates := []string{localModel}
		if upstream != "" {
			candidates = append([]string{upstream}, candidates...)
		}
		if !strings.Contains(localModel, "/") {
			candidates = append(candidates, "anthropic/"+localModel)
		}

		var matched *openRouterModelPrice
		var matchedID string
		for _, id := range uniqueNonEmpty(candidates) {
			if p, ok := priceByID[id]; ok {
				matched = &p
				matchedID = id
				break
			}
		}
		if matched == nil {
			logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter no price for local model %q", channel.Id, localModel))
			continue
		}
		cachePrice, cacheCreationPrice := fillMissingCachePricesFromOfficial(
			localModel,
			matched.InputPrice,
			matched.OutputPrice,
			matched.CachePrice,
			matched.CacheCreationPrice,
		)

		rows = append(rows, model.ChannelModelPricing{
			ChannelId:          channel.Id,
			ModelName:          localModel,
			InputPrice:         matched.InputPrice,
			OutputPrice:        matched.OutputPrice,
			CachePrice:         cachePrice,
			CacheCreationPrice: cacheCreationPrice,
			GroupRatio:         1,
			Currency:           "USD",
			PricingSource:      "api",
			FetchedAt:          now,
		})
		logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter %q ← %q input=%.4f output=%.4f",
			channel.Id, localModel, matchedID, matched.InputPrice, matched.OutputPrice))
	}

	if len(rows) == 0 {
		return false
	}
	if err := model.UpsertChannelModelPricings(rows); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter upsert: %v", channel.Id, err))
		return false
	}
	logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: OpenRouter stored %d model prices", channel.Id, len(rows)))
	return true
}

func parseOpenRouterModelPrices(body []byte) (map[string]openRouterModelPrice, error) {
	var resp struct {
		Data []struct {
			ID      string `json:"id"`
			Pricing struct {
				Prompt          string `json:"prompt"`
				Completion      string `json:"completion"`
				InputCacheRead  string `json:"input_cache_read"`
				InputCacheWrite string `json:"input_cache_write"`
			} `json:"pricing"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}

	out := make(map[string]openRouterModelPrice, len(resp.Data))
	for _, item := range resp.Data {
		if item.ID == "" {
			continue
		}
		prompt, promptOK := parseOpenRouterTokenUSD(item.Pricing.Prompt)
		completion, completionOK := parseOpenRouterTokenUSD(item.Pricing.Completion)
		if !promptOK && !completionOK {
			continue
		}
		if prompt < 0 || completion < 0 {
			continue
		}

		price := openRouterModelPrice{
			InputPrice:  prompt * 1_000_000,
			OutputPrice: completion * 1_000_000,
		}
		if cacheRead, ok := parseOpenRouterTokenUSD(item.Pricing.InputCacheRead); ok && cacheRead >= 0 {
			price.CachePrice = cacheRead * 1_000_000
		}
		if cacheWrite, ok := parseOpenRouterTokenUSD(item.Pricing.InputCacheWrite); ok && cacheWrite >= 0 {
			price.CacheCreationPrice = cacheWrite * 1_000_000
		}
		out[item.ID] = price
	}
	return out, nil
}

func parseOpenRouterTokenUSD(raw string) (float64, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

func channelModelsFromList(models string) []string {
	if strings.TrimSpace(models) == "" {
		return nil
	}
	out := make([]string, 0)
	for _, part := range strings.Split(models, ",") {
		if m := strings.TrimSpace(part); m != "" {
			out = append(out, m)
		}
	}
	return out
}

func uniqueNonEmpty(items []string) []string {
	seen := make(map[string]bool, len(items))
	out := make([]string, 0, len(items))
	for _, s := range items {
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}
