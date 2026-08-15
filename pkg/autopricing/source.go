package autopricing

import (
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// ParseLiteLLM parses the mirrored LiteLLM document into normalized entries.
func ParseLiteLLM(data []byte) (SourceEntries, int, error) {
	var raw map[string]json.RawMessage
	if err := common.Unmarshal(data, &raw); err != nil {
		return nil, 0, fmt.Errorf("parse LiteLLM pricing catalog: %w", err)
	}
	if len(raw) == 0 {
		return nil, 0, fmt.Errorf("LiteLLM pricing catalog is empty")
	}

	entries := make(SourceEntries, len(raw))
	skipped := 0
	for modelName, rawEntry := range raw {
		if modelName == "" || modelName == "sample_spec" {
			continue
		}
		var parsed litellmRawEntry
		if err := common.Unmarshal(rawEntry, &parsed); err != nil {
			skipped++
			continue
		}
		entry, ok := convertEntry(parsed)
		if !ok {
			skipped++
			continue
		}
		entry.CatalogKey = modelName
		entries[normalizeKey(modelName)] = entry
	}
	if len(entries) == 0 {
		return nil, skipped, fmt.Errorf("LiteLLM pricing catalog has no usable token-priced entries")
	}
	return entries, skipped, nil
}

type modelsDevProvider struct {
	Models map[string]modelsDevModel `json:"models"`
}

type modelsDevModel struct {
	Cost modelsDevCost `json:"cost"`
}

type modelsDevCost struct {
	Input     *float64 `json:"input"`
	Output    *float64 `json:"output"`
	CacheRead *float64 `json:"cache_read"`
}

type modelsDevCandidate struct {
	Provider  string
	Input     float64
	Output    *float64
	CacheRead *float64
}

// ParseModelsDev parses models.dev /api.json. Its prices are USD per million
// tokens, while Ren2Hub ratio units represent two USD per million tokens.
func ParseModelsDev(data []byte) (SourceEntries, int, error) {
	var upstream map[string]modelsDevProvider
	if err := common.Unmarshal(data, &upstream); err != nil {
		return nil, 0, fmt.Errorf("parse models.dev pricing catalog: %w", err)
	}
	if len(upstream) == 0 {
		return nil, 0, fmt.Errorf("models.dev pricing catalog is empty")
	}

	providers := make([]string, 0, len(upstream))
	for provider := range upstream {
		providers = append(providers, provider)
	}
	sort.Strings(providers)
	selected := make(map[string]modelsDevCandidate)
	skipped := 0
	for _, provider := range providers {
		modelNames := make([]string, 0, len(upstream[provider].Models))
		for modelName := range upstream[provider].Models {
			modelNames = append(modelNames, modelName)
		}
		sort.Strings(modelNames)
		for _, modelName := range modelNames {
			candidate, ok := buildModelsDevCandidate(provider, upstream[provider].Models[modelName].Cost)
			if !ok {
				skipped++
				continue
			}
			key := normalizeKey(modelName)
			current, exists := selected[key]
			if !exists || shouldReplaceModelsDevCandidate(current, candidate) {
				selected[key] = candidate
			}
		}
	}
	if len(selected) == 0 {
		return nil, skipped, fmt.Errorf("models.dev pricing catalog has no usable entries")
	}

	entries := make(SourceEntries, len(selected))
	for modelName, candidate := range selected {
		entry := Entry{CatalogKey: modelName, HasModelRatio: true}
		if candidate.Input == 0 {
			entry.ModelRatio = 0
			if candidate.Output != nil {
				entry.CompletionRatio = 1
				entry.HasCompletionRatio = true
			}
		} else {
			entry.ModelRatio = roundRatio(candidate.Input / 2)
			if candidate.Output != nil {
				entry.CompletionRatio = roundRatio(*candidate.Output / candidate.Input)
				entry.HasCompletionRatio = true
			}
		}
		if candidate.CacheRead != nil && candidate.Input > 0 {
			entry.CacheRatio = roundRatio(*candidate.CacheRead / candidate.Input)
			entry.HasCacheRatio = true
		}
		entries[modelName] = entry
	}
	return entries, skipped, nil
}

func buildModelsDevCandidate(provider string, cost modelsDevCost) (modelsDevCandidate, bool) {
	if cost.Input == nil || !validCost(*cost.Input) {
		return modelsDevCandidate{}, false
	}
	if cost.Output != nil && !validCost(*cost.Output) {
		return modelsDevCandidate{}, false
	}
	if cost.CacheRead != nil && !validCost(*cost.CacheRead) {
		return modelsDevCandidate{}, false
	}
	if *cost.Input == 0 && cost.Output != nil && *cost.Output > 0 {
		return modelsDevCandidate{}, false
	}
	return modelsDevCandidate{
		Provider:  provider,
		Input:     *cost.Input,
		Output:    cloneFloat(cost.Output),
		CacheRead: cloneFloat(cost.CacheRead),
	}, true
}

func shouldReplaceModelsDevCandidate(current, next modelsDevCandidate) bool {
	currentNonZero := current.Input > 0
	nextNonZero := next.Input > 0
	if currentNonZero != nextNonZero {
		return nextNonZero
	}
	if nextNonZero && next.Input != current.Input {
		return next.Input < current.Input
	}
	return next.Provider < current.Provider
}

func cloneFloat(value *float64) *float64 {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

// ConvertModelsDevToRatioData keeps the existing manual ratio-sync endpoint
// compatible while using the same parser as automatic pricing.
func ConvertModelsDevToRatioData(reader io.Reader) (map[string]any, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	entries, _, err := ParseModelsDev(data)
	if err != nil {
		return nil, err
	}
	modelRatios := make(map[string]any, len(entries))
	completionRatios := make(map[string]any)
	cacheRatios := make(map[string]any)
	keys := make([]string, 0, len(entries))
	for key := range entries {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		entry := entries[key]
		modelRatios[key] = entry.ModelRatio
		if entry.HasCompletionRatio {
			completionRatios[key] = entry.CompletionRatio
		}
		if entry.HasCacheRatio {
			cacheRatios[key] = entry.CacheRatio
		}
	}
	result := map[string]any{"model_ratio": modelRatios}
	if len(completionRatios) > 0 {
		result["completion_ratio"] = completionRatios
	}
	if len(cacheRatios) > 0 {
		result["cache_ratio"] = cacheRatios
	}
	return result, nil
}

// MergeKey normalizes source model keys for callers outside this package.
func MergeKey(model string) string {
	return strings.ToLower(strings.TrimSpace(model))
}
