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
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Official ratio preset used by upstream sync UI ("官方倍率预设").
// Marketplace discount badges compare site ModelRatio/ModelPrice against this baseline.
const officialRatioPresetURL = "https://basellm.github.io/llm-metadata/api/newapi/ratio_config-v1-base.json"

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

// getOfficialRatioSnapshot returns a cached snapshot of the public official ratio preset.
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
		common.SysLog("official ratio preset fetch failed: " + err.Error())
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
	reqCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
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
		return nil, fmt.Errorf("official ratio preset HTTP %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 12<<20))
	if err != nil {
		return nil, err
	}

	var envelope struct {
		Success bool `json:"success"`
		Data    struct {
			ModelRatio map[string]any `json:"model_ratio"`
			ModelPrice map[string]any `json:"model_price"`
		} `json:"data"`
	}
	if err := common.Unmarshal(body, &envelope); err != nil {
		return nil, err
	}

	return &officialRatioSnapshot{
		modelRatio: toFloatMap(envelope.Data.ModelRatio),
		modelPrice: toFloatMap(envelope.Data.ModelPrice),
		fetchedAt:  time.Now(),
	}, nil
}

func toFloatMap(raw map[string]any) map[string]float64 {
	if len(raw) == 0 {
		return map[string]float64{}
	}
	out := make(map[string]float64, len(raw))
	for key, value := range raw {
		if f, ok := anyToFloat64(value); ok && f > 0 && !math.IsNaN(f) && !math.IsInf(f, 0) {
			out[key] = f
		}
	}
	return out
}

func anyToFloat64(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case uint:
		return float64(typed), true
	case uint64:
		return float64(typed), true
	case string:
		var f float64
		if _, err := fmt.Sscanf(typed, "%f", &f); err == nil {
			return f, true
		}
		return 0, false
	default:
		// encoding/json.Number and similar fmt.Stringer numeric types
		if stringer, ok := value.(interface{ Float64() (float64, error) }); ok {
			f, err := stringer.Float64()
			return f, err == nil
		}
		return 0, false
	}
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
// price/ratio vs the official preset baseline. Returns 0 when no discount applies
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
