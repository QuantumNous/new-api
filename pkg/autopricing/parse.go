package autopricing

import (
	"encoding/json"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
)

// ratioUnitUSDPerMillionTokens is the USD price that one Ren2Hub ratio unit
// represents per 1M tokens: 1 unit = $0.002 / 1K tokens = $2 / 1M tokens.
//
// setting/ratio_setting expresses the same unit as USD = 500 ($1 = 500 units),
// but that package imports this one, so the constant cannot be shared in that
// direction. TestRatioUnitMatchesRatioSetting in setting/ratio_setting pins the
// two definitions together.
const ratioUnitUSDPerMillionTokens = 2.0

// Upstream data is untrusted input that feeds quota arithmetic. Anything beyond
// these bounds is corruption rather than a real price, and is dropped instead of
// being clamped, so a bad catalog entry falls back to "not configured" rather
// than to a plausible-looking wrong charge.
const (
	maxModelRatio = 1e6
	maxMultiplier = 1e4
)

// litellmRawEntry is the subset of the LiteLLM catalog schema Ren2Hub prices
// with. Pointers distinguish an absent field from an explicit zero: an absent
// input cost means the entry is not token-priced, while an explicit zero means
// a free model.
type litellmRawEntry struct {
	InputCostPerToken           *float64 `json:"input_cost_per_token"`
	OutputCostPerToken          *float64 `json:"output_cost_per_token"`
	CacheReadInputTokenCost     *float64 `json:"cache_read_input_token_cost"`
	CacheCreationInputTokenCost *float64 `json:"cache_creation_input_token_cost"`
}

// BuildCatalog parses a LiteLLM pricing document into a catalog snapshot.
// version is the change token the document was fetched with (ETag or hash) and
// is echoed back through the status API.
func BuildCatalog(data []byte, version string) (*Catalog, error) {
	var raw map[string]json.RawMessage
	if err := common.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse pricing catalog: %w", err)
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("pricing catalog is empty")
	}

	entries := make(map[string]Entry, len(raw))
	skipped := 0
	for modelName, rawEntry := range raw {
		// sample_spec documents the schema and carries no real pricing.
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
		return nil, fmt.Errorf("pricing catalog has no usable token-priced entries")
	}
	return newCatalog(entries, version, skipped), nil
}

// convertEntry turns per-token USD costs into Ren2Hub ratios, reporting false
// when the entry cannot be expressed as a token ratio at all.
func convertEntry(raw litellmRawEntry) (Entry, bool) {
	// Image-only and metadata-only entries carry no token price. Treating them
	// as zero would bill token traffic at no cost.
	if raw.InputCostPerToken == nil && raw.OutputCostPerToken == nil {
		return Entry{}, false
	}

	input := 0.0
	if raw.InputCostPerToken != nil {
		input = *raw.InputCostPerToken
	}
	output := 0.0
	if raw.OutputCostPerToken != nil {
		output = *raw.OutputCostPerToken
	}
	if !validCost(input) || !validCost(output) {
		return Entry{}, false
	}

	if input == 0 {
		// A free input with a paid output cannot be expressed as an input ratio
		// plus a completion multiplier. Matches the existing models.dev rule in
		// controller/ratio_sync.go.
		if output > 0 {
			return Entry{}, false
		}
		return Entry{ModelRatio: 0, CompletionRatio: 1}, true
	}

	modelRatio := roundRatio(input * 1e6 / ratioUnitUSDPerMillionTokens)
	if modelRatio > maxModelRatio {
		return Entry{}, false
	}

	completionRatio := roundRatio(output / input)
	if completionRatio > maxMultiplier {
		return Entry{}, false
	}

	entry := Entry{
		ModelRatio:      modelRatio,
		CompletionRatio: completionRatio,
	}

	if raw.CacheReadInputTokenCost != nil && validCost(*raw.CacheReadInputTokenCost) {
		cacheRatio := roundRatio(*raw.CacheReadInputTokenCost / input)
		if cacheRatio > maxMultiplier {
			return Entry{}, false
		}
		entry.CacheRatio = cacheRatio
		entry.HasCacheRatio = true
	}

	if raw.CacheCreationInputTokenCost != nil && validCost(*raw.CacheCreationInputTokenCost) {
		createCacheRatio := roundRatio(*raw.CacheCreationInputTokenCost / input)
		if createCacheRatio > maxMultiplier {
			return Entry{}, false
		}
		entry.CreateCacheRatio = createCacheRatio
		entry.HasCreateCacheRatio = true
	}

	return entry, true
}

func validCost(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= 0
}

// roundRatio matches the precision used by the manual upstream ratio sync in
// controller/ratio_sync.go so both sources produce comparable numbers.
func roundRatio(value float64) float64 {
	return math.Round(value*1e6) / 1e6
}
