package autopricing

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"time"
)

// SourceID identifies a pricing source. The richer source model is also used
// by compatibility tooling and keeps provenance attached to every field.
type SourceID string

const (
	SourceModelsDev SourceID = "models.dev"
	SourceLiteLLM   SourceID = "litellm"
	SourceNewAPI    SourceID = "new-api"
	SourceOverride  SourceID = "override"
)

type FieldID string

const (
	FieldInput        FieldID = "input"
	FieldOutput       FieldID = "output"
	FieldCacheRead    FieldID = "cache_read"
	FieldCacheWrite5m FieldID = "cache_write_5m"
	FieldCacheWrite1h FieldID = "cache_write_1h"
	FieldBillingExpr  FieldID = "billing_expr"
)

type CostSet struct {
	Input        *float64 `json:"input,omitempty"`
	Output       *float64 `json:"output,omitempty"`
	CacheRead    *float64 `json:"cache_read,omitempty"`
	CacheWrite5m *float64 `json:"cache_write_5m,omitempty"`
	CacheWrite1h *float64 `json:"cache_write_1h,omitempty"`
	ImageInput   *float64 `json:"image_input,omitempty"`
	ImageOutput  *float64 `json:"image_output,omitempty"`
}

type PriceTier struct {
	Name           string  `json:"name"`
	MaxInputTokens int     `json:"max_input_tokens,omitempty"`
	Costs          CostSet `json:"costs"`
}

type PriceRecord struct {
	Model         string               `json:"model"`
	PrimarySource SourceID             `json:"primary_source"`
	Provider      string               `json:"provider,omitempty"`
	Standard      CostSet              `json:"standard"`
	Priority      CostSet              `json:"priority"`
	Flex          CostSet              `json:"flex"`
	PerRequest    *float64             `json:"per_request,omitempty"`
	Tiers         []PriceTier          `json:"tiers,omitempty"`
	BillingMode   string               `json:"billing_mode,omitempty"`
	BillingExpr   string               `json:"billing_expr,omitempty"`
	SourceURL     string               `json:"source_url,omitempty"`
	Reason        string               `json:"reason,omitempty"`
	ValidUntil    time.Time            `json:"valid_until,omitempty"`
	FieldSources  map[FieldID]SourceID `json:"field_sources,omitempty"`
}

type SourceCatalog struct {
	Source  SourceID               `json:"source"`
	Version string                 `json:"version"`
	Records map[string]PriceRecord `json:"records"`
}

func newSourceCatalog(source SourceID, version string) *SourceCatalog {
	return &SourceCatalog{Source: source, Version: version, Records: make(map[string]PriceRecord)}
}

func pricePtr(value float64) *float64 { return &value }

func ParseLiteLLMSource(data []byte, version string) (*SourceCatalog, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse LiteLLM source: %w", err)
	}
	source := newSourceCatalog(SourceLiteLLM, version)
	for model, body := range raw {
		if model == "" || model == "sample_spec" {
			continue
		}
		var entry struct {
			Input           *float64 `json:"input_cost_per_token"`
			Output          *float64 `json:"output_cost_per_token"`
			CacheRead       *float64 `json:"cache_read_input_token_cost"`
			CacheWrite5m    *float64 `json:"cache_creation_input_token_cost"`
			CacheWrite1h    *float64 `json:"cache_creation_input_token_cost_above_1hr"`
			PriorityInput   *float64 `json:"input_cost_per_token_priority"`
			PriorityOutput  *float64 `json:"output_cost_per_token_priority"`
			FlexInput       *float64 `json:"input_cost_per_token_flex"`
			FlexOutput      *float64 `json:"output_cost_per_token_flex"`
			ImageInput      *float64 `json:"input_cost_per_image_token"`
			ImageOutput     *float64 `json:"output_cost_per_image_token"`
			PerRequest      *float64 `json:"output_cost_per_image"`
			Above200kInput  *float64 `json:"input_cost_per_token_above_200k_tokens"`
			Above200kOutput *float64 `json:"output_cost_per_token_above_200k_tokens"`
		}
		if err := json.Unmarshal(body, &entry); err != nil || entry.Input == nil {
			continue
		}
		record := PriceRecord{Model: model, PrimarySource: SourceLiteLLM, FieldSources: make(map[FieldID]SourceID)}
		record.Standard = CostSet{Input: scaleTokenCost(entry.Input), Output: scaleTokenCost(entry.Output), CacheRead: scaleTokenCost(entry.CacheRead), CacheWrite5m: scaleTokenCost(entry.CacheWrite5m), CacheWrite1h: scaleTokenCost(entry.CacheWrite1h), ImageInput: scaleTokenCost(entry.ImageInput), ImageOutput: scaleTokenCost(entry.ImageOutput)}
		record.Priority = CostSet{Input: scaleTokenCost(entry.PriorityInput), Output: scaleTokenCost(entry.PriorityOutput)}
		record.Flex = CostSet{Input: scaleTokenCost(entry.FlexInput), Output: scaleTokenCost(entry.FlexOutput)}
		record.PerRequest = cloneFloat(entry.PerRequest)
		if entry.Above200kInput != nil || entry.Above200kOutput != nil {
			record.Tiers = []PriceTier{{Name: "standard", MaxInputTokens: 200000, Costs: record.Standard}, {Name: "long", Costs: CostSet{Input: scaleTokenCost(entry.Above200kInput), Output: scaleTokenCost(entry.Above200kOutput)}}}
		}
		setFieldSources(&record)
		source.Records[normalizeKey(model)] = record
	}
	if len(source.Records) == 0 {
		return nil, fmt.Errorf("LiteLLM source has no usable records")
	}
	return source, nil
}

func scaleTokenCost(value *float64) *float64 {
	if value == nil {
		return nil
	}
	out := *value * 1e6
	return &out
}

func ParseModelsDevSource(data []byte, version string) (*SourceCatalog, error) {
	var raw map[string]modelsDevProvider
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse models.dev source: %w", err)
	}
	source := newSourceCatalog(SourceModelsDev, version)
	providers := make([]string, 0, len(raw))
	for provider := range raw {
		providers = append(providers, provider)
	}
	sort.Strings(providers)
	selected := make(map[string]modelsDevCandidate)
	for _, provider := range providers {
		modelNames := make([]string, 0, len(raw[provider].Models))
		for model := range raw[provider].Models {
			modelNames = append(modelNames, model)
		}
		sort.Strings(modelNames)
		for _, model := range modelNames {
			candidate, ok := buildModelsDevCandidate(provider, raw[provider].Models[model].Cost)
			if !ok {
				continue
			}
			key := normalizeKey(model)
			if existing, ok := selected[key]; ok && !shouldReplaceModelsDevCandidate(existing, candidate) {
				continue
			}
			selected[key] = candidate
		}
	}
	for key, candidate := range selected {
		record := PriceRecord{Model: key, PrimarySource: SourceModelsDev, Provider: candidate.Provider, FieldSources: make(map[FieldID]SourceID)}
		record.Standard.Input = pricePtr(candidate.Input)
		record.Standard.Output = cloneFloat(candidate.Output)
		record.Standard.CacheRead = cloneFloat(candidate.CacheRead)
		setFieldSources(&record)
		source.Records[key] = record
	}
	if len(source.Records) == 0 {
		return nil, fmt.Errorf("models.dev source has no usable records")
	}
	return source, nil
}

func ParseNewAPISource(data []byte, version string) (*SourceCatalog, error) {
	var envelope struct {
		Data map[string]map[string]any `json:"data"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		return nil, err
	}
	source := newSourceCatalog(SourceNewAPI, version)
	models := map[string]map[string]any{}
	for field, values := range envelope.Data {
		for model, value := range values {
			if models[model] == nil {
				models[model] = map[string]any{}
			}
			models[model][field] = value
		}
	}
	for model, fields := range models {
		record := PriceRecord{Model: model, PrimarySource: SourceNewAPI, FieldSources: map[FieldID]SourceID{}}
		completion, hasCompletion := asNumber(fields["completion_ratio"])
		if input, ok := asNumber(fields["model_ratio"]); ok {
			record.Standard.Input = pricePtr(input * 2)
		}
		if hasCompletion && record.Standard.Input != nil {
			record.Standard.Output = pricePtr(*record.Standard.Input * completion)
		}
		if cache, ok := asNumber(fields["cache_ratio"]); ok && record.Standard.Input != nil {
			record.Standard.CacheRead = pricePtr(*record.Standard.Input * cache)
		}
		if mode, ok := fields["billing_mode"].(string); ok {
			record.BillingMode = mode
		}
		if expr, ok := fields["billing_expr"].(string); ok {
			record.BillingExpr = expr
		}
		setFieldSources(&record)
		source.Records[normalizeKey(model)] = record
	}
	if len(source.Records) == 0 {
		return nil, fmt.Errorf("new-api source has no usable records")
	}
	return source, nil
}

func asNumber(value any) (float64, bool) {
	switch v := value.(type) {
	case float64:
		return v, true
	case json.Number:
		n, err := v.Float64()
		return n, err == nil
	default:
		return 0, false
	}
}
func setFieldSources(record *PriceRecord) {
	for field, value := range map[FieldID]*float64{FieldInput: record.Standard.Input, FieldOutput: record.Standard.Output, FieldCacheRead: record.Standard.CacheRead, FieldCacheWrite5m: record.Standard.CacheWrite5m, FieldCacheWrite1h: record.Standard.CacheWrite1h} {
		if value != nil {
			record.FieldSources[field] = record.PrimarySource
		}
	}
	if record.BillingExpr != "" {
		record.FieldSources[FieldBillingExpr] = record.PrimarySource
	}
}

func recordToEntry(record PriceRecord) Entry {
	entry := Entry{CatalogKey: record.Model, Source: record.PrimarySource, FieldSources: record.FieldSources, BillingExpr: record.BillingExpr, HasBillingExpr: record.BillingExpr != ""}
	if record.Standard.Input != nil {
		entry.ModelRatio = *record.Standard.Input / 2
		entry.HasModelRatio = true
	}
	if record.Standard.Output != nil && record.Standard.Input != nil {
		if *record.Standard.Input == 0 {
			entry.CompletionRatio = 1
		} else {
			entry.CompletionRatio = *record.Standard.Output / *record.Standard.Input
		}
		entry.HasCompletionRatio = true
	}
	if record.Standard.CacheRead != nil && record.Standard.Input != nil {
		entry.CacheRatio = *record.Standard.CacheRead / *record.Standard.Input
		entry.HasCacheRatio = true
	}
	if record.Standard.CacheWrite5m != nil && record.Standard.Input != nil {
		entry.CreateCacheRatio = *record.Standard.CacheWrite5m / *record.Standard.Input
		entry.HasCreateCacheRatio = true
	}
	return entry
}

func MergeSources(sources ...*SourceCatalog) (*Catalog, error) {
	if len(sources) == 0 {
		return nil, fmt.Errorf("no pricing sources")
	}
	priority := map[SourceID]int{SourceModelsDev: 1, SourceLiteLLM: 2, SourceNewAPI: 3, SourceOverride: 4}
	records := make(map[string]PriceRecord)
	for _, source := range sources {
		if source == nil {
			continue
		}
		for key, candidate := range source.Records {
			current, exists := records[key]
			if !exists {
				records[key] = candidate
				continue
			}
			merged := current
			if priority[candidate.PrimarySource] > priority[current.PrimarySource] {
				merged.PrimarySource = candidate.PrimarySource
				merged.Model = candidate.Model
			}
			for field, value := range map[FieldID]*float64{FieldInput: candidate.Standard.Input, FieldOutput: candidate.Standard.Output, FieldCacheRead: candidate.Standard.CacheRead, FieldCacheWrite5m: candidate.Standard.CacheWrite5m, FieldCacheWrite1h: candidate.Standard.CacheWrite1h} {
				if value != nil && (merged.FieldSources[field] == "" || priority[candidate.PrimarySource] >= priority[merged.FieldSources[field]]) {
					assignCost(&merged.Standard, field, value)
					merged.FieldSources[field] = candidate.PrimarySource
				}
			}
			if candidate.BillingExpr != "" && (merged.BillingExpr == "" || priority[candidate.PrimarySource] >= priority[merged.FieldSources[FieldBillingExpr]]) {
				merged.BillingExpr = candidate.BillingExpr
				merged.BillingMode = candidate.BillingMode
				merged.FieldSources[FieldBillingExpr] = candidate.PrimarySource
			}
			if candidate.PerRequest != nil && merged.PerRequest == nil {
				merged.PerRequest = candidate.PerRequest
			}
			if len(candidate.Tiers) > 0 && len(merged.Tiers) == 0 {
				merged.Tiers = candidate.Tiers
			}
			records[key] = merged
		}
	}
	entries := make(map[string]Entry, len(records))
	for key, record := range records {
		entry := recordToEntry(record)
		if !entry.HasModelRatio {
			continue
		}
		entry.CatalogKey = record.Model
		entries[key] = entry
	}
	catalog := newCatalog(entries, mergedVersion(sources), 0)
	catalog.records = records
	return catalog, nil
}

func assignCost(cost *CostSet, field FieldID, value *float64) {
	switch field {
	case FieldInput:
		cost.Input = cloneFloat(value)
	case FieldOutput:
		cost.Output = cloneFloat(value)
	case FieldCacheRead:
		cost.CacheRead = cloneFloat(value)
	case FieldCacheWrite5m:
		cost.CacheWrite5m = cloneFloat(value)
	case FieldCacheWrite1h:
		cost.CacheWrite1h = cloneFloat(value)
	}
}
func mergedVersion(sources []*SourceCatalog) string {
	h := sha256.New()
	for _, source := range sources {
		if source != nil {
			h.Write([]byte(string(source.Source)))
			h.Write([]byte(source.Version))
		}
	}
	return "sha256:" + hex.EncodeToString(h.Sum(nil))
}

type PendingPriceChange struct{ Model, Fingerprint, Reason string }

func GuardCatalog(active, candidate *Catalog, threshold float64, rejected map[string]bool) (*Catalog, []PendingPriceChange, error) {
	if active == nil || candidate == nil {
		return candidate, nil, nil
	}
	pending := make([]PendingPriceChange, 0)
	accepted := make(map[string]Entry, len(candidate.entries))
	for key, candidateEntry := range candidate.entries {
		activeEntry, exists := active.entries[key]
		if !exists || candidateEntry.Source == SourceOverride {
			accepted[key] = candidateEntry
			continue
		}
		fingerprint := priceFingerprint(candidate.Version, key, candidateEntry)
		if rejected != nil && rejected[fingerprint] {
			accepted[key] = activeEntry
			continue
		}
		if record := candidate.records[key]; len(record.Tiers) != 0 && len(active.records[key].Tiers) == 0 {
			pending = append(pending, PendingPriceChange{Model: key, Fingerprint: fingerprint, Reason: "billing structure changed"})
			accepted[key] = activeEntry
			continue
		}
		if exceedsChange(activeEntry.ModelRatio, candidateEntry.ModelRatio, threshold) || exceedsChange(activeEntry.CompletionRatio, candidateEntry.CompletionRatio, threshold) {
			pending = append(pending, PendingPriceChange{Model: key, Fingerprint: fingerprint, Reason: "price change exceeds threshold"})
			accepted[key] = activeEntry
			continue
		}
		accepted[key] = candidateEntry
	}
	result := newCatalog(accepted, candidate.Version, candidate.SkippedCount)
	result.records = cloneRecords(candidate.records)
	result.reviewCandidates = make(map[string]Entry)
	for key, candidateEntry := range candidate.entries {
		if activeEntry, exists := active.entries[key]; exists && candidateEntry.Source != SourceOverride &&
			(exceedsChange(activeEntry.ModelRatio, candidateEntry.ModelRatio, threshold) || exceedsChange(activeEntry.CompletionRatio, candidateEntry.CompletionRatio, threshold) || (len(candidate.records[key].Tiers) != 0 && len(active.records[key].Tiers) == 0)) {
			result.reviewCandidates[key] = candidateEntry
		}
	}
	return result, pending, nil
}

func exceedsChange(current, next, threshold float64) bool {
	if current == next {
		return false
	}
	if current == 0 {
		return next != 0
	}
	diff := current - next
	if diff < 0 {
		diff = -diff
	}
	return diff/current > threshold
}
func priceFingerprint(version, model string, entry Entry) string {
	return fmt.Sprintf("%s:%s:%g:%g", version, model, entry.ModelRatio, entry.CompletionRatio)
}
func cloneRecords(records map[string]PriceRecord) map[string]PriceRecord {
	out := make(map[string]PriceRecord, len(records))
	for key, value := range records {
		out[key] = value
	}
	return out
}

func hasCosts(costs CostSet) bool {
	return costs.Input != nil || costs.Output != nil || costs.CacheRead != nil || costs.CacheWrite5m != nil || costs.CacheWrite1h != nil || costs.ImageInput != nil || costs.ImageOutput != nil
}

func ApplyReview(guarded *Catalog, pending []PendingPriceChange, approved []string, approve bool) (*Catalog, []PendingPriceChange, []string, error) {
	if guarded == nil {
		return nil, pending, nil, fmt.Errorf("catalog is nil")
	}
	approvedSet := make(map[string]bool)
	for _, model := range approved {
		approvedSet[normalizeKey(model)] = true
	}
	entries := make(map[string]Entry, len(guarded.entries))
	for key, value := range guarded.entries {
		entries[key] = value
	}
	remaining := make([]PendingPriceChange, 0)
	rejected := make([]string, 0)
	for _, change := range pending {
		if approve && approvedSet[normalizeKey(change.Model)] {
			continue
		}
		if !approve {
			rejected = append(rejected, change.Fingerprint)
		}
		remaining = append(remaining, change)
	}
	if approve {
		for model := range approvedSet {
			if entry, ok := guarded.reviewCandidates[model]; ok {
				entries[model] = entry
			}
		}
	} else {
		remaining = nil
	}
	return &Catalog{entries: entries, sortedKeys: append([]string(nil), guarded.sortedKeys...), baseIndex: guarded.baseIndex, Version: guarded.Version, UpdatedAt: guarded.UpdatedAt, ModelCount: guarded.ModelCount, SkippedCount: guarded.SkippedCount, records: cloneRecords(guarded.records), reviewCandidates: cloneEntries(guarded.reviewCandidates)}, remaining, rejected, nil
}

func cloneEntries(entries map[string]Entry) map[string]Entry {
	out := make(map[string]Entry, len(entries))
	for key, value := range entries {
		out[key] = value
	}
	return out
}

func LoadBuiltInOverrides(now time.Time) (*SourceCatalog, []string, error) {
	source := newSourceCatalog(SourceOverride, "built-in-2026-08-14")
	add := func(model string, input, output float64, expr, reason string) {
		record := PriceRecord{Model: model, PrimarySource: SourceOverride, Standard: CostSet{Input: pricePtr(input), Output: pricePtr(output)}, BillingExpr: expr, SourceURL: "builtin://reviewed-pricing", Reason: reason, ValidUntil: now.Add(365 * 24 * time.Hour), FieldSources: map[FieldID]SourceID{FieldInput: SourceOverride, FieldOutput: SourceOverride}}
		if expr != "" {
			record.FieldSources[FieldBillingExpr] = SourceOverride
		}
		source.Records[model] = record
	}
	addRich := func(model string, input, output float64, expr, reason string) {
		add(model, input, output, expr, reason)
		record := source.Records[model]
		record.Priority = CostSet{Input: pricePtr(input * 2), Output: pricePtr(output * 2)}
		record.Flex = CostSet{Input: pricePtr(input / 2), Output: pricePtr(output / 2)}
		if model == "gpt-5.6-sol" {
			record.Tiers = []PriceTier{{Name: "base", MaxInputTokens: 272000, Costs: record.Standard}, {Name: "long", Costs: CostSet{Input: pricePtr(input * 2), Output: pricePtr(output * 1.5)}}}
		}
		source.Records[model] = record
	}
	addRich("gpt-5.6-sol", 5, 30, "param(\"service_tier\") == \"priority\" || param(\"service_tier\") == \"fast\" ? tier(\"priority\", p * 10 + c * 60) : param(\"service_tier\") == \"flex\" ? tier(\"flex\", p * 2.5 + c * 15) : (len <= 272000 ? tier(\"base\", p * 5 + c * 30) : tier(\"long\", p * 10 + c * 45))", "reviewed official price")
	addRich("gpt-5.6-terra", 2, 12, "", "reviewed official price")
	addRich("gpt-5.6-"+"luna", 0.2, 1.2, "", "reviewed official price")
	addRich("gpt-5.4", 2.5, 15, "", "reviewed official price")
	addRich("gpt-5.5", 5, 30, "", "reviewed official price")
	add("gemini-2.5-pro", 1.25, 10, "", "reviewed official price")
	add("claude-opus-5", 5, 25, "cc1h > 0 ? cc1h * 16.25 : cc * 16.25", "reviewed official price")
	return source, nil, nil
}
