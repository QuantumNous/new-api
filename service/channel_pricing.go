package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
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

	// Resolve the key_group from the channel's setting JSON.
	keyGroup := ExtractKeyGroup(channel.Setting)

	baseURL := strings.TrimRight(*channel.BaseURL, "/")
	url := baseURL + "/api/pricing"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: build request: %v", channel.Id, err))
		return
	}
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: request: %v", channel.Id, err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: upstream returned HTTP %d", channel.Id, resp.StatusCode))
		return
	}

	type pricingItem struct {
		ModelName       string  `json:"model_name"`
		QuotaType       int     `json:"quota_type"`       // 0=ratio-based 1=price-based
		ModelRatio      float64 `json:"model_ratio"`      // 1 ratio = $2/1M input tokens
		ModelPrice      float64 `json:"model_price"`      // direct USD/request (quota_type=1)
		CompletionRatio float64 `json:"completion_ratio"` // output/input multiplier
	}
	type pricingResp struct {
		GroupRatio map[string]float64 `json:"group_ratio"`
		Data       []pricingItem      `json:"data"`
	}

	var parsed pricingResp
	if err := common.DecodeJson(resp.Body, &parsed); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: decode: %v", channel.Id, err))
		return
	}

	// Resolve group multiplier (default 1.0 if key_group is empty or not found).
	groupMul := 1.0
	if keyGroup != "" {
		if v, ok := parsed.GroupRatio[keyGroup]; ok && v > 0 {
			groupMul = v
		}
	}

	now := time.Now().Unix()
	rows := make([]model.ChannelModelPricing, 0, len(parsed.Data))
	for _, item := range parsed.Data {
		if item.ModelName == "" {
			continue
		}
		var inputPrice, outputPrice float64
		if item.QuotaType == 1 {
			// price-based: ModelPrice is USD/request, store as-is for input, 0 for output
			inputPrice = item.ModelPrice * groupMul
		} else {
			// ratio-based: 1 ratio = $2/1M input tokens
			inputPrice = item.ModelRatio * groupMul * 2
			outputPrice = item.ModelRatio * item.CompletionRatio * groupMul * 2
		}
		rows = append(rows, model.ChannelModelPricing{
			ChannelId:   channel.Id,
			ModelName:   item.ModelName,
			InputPrice:  inputPrice,
			OutputPrice: outputPrice,
			Currency:    "USD",
			FetchedAt:   now,
		})
	}

	if len(rows) == 0 {
		logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d]: no pricing rows in response", channel.Id))
		return
	}

	if err := model.UpsertChannelModelPricings(rows); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("channel-pricing [%d]: upsert: %v", channel.Id, err))
		return
	}
	logger.LogInfo(ctx, fmt.Sprintf("channel-pricing [%d] group=%q mul=%.3f: stored %d model prices",
		channel.Id, keyGroup, groupMul, len(rows)))
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
