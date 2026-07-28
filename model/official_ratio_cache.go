/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package model

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// Official baseline for marketplace discount badges: models.dev public pricing.
// Same source as the upstream-sync preset "models.dev 价格预设".
// models.dev costs are USD per 1M tokens; converted with the local ratio formula:
//
//	model_ratio = input_usd_per_1M * USD / 1000   (= input / 2 when USD=500)
const officialRatioPresetURL = "https://models.dev/api.json"

// models.dev input cost → local model_ratio divisor (mirrors controller/ratio_sync.go).
const modelsDevInputCostRatioBase = 1000.0

const officialRatioCacheTTL = 6 * time.Hour

type officialRatioSnapshot struct {
	modelRatio map[string]float64
	modelPrice map[string]float64
	fetchedAt  time.Time
}

var (
	officialRatioMu    sync.RWMutex
	officialRatioCache *officialRatioSnapshot
)

// getOfficialRatioSnapshot returns a cached snapshot of models.dev pricing.
// On fetch failure it keeps the previous snapshot (if any) so pricing still works offline.
func getOfficialRatioSnapshot() *officialRatioSnapshot {
	officialRatioMu.RLock()
	cached := officialRatioCache
	officialRatioMu.RUnlock()
	if cached != nil && time.Since(cached.fetchedAt) < officialRatioCacheTTL {
		return cached
	}

	officialRatioMu.Lock()
	defer officialRatioMu.Unlock()
	if officialRatioCache != nil && time.Since(officialRatioCache.fetchedAt) < officialRatioCacheTTL {
		return officialRatioCache
	}

	next, err := fetchOfficialRatioSnapshot(context.Background())
	if err != nil {
		common.SysLog("models.dev official price fetch failed: " + err.Error())
		if officialRatioCache != nil {
			// Keep serving stale data; bump timestamp lightly so we don't hammer the remote.
			stale := *officialRatioCache
			stale.fetchedAt = time.Now().Add(-officialRatioCacheTTL + 15*time.Minute)
			officialRatioCache = &stale
			return officialRatioCache
		}
		return nil
	}
	officialRatioCache = next
	return officialRatioCache
}

func fetchOfficialRatioSnapshot(ctx context.Context) (*officialRatioSnapshot, error) {
	reqCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, officialRatioPresetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "boxai-pricing/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("models.dev HTTP %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, err
	}

	return parseModelsDevSnapshot(body)
}

// models.dev JSON: { "<provider>": { "models": { "<id>": { "cost": { "input", "output", ... } } } } }
type modelsDevProvider struct {
	Models map[string]modelsDevModel `json:"models"`
}

type modelsDevModel struct {
	Cost modelsDevCost `json:"cost"`
}

type modelsDevCost struct {
	Input  *float64 `json:"input"`
	Output *float64 `json:"output"`
}

type modelsDevCandidate struct {
	provider string
	input    float64 // USD per 1M tokens
}

func parseModelsDevSnapshot(body []byte) (*officialRatioSnapshot, error) {
	var upstream map[string]modelsDevProvider
	if err := common.Unmarshal(body, &upstream); err != nil {
		return nil, fmt.Errorf("decode models.dev: %w", err)
	}
	if len(upstream) == 0 {
		return nil, fmt.Errorf("empty models.dev response")
	}

	providers := make([]string, 0, len(upstream))
	for provider := range upstream {
		providers = append(providers, provider)
	}
	sort.Strings(providers)

	// model id → cheapest non-zero input cost across providers (same policy as ratio sync).
	selected := make(map[string]modelsDevCandidate)
	for _, provider := range providers {
		providerData := upstream[provider]
		if len(providerData.Models) == 0 {
			continue
		}
		modelNames := make([]string, 0, len(providerData.Models))
		for modelName := range providerData.Models {
			modelNames = append(modelNames, modelName)
		}
		sort.Strings(modelNames)

		for _, modelName := range modelNames {
			cost := providerData.Models[modelName].Cost
			if cost.Input == nil {
				continue
			}
			input := *cost.Input
			if math.IsNaN(input) || math.IsInf(input, 0) || input < 0 {
				continue
			}
			// input=0 with positive output cannot become a local ratio baseline.
			if input == 0 {
				if cost.Output != nil && *cost.Output > 0 {
					continue
				}
				// pure free models are not useful as discount baselines
				continue
			}

			next := modelsDevCandidate{provider: provider, input: input}
			current, exists := selected[modelName]
			if !exists || shouldPreferModelsDevCandidate(current, next) {
				selected[modelName] = next
			}
		}
	}

	if len(selected) == 0 {
		return nil, fmt.Errorf("no valid models.dev pricing entries found")
	}

	modelRatio := make(map[string]float64, len(selected))
	for modelName, candidate := range selected {
		// model_ratio = input_usd_per_1M * USD / 1000
		ratio := candidate.input * float64(ratio_setting.USD) / modelsDevInputCostRatioBase
		if ratio <= 0 || math.IsNaN(ratio) || math.IsInf(ratio, 0) {
			continue
		}
		modelRatio[modelName] = ratio
	}

	if len(modelRatio) == 0 {
		return nil, fmt.Errorf("no convertible models.dev ratios")
	}

	return &officialRatioSnapshot{
		modelRatio: modelRatio,
		// models.dev is token-cost oriented; fixed $/request baselines are not provided.
		modelPrice: map[string]float64{},
		fetchedAt:  time.Now(),
	}, nil
}

func shouldPreferModelsDevCandidate(current, next modelsDevCandidate) bool {
	// Prefer cheaper non-zero input; stable provider name tie-break.
	if !nearlyEqualFloat(next.input, current.input) {
		return next.input < current.input
	}
	return next.provider < current.provider
}

func nearlyEqualFloat(a, b float64) bool {
	const eps = 1e-9
	if a > b {
		return a-b < eps
	}
	return b-a < eps
}

func lookupOfficialValue(values map[string]float64, modelName string) (float64, bool) {
	if len(values) == 0 || modelName == "" {
		return 0, false
	}
	if v, ok := values[modelName]; ok {
		return v, true
	}
	// Prefer the bare leaf name (e.g. "moonshotai/Kimi-K3" → "Kimi-K3").
	if i := strings.LastIndex(modelName, "/"); i >= 0 && i+1 < len(modelName) {
		if v, ok := values[modelName[i+1:]]; ok {
			return v, true
		}
	}
	if i := strings.LastIndex(modelName, "."); i >= 0 && i+1 < len(modelName) {
		if v, ok := values[modelName[i+1:]]; ok {
			return v, true
		}
	}
	return 0, false
}

// computeAutoOfficialDiscount returns the marketplace discount percent of site
// price/ratio vs the official baseline. Returns 0 when no discount applies
// or the official baseline is missing.
func computeAutoOfficialDiscount(
	quotaType int,
	siteModelRatio float64,
	siteModelPrice float64,
	modelName string,
	official *officialRatioSnapshot,
) float64 {
	if official == nil {
		return 0
	}

	var site, baseline float64
	var ok bool
	if quotaType == 1 {
		// Fixed-price models: compare USD/request when we have an official price baseline.
		// models.dev rarely provides this; then no auto badge.
		site = siteModelPrice
		baseline, ok = lookupOfficialValue(official.modelPrice, modelName)
	} else {
		site = siteModelRatio
		baseline, ok = lookupOfficialValue(official.modelRatio, modelName)
	}
	if !ok || baseline <= 0 || site <= 0 || site >= baseline {
		return 0
	}

	percent := (1 - site/baseline) * 100
	if percent < 1 {
		return 0
	}
	if percent > 99.99 {
		percent = 99.99
	}
	// Two decimal places to match admin metadata validation / badge display.
	return math.Round(percent*100) / 100
}
